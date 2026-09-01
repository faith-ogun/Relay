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
from datetime import datetime, timedelta, timezone

logger = logging.getLogger("ohmlet.reporter.entitlements")

VALID_PLANS = ("free", "pro", "max")
PLANS_COLLECTION = os.getenv("OHMLET_PLANS_COLLECTION", "ohmlet_plans")

# ── The twin gate changed on 2026-08-28: it now meters PERSISTENCE, not
# ── generation. Faith's call, on the growth review's argument.
#
# The old design capped a free learner at ONE twin a month. The twin is the
# artifact people post: it is the whole reason the distribution thesis has a
# viral loop in it at all, with a stated kill criterion below 0.1 K-factor. A
# free learner who finished three builds got something to share for the first
# and nothing for the other two, so the loop was throttled at precisely the
# moment it was supposed to fire. That is a tax on the product spreading.
#
# Now: EVERY completed build produces a shareable twin, on every plan. What the
# paid tiers buy is that it lasts. A free learner's private gallery rolls off
# after 30 days; Pro and Max keep it for good. Loss aversion aimed at the
# collection rather than at the moment of creation.
#
# Two properties fall out of evaluating expiry against the CURRENT plan at read
# time rather than stamping an expiry date at creation, and both are why it is
# done that way:
#
#   * Upgrading restores the entire gallery instantly, including twins that had
#     already rolled off. Nothing is destroyed, only hidden, so the upgrade
#     delivers something visible and immediate.
#   * Sharing pins a twin permanently, on any plan. An already-shared public
#     link must never break, because someone else is holding it.
RETENTION_DAYS: dict[str, int] = {
    # 0 means forever.
    "free": int(os.getenv("OHMLET_TWIN_RETENTION_FREE_DAYS", "30")),
    "pro": int(os.getenv("OHMLET_TWIN_RETENTION_PRO_DAYS", "0")),
    "max": int(os.getenv("OHMLET_TWIN_RETENTION_MAX_DAYS", "0")),
}

# Still a ceiling, but an ABUSE ceiling rather than a product gate. Generation
# calls a paid provider, so it cannot be literally unbounded. These sit far above
# what the live-tutor budget physically allows: a free learner has 60 minutes of
# tutor time a month, so thirty completed builds is not a number they can reach.
# If one of these ever bites a real learner, it is set wrong.
TWINS_PER_MONTH: dict[str, int] = {
    "free": int(os.getenv("OHMLET_TWINS_FREE", "30")),
    "pro": int(os.getenv("OHMLET_TWINS_PRO", "100")),
    "max": int(os.getenv("OHMLET_TWINS_MAX", "300")),
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
    """The abuse ceiling on generation. NOT the product gate: see RETENTION_DAYS."""
    return TWINS_PER_MONTH.get(normalize_plan(plan), TWINS_PER_MONTH["free"])


def retention_days(plan: str) -> int:
    """How long this plan keeps a twin in the private gallery. 0 means forever."""
    return RETENTION_DAYS.get(normalize_plan(plan), RETENTION_DAYS["free"])


def is_visible(record: dict, plan: str, now: datetime | None = None) -> bool:
    """Whether a twin still shows in its owner's gallery.

    Shared twins are always visible, on every plan, because a public link that
    somebody else is holding must not break when the owner's subscription
    lapses. Nothing here deletes anything: expiry hides, so an upgrade brings
    the whole collection back.
    """
    if record.get("shared"):
        return True
    days = retention_days(plan)
    if days <= 0:
        return True
    created = str(record.get("createdAt") or "")
    if not created:
        return True  # no timestamp is not evidence of age
    try:
        when = datetime.fromisoformat(created.replace("Z", "+00:00"))
    except ValueError:
        return True
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    return (now or datetime.now(timezone.utc)) - when <= timedelta(days=days)
