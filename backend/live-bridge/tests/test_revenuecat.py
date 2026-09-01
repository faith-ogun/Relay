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


class Plans(dict):
    """uid -> plan, with the full argument list of every write kept alongside.

    A plain dict was enough until the write grew a `setBy` stamp. Provenance that
    is only tolerated by a test fixture is provenance nothing checks, and this one
    exists precisely because a stale `setBy: admin-console` survived a merge and
    misattributed a RevenueCat grant in production Firestore on 2026-08-30.
    """

    def __init__(self) -> None:
        super().__init__()
        self.writes: list[dict] = []


@pytest.fixture
def rc(monkeypatch):
    """A configured webhook with the plan writes and idempotency captured."""
    monkeypatch.setattr(revenuecat, "WEBHOOK_SECRET", "shhh")
    plans = Plans()

    def set_plan(uid, plan, environment="PRODUCTION", source="system"):
        plans[uid] = plan
        plans.writes.append({"uid": uid, "plan": plan, "environment": environment, "source": source})

    monkeypatch.setattr(revenuecat.entitlements, "set_plan", set_plan)
    # Production by default. The sandbox tests flip it deliberately, so a test
    # that forgets is testing the shipped posture rather than a lucky one.
    monkeypatch.setattr(revenuecat, "ACCEPT_SANDBOX", False)
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


def test_a_sandbox_purchase_grants_nothing_by_default(rc):
    """Sandbox purchases cost nothing.

    RevenueCat stamps every event with an environment, and the handler ignored it
    until 2026-08-30. An Apple sandbox tester could therefore have granted
    themselves Max, free, in production Firestore, permanently. RevenueCat's own
    "secure your sandbox access" list is the other half of this; neither is
    sufficient alone.
    """
    body = {"event": {"id": "e-sandbox", "type": "INITIAL_PURCHASE",
                      "app_user_id": "uid-1", "entitlement_ids": ["max"],
                      "environment": "SANDBOX"}}
    res = asyncio.run(revenuecat.webhook(FakeRequest(body)))
    assert res["reason"] == "sandbox"
    assert "uid-1" not in rc


def test_sandbox_is_accepted_when_deliberately_switched_on(rc, monkeypatch):
    """Refusing ALWAYS would make the end-to-end test unverifiable: a purchase
    would reach RevenueCat and stop, and "the webhook fired" is not the same
    evidence as "the learner's plan changed"."""
    monkeypatch.setattr(revenuecat, "ACCEPT_SANDBOX", True)
    body = {"event": {"id": "e-sandbox-ok", "type": "INITIAL_PURCHASE",
                      "app_user_id": "uid-2", "entitlement_ids": ["pro"],
                      "environment": "SANDBOX"}}
    asyncio.run(revenuecat.webhook(FakeRequest(body)))
    assert rc.get("uid-2") == "pro"


def test_an_event_with_no_environment_is_treated_as_production(rc):
    """The unknown case must not be the free one. Older payloads and anything
    unexpected are production, so a missing field cannot become a way in."""
    body = {"event": {"id": "e-noenv", "type": "INITIAL_PURCHASE",
                      "app_user_id": "uid-3", "entitlement_ids": ["max"]}}
    asyncio.run(revenuecat.webhook(FakeRequest(body)))
    assert rc.get("uid-3") == "max"


def test_the_wizards_entitlement_names_grant_the_right_plan(rc):
    """RevenueCat's onboarding wizard names entitlements after the app.

    Ohmlet's are `ohmlet_pro` and `ohmlet_max`, and RevenueCat will not let the
    ones it created be deleted. A map holding only `pro` and `max` recognised
    neither, so a purchase would have charged the card and granted the free tier:
    the worst possible outcome, because everything downstream looks healthy.
    """
    body = {"event": {"id": "e-wizard", "type": "INITIAL_PURCHASE",
                      "app_user_id": "uid-w", "entitlement_ids": ["ohmlet_max"]}}
    asyncio.run(revenuecat.webhook(FakeRequest(body)))
    assert rc.get("uid-w") == "max"


def test_holding_both_tiers_keeps_the_higher_one(rc):
    """Highest wins, so a mapping change can never silently downgrade somebody
    who is paying."""
    body = {"event": {"id": "e-both", "type": "RENEWAL",
                      "app_user_id": "uid-b", "entitlement_ids": ["ohmlet_pro", "ohmlet_max"]}}
    asyncio.run(revenuecat.webhook(FakeRequest(body)))
    assert rc.get("uid-b") == "max"


# ── Provenance ──────────────────────────────────────────────────────────────

def test_every_grant_names_revenuecat_as_its_source(rc):
    """The plan document merges, so a `setBy` nobody rewrites outlives the truth.

    On 2026-08-30 a document read `setBy: admin-console` from a manual edit five
    days earlier while RevenueCat was the one granting Max. The pre-launch sweep
    for test grants reads this field, so a wrong value there is not cosmetic.
    """
    call(event())
    call(event(id="evt_x", type="EXPIRATION"))
    assert rc.writes, "no plan write was recorded"
    sources = {w["source"] for w in rc.writes}
    assert sources == {"revenuecat"}, (
        f"grants and revokes must both be stamped 'revenuecat', got {sources}. "
        "A default of 'system' leaves whatever the document said before."
    )


def test_transfer_stamps_the_losing_account_too(rc):
    """The losing side of a transfer is a plan write like any other."""
    call(event(type="TRANSFER", transferred_from=["uid_old"]))
    losing = [w for w in rc.writes if w["uid"] == "uid_old"]
    assert losing, "the losing account was never downgraded"
    assert losing[0]["source"] == "revenuecat"
