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
# REPRICED on 2026-09-01: Pro 240 -> 150 min ($15.99/$143.99 -> $12.99/$77.99),
# Max 540 -> 300 min ($34.99/$324.99 -> $24.99/$149.99). Both annuals are now
# sold at a flat 50% off the monthly price ($6.50/mo and $12.50/mo respectively).
# Faith's call, on the arithmetic below.
#
# The cost of a paid minute (usage_meter.py's own rates):
#
#     audio      $0.037 / min
#     video      $0.012 / min   (1 frame/sec at $0.0002)
#     tokens     ~$0.004 / min amortised, from Pro-routed tool calls
#     ---------------------------------
#     TOTAL      ~$0.053 / min
#
# $0.053/min is a conservative PLANNING figure, not a measured one. Google's
# published Live API rates imply closer to $0.0385/min, but the Live API
# re-bills accumulated session context on every turn of a long session, so the
# real cost could land above either number. Nobody has checked this against
# actual Vertex AI billing yet — do that within the first months of real
# traffic, and treat every margin below as provisional until it happens.
#
# Net revenue, after Apple's 15% under the Small Business Program (the worse
# case is 30% off-programme, which tightens all of this further; Stripe on the
# web keeps ~97%, comfortably ahead of either Apple figure, so App Store sales
# are the pessimistic case this file prices against):
#
# MONTHLY, at 100% of cap — the worst case a hard-capped user can reach:
#
#     Pro   $12.99 -> $11.04 net,  150 min costs  $7.95 -> +$3.09
#     Max   $24.99 -> $21.24 net,  300 min costs $15.90 -> +$5.34
#
# Monthly clears full cap. A learner who burns the entire monthly budget still
# leaves us ahead, same as before the reprice.
#
# ANNUAL, at 100% of cap:
#
#     Pro   $77.99/yr, $5.52 net/mo,   150 min costs  $7.95 -> -$2.43/mo
#     Max  $149.99/yr, $10.62 net/mo,  300 min costs $15.90 -> -$5.28/mo
#
# Annual does NOT clear full cap at these prices, and that is DELIBERATE, not
# an oversight. Pricing every tier to survive 100% utilisation is double
# insurance: the hard server-side minute cap (live_seconds_remaining,
# settle_live_session below) already bounds the worst case per user, so a price
# that ALSO has to survive 100% utilisation is paying twice for the protection
# the cap already provides — and that second payment was the thing making the
# 50%-off annual plans look barely discounted, which costs conversion.
#
# So annual is priced against EXPECTED utilisation instead of the ceiling,
# modelled at ~37.5% of cap (NOT measured — instrument and revisit once
# live_seconds_used_this_period has enough production history to model from):
#
#     Pro    56.25 min costs $2.98 against $5.52 net  -> +$2.54/mo
#     Max   112.5  min costs $5.96 against $10.62 net -> +$4.66/mo
#
# The cap is what makes this safe. It is a ceiling on the tail the price no
# longer insures against, not a suggestion. If the cap enforcement in this file
# ever breaks (or a plan gets granted client-side without the server checking
# it — see the module docstring), the annual tiers stop being a considered
# pricing choice and become a straightforward, uncapped loss on every heavy
# user, silently, because nothing else in the system is watching that line.
#
# The PREVIOUS version of this comment tested break-even against the MONTHLY
# price only ($15.99 -> $13.59 net -> break-even at 256 min) and never checked
# annual on its own per-month price. Annual was underwater at full cap this
# entire time, while the comment claimed "everyone below the cap is
# profitable," and nothing caught it because the test encoded the same
# one-price assumption (see test_caps_do_not_lose_money_at_full_utilisation in
# test_entitlements.py). Any future repricing must check monthly and annual
# separately — a cadence that clears break-even says nothing about the other.
#
#     Free   60 min ->  $3.18 cost. Unchanged: this is CAC, and activation
#                       depends on it. See the note below.
#
# The Pro to Max step is now 2x rather than 2.25x, and that is the right
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
# Why the monthly cohort matters beyond its own margin: it is the one that can
# safely absorb the $0.053-vs-$0.0385 uncertainty above, because it clears full
# cap with room to spare (+$3.09 / +$5.34) even if real cost lands meaningfully
# over plan. Annual has no such room by design. When production billing data
# finally lands, recheck annual's expected-utilisation margin first — it is the
# number with the least slack in this whole file.
#
# Every value is env-tunable, so a cap can be changed without a deploy.
LIVE_MINUTES_PER_MONTH: dict[str, float] = {
    "free": float(os.getenv("OHMLET_LIVE_MIN_FREE", "60")),
    "pro": float(os.getenv("OHMLET_LIVE_MIN_PRO", "150")),   # 2.5 hours
    "max": float(os.getenv("OHMLET_LIVE_MIN_MAX", "300")),   # 5 hours
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


def set_plan(
    user_id: str,
    plan: str,
    environment: str = "PRODUCTION",
    source: str = "system",
) -> str:
    """Write the user's plan to Firestore (the authoritative store). Returns the
    normalised plan actually written. The real callers are the Stripe webhook on
    the web and the RevenueCat webhook on iOS; an admin-only endpoint can also
    override a plan for testing the tiers.

    `environment` is stamped so a plan granted by a free sandbox purchase is
    distinguishable from one somebody paid for. Without it the two are the same
    document and a test grant is indistinguishable from revenue.

    `setBy` is stamped for the same reason, one level finer. Because these writes
    MERGE, a field nobody rewrites survives forever: on 2026-08-30 a document
    carried `setBy: admin-console` from a manual edit five days earlier while
    RevenueCat was the one actually granting it. A provenance field that lies is
    worse than no provenance field, because the pre-launch sweep for test grants
    is going to read exactly this.
    """
    plan = normalize_plan(plan)
    from state_store import get_client

    get_client().collection(PLANS_COLLECTION).document(user_id).set(
        {
            "plan": plan,
            "updated_at": _today(),
            "environment": environment,
            "setBy": source,
        },
        merge=True,
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
