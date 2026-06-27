"""Twin entitlements (#31 + #56) — who can make a 3D twin, and how many.

The digital twin is the premium post-session artifact, and each one costs a real
3D-generation call, so generation is gated and metered server-side (never trust
the client). We read the same authoritative plan record the rest of the platform
writes (`ohmlet_plans/{uid}.plan`, set by the Stripe webhook, #30) and enforce a
per-tier monthly quota.

Defaults below are deliberately conservative and ALL env-tunable, so the product
can open them up without a deploy. They are a starting policy, not a hard
contract: a free taste, generous-but-finite paid quotas.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger("ohmlet.reporter.entitlements")

VALID_PLANS = ("free", "pro", "max")
PLANS_COLLECTION = os.getenv("OHMLET_PLANS_COLLECTION", "ohmlet_plans")

# Monthly twin allowance per plan. Free gets a single taste of the artifact (a
# strong upgrade hook); paid tiers get generous, finite quotas matched to cost.
TWINS_PER_MONTH: dict[str, int] = {
    "free": int(os.getenv("OHMLET_TWINS_FREE", "1")),
    "pro": int(os.getenv("OHMLET_TWINS_PRO", "30")),
    "max": int(os.getenv("OHMLET_TWINS_MAX", "100")),
}


def normalize_plan(value: object) -> str:
    return value if value in VALID_PLANS else "free"


def period() -> str:
    """The quota window: the calendar month (UTC), YYYY-MM."""
    return datetime.now(timezone.utc).strftime("%Y-%m")


def get_plan(uid: str) -> str:
    """Read the user's plan from Firestore; default 'free'. Never raises."""
    try:
        from storage import _firestore

        snap = _firestore().collection(PLANS_COLLECTION).document(uid).get()
        if snap.exists:
            return normalize_plan((snap.to_dict() or {}).get("plan"))
    except Exception as exc:  # a plan lookup must never hard-fail the request
        logger.warning("plan lookup failed for %s: %s", uid, exc)
    return "free"


def monthly_quota(plan: str) -> int:
    return TWINS_PER_MONTH.get(normalize_plan(plan), TWINS_PER_MONTH["free"])
