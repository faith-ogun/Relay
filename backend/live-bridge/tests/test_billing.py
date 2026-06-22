"""Stripe billing (#30) — the webhook routing + plan mapping that broke this
session. These tests pin the exact behaviour so the bugs can't come back:
  - StripeObject-vs-dict access (we now handle a plain dict)
  - price id -> plan mapping
  - subscription status -> plan (active/trialing vs cancelled)
  - origin-based return URL
All Firestore/Stripe side effects are stubbed; we assert what the handler *does*.
"""

import types

import billing
import entitlements


# ── price config ──
def test_price_for_reads_env(monkeypatch):
    monkeypatch.setenv("STRIPE_PRICE_PRO_MONTHLY", "price_pm")
    monkeypatch.setenv("STRIPE_PRICE_MAX_ANNUAL", "price_ma")
    assert billing._price_for("pro", "monthly") == "price_pm"
    assert billing._price_for("max", "annual") == "price_ma"
    assert billing._price_for("pro", "annual") is None


def test_price_plan_map_inverts_config(monkeypatch):
    monkeypatch.setenv("STRIPE_PRICE_PRO_MONTHLY", "price_pm")
    monkeypatch.setenv("STRIPE_PRICE_MAX_ANNUAL", "price_ma")
    m = billing._price_plan_map()
    assert m["price_pm"] == "pro"
    assert m["price_ma"] == "max"


# ── return URL ──
def test_return_base_prefers_origin():
    req = types.SimpleNamespace(headers={"origin": "http://localhost:3000"})
    assert billing._return_base(req) == "http://localhost:3000"


def test_return_base_falls_back_when_missing_or_bad():
    assert billing._return_base(types.SimpleNamespace(headers={})) == billing.APP_URL
    assert billing._return_base(types.SimpleNamespace(headers={"origin": "ftp://evil"})) == billing.APP_URL


# ── webhook event handling ──
def test_subscription_active_sets_paid_plan(monkeypatch):
    monkeypatch.setenv("STRIPE_PRICE_PRO_MONTHLY", "price_pm")
    calls = {}
    monkeypatch.setattr(entitlements, "set_plan", lambda uid, plan: calls.__setitem__("plan", (uid, plan)))
    monkeypatch.setattr(entitlements, "set_customer", lambda uid, c: calls.__setitem__("cust", (uid, c)))
    event = {
        "type": "customer.subscription.created",
        "data": {"object": {
            "metadata": {"uid": "u1"},
            "customer": "cus_1",
            "status": "active",
            "items": {"data": [{"price": {"id": "price_pm"}}]},
        }},
    }
    billing._handle_event(event)
    assert calls["plan"] == ("u1", "pro")
    assert calls["cust"] == ("u1", "cus_1")


def test_subscription_cancelled_status_downgrades_to_free(monkeypatch):
    monkeypatch.setenv("STRIPE_PRICE_PRO_MONTHLY", "price_pm")
    seen = {}
    monkeypatch.setattr(entitlements, "set_plan", lambda uid, plan: seen.__setitem__("p", (uid, plan)))
    monkeypatch.setattr(entitlements, "set_customer", lambda *a: None)
    event = {
        "type": "customer.subscription.updated",
        "data": {"object": {
            "metadata": {"uid": "u3"},
            "customer": "cus_3",
            "status": "canceled",
            "items": {"data": [{"price": {"id": "price_pm"}}]},
        }},
    }
    billing._handle_event(event)
    assert seen["p"] == ("u3", "free")


def test_subscription_deleted_resolves_via_customer(monkeypatch):
    seen = {}
    monkeypatch.setattr(entitlements, "set_plan", lambda uid, plan: seen.__setitem__("p", (uid, plan)))
    monkeypatch.setattr(entitlements, "uid_for_customer", lambda c: "u9" if c == "cus_9" else None)
    event = {"type": "customer.subscription.deleted",
             "data": {"object": {"customer": "cus_9", "metadata": {}}}}
    billing._handle_event(event)
    assert seen["p"] == ("u9", "free")


def test_checkout_completed_stores_customer_mapping(monkeypatch):
    seen = {}
    monkeypatch.setattr(entitlements, "set_customer", lambda uid, c: seen.__setitem__("m", (uid, c)))
    event = {"type": "checkout.session.completed",
             "data": {"object": {"client_reference_id": "u2", "customer": "cus_2"}}}
    billing._handle_event(event)
    assert seen["m"] == ("u2", "cus_2")


def test_resolve_uid_prefers_metadata():
    # short-circuits before any customer lookup
    assert billing._resolve_uid({"metadata": {"uid": "u-meta"}, "customer": "cus_x"}) == "u-meta"
