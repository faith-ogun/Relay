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

# Daily live-tutor budget per plan (minutes). Vision + audio is the cost driver,
# so Free is metered. Provisional pending real cost data (see usage_meter / #19).
# inf = effectively unlimited (still protected by the idle watchdog + abuse caps).
LIVE_MINUTES_PER_DAY: dict[str, float] = {
    "free": float(os.getenv("OHMLET_LIVE_MIN_FREE", "20")),
    "pro": float(os.getenv("OHMLET_LIVE_MIN_PRO", "180")),
    "max": float("inf"),
}

# Plans that get the premium models for code gen / deep reasoning tools.
_PRIORITY_PLANS = {"pro", "max"}

PLANS_COLLECTION = os.getenv("OHMLET_PLANS_COLLECTION", "ohmlet_plans")
BUDGET_COLLECTION = os.getenv("OHMLET_LIVE_BUDGET_COLLECTION", "ohmlet_live_budget")


def normalize_plan(value: object) -> str:
    return value if value in VALID_PLANS else "free"


def live_cap_minutes(plan: str) -> float:
    return LIVE_MINUTES_PER_DAY.get(normalize_plan(plan), LIVE_MINUTES_PER_DAY["free"])


def has_priority_models(plan: str) -> bool:
    return normalize_plan(plan) in _PRIORITY_PLANS


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _budget_doc_id(user_id: str) -> str:
    return f"{user_id}_{_today()}"


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


def live_seconds_used_today(user_id: str) -> float:
    """Live seconds the user has already consumed today (0 on any error)."""
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
    return max(0.0, cap_min * 60.0 - live_seconds_used_today(user_id))


def add_live_seconds(user_id: str, seconds: float) -> None:
    """Atomically add consumed live seconds to today's budget (best-effort)."""
    if seconds <= 0:
        return
    try:
        from google.cloud import firestore

        from state_store import get_client

        ref = get_client().collection(BUDGET_COLLECTION).document(_budget_doc_id(user_id))
        ref.set(
            {"user_id": user_id, "date": _today(), "seconds": firestore.Increment(round(seconds, 1))},
            merge=True,
        )
    except Exception as exc:
        logger.warning("budget write failed for %s: %s", user_id, exc)
