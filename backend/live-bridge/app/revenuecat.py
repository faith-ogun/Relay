"""RevenueCat webhook: the only way an iOS purchase becomes an entitlement.

Without this, a purchase on the phone charges the card and grants nothing. The
App Store takes the money, RevenueCat records the subscription, and our
`ohmlet_plans` document is never written, so the learner stays capped at the free
tier's 60 live minutes while paying for 10 or 30 hours. Stripe's webhook covers
the web the same way; this is its counterpart.

Trust model, mirroring the Stripe handler:

  - The shared secret is compared in constant time. RevenueCat authenticates by
    sending a header value you configure, so a timing-safe compare is the whole
    of the authentication and a `==` would leak it a byte at a time.
  - Every event is claimed through the idempotency store before it is applied.
    RevenueCat retries on any non-2xx, so a handler that is not idempotent will
    eventually double-apply a renewal.
  - The plan is derived from the ENTITLEMENT ids RevenueCat reports, never from
    anything the app sends. A client cannot ask for a tier.
"""

from __future__ import annotations

import hmac
import logging
import os
from typing import Any

from fastapi import APIRouter, HTTPException, Request

import entitlements
import idempotency
import obs

logger = logging.getLogger("ohmlet.revenuecat")

router = APIRouter(prefix="/v1/billing/revenuecat", tags=["billing"])

WEBHOOK_SECRET = os.getenv("OHMLET_REVENUECAT_WEBHOOK_SECRET", "")

# Sandbox purchases cost nothing. RevenueCat stamps every event with an
# `environment`, and ignoring it means an Apple sandbox tester can grant
# themselves Max for free, in production Firestore, forever.
#
# Refusing by default is the safe direction, but refusing ALWAYS would make the
# end-to-end test unverifiable: a purchase on the phone would reach RevenueCat
# and stop, and "the webhook fired" is not the same evidence as "the learner's
# plan changed". So it is an explicit switch, on while testing and off at launch.
#
# Plans granted this way are stamped `environment: SANDBOX` on the document, so
# they can be found and swept rather than living on indistinguishable from a
# plan somebody paid for.
ACCEPT_SANDBOX = os.getenv("OHMLET_ACCEPT_SANDBOX_BILLING", "").strip().lower() in ("1", "true", "yes")

# Entitlement identifier in RevenueCat -> our plan. Highest wins when a user
# somehow holds more than one, so a mapping change can never silently downgrade.
ENTITLEMENT_TO_PLAN: dict[str, str] = {
    "max": "max",
    "pro": "pro",
}
PLAN_RANK = {"free": 0, "pro": 1, "max": 2}

# Events that mean "this person currently has the entitlement".
GRANTING = {
    "INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE",
    "NON_RENEWING_PURCHASE", "SUBSCRIPTION_EXTENDED", "TEMPORARY_ENTITLEMENT_GRANT",
}
# Events that mean access has actually ended. CANCELLATION is deliberately NOT
# here: it means auto-renew was switched off, and the person keeps what they paid
# for until the period ends, at which point EXPIRATION arrives.
REVOKING = {"EXPIRATION", "SUBSCRIPTION_PAUSED"}


def _plan_from_entitlements(ids: list[str]) -> str:
    best = "free"
    for e in ids or []:
        plan = ENTITLEMENT_TO_PLAN.get(str(e).lower())
        if plan and PLAN_RANK[plan] > PLAN_RANK[best]:
            best = plan
    return best


def _authorised(request: Request) -> bool:
    supplied = request.headers.get("authorization", "")
    return hmac.compare_digest(supplied, WEBHOOK_SECRET)


@router.post("")
async def webhook(request: Request) -> dict:
    if not WEBHOOK_SECRET:
        # Refusing is the safe failure: an unauthenticated endpoint that grants
        # plans is worse than one that is temporarily unavailable.
        raise HTTPException(503, "RevenueCat webhook is not configured yet.")
    if not _authorised(request):
        obs.audit("billing.revenuecat_webhook_rejected")
        raise HTTPException(401, "Invalid signature")

    try:
        body: dict[str, Any] = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid payload")

    event = body.get("event") or {}
    event_id = str(event.get("id") or "")
    event_type = str(event.get("type") or "").upper()
    uid = str(event.get("app_user_id") or "")

    if not event_id or not uid:
        raise HTTPException(422, "Event is missing an id or an app_user_id.")

    # An anonymous id means the app configured RevenueCat without our uid, so the
    # purchase cannot be attributed. Loud, because someone has paid.
    if uid.startswith("$RCAnonymousID:"):
        logger.error("RevenueCat event %s for an anonymous user; purchase unattributable", event_id)
        obs.audit("billing.revenuecat_anonymous", eventId=event_id, eventType=event_type)
        return {"status": "ignored", "reason": "anonymous_app_user_id"}

    # SANDBOX or PRODUCTION. Absent on older payloads, which are treated as
    # production: the unknown case must not be the free one.
    environment = str(event.get("environment") or "PRODUCTION").upper()
    if environment != "PRODUCTION" and not ACCEPT_SANDBOX:
        logger.warning("RevenueCat %s event refused: sandbox billing is off", environment)
        obs.audit("billing.revenuecat_sandbox_refused", eventId=event_id, eventType=event_type)
        return {"status": "ignored", "reason": "sandbox"}

    key = f"revenuecat:{event_id}"
    if not idempotency.claim_event(key):
        return {"status": "duplicate"}

    try:
        if event_type in GRANTING:
            plan = _plan_from_entitlements(event.get("entitlement_ids") or [])
            if plan == "free":
                logger.warning(
                    "RevenueCat %s for %s carried no known entitlement: %s",
                    event_type, uid, event.get("entitlement_ids"),
                )
            entitlements.set_plan(uid, plan, environment=environment)
            obs.audit("billing.plan_granted", uid=uid, plan=plan, source="revenuecat", eventType=event_type)

        elif event_type in REVOKING:
            entitlements.set_plan(uid, "free", environment=environment)
            obs.audit("billing.plan_revoked", uid=uid, source="revenuecat", eventType=event_type)

        elif event_type == "TRANSFER":
            # The entitlement moved to another app_user_id. The gaining user is
            # granted by their own event; the losing ones are dropped here so a
            # shared login cannot leave a paid plan behind on both accounts.
            for lost in event.get("transferred_from") or []:
                if not str(lost).startswith("$RCAnonymousID:"):
                    entitlements.set_plan(str(lost), "free")
            obs.audit("billing.plan_transferred", uid=uid, source="revenuecat")

        else:
            # BILLING_ISSUE, CANCELLATION and the rest are recorded but change
            # nothing: access ends at EXPIRATION, not when a card fails or when
            # auto-renew is switched off.
            logger.info("RevenueCat %s for %s recorded, no plan change", event_type, uid)

    except Exception:
        idempotency.release_event(key)   # let RevenueCat retry this delivery
        raise

    return {"status": "ok"}
