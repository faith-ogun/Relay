"""Server-side entitlements — the real gate for plan-based access and cost.

The browser also gates the UI (frontend/components/ohmlet/entitlements.ts), but
that is only for UX: a determined user can edit client state, so the server must
enforce the same contract independently. This module is the backend half.

Two jobs:
  1. Live-tutor budget: how many minutes/day a plan includes, tracked per user
     per day in Firestore so it survives across sessions and reconnects.
  2. Model routing: whether a plan gets the premium (Pro) models for the
     expensive code/reasoning tools, so a Free session can't quietly burn
     Pro-model spend.

Plan source: a per-user doc in `ohmlet_plans` ({"plan": "pro"}). A Stripe webhook
will write that doc later; until then it simply defaults to "free", which is the
correct safe default and needs no billing wired.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger("ohmlet.entitlements")

VALID_PLANS = ("free", "pro", "max")

# Monthly live-tutor budget per plan (minutes).
#
# CUT on 2026-08-28, from 60/600/1800, because the old caps lost money at full
# utilisation and the loss grew with the price of the tier. Faith's call, on the
# arithmetic below.
#
# The cost of a paid minute, with the token rates now set honestly in
# usage_meter.py (they defaulted to ZERO for tokens, which hid the Pro-model
# spend entirely):
#
#     audio      $0.037 / min
#     video      $0.012 / min   (1 frame/sec at $0.0002)
#     tokens     ~$0.004 / min amortised, from Pro-routed tool calls
#     ---------------------------------
#     TOTAL      ~$0.053 / min
#
# Net revenue, after Apple's 15% under the Small Business Program (the worse
# case is 30% off-programme, which tightens all of this further):
#
#     Pro   $15.99 -> $13.59 net -> break-even at 256 min
#     Max   $34.99 -> $29.74 net -> break-even at 561 min
#
# The caps sit just under break-even, so a learner who burns their ENTIRE budget
# still contributes a little rather than costing us money. Everyone below the cap
# is profitable, and the cap is a ceiling on loss rather than a target.
#
#     Free   60 min ->  $3.18 cost. Unchanged: this is CAC, and activation
#                       depends on it. See the note below.
#     Pro   240 min -> $12.72 cost against $13.59 net
#     Max   540 min -> $28.62 cost against $29.74 net
#
# The Pro to Max step is now 2.25x rather than 3x, and that is the right
# direction: Max's reason to exist is Interview Mode and the career features,
# not a bigger number of minutes. A tier differentiated only by quantity is one
# most subscribers never have a reason to reach for.
#
# FREE IS DELIBERATELY UNCHANGED, and it rests on an assumption nobody has
# tested: that 60 minutes covers one real first build including a beginner's
# mis-wires. Session duration is instrumented (usage_meter.duration_seconds) but
# there is no production data yet. If that assumption is wrong, the free tier is
# stringent in the one place it must not be. Run scripts/first_build.py.
#
# Every value is env-tunable, so a cap can be changed without a deploy.
LIVE_MINUTES_PER_MONTH: dict[str, float] = {
    "free": float(os.getenv("OHMLET_LIVE_MIN_FREE", "60")),
    "pro": float(os.getenv("OHMLET_LIVE_MIN_PRO", "240")),   # 4 hours
    "max": float(os.getenv("OHMLET_LIVE_MIN_MAX", "540")),   # 9 hours
}

# Plans that get the premium models for code gen / deep reasoning tools.
_PRIORITY_PLANS = {"pro", "max"}

PLANS_COLLECTION = os.getenv("OHMLET_PLANS_COLLECTION", "ohmlet_plans")
BUDGET_COLLECTION = os.getenv("OHMLET_LIVE_BUDGET_COLLECTION", "ohmlet_live_budget")
# Maps a Stripe customer id -> our UID, so a webhook (which knows the customer)
# can resolve the user even when metadata is absent.
CUSTOMERS_COLLECTION = os.getenv("OHMLET_STRIPE_CUSTOMERS_COLLECTION", "ohmlet_stripe_customers")


def normalize_plan(value: object) -> str:
    return value if value in VALID_PLANS else "free"


def live_cap_minutes(plan: str) -> float:
    return LIVE_MINUTES_PER_MONTH.get(normalize_plan(plan), LIVE_MINUTES_PER_MONTH["free"])


def has_priority_models(plan: str) -> bool:
    return normalize_plan(plan) in _PRIORITY_PLANS


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _period() -> str:
    """The budget window the caps reset on: the calendar month (UTC), YYYY-MM."""
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _budget_doc_id(user_id: str) -> str:
    return f"{user_id}_{_period()}"


def get_plan(user_id: str) -> str:
    """Read the user's plan from Firestore; default 'free'. Never raises."""
    try:
        from state_store import get_client

        snap = get_client().collection(PLANS_COLLECTION).document(user_id).get()
        if snap.exists:
            return normalize_plan((snap.to_dict() or {}).get("plan"))
    except Exception as exc:  # plan lookup must never break a session
        logger.warning("plan lookup failed for %s: %s", user_id, exc)
    return "free"


def set_plan(user_id: str, plan: str) -> str:
    """Write the user's plan to Firestore (the authoritative store). Returns the
    normalised plan actually written. In production the Stripe webhook is the
    real caller (#30); for now an admin-only endpoint uses this to test tiers."""
    plan = normalize_plan(plan)
    from state_store import get_client

    get_client().collection(PLANS_COLLECTION).document(user_id).set(
        {"plan": plan, "updated_at": _today()}, merge=True
    )
    return plan


def set_customer(user_id: str, customer_id: str) -> None:
    """Record the Stripe customer for a user (both directions, for webhook lookup)."""
    if not user_id or not customer_id:
        return
    from state_store import get_client

    client = get_client()
    client.collection(PLANS_COLLECTION).document(user_id).set({"stripeCustomerId": customer_id}, merge=True)
    client.collection(CUSTOMERS_COLLECTION).document(customer_id).set({"uid": user_id}, merge=True)


def get_customer(user_id: str) -> str | None:
    """The user's Stripe customer id, if they have one (for the Customer Portal)."""
    from state_store import get_client

    try:
        snap = get_client().collection(PLANS_COLLECTION).document(user_id).get()
        if snap.exists:
            return (snap.to_dict() or {}).get("stripeCustomerId")
    except Exception as exc:
        logger.warning("customer lookup failed for %s: %s", user_id, exc)
    return None


def uid_for_customer(customer_id: str | None) -> str | None:
    """Reverse lookup: the UID behind a Stripe customer id."""
    if not customer_id:
        return None
    from state_store import get_client

    try:
        snap = get_client().collection(CUSTOMERS_COLLECTION).document(customer_id).get()
        if snap.exists:
            return (snap.to_dict() or {}).get("uid")
    except Exception as exc:
        logger.warning("uid_for_customer lookup failed for %s: %s", customer_id, exc)
    return None


def live_seconds_used_this_period(user_id: str) -> float:
    """Live seconds the user has consumed this month (0 on any error)."""
    try:
        from state_store import get_client

        snap = get_client().collection(BUDGET_COLLECTION).document(_budget_doc_id(user_id)).get()
        if snap.exists:
            return float((snap.to_dict() or {}).get("seconds", 0.0))
    except Exception as exc:
        logger.warning("budget read failed for %s: %s", user_id, exc)
    return 0.0


def live_seconds_remaining(user_id: str, plan: str) -> float:
    cap_min = live_cap_minutes(plan)
    if cap_min == float("inf"):
        return float("inf")
    return max(0.0, cap_min * 60.0 - live_seconds_used_this_period(user_id))


def settle_live_session(user_id: str, plan: str, elapsed_seconds: float, charged_seconds: float) -> tuple[float, float]:
    """Bill the not-yet-charged part of a live session, then report what is left.

    Live sessions settle repeatedly while running, not once at close, so that two
    concurrent sessions (two tabs, phone + laptop) can SEE each other's spend. A
    connect-time snapshot alone let each one spend the whole remaining balance
    independently, multiplying live-tutor cost past the plan's margin.

    `charged_seconds` is what this session has already written. Only the delta is
    added, so repeated calls never double-bill the same seconds.

    Returns (charged_seconds, remaining_seconds), both refreshed.
    """
    delta = elapsed_seconds - charged_seconds
    if delta > 0:
        add_live_seconds(user_id, delta)
        charged_seconds = elapsed_seconds
    return charged_seconds, live_seconds_remaining(user_id, plan)


def add_live_seconds(user_id: str, seconds: float) -> None:
    """Atomically add consumed live seconds to this month's budget (best-effort)."""
    if seconds <= 0:
        return
    try:
        from google.cloud import firestore

        from state_store import get_client

        ref = get_client().collection(BUDGET_COLLECTION).document(_budget_doc_id(user_id))
        ref.set(
            {"user_id": user_id, "period": _period(), "seconds": firestore.Increment(round(seconds, 1))},
            merge=True,
        )
    except Exception as exc:
        logger.warning("budget write failed for %s: %s", user_id, exc)
