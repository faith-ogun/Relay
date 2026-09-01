"""Entitlements: plan normalisation, caps, model routing, period keys (#56)."""

import pathlib
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
    """The server cap and the published promise must be the same number.

    This used to hard-code 60/600/1800 alongside a comment saying which hours
    they were, which pins the caps but not the PROMISE: the copy could drift and
    the test would still pass. It now reads the pricing page and compares, so
    the invariant it claims to protect is the one it actually checks.

    Caps were cut on 2026-08-28 (600 -> 240, 1800 -> 540) because Pro and Max
    lost money at full utilisation. This test is what made that a two-file change
    instead of a silent lie on the pricing page.

    Cut again on 2026-09-01 (240 -> 150, 540 -> 300) alongside a reprice that
    split monthly and annual arithmetic apart. See
    test_caps_do_not_lose_money_at_full_utilisation_monthly and
    test_annual_is_deliberately_underwater_at_full_utilisation below for why a
    single cap number no longer tells the whole profitability story.
    """
    page = (
        pathlib.Path(__file__).resolve().parents[3]
        / "frontend" / "components" / "PricingPage.tsx"
    ).read_text()

    # 'Live tutor sessions, up to N hours a month' / 'Voice tutor, N minutes a month'
    #
    # The hours group must accept a decimal (\.\d+)? — 150 min is 2.5 hours, not
    # a whole number. This used to be int-only and it worked by coincidence for
    # as long as every plan's minutes happened to divide evenly by 60. The
    # 2026-09-01 reprice broke that coincidence (Pro: 150 min = 2.5h) and the
    # int-only pattern silently dropped the Pro line instead of comparing it,
    # which is worse than a loud failure: a wrong page would have passed.
    hours = [float(h) for h in re.findall(r"up to (\d+(?:\.\d+)?) hours a month", page)]
    minutes = [int(m) for m in re.findall(r"Voice tutor, (\d+) minutes a month", page)]
    assert len(minutes) == 1, f"expected one free minutes line, found {minutes}"
    assert len(hours) == 2, f"expected a Pro and a Max hours line, found {hours}"

    assert entitlements.live_cap_minutes("free") == minutes[0]
    assert entitlements.live_cap_minutes("pro") == hours[0] * 60
    assert entitlements.live_cap_minutes("max") == hours[1] * 60
    assert entitlements.live_cap_minutes("bogus") == minutes[0]  # safe default


# Shared cost model for the three tests below: audio + video + amortised
# Pro-routed tokens, from usage_meter's own rates. Net revenue is after Apple's
# 15% under the Small Business Programme, the generous reading; off-programme
# is 30% and tightens all three further.
_COST_PER_MIN = 0.037 + 0.012 + 0.004
_APPLE_NET = 0.85
# The utilisation the annual tiers are actually priced against (see the
# arithmetic above LIVE_MINUTES_PER_MONTH in entitlements.py). Modelled, not
# measured — there is no production live_seconds history yet.
_EXPECTED_UTILISATION = 0.375


def test_caps_do_not_lose_money_at_full_utilisation_monthly():
    """Monthly must clear its OWN cap. A learner on the monthly plan who burns
    their whole budget must not cost more than they paid — monthly carries no
    discount to cushion it, so it is the plan this arithmetic protects hardest.

    If someone raises a cap or drops the monthly price without re-doing this
    arithmetic, this fails and tells them what the new ceiling is.
    """
    monthly_prices = {"pro": 12.99, "max": 24.99}

    for plan, price in monthly_prices.items():
        net = price * _APPLE_NET
        cost = entitlements.live_cap_minutes(plan) * _COST_PER_MIN
        assert cost <= net, (
            f"{plan} monthly: {entitlements.live_cap_minutes(plan):.0f} min costs "
            f"${cost:.2f} against ${net:.2f} net. Cap must be at most "
            f"{net / _COST_PER_MIN:.0f} min."
        )


def test_annual_is_deliberately_underwater_at_full_utilisation():
    """Annual does NOT clear full cap, on purpose, and this test exists to keep
    that a decision instead of a drift.

    The previous version of this test (and of the comment above
    LIVE_MINUTES_PER_MONTH) checked break-even against the MONTHLY price only,
    so annual silently ran a loss at full cap the entire time the code claimed
    "everyone below the cap is profitable," and nothing caught it. This test
    pins the opposite claim, so a future change that makes annual profitable at
    100% utilisation again (e.g. the annual price drifting back up toward
    monthly) gets flagged too — that would mean the 50%-off annual discount had
    quietly stopped being real.

    Running annual underwater at the ceiling is only safe because the hard
    server-side minute cap bounds the loss to exactly this number per user
    rather than leaving it open-ended. See the arithmetic in entitlements.py
    above LIVE_MINUTES_PER_MONTH for why expected-utilisation pricing was
    chosen over ceiling pricing for the annual tiers.
    """
    annual_totals = {"pro": 77.99, "max": 149.99}

    for plan, annual_total in annual_totals.items():
        net_per_month = (annual_total / 12) * _APPLE_NET
        cost = entitlements.live_cap_minutes(plan) * _COST_PER_MIN
        assert cost > net_per_month, (
            f"{plan} annual: {entitlements.live_cap_minutes(plan):.0f} min costs "
            f"${cost:.2f} against ${net_per_month:.2f} net/mo, which no longer runs "
            f"a deliberate loss at full cap. Check whether the annual discount is "
            f"still real and update the arithmetic comment in entitlements.py."
        )


def test_annual_is_profitable_at_expected_utilisation():
    """The other half of the annual story: it is priced to the EXPECTED case,
    not the ceiling. If this fails, the reprice no longer matches the
    utilisation assumption it was justified by, and the annual margin numbers
    in the entitlements.py comment need re-deriving.
    """
    annual_totals = {"pro": 77.99, "max": 149.99}

    for plan, annual_total in annual_totals.items():
        net_per_month = (annual_total / 12) * _APPLE_NET
        used_min = entitlements.live_cap_minutes(plan) * _EXPECTED_UTILISATION
        cost = used_min * _COST_PER_MIN
        assert cost <= net_per_month, (
            f"{plan} annual at expected utilisation: {used_min:.1f} min costs "
            f"${cost:.2f} against ${net_per_month:.2f} net/mo."
        )


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
