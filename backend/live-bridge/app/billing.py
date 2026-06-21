"""Stripe billing (#30) — Checkout, Customer Portal, and the webhook that is the
sole writer of a user's plan.

Design notes (verified against current Stripe guidance):
  - The webhook signature is verified with the raw request body. It takes NO auth
    (Stripe has no bearer token) and is excluded from the rate limiter so events
    are never dropped.
  - Events are processed idempotently: Stripe redelivers (retries, dashboard
    re-sends), so we claim each event id once (idempotency.claim_event) and
    release it on handler failure so a retry can reprocess.
  - The plan is derived from the subscription's price id, mapped via env, and the
    webhook is the ONLY place a paid plan is written (entitlements.set_plan).
  - All Stripe config is env/Secret-Manager driven; with nothing configured the
    endpoints return 503 cleanly, so shipping this is inert until set up.
"""

from __future__ import annotations

import json
import logging
import os

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request

import entitlements
import idempotency
from auth import require_claims

logger = logging.getLogger("ohmlet.billing")

router = APIRouter(prefix="/v1/billing", tags=["billing"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
APP_URL = os.getenv("OHMLET_APP_URL", "https://ohmlet.org").rstrip("/")

PAID_PLANS = ("pro", "max")
INTERVALS = ("monthly", "annual")


def _price_for(plan: str, interval: str) -> str | None:
    """The Stripe price id for a plan+interval, e.g. STRIPE_PRICE_PRO_ANNUAL."""
    return os.getenv(f"STRIPE_PRICE_{plan.upper()}_{interval.upper()}") or None


def _price_plan_map() -> dict[str, str]:
    """Reverse map: every configured price id -> its plan (for the webhook)."""
    m: dict[str, str] = {}
    for plan in PAID_PLANS:
        for interval in INTERVALS:
            pid = _price_for(plan, interval)
            if pid:
                m[pid] = plan
    return m


def _require_configured() -> None:
    if not stripe.api_key:
        raise HTTPException(status_code=503, detail="Billing is not configured yet.")


def _return_base(request: Request) -> str:
    """Where to send the browser after Checkout. Use the Origin the request came
    from (so localhost / preview / prod all return to themselves), falling back
    to the configured app URL. Only http(s) origins are accepted."""
    origin = (request.headers.get("origin") or "").rstrip("/")
    if origin.startswith("https://") or origin.startswith("http://"):
        return origin
    return APP_URL


# ── Checkout: start a subscription ──
# The body is read manually (not a typed param) so the auth dependency runs first
# and an unauthenticated call returns a clean 401, not a body-validation 422.
@router.post("/checkout")
async def create_checkout(request: Request, claims: dict = Depends(require_claims)) -> dict:
    _require_configured()
    uid = claims["uid"]
    email = claims.get("email")
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    plan = payload.get("plan")
    interval = payload.get("interval", "annual")
    if plan not in PAID_PLANS:
        raise HTTPException(422, f"plan must be one of {PAID_PLANS}")
    if interval not in INTERVALS:
        raise HTTPException(422, f"interval must be one of {INTERVALS}")
    price = _price_for(plan, interval)
    if not price:
        raise HTTPException(503, f"No price configured for {plan}/{interval}.")

    # Carry the UID on both the session and the subscription so the webhook can
    # resolve the user without a prior lookup.
    base = _return_base(request)
    kwargs = dict(
        mode="subscription",
        line_items=[{"price": price, "quantity": 1}],
        success_url=f"{base}/upgrade-success?plan={plan}&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{base}/pricing",
        client_reference_id=uid,
        metadata={"uid": uid, "plan": plan},
        subscription_data={"metadata": {"uid": uid, "plan": plan}},
        allow_promotion_codes=True,
    )
    existing = entitlements.get_customer(uid)
    if existing:
        kwargs["customer"] = existing
    elif email:
        kwargs["customer_email"] = email

    try:
        session = stripe.checkout.Session.create(**kwargs)
    except Exception as exc:
        logger.error("checkout create failed for %s: %s", uid, exc)
        raise HTTPException(502, "Could not start checkout.") from exc
    return {"url": session.url}


# ── Customer Portal: manage/cancel an existing subscription ──
@router.post("/portal")
def create_portal(request: Request, claims: dict = Depends(require_claims)) -> dict:
    _require_configured()
    uid = claims["uid"]
    customer = entitlements.get_customer(uid)
    if not customer:
        raise HTTPException(404, "No subscription to manage.")
    base = _return_base(request)
    try:
        session = stripe.billing_portal.Session.create(
            customer=customer, return_url=f"{base}/ohmlet-app?from=portal"
        )
    except Exception as exc:
        logger.error("portal create failed for %s: %s", uid, exc)
        raise HTTPException(502, "Could not open the billing portal.") from exc
    return {"url": session.url}


# ── Webhook: the only writer of paid plans ──
@router.post("/webhook")
async def webhook(request: Request) -> dict:
    if not WEBHOOK_SECRET:
        raise HTTPException(503, "Webhook is not configured yet.")
    payload = await request.body()  # RAW body required for signature verification
    sig = request.headers.get("stripe-signature", "")
    try:
        stripe.Webhook.construct_event(payload, sig, WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(400, "Invalid payload")
    except Exception:  # SignatureVerificationError (import path varies by SDK)
        raise HTTPException(400, "Invalid signature")

    # Signature is verified against the raw payload above. Work on a plain dict
    # (the SDK's StripeObject does not support .get()), so handler access is safe.
    event = json.loads(payload)

    key = f"stripe:{event['id']}"
    if not idempotency.claim_event(key):
        return {"status": "duplicate"}  # already processed; safe to ack
    try:
        _handle_event(event)
    except Exception:
        idempotency.release_event(key)  # let Stripe retry this delivery
        logger.exception("webhook handling failed for event %s", event.get("id"))
        raise HTTPException(500, "handler error")
    return {"status": "ok"}


def _resolve_uid(obj: dict) -> str | None:
    return (obj.get("metadata") or {}).get("uid") or entitlements.uid_for_customer(obj.get("customer"))


def _handle_event(event: dict) -> None:
    etype = event["type"]
    obj = event["data"]["object"]

    if etype == "checkout.session.completed":
        uid = obj.get("client_reference_id") or (obj.get("metadata") or {}).get("uid")
        customer = obj.get("customer")
        if uid and customer:
            entitlements.set_customer(uid, customer)
        logger.info("checkout completed: uid=%s customer=%s", uid, customer)
        return

    if etype in ("customer.subscription.created", "customer.subscription.updated"):
        uid = _resolve_uid(obj)
        customer = obj.get("customer")
        if uid and customer:
            entitlements.set_customer(uid, customer)
        status = obj.get("status")
        plan = "free"
        if status in ("active", "trialing"):
            items = (obj.get("items") or {}).get("data") or []
            price_id = items[0].get("price", {}).get("id") if items else None
            plan = _price_plan_map().get(price_id, "free")
        if uid:
            entitlements.set_plan(uid, plan)
            logger.info("subscription %s -> uid=%s plan=%s status=%s", etype, uid, plan, status)
        return

    if etype == "customer.subscription.deleted":
        uid = _resolve_uid(obj)
        if uid:
            entitlements.set_plan(uid, "free")
            logger.info("subscription deleted -> uid=%s downgraded to free", uid)
        return

    logger.info("ignoring unhandled stripe event: %s", etype)
