"""The RevenueCat webhook is what turns an iOS purchase into an entitlement.

If it is wrong the failure is silent and expensive in both directions: a learner
pays and stays on the free cap, or a lapsed subscriber keeps a paid tier. Neither
shows up in any UI, so the behaviour is pinned here.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException

import revenuecat


@pytest.fixture
def rc(monkeypatch):
    """A configured webhook with the plan writes and idempotency captured."""
    monkeypatch.setattr(revenuecat, "WEBHOOK_SECRET", "shhh")
    plans: dict[str, str] = {}
    monkeypatch.setattr(revenuecat.entitlements, "set_plan",
                        lambda uid, plan: plans.__setitem__(uid, plan))
    seen: set[str] = set()
    monkeypatch.setattr(revenuecat.idempotency, "claim_event",
                        lambda key: (key not in seen) and (seen.add(key) or True))
    monkeypatch.setattr(revenuecat.idempotency, "release_event", lambda key: seen.discard(key))
    monkeypatch.setattr(revenuecat.obs, "audit", lambda *a, **k: None)
    return plans


class FakeRequest:
    def __init__(self, body, auth="shhh"):
        self._body = body
        self.headers = {"authorization": auth}

    async def json(self):
        return self._body


def event(**over):
    e = {"id": "evt_1", "type": "INITIAL_PURCHASE", "app_user_id": "uid_1", "entitlement_ids": ["pro"]}
    e.update(over)
    return {"event": e}


def call(body, auth="shhh"):
    """The handler is a coroutine; driving it with asyncio.run keeps the suite
    free of a pytest-asyncio dependency it otherwise does not need."""
    return asyncio.run(revenuecat.webhook(FakeRequest(body, auth)))


# ── Authentication ──────────────────────────────────────────────────────────

def test_wrong_secret_is_rejected(rc):
    with pytest.raises(HTTPException) as exc:
        call(event(), auth="wrong")
    assert exc.value.status_code == 401


def test_unconfigured_refuses_rather_than_granting(monkeypatch):
    monkeypatch.setattr(revenuecat, "WEBHOOK_SECRET", "")
    with pytest.raises(HTTPException) as exc:
        call(event())
    assert exc.value.status_code == 503, "an unauthenticated endpoint must not grant plans"


# ── Granting ────────────────────────────────────────────────────────────────

def test_initial_purchase_grants_the_plan(rc):
    call(event())
    assert rc["uid_1"] == "pro"


def test_renewal_keeps_the_plan(rc):
    call(event(id="evt_2", type="RENEWAL", entitlement_ids=["max"]))
    assert rc["uid_1"] == "max"


def test_highest_entitlement_wins(rc):
    call(event(entitlement_ids=["pro", "max"]))
    assert rc["uid_1"] == "max", "holding both tiers must not downgrade to the lower one"


def test_unknown_entitlement_does_not_invent_a_tier(rc):
    call(event(entitlement_ids=["something_else"]))
    assert rc["uid_1"] == "free"


# ── Revoking ────────────────────────────────────────────────────────────────

def test_expiration_revokes(rc):
    call(event(id="evt_3", type="EXPIRATION", entitlement_ids=["pro"]))
    assert rc["uid_1"] == "free"


def test_cancellation_does_not_revoke_early(rc):
    """Cancelling turns auto-renew off. The person keeps what they paid for
    until EXPIRATION, and taking it immediately would be taking paid time."""
    call(event(id="evt_4", type="CANCELLATION", entitlement_ids=["pro"]))
    assert "uid_1" not in rc


def test_billing_issue_does_not_revoke(rc):
    call(event(id="evt_5", type="BILLING_ISSUE", entitlement_ids=["pro"]))
    assert "uid_1" not in rc


# ── Idempotency and attribution ─────────────────────────────────────────────

def test_replayed_event_is_applied_once(rc):
    first = call(event())
    second = call(event())
    assert first["status"] == "ok"
    assert second["status"] == "duplicate"


def test_anonymous_purchase_is_flagged_not_silently_granted(rc):
    result = call(event(app_user_id="$RCAnonymousID:abc123"))
    assert result["status"] == "ignored"
    assert not rc, "an unattributable purchase must not grant a plan to anyone"


def test_transfer_drops_the_losing_account(rc):
    call(event(id="evt_6", type="TRANSFER", app_user_id="uid_new",
                     transferred_from=["uid_old", "$RCAnonymousID:x"]))
    assert rc["uid_old"] == "free"
    assert "$RCAnonymousID:x" not in rc


def test_missing_app_user_id_is_rejected(rc):
    with pytest.raises(HTTPException) as exc:
        call(event(app_user_id=""))
    assert exc.value.status_code == 422
