"""Entitlements: plan normalisation, caps, model routing, period keys (#56)."""

import re

import entitlements


def test_normalize_plan_accepts_valid_and_floors_unknown():
    assert entitlements.normalize_plan("free") == "free"
    assert entitlements.normalize_plan("pro") == "pro"
    assert entitlements.normalize_plan("max") == "max"
    assert entitlements.normalize_plan("enterprise") == "free"
    assert entitlements.normalize_plan(None) == "free"
    assert entitlements.normalize_plan(123) == "free"


def test_live_cap_matches_pricing_page():
    assert entitlements.live_cap_minutes("free") == 60
    assert entitlements.live_cap_minutes("pro") == 600   # 10 hours
    assert entitlements.live_cap_minutes("max") == 1800  # 30 hours
    assert entitlements.live_cap_minutes("bogus") == 60  # safe default


def test_priority_models_only_for_paid():
    assert entitlements.has_priority_models("pro") is True
    assert entitlements.has_priority_models("max") is True
    assert entitlements.has_priority_models("free") is False
    assert entitlements.has_priority_models("bogus") is False


def test_period_is_year_month():
    assert re.fullmatch(r"\d{4}-\d{2}", entitlements._period())


def test_budget_doc_id_is_namespaced_by_user_and_period():
    doc_id = entitlements._budget_doc_id("user-123")
    assert doc_id.startswith("user-123_")
    assert re.fullmatch(r"user-123_\d{4}-\d{2}", doc_id)


# ── settle_live_session: the concurrent-spend guard ──
# A live session used to read its remaining balance ONCE at connect and only
# write consumption back at close, so two simultaneous sessions each spent the
# full monthly allowance. Sessions now settle as they run. These tests pin the
# two invariants that makes correct: never double-bill, and always re-read the
# shared total so siblings are visible.
class _FakeBudget:
    """Stands in for the shared Firestore counter."""

    def __init__(self, cap_seconds):
        self.total = 0.0
        self.cap = cap_seconds

    def install(self, monkeypatch, plan="pro"):
        monkeypatch.setattr(entitlements, "add_live_seconds", lambda uid, s: self._add(s))
        monkeypatch.setattr(
            entitlements, "live_seconds_remaining", lambda uid, p: max(0.0, self.cap - self.total)
        )

    def _add(self, seconds):
        self.total += seconds


def test_settle_bills_only_the_delta_never_twice(monkeypatch):
    budget = _FakeBudget(cap_seconds=600)
    budget.install(monkeypatch)

    charged, remaining = entitlements.settle_live_session("u1", "pro", 30.0, 0.0)
    assert charged == 30.0 and budget.total == 30.0 and remaining == 570.0

    # Session continues: only the new 20s is billed, not another 50s.
    charged, remaining = entitlements.settle_live_session("u1", "pro", 50.0, charged)
    assert charged == 50.0 and budget.total == 50.0 and remaining == 550.0

    # A settle with no elapsed time since the last one is a no-op.
    charged, _ = entitlements.settle_live_session("u1", "pro", 50.0, charged)
    assert charged == 50.0 and budget.total == 50.0


def test_concurrent_sessions_see_each_others_spend(monkeypatch):
    """The actual bug: two sessions must not each get the whole allowance."""
    budget = _FakeBudget(cap_seconds=100)
    budget.install(monkeypatch)

    a_charged = b_charged = 0.0
    # Both run 60s. Under the old snapshot logic each saw 100s remaining and
    # neither would stop; together they would spend 120s against a 100s cap.
    a_charged, a_remaining = entitlements.settle_live_session("u1", "pro", 60.0, a_charged)
    b_charged, b_remaining = entitlements.settle_live_session("u1", "pro", 60.0, b_charged)

    assert budget.total == 120.0          # both sessions' time is on the shared counter
    assert a_remaining == 40.0            # A already sees B is not yet counted
    assert b_remaining == 0.0             # B sees the allowance is gone and will cut off
