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
