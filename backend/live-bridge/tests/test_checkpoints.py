"""The checkpoint claim contract: earned once, verified, paid exactly once.

Written because the endpoint had no coverage and no caller. It was transactional
and correct, and the chest on the path paid nothing, because nothing on either
surface ever called it. Tests would not have caught that on their own, which is
what frontend/scripts/check-api-coverage.mjs is for. What they do catch is the
half that matters once a caller exists: that the second call pays zero.

The promise these pin down, in the order a learner meets it:

  1. Only multi-lesson skills carry a checkpoint, so the ceremony stays rare.
  2. The payout is computed from the authored step count, not sent by a client.
  3. A skill pays only when every lesson in it is genuinely complete.
  4. A second claim grants nothing, whoever makes it and from wherever.

Point 4 is the one worth the file. A learner who taps twice, or claims on their
phone and then opens the web app, must be paid once. The server is the only
place that can promise that, because it is the only place that sees both.

What these tests do NOT cover: interleaved commits. Firestore retries a
transaction whose reads were invalidated, and a single-threaded stand-in cannot
prove that. These pin the logic sitting on top of it, so a regression to a
read-outside-the-transaction shows up here as a double grant.
"""

from __future__ import annotations

import pytest

import checkpoints
import curriculum


# ── Firestore stand-in ───────────────────────────────────────────────────────
#
# Deliberately models one subtlety rather than glossing it: `set(..., merge=True)`
# merges NESTED maps field by field rather than replacing them. claim_all writes
# `{"claimed": {skill: ...}}` with merge, and relies on that to keep previously
# claimed skills. A stand-in with a shallow update would drop them, which would
# make the multi-skill tests below pass against a fake that behaves better than
# the real thing, or fail against code that is right.


def _deep_merge(dst: dict, src: dict) -> None:
    for key, value in src.items():
        if isinstance(value, dict) and isinstance(dst.get(key), dict):
            _deep_merge(dst[key], value)
        else:
            dst[key] = value


class FakeSnapshot:
    def __init__(self, data):
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return dict(self._data) if self._data is not None else None


class FakeDoc:
    def __init__(self, store, key, fail_read=False):
        self._store = store
        self._key = key
        self._fail_read = fail_read

    def get(self, transaction=None):
        if self._fail_read:
            raise RuntimeError("Firestore unavailable")
        return FakeSnapshot(self._store.get(self._key))

    def set(self, data, merge=False):
        if merge and self._key in self._store:
            _deep_merge(self._store[self._key], data)
        else:
            self._store[self._key] = dict(data)


class FakeCollection:
    def __init__(self, store, name, failing):
        self._store = store
        self._name = name
        self._failing = failing

    def document(self, doc_id=None):
        return FakeDoc(self._store, f"{self._name}/{doc_id}", self._name in self._failing)


class FakeTransaction:
    """Writes buffer until commit, as a real transaction does."""

    def __init__(self):
        self._writes = []

    def set(self, ref, data, merge=False):
        self._writes.append(lambda: ref.set(data, merge=merge))

    def commit(self):
        for write in self._writes:
            write()
        self._writes.clear()


class FakeClient:
    def __init__(self):
        self.store: dict[str, dict] = {}
        self.failing: set[str] = set()

    def collection(self, name):
        return FakeCollection(self.store, name, self.failing)

    def transaction(self):
        return FakeTransaction()


# ── A curriculum small enough to reason about ────────────────────────────────
#
# Built through the real loaders rather than by patching _skill_index, so the
# eligibility rule and the step counting are exercised rather than assumed.
#
#   u1/skill-a  2 lessons, 20 steps  -> 20 * 0.5 = 10 XP
#   u1/skill-b  3 lessons, 30 steps  -> 30 * 0.5 = 15 XP
#   u1/solo     1 lesson,  40 steps  -> no checkpoint at all

FAKE_CURRICULUM = {
    "units": [
        {
            "id": "u1",
            "skills": [
                {"id": "skill-a", "title": "Ohm's Law", "lessons": [{"id": "a1"}, {"id": "a2"}]},
                {"id": "skill-b", "title": "Series Circuits",
                 "lessons": [{"id": "b1"}, {"id": "b2"}, {"id": "b3"}]},
                {"id": "solo", "title": "One Off", "lessons": [{"id": "s1"}]},
            ],
        }
    ]
}

FAKE_LESSONS = {
    "lessons": {
        "a1": {"steps": [{}] * 10}, "a2": {"steps": [{}] * 10},
        "b1": {"steps": [{}] * 10}, "b2": {"steps": [{}] * 10}, "b3": {"steps": [{}] * 10},
        "s1": {"steps": [{}] * 40},
    }
}

ALL_LESSONS = ["a1", "a2", "b1", "b2", "b3", "s1"]


@pytest.fixture
def fake(monkeypatch):
    client = FakeClient()

    monkeypatch.setattr(curriculum, "_curriculum", lambda: FAKE_CURRICULUM)
    monkeypatch.setattr(curriculum, "_lessons", lambda: FAKE_LESSONS)
    # _skill_index is lru_cached, so a real curriculum cached by another test in
    # the same process would leak in here. Cleared on the way in and on the way
    # out, so this file neither inherits nor leaves a poisoned cache.
    checkpoints._skill_index.cache_clear()

    import state_store
    monkeypatch.setattr(state_store, "get_client", lambda: client)

    def passthrough(fn):
        def wrapper(transaction, *args, **kwargs):
            result = fn(transaction, *args, **kwargs)
            transaction.commit()
            return result
        return wrapper

    monkeypatch.setattr(checkpoints.firestore, "transactional", passthrough)

    yield client
    checkpoints._skill_index.cache_clear()


def complete(client, uid: str, *lesson_ids: str) -> None:
    """Mark lessons finished in the learner's state envelope."""
    key = f"{checkpoints.STATE_COLLECTION}/{uid}"
    data = client.store.setdefault(key, {"data": {"lessonLevels": {}}})
    data["data"]["lessonLevels"].update({lid: 1 for lid in lesson_ids})


def claimed_of(client, uid: str) -> dict:
    return client.store.get(f"{checkpoints.CHECKPOINTS_COLLECTION}/{uid}", {}).get("claimed", {})


# ── Which skills carry a checkpoint at all ───────────────────────────────────

def test_single_lesson_skills_carry_no_checkpoint(fake):
    """A celebration every other screen is not a reward."""
    index = checkpoints._skill_index()
    assert set(index) == {"skill-a", "skill-b"}
    assert "solo" not in index
    assert checkpoints.xp_for("solo") == 0


def test_payout_scales_with_steps_not_lesson_count(fake):
    assert checkpoints.xp_for("skill-a") == 10   # 20 steps
    assert checkpoints.xp_for("skill-b") == 15   # 30 steps
    assert checkpoints.xp_for("no-such-skill") == 0


def test_payout_is_a_round_number_with_a_floor(fake):
    for skill_id in ("skill-a", "skill-b"):
        xp = checkpoints.xp_for(skill_id)
        assert xp % 5 == 0, "a reward should read as a reward, not as arithmetic"
        assert xp >= 5


# ── status: what is earned, what is owed ─────────────────────────────────────

def test_nothing_available_before_any_lesson_is_done(fake):
    status = checkpoints.status("learner")
    assert status["available"] == []
    assert status["claimed"] == {}
    assert status["totalClaimedXp"] == 0


def test_a_partly_finished_skill_is_not_available(fake):
    complete(fake, "learner", "a1")
    assert checkpoints.status("learner")["available"] == []


def test_a_finished_skill_becomes_available(fake):
    complete(fake, "learner", "a1", "a2")
    available = checkpoints.status("learner")["available"]
    assert [a["skillId"] for a in available] == ["skill-a"]
    assert available[0] == {"skillId": "skill-a", "title": "Ohm's Law", "unitId": "u1", "xp": 10}


def test_finishing_a_single_lesson_skill_never_becomes_available(fake):
    complete(fake, "learner", "s1")
    assert checkpoints.status("learner")["available"] == []


def test_claimed_checkpoints_leave_the_available_list(fake):
    complete(fake, "learner", *ALL_LESSONS)
    checkpoints.claim_all("learner")
    status = checkpoints.status("learner")
    assert status["available"] == []
    assert status["totalClaimedXp"] == 25


# ── claim_all: the payout ────────────────────────────────────────────────────

def test_claim_pays_every_earned_skill_at_once(fake):
    complete(fake, "learner", *ALL_LESSONS)
    result = checkpoints.claim_all("learner")
    assert {g["skillId"] for g in result["granted"]} == {"skill-a", "skill-b"}
    assert result["xp"] == 25
    assert result["xp"] == sum(g["xp"] for g in result["granted"])


def test_claim_pays_nothing_for_unfinished_work(fake):
    complete(fake, "learner", "a1", "b1", "b2")
    result = checkpoints.claim_all("learner")
    assert result["granted"] == []
    assert result["xp"] == 0


def test_claim_records_what_it_paid(fake):
    complete(fake, "learner", "a1", "a2")
    checkpoints.claim_all("learner")
    record = claimed_of(fake, "learner")
    assert set(record) == {"skill-a"}
    assert record["skill-a"]["xp"] == 10
    assert record["skill-a"]["at"], "a grant with no timestamp cannot be audited"


def test_claim_creates_the_record_when_none_exists(fake):
    """A first-ever claim must not need a document to already be there."""
    assert f"{checkpoints.CHECKPOINTS_COLLECTION}/learner" not in fake.store
    complete(fake, "learner", "a1", "a2")
    assert checkpoints.claim_all("learner")["xp"] == 10


# ── Idempotency: the whole point ─────────────────────────────────────────────

def test_claiming_twice_grants_nothing_the_second_time(fake):
    """The double tap."""
    complete(fake, "learner", *ALL_LESSONS)
    first = checkpoints.claim_all("learner")
    second = checkpoints.claim_all("learner")

    assert first["xp"] == 25
    assert second["xp"] == 0, "a second claim printed XP"
    assert second["granted"] == []
    assert checkpoints.status("learner")["totalClaimedXp"] == 25


def test_claiming_many_times_never_pays_twice(fake):
    complete(fake, "learner", *ALL_LESSONS)
    total = sum(checkpoints.claim_all("learner")["xp"] for _ in range(10))
    assert total == 25
    assert checkpoints.status("learner")["totalClaimedXp"] == 25


def test_a_second_device_finds_the_work_already_paid(fake):
    """Claimed on the phone, then the web app opens.

    The web client's ledger reconciles against totalClaimedXp, so the number it
    shows has to be the same one the phone was paid, and the claim it makes on
    open has to grant zero. Both are asserted here because a client cannot be
    correct if either is not.
    """
    complete(fake, "learner", "a1", "a2")
    phone = checkpoints.claim_all("learner")
    assert phone["xp"] == 10

    web_status = checkpoints.status("learner")
    assert web_status["totalClaimedXp"] == 10
    assert web_status["available"] == [], "the web would fire a ceremony for an already-paid checkpoint"
    assert checkpoints.claim_all("learner")["granted"] == []


def test_new_work_after_a_claim_pays_only_the_new_skill(fake):
    complete(fake, "learner", "a1", "a2")
    assert checkpoints.claim_all("learner")["xp"] == 10

    complete(fake, "learner", "b1", "b2", "b3")
    second = checkpoints.claim_all("learner")
    assert [g["skillId"] for g in second["granted"]] == ["skill-b"]
    assert second["xp"] == 15

    # The earlier grant survived the merge write rather than being overwritten.
    assert set(claimed_of(fake, "learner")) == {"skill-a", "skill-b"}
    assert checkpoints.status("learner")["totalClaimedXp"] == 25


def test_replaying_a_finished_lesson_does_not_re_pay(fake):
    """Redoing a lesson is normal. Being paid for redoing it is not."""
    complete(fake, "learner", "a1", "a2")
    checkpoints.claim_all("learner")
    complete(fake, "learner", "a1", "a2")  # replayed
    assert checkpoints.claim_all("learner")["xp"] == 0


def test_total_claimed_xp_always_equals_the_sum_of_grants(fake):
    """The invariant both clients' ledgers subtract against."""
    complete(fake, "learner", "a1", "a2")
    paid = checkpoints.claim_all("learner")["xp"]
    complete(fake, "learner", "b1", "b2", "b3")
    paid += checkpoints.claim_all("learner")["xp"]
    assert checkpoints.status("learner")["totalClaimedXp"] == paid


def test_a_claim_moves_the_total_by_exactly_what_it_granted(fake):
    """The anchor both clients fold a fresh grant against.

    A client cannot add the grant to whatever its ledger happens to hold when the
    reply lands. Two things can fold the same grant first: a background status
    refresh that raced the claim, and a second tap sharing the same in-flight
    request. Either way the delta is applied twice and the learner is paid twice.
    So the clients fold to an ABSOLUTE total instead, built as "the total I last
    saw" plus "what this claim granted", which is a no-op when something else
    already got there. That is only sound if a claim moves the server's total by
    exactly the XP it reports, which is what this pins.
    See `foldClaim` in frontend/services/checkpoints.ts.
    """
    complete(fake, "learner", "a1", "a2")
    before = checkpoints.status("learner")["totalClaimedXp"]
    grant = checkpoints.claim_all("learner")
    assert checkpoints.status("learner")["totalClaimedXp"] == before + grant["xp"]

    complete(fake, "learner", "b1", "b2", "b3")
    before = checkpoints.status("learner")["totalClaimedXp"]
    grant = checkpoints.claim_all("learner")
    assert checkpoints.status("learner")["totalClaimedXp"] == before + grant["xp"]

    # A claim that grants nothing must move it not at all, so folding after an
    # empty claim writes nothing rather than nudging the ledger off the total.
    before = checkpoints.status("learner")["totalClaimedXp"]
    assert checkpoints.claim_all("learner")["xp"] == 0
    assert checkpoints.status("learner")["totalClaimedXp"] == before


def test_a_stale_anchor_lands_short_of_the_total_never_over(fake):
    """Two devices, and the one collecting read the total before the other paid.

    The anchor a client folds against is whatever GET /checkpoints last told it,
    which on a second device can be out of date. Landing SHORT is fine and
    self-healing: the next reconcile against a fetched total adds the remainder.
    Landing OVER is not, because the excess would be XP no grant ever backed.

    It cannot land over, and the reason is structural: the skills in `granted`
    were absent from the claim record when the server read it, so they were
    absent from the older read the anchor came from too. Anchor plus grant is
    therefore at most the true total.
    """
    complete(fake, "learner", "a1", "a2")

    # The phone reads the total, and puts the panel on screen showing 0 claimed.
    stale_anchor = checkpoints.status("learner")["totalClaimedXp"]
    assert stale_anchor == 0

    # The web collects skill-a while the phone's panel still says 0.
    assert checkpoints.claim_all("learner")["xp"] == 10

    # The learner finishes skill-b and taps Collect on the phone, whose anchor
    # is still the 0 it read before any of that happened.
    complete(fake, "learner", "b1", "b2", "b3")
    grant = checkpoints.claim_all("learner")
    assert grant["xp"] == 15

    true_total = checkpoints.status("learner")["totalClaimedXp"]
    assert true_total == 25
    assert stale_anchor + grant["xp"] == 15
    assert stale_anchor + grant["xp"] < true_total, "a stale anchor must never overshoot"


# ── Failing closed ───────────────────────────────────────────────────────────

def test_unreadable_state_grants_nothing(fake):
    """Never pay for work we cannot see."""
    complete(fake, "learner", *ALL_LESSONS)
    fake.failing.add(checkpoints.STATE_COLLECTION)
    assert checkpoints.claim_all("learner")["granted"] == []


def test_malformed_state_grants_nothing(fake):
    fake.store[f"{checkpoints.STATE_COLLECTION}/learner"] = {"data": {"lessonLevels": "not-a-map"}}
    assert checkpoints.claim_all("learner")["granted"] == []


def test_a_failed_claim_write_raises_rather_than_reporting_a_silent_zero(fake):
    """A swallowed failure looks exactly like an honest empty grant.

    The learner would see a checkpoint that paid nothing and have no way to tell
    the difference, so the endpoint must surface it instead.
    """
    complete(fake, "learner", "a1", "a2")
    fake.failing.add(checkpoints.CHECKPOINTS_COLLECTION)
    with pytest.raises(RuntimeError):
        checkpoints.claim_all("learner")


def test_learners_do_not_share_checkpoints(fake):
    complete(fake, "one", "a1", "a2")
    complete(fake, "two", "a1", "a2")
    assert checkpoints.claim_all("one")["xp"] == 10
    assert checkpoints.claim_all("two")["xp"] == 10, "a claim by one learner paid out another's"
    assert checkpoints.status("one")["totalClaimedXp"] == 10
