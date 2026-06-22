"""GDPR / privacy rights (#34) — data export and account deletion.

Built to the most stringent standard (GDPR Art. 15 access, Art. 20 portability,
Art. 17 erasure), which in practice also satisfies CCPA/CPRA (California), LGPD
(Brazil), PIPEDA (Canada) and Australia's APPs — they converge on the same core
rights. Both endpoints derive the UID from the verified token, never the client,
so a user can only export or delete THEIR OWN data.

Lawful-retention note (GDPR Art. 17(3)(b)): payment/tax records are exempt from
erasure. Deletion cancels the subscription and removes our personal data + the
Firebase Auth user; Stripe retains the transaction records it is legally required
to keep. That is compliant, not a gap.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request

import entitlements
from auth import _ensure_app, require_claims

logger = logging.getLogger("ohmlet.privacy")

router = APIRouter(prefix="/v1/me", tags=["privacy"])

STATE_COLLECTION = os.getenv("OHMLET_STATE_COLLECTION", "ohmlet_state")
USAGE_COLLECTION = os.getenv("OHMLET_USAGE_COLLECTION", "usage_sessions")

if not stripe.api_key:
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")


def _client():
    from state_store import get_client  # lazy: avoid circular import at module load

    return get_client()


def _profile(uid: str) -> dict:
    """Identity fields from Firebase Auth (best-effort)."""
    try:
        _ensure_app()
        from firebase_admin import auth as fb_auth

        u = fb_auth.get_user(uid)
        meta = u.user_metadata
        return {
            "email": u.email,
            "displayName": u.display_name,
            "emailVerified": u.email_verified,
            "createdAt": getattr(meta, "creation_timestamp", None),
            "lastSignInAt": getattr(meta, "last_sign_in_timestamp", None),
            "providers": [p.provider_id for p in (u.provider_data or [])],
        }
    except Exception as exc:
        logger.warning("profile fetch failed for %s: %s", uid, exc)
        return {}


def _budget_docs(client, uid: str):
    """All monthly live-usage docs for the user (ids are '<uid>_<YYYY-MM>')."""
    prefix = f"{uid}_"
    return [d for d in client.collection(entitlements.BUDGET_COLLECTION).list_documents() if d.id.startswith(prefix)]


# ── Export: everything we hold about the user (Art. 15 + 20) ──
@router.get("/export")
def export_data(claims: dict = Depends(require_claims)) -> dict:
    uid = claims["uid"]
    client = _client()
    out: dict = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "userId": uid,
        "profile": _profile(uid),
        "plan": {},
        "progress": {},
        "liveUsage": [],
        "usageSessions": [],
        "billing": {},
        "notice": (
            "This is all personal data Ohmlet holds about you. Payment and tax "
            "records held by our payment processor (Stripe) are retained as "
            "required by law and are not included here."
        ),
    }

    plan_snap = client.collection(entitlements.PLANS_COLLECTION).document(uid).get()
    if plan_snap.exists:
        plan = plan_snap.to_dict() or {}
        out["plan"] = {k: v for k, v in plan.items() if k != "stripeCustomerId"}
        if plan.get("stripeCustomerId"):
            out["billing"] = {"stripeCustomerId": plan["stripeCustomerId"]}

    state_snap = client.collection(STATE_COLLECTION).document(uid).get()
    if state_snap.exists:
        out["progress"] = state_snap.to_dict()

    for d in _budget_docs(client, uid):
        snap = d.get()
        if snap.exists:
            out["liveUsage"].append({"period": d.id, **(snap.to_dict() or {})})

    try:
        for doc in client.collection(USAGE_COLLECTION).where("user_id", "==", uid).stream():
            out["usageSessions"].append(doc.to_dict())
    except Exception as exc:
        logger.warning("usage export failed for %s: %s", uid, exc)

    return out


# ── Delete: erase everything (Art. 17, right to be forgotten) ──
@router.post("/delete")
async def delete_account(request: Request, claims: dict = Depends(require_claims)) -> dict:
    uid = claims["uid"]
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not (isinstance(body, dict) and body.get("confirm")):
        raise HTTPException(400, "Account deletion must be explicitly confirmed.")

    client = _client()
    customer = entitlements.get_customer(uid)

    # 1) Stop billing: cancel subscriptions, then delete the Stripe customer.
    #    (Stripe still keeps the invoices/charges it must retain for tax law.)
    if customer and stripe.api_key:
        try:
            for sub in stripe.Subscription.list(customer=customer, status="all").auto_paging_iter():
                if sub.get("status") in ("active", "trialing", "past_due", "unpaid"):
                    stripe.Subscription.cancel(sub.id)
            stripe.Customer.delete(customer)
        except Exception as exc:
            logger.warning("stripe cleanup failed for %s (continuing erasure): %s", uid, exc)

    # 2) Erase our personal data across every collection.
    deleted = []
    for coll, doc_id in (
        (entitlements.PLANS_COLLECTION, uid),
        (STATE_COLLECTION, uid),
        (entitlements.CUSTOMERS_COLLECTION, customer),
    ):
        if doc_id:
            try:
                client.collection(coll).document(doc_id).delete()
                deleted.append(coll)
            except Exception as exc:
                logger.warning("delete %s/%s failed: %s", coll, doc_id, exc)

    for d in _budget_docs(client, uid):
        try:
            d.delete()
        except Exception as exc:
            logger.warning("budget delete %s failed: %s", d.id, exc)

    try:
        for doc in client.collection(USAGE_COLLECTION).where("user_id", "==", uid).stream():
            doc.reference.delete()
    except Exception as exc:
        logger.warning("usage delete failed for %s: %s", uid, exc)

    # 3) Remove the identity itself (revokes all sessions).
    try:
        _ensure_app()
        from firebase_admin import auth as fb_auth

        fb_auth.delete_user(uid)
        deleted.append("auth")
    except Exception as exc:
        logger.error("auth user delete failed for %s: %s", uid, exc)
        raise HTTPException(502, "Could not fully delete the account; please contact support.") from exc

    logger.info("account erased: uid=%s collections=%s", uid, deleted)
    return {"status": "deleted", "deletedAt": datetime.now(timezone.utc).isoformat()}
