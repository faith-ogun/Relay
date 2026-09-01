"""The twin gate: every build gets one, the paid tiers keep it.

Changed on 2026-08-28 from metering GENERATION to metering PERSISTENCE. The old
cap gave a free learner one twin a month, which throttled the share loop at the
exact moment it was meant to fire: finish three builds, get something postable
for one of them.

The four promises this pins, and the third is the one that would be quietly
broken by a future refactor:

  1. A free gallery keeps 30 days; Pro and Max keep everything.
  2. Expiry is evaluated against the CURRENT plan at read time, never stamped at
     creation, so upgrading brings the entire collection back at once.
  3. **A shared twin never rolls off, on any plan.** Somebody else is holding
     that link. This is the promise most likely to be lost by someone
     "simplifying" the visibility rule.
  4. Nothing here deletes anything. Rolled off means hidden.
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app"))

import entitlements


NOW = datetime(2026, 8, 28, 12, 0, tzinfo=timezone.utc)


def twin(days_old: float, shared: bool = False) -> dict:
    return {
        "createdAt": (NOW - timedelta(days=days_old)).isoformat(),
        "shared": shared,
        "status": "ready",
    }


# ── Retention by plan ───────────────────────────────────────────────────────

def test_free_keeps_thirty_days():
    assert entitlements.is_visible(twin(1), "free", NOW)
    assert entitlements.is_visible(twin(29.9), "free", NOW)


def test_free_rolls_off_after_thirty_days():
    assert not entitlements.is_visible(twin(31), "free", NOW)


def test_paid_plans_keep_everything():
    for plan in ("pro", "max"):
        assert entitlements.is_visible(twin(365), plan, NOW), plan
        assert entitlements.is_visible(twin(3650), plan, NOW), plan


# ── The upgrade is the point ────────────────────────────────────────────────

def test_upgrading_brings_the_whole_gallery_back():
    """The reason expiry is evaluated at READ time against the CURRENT plan
    rather than stamped as a date at creation. The same record, unchanged."""
    old = twin(200)
    assert not entitlements.is_visible(old, "free", NOW)
    assert entitlements.is_visible(old, "pro", NOW)


def test_downgrading_hides_again_without_destroying():
    old = twin(200)
    assert entitlements.is_visible(old, "max", NOW)
    assert not entitlements.is_visible(old, "free", NOW)
    # The record is untouched by either reading. Hidden, not deleted.
    assert old["createdAt"]


# ── The promise to whoever is holding the link ──────────────────────────────

def test_a_shared_twin_never_rolls_off():
    """If this fails, a public link somebody posted has gone dead because the
    owner's subscription lapsed. Read the module docstring before changing it."""
    assert entitlements.is_visible(twin(9999, shared=True), "free", NOW)


# ── Robustness: never hide something because of a parsing problem ───────────

def test_a_missing_or_unparseable_timestamp_stays_visible():
    """No timestamp is not evidence of age. Failing towards showing the learner
    their own work is the right direction to be wrong in."""
    assert entitlements.is_visible({"status": "ready"}, "free", NOW)
    assert entitlements.is_visible({"createdAt": "not a date"}, "free", NOW)


def test_a_naive_timestamp_is_read_as_utc():
    naive = {"createdAt": (NOW - timedelta(days=5)).replace(tzinfo=None).isoformat()}
    assert entitlements.is_visible(naive, "free", NOW)


def test_a_zulu_timestamp_parses():
    z = {"createdAt": (NOW - timedelta(days=5)).isoformat().replace("+00:00", "Z")}
    assert entitlements.is_visible(z, "free", NOW)


# ── The generation ceiling is now abuse-shaped, not paywall-shaped ──────────

def test_generation_ceilings_are_above_what_a_plan_can_physically_reach():
    """A free learner has 60 minutes of tutor time a month. Thirty completed
    builds is not a number they can reach, which is the test that this is an
    abuse ceiling rather than the product gate."""
    assert entitlements.monthly_quota("free") >= 30
    assert entitlements.monthly_quota("pro") >= entitlements.monthly_quota("free")
    assert entitlements.monthly_quota("max") >= entitlements.monthly_quota("pro")


def test_retention_days_zero_means_forever():
    assert entitlements.retention_days("pro") == 0
    assert entitlements.retention_days("max") == 0
    assert entitlements.retention_days("free") > 0
