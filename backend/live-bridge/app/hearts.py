"""Hearts — the free tier's attempt budget, and the second thing a paid plan buys.

Hearts are the Duolingo-shaped constraint: a Free learner has a small pool, a
wrong answer costs one, and an empty pool means waiting rather than paying
attention-tax forever. Pro and Max have no pool at all.

Why this lives on the server, like live minutes do:

  A heart balance held on the device is a balance the device can edit. Deleting
  the app, clearing storage, or winding the system clock forward would each
  refill it for free, which makes the paid tier's headline perk worthless. So
  the balance and its clock are Firestore's, derived from the verified uid, and
  the client only ever RENDERS what this module reports.

Storage shape — a balance plus the instant it was stamped, never a running
timer:

    {"hearts": 1, "updated_at": 1755000000.0}

The live balance is derived on read: every REGEN_SECONDS elapsed since the stamp
is worth one heart, clamped to the plan maximum. A timer that had to tick would
need a scheduler and would drift; this needs neither and is correct after any
outage, cold start, or month-long absence.

Spending preserves partial progress toward the next heart. A learner 80 minutes
into a 90-minute regen who loses a heart keeps those 80 minutes: the new stamp
is `now - residual`, not `now`. Stamping `now` would silently confiscate almost
a full regen cycle on every miss, which is the kind of quiet unfairness people
notice and resent without being able to name.
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone

import entitlements

logger = logging.getLogger("ohmlet.hearts")

HEARTS_COLLECTION = os.getenv("OHMLET_HEARTS_COLLECTION", "ohmlet_hearts")

# Free-tier pool. Three is deliberate: enough that a normal lesson survives a
# careless slip or two, few enough that a lesson attempted without reading is
# not free. Pro and Max are unlimited and never touch this path.
MAX_HEARTS_FREE = int(os.getenv("OHMLET_HEARTS_FREE", "3"))

# One heart back every this many minutes. Ohmlet lessons are longer and denser
# than a language drill, so Duolingo's four-hour heart would strand a beginner
# for most of a day. Ninety minutes means a drained learner is back in within
# the same evening (full pool in 4.5 hours) while the wait is still real enough
# to be worth removing.
REGEN_SECONDS = float(os.getenv("OHMLET_HEART_REGEN_MINUTES", "90")) * 60.0

_UNLIMITED_PLANS = {"pro", "max"}


def is_unlimited(plan: str) -> bool:
    return entitlements.normalize_plan(plan) in _UNLIMITED_PLANS


def _doc(user_id: str):
    from state_store import get_client

    return get_client().collection(HEARTS_COLLECTION).document(user_id)


def _read_raw(user_id: str) -> tuple[int, float]:
    """The stored (balance, stamp). A user with no doc yet starts full."""
    try:
        snap = _doc(user_id).get()
        if snap.exists:
            data = snap.to_dict() or {}
            stored = int(data.get("hearts", MAX_HEARTS_FREE))
            stamp = float(data.get("updated_at", 0.0))
            return max(0, min(stored, MAX_HEARTS_FREE)), stamp
    except Exception as exc:
        # Never block a lesson on a Firestore hiccup. Failing OPEN here costs at
        # most a few free attempts; failing closed would lock a paying-adjacent
        # learner out of the product over a transient read error.
        logger.warning("hearts read failed for %s: %s", user_id, exc)
    return MAX_HEARTS_FREE, 0.0


def _derive(stored: int, stamp: float, now: float) -> tuple[int, float]:
    """(live balance, residual seconds already served toward the next heart)."""
    if stored >= MAX_HEARTS_FREE:
        return MAX_HEARTS_FREE, 0.0
    elapsed = max(0.0, now - stamp)
    gained = int(elapsed // REGEN_SECONDS)
    balance = min(MAX_HEARTS_FREE, stored + gained)
    if balance >= MAX_HEARTS_FREE:
        return MAX_HEARTS_FREE, 0.0
    return balance, elapsed % REGEN_SECONDS


def status(user_id: str, plan: str) -> dict:
    """What the client renders: balance, cap, and when the next one lands."""
    if is_unlimited(plan):
        return {
            "hearts": None,          # null means unlimited, as with liveCapMinutes
            "max": None,
            "unlimited": True,
            "nextHeartInSeconds": None,
            "fullInSeconds": None,
            "regenSeconds": None,
        }
    now = time.time()
    stored, stamp = _read_raw(user_id)
    balance, residual = _derive(stored, stamp, now)
    missing = MAX_HEARTS_FREE - balance
    next_in = None if missing <= 0 else max(0.0, REGEN_SECONDS - residual)
    full_in = None if missing <= 0 else next_in + (missing - 1) * REGEN_SECONDS
    return {
        "hearts": balance,
        "max": MAX_HEARTS_FREE,
        "unlimited": False,
        "nextHeartInSeconds": None if next_in is None else round(next_in),
        "fullInSeconds": None if full_in is None else round(full_in),
        # Sent so the client can draw how far through the cycle it is without
        # hard-coding a number this module is free to tune from the environment.
        "regenSeconds": round(REGEN_SECONDS),
    }


def spend(user_id: str, plan: str) -> dict:
    """Charge one heart for a wrong answer. Returns the refreshed status.

    Not transactional by design. The only writer is the learner's own device,
    one wrong answer at a time; the failure mode a transaction would prevent
    (two devices missing a question in the same instant) costs the business
    nothing and would cost every correct answer a transaction round-trip. The
    idempotency key on the route is what stops a network retry double-charging,
    which is the race that actually happens.
    """
    if is_unlimited(plan):
        return status(user_id, plan)

    now = time.time()
    stored, stamp = _read_raw(user_id)
    balance, residual = _derive(stored, stamp, now)
    if balance <= 0:
        return status(user_id, plan)

    balance -= 1
    # Full pool -> the regen clock starts now. Partial pool -> keep the progress
    # already served toward the next heart.
    new_stamp = now if balance >= MAX_HEARTS_FREE else now - residual
    try:
        _doc(user_id).set(
            {
                "user_id": user_id,
                "hearts": balance,
                "updated_at": new_stamp,
                "updated_iso": datetime.now(timezone.utc).isoformat(),
            },
            merge=True,
        )
    except Exception as exc:
        logger.warning("hearts write failed for %s: %s", user_id, exc)
        return status(user_id, plan)
    return status(user_id, plan)


def has_a_heart(user_id: str, plan: str) -> bool:
    """Whether this learner may start a lesson right now."""
    if is_unlimited(plan):
        return True
    return (status(user_id, plan).get("hearts") or 0) > 0
