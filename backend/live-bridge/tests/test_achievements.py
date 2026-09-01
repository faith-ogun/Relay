"""Earning is an event. Once it has happened it cannot be un-happened.

Written because it had been happening, repeatedly, to real learners. Every
achievement was recomputed from live counters on every render, so any change to
how a counter was derived silently stripped medals from people who had done the
work. Three such changes shipped in one day; the loudest was the session split,
which cut 142 authored lessons into 284 shorter sessions. Unit completion was
"every lesson in this unit is done", so a learner who had finished the entire
curriculum was left with every part one complete and every part two untouched,
and up to four unit medals evaporated.

Two promises are pinned here, in the order a learner meets them:

  1. A unit is complete when its AUTHORED lessons are done. Cutting one lesson
     into two parts must not double the bar for the unit that holds it, and the
     same goes for the `builds` family, which also counts lessons.
  2. Anything stamped stays stamped. The counters may then go to zero, the
     corpus may be re-cut and a metric may be derived a different way; the medal
     does not move.

The second is the one worth the file. `test_a_counter_correction_cannot_take_a_
medal_back` drives exactly the failure that shipped: earn, then change the
arithmetic underneath, and assert the record does not care.

What these tests do NOT cover: interleaved commits. Firestore retries a
transaction whose reads were invalidated, and a single-threaded stand-in cannot
prove that. These pin the logic sitting on top of it, so a regression to a
read-outside-the-transaction shows up here as a double stamp.
"""

from __future__ import annotations

import inspect

import pytest

import achievements
import curriculum
from datetime import datetime, timedelta, timezone


# ── Firestore stand-in ───────────────────────────────────────────────────────
#
# Models `set(..., merge=True)` as a DEEP merge of nested maps, which is what the
# real client does and what `sync` relies on to keep previously stamped medals
# when it writes a new one. A shallow stand-in would make the multi-sync tests
# below pass against a fake that behaves better than production.


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
        if self._fail_read:
            raise RuntimeError("Firestore unavailable")
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


# ── A corpus small enough to reason about, cut the way the real one is ───────
#
#   u1 / skill-a   authored "A" -> A, "A II"
#                  authored "B" -> B, "B II"
#   u2 / skill-b   authored "C" -> C            (short enough not to be split)
#                  authored "D" -> D, "D II", "D III"
#
# Four authored lessons delivered as eight sessions, which is the ratio the real
# curriculum has (142 -> 284). "D Extra" is deliberately NOT a session of "D":
# its suffix is not a numeral, so nothing may fold it in.

FAKE_CURRICULUM = {
    "units": [
        {
            "id": "u1",
            "skills": [
                {"id": "skill-a", "lessons": [
                    {"id": "A"}, {"id": "A II"}, {"id": "B"}, {"id": "B II"},
                ]},
            ],
        },
        {
            "id": "u2",
            "skills": [
                {"id": "skill-b", "lessons": [
                    {"id": "C"}, {"id": "D"}, {"id": "D II"}, {"id": "D III"},
                ]},
            ],
        },
    ]
}

AUTHORED = ["A", "B", "C", "D"]
EVERY_SESSION = ["A", "A II", "B", "B II", "C", "D", "D II", "D III"]

FAKE_CATALOGUE = {
    "achievements": [
        {"id": "unit-1", "metric": "units", "threshold": 1},
        {"id": "unit-2", "metric": "units", "threshold": 2},
        {"id": "build-1", "metric": "builds", "threshold": 1},
        {"id": "build-4", "metric": "builds", "threshold": 4},
        {"id": "xp-100", "metric": "xp", "threshold": 100},
        {"id": "streak-3", "metric": "streak", "threshold": 3},
        {"id": "live-1", "metric": "liveSessions", "threshold": 1},
        {"id": "likes-10", "metric": "likes", "threshold": 10},
        {"id": "post-1", "metric": "posts", "threshold": 1},
    ]
}

NO_COMMUNITY = {"likesReceived": 0, "posts": 0, "comments": 0}


@pytest.fixture
def fake(monkeypatch):
    client = FakeClient()

    monkeypatch.setattr(curriculum, "_curriculum", lambda: FAKE_CURRICULUM)
    monkeypatch.setattr(curriculum, "_achievements", lambda: FAKE_CATALOGUE)
    monkeypatch.setattr(curriculum, "content_version", lambda: "test-version")

    # Both are lru_cached, so a real corpus cached by another test in the same
    # process would leak in here. Cleared on the way in and on the way out, so
    # this file neither inherits nor leaves a poisoned cache.
    achievements._corpus.cache_clear()
    achievements._catalogue.cache_clear()

    import state_store
    monkeypatch.setattr(state_store, "get_client", lambda: client)
    monkeypatch.setattr(
        state_store,
        "load_record",
        lambda uid, key: client.store.get(f"metrics_record/{uid}", {}),
    )

    import community
    monkeypatch.setattr(community, "community_stats", lambda claims: dict(NO_COMMUNITY))

    def passthrough(fn):
        def wrapper(transaction, *args, **kwargs):
            result = fn(transaction, *args, **kwargs)
            transaction.commit()
            return result
        return wrapper

    monkeypatch.setattr(achievements.firestore, "transactional", passthrough)

    yield client
    achievements._corpus.cache_clear()
    achievements._catalogue.cache_clear()


def complete(client, uid: str, *lesson_ids: str) -> None:
    """Mark sessions finished in the learner's state envelope."""
    key = f"{achievements.STATE_COLLECTION}/{uid}"
    doc = client.store.setdefault(key, {"data": {"lessonLevels": {}}})
    doc["data"].setdefault("lessonLevels", {}).update({lid: 1 for lid in lesson_ids})


def set_progress(client, uid: str, **fields) -> None:
    """Write progress fields, defaulting a streak to a LIVE one.

    A streak is only real if the learner was active today or yesterday, so
    `streak=10` on its own describes a streak that has already lapsed and reads
    as 0. Every test that passes a streak means a live one, so the last-active
    day is stamped to today unless the test sets it deliberately.
    """
    key = f"{achievements.STATE_COLLECTION}/{uid}"
    doc = client.store.setdefault(key, {"data": {"lessonLevels": {}}})
    if "streak" in fields and "lastActiveDate" not in fields:
        fields = {**fields, "lastActiveDate": datetime.now(timezone.utc).date().isoformat()}
    doc["data"].update(fields)


def set_metrics_record(client, uid: str, **counters) -> None:
    client.store[f"metrics_record/{uid}"] = {"data": dict(counters)}


def stamped(client, uid: str) -> dict:
    return client.store.get(f"{achievements.ACHIEVEMENTS_COLLECTION}/{uid}", {}).get("earned", {})


# ── Packaging independence: the bug Faith reported ───────────────────────────

def test_a_unit_is_complete_when_its_authored_lessons_are(fake):
    """The learner finished everything before the split, so they hold part one
    of every lesson and nothing else. They finished the curriculum."""
    complete(fake, "learner", *AUTHORED)
    assert achievements.units_completed(AUTHORED) == 2


def test_counting_sessions_is_what_took_the_medals_away(fake):
    """The old rule, stated explicitly so the regression is unmistakable."""
    done = set(AUTHORED)
    naive = sum(
        1
        for unit in FAKE_CURRICULUM["units"]
        if all(
            lesson["id"] in done
            for skill in unit["skills"]
            for lesson in skill["lessons"]
        )
    )
    assert naive == 0, "the fixture no longer reproduces the reported failure"
    assert achievements.units_completed(done) == 2


def test_splitting_a_lesson_does_not_double_the_bar(fake):
    """Sitting through every session is the same achievement as sitting through
    the uncut lessons: both are the whole curriculum."""
    assert achievements.units_completed(EVERY_SESSION) == 2
    assert achievements.units_completed(AUTHORED) == 2


def test_a_later_part_counts_for_its_authored_lesson(fake):
    """Progress keyed by a continuation id resolves to the same authored lesson."""
    assert achievements.units_completed(["A II", "B II", "C", "D III"]) == 2


def test_an_unfinished_unit_is_not_complete(fake):
    assert achievements.units_completed(["A", "A II"]) == 0
    assert achievements.units_completed(["A", "B"]) == 1


def test_builds_counts_authored_lessons_not_sessions(fake):
    """Otherwise re-cutting the corpus halves every threshold in the family."""
    complete(fake, "learner", *EVERY_SESSION)
    assert achievements.compute_stats("learner")["builds"] == 4

    fake.store.clear()
    complete(fake, "learner", *AUTHORED)
    assert achievements.compute_stats("learner")["builds"] == 4


def test_an_unsplit_id_is_left_alone(fake):
    corpus_ids = frozenset(EVERY_SESSION)
    assert achievements.authored_lesson_id("C", corpus_ids) == "C"
    assert achievements.authored_lesson_id("A II", corpus_ids) == "A"


def test_a_numeral_suffix_whose_head_is_not_a_lesson_is_not_folded(fake):
    """A lesson genuinely called "Chapter II" must not be swallowed by "Chapter"."""
    assert achievements.authored_lesson_id("Chapter II", frozenset({"Chapter II"})) == "Chapter II"


def test_part_one_never_carries_a_numeral_so_a_trailing_I_is_a_title(fake):
    ids = frozenset({"Grade", "Grade I"})
    assert achievements.authored_lesson_id("Grade I", ids) == "Grade I"


def test_progress_against_an_unknown_corpus_still_counts_as_a_build(fake):
    """Finished on a phone running a newer curriculum. Dropping it would lower
    the learner's total the moment they opened the other surface."""
    complete(fake, "learner", "A", "Something Else Entirely")
    assert achievements.compute_stats("learner")["builds"] == 2


# ── Reading the learner's own records ────────────────────────────────────────

def test_a_pre_levels_record_still_counts(fake):
    """The learners this record exists to protect are the ones whose progress is
    oldest, and the oldest shape is a flat list of ids."""
    fake.store[f"{achievements.STATE_COLLECTION}/learner"] = {
        "data": {"completedLessonIds": AUTHORED}
    }
    assert achievements.compute_stats("learner")["units"] == 2


def test_a_lesson_recorded_below_level_one_is_not_complete(fake):
    fake.store[f"{achievements.STATE_COLLECTION}/learner"] = {
        "data": {"lessonLevels": {"A": 1, "B": 0, "C": 1, "D": 1}}
    }
    assert achievements.compute_stats("learner")["units"] == 1


def test_counters_are_read_from_both_places_they_can_live(fake):
    """The web writes the keyed metrics record; installed phone builds nest the
    same counters inside the progress record. Whichever saw more activity wins."""
    set_progress(fake, "learner", metrics={"liveSessions": 7, "drawings": 1})
    set_metrics_record(fake, "learner", liveSessions=2, drawings=9)
    stats = achievements.compute_stats("learner")
    assert stats["liveSessions"] == 7
    assert stats["drawings"] == 9


def test_community_counters_come_from_the_server(fake, monkeypatch):
    import community
    monkeypatch.setattr(
        community,
        "community_stats",
        lambda claims: {"likesReceived": 12, "posts": 3, "comments": 0},
    )
    stats = achievements.compute_stats("learner")
    assert stats["likes"] == 12
    assert stats["posts"] == 3


def test_a_community_outage_never_lowers_anything_stamped(fake, monkeypatch):
    """A transient miss can only delay a stamp, because nothing is ever removed."""
    import community
    monkeypatch.setattr(
        community, "community_stats", lambda claims: {"likesReceived": 50, "posts": 5, "comments": 0},
    )
    first = achievements.sync("learner")
    assert "likes-10" in first["earned"]

    def boom(claims):
        raise RuntimeError("community down")

    monkeypatch.setattr(community, "community_stats", boom)
    second = achievements.sync("learner")
    assert second["stats"]["likes"] == 0
    assert "likes-10" in second["earned"], "an outage un-earned a medal"


# ── The backfill ─────────────────────────────────────────────────────────────

def test_a_learner_who_already_earned_it_is_backfilled_on_first_sync(fake):
    """Faith's learner: four unit medals before the change, opens the app after."""
    complete(fake, "learner", *AUTHORED)
    result = achievements.sync("learner")

    assert result["backfilled"] is True
    assert {"unit-1", "unit-2", "build-1", "build-4"} <= set(result["earned"])
    assert all(entry["backfilled"] for entry in result["earned"].values())
    assert result["newlyEarned"], "the backfill wrote nothing"


def test_a_new_learner_is_backfilled_nothing(fake):
    """The guard on the backfill: it stamps what the server can SEE is true, and
    a learner who has done nothing has nothing true."""
    result = achievements.sync("newcomer")
    assert result["earned"] == {}
    assert result["newlyEarned"] == []
    assert stamped(fake, "newcomer") == {}


def test_a_partly_finished_learner_is_backfilled_only_what_they_hold(fake):
    complete(fake, "learner", "A", "B")           # unit 1 only
    set_progress(fake, "learner", xp=40)          # short of xp-100
    result = achievements.sync("learner")
    assert set(result["earned"]) == {"unit-1", "build-1"}


def test_a_backfilled_stamp_says_so(fake):
    """The instant is when we NOTICED, not when it happened, so the client can
    avoid printing a date it cannot stand behind."""
    complete(fake, "learner", *AUTHORED)
    achievements.sync("learner")
    assert stamped(fake, "learner")["unit-2"]["backfilled"] is True


def test_something_earned_after_the_record_exists_is_not_marked_backfilled(fake):
    complete(fake, "learner", "A", "B")
    achievements.sync("learner")

    complete(fake, "learner", "C", "D")
    second = achievements.sync("learner")
    assert second["backfilled"] is False
    assert second["newlyEarned"] == ["build-4", "unit-2"]
    assert "backfilled" not in stamped(fake, "learner")["unit-2"]


# ── Never un-earned: the whole point ─────────────────────────────────────────

def test_a_counter_correction_cannot_take_a_medal_back(fake):
    """The exact failure that shipped, in miniature: earn the unit medals, then
    change how the counter is derived underneath them."""
    complete(fake, "learner", *AUTHORED)
    assert "unit-2" in achievements.sync("learner")["earned"]

    # The learner's record is now read against a corpus that has been re-cut, so
    # the live counter says they have finished nothing at all.
    fake.store[f"{achievements.STATE_COLLECTION}/learner"] = {"data": {"lessonLevels": {}}}
    after = achievements.sync("learner")

    assert after["stats"]["units"] == 0, "the fixture no longer reproduces the correction"
    assert "unit-2" in after["earned"], "a medal was un-earned"
    assert "unit-1" in after["earned"]


def test_xp_falling_below_the_threshold_keeps_the_medal(fake):
    set_progress(fake, "learner", xp=500)
    assert "xp-100" in achievements.sync("learner")["earned"]
    set_progress(fake, "learner", xp=0)
    assert "xp-100" in achievements.sync("learner")["earned"]


def test_a_broken_streak_keeps_the_medal(fake):
    set_progress(fake, "learner", streak=10)
    assert "streak-3" in achievements.sync("learner")["earned"]
    set_progress(fake, "learner", streak=1)
    assert "streak-3" in achievements.sync("learner")["earned"]


# ── A streak dies by the clock, not by an action ─────────────────────────────

def test_a_lapsed_streak_reads_as_zero(fake):
    """Reported 2026-08-30: a 2 day streak survived a full day off.

    The stored number is written by a completion, so nothing writes on the day a
    streak dies. Read raw, it stays up forever.
    """
    stale = (datetime.now(timezone.utc).date() - timedelta(days=3)).isoformat()
    set_progress(fake, "learner", streak=12, lastActiveDate=stale)
    assert achievements.sync("learner")["stats"]["streak"] == 0


def test_yesterday_still_counts(fake):
    """Missing TODAY breaks nothing while today is still running."""
    yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    set_progress(fake, "learner", streak=12, lastActiveDate=yesterday)
    assert achievements.sync("learner")["stats"]["streak"] == 12


def test_a_lapsed_streak_cannot_mint_a_NEW_medal(fake):
    """The half that matters. Medals are permanent, so one minted on a streak the
    learner no longer holds can never be taken back."""
    stale = (datetime.now(timezone.utc).date() - timedelta(days=30)).isoformat()
    set_progress(fake, "learner", streak=30, lastActiveDate=stale)
    earned = achievements.sync("learner")["earned"]
    assert "streak-3" not in earned, (
        "a 30 day streak abandoned a month ago minted a streak medal. "
        "The learner can see the app reporting no streak while the medal says otherwise."
    )


# ── Idempotency ──────────────────────────────────────────────────────────────

def test_syncing_twice_stamps_nothing_the_second_time(fake):
    complete(fake, "learner", *AUTHORED)
    first = achievements.sync("learner")
    second = achievements.sync("learner")

    assert first["newlyEarned"]
    assert second["newlyEarned"] == [], "a second sync re-stamped"
    assert set(first["earned"]) == set(second["earned"])


def test_syncing_many_times_never_moves_the_instant(fake):
    complete(fake, "learner", *AUTHORED)
    first_at = achievements.sync("learner")["earned"]["unit-2"]["at"]
    for _ in range(5):
        achievements.sync("learner")
    assert stamped(fake, "learner")["unit-2"]["at"] == first_at


def test_a_second_device_finds_the_medal_already_recorded(fake):
    """Earned on the phone, then the web app opens."""
    complete(fake, "learner", *AUTHORED)
    phone = achievements.sync("learner")
    web = achievements.sync("learner")
    assert web["newlyEarned"] == [], "the web would fire a ceremony for an old medal"
    assert set(web["earned"]) == set(phone["earned"])


def test_a_new_medal_after_a_sync_keeps_the_earlier_ones(fake):
    """The merge write must not replace the map it is adding to."""
    complete(fake, "learner", "A", "B")
    achievements.sync("learner")
    set_progress(fake, "learner", xp=1000)
    result = achievements.sync("learner")
    assert {"unit-1", "build-1", "xp-100"} <= set(result["earned"])
    assert {"unit-1", "build-1", "xp-100"} <= set(stamped(fake, "learner"))


def test_the_record_is_created_when_none_exists(fake):
    assert f"{achievements.ACHIEVEMENTS_COLLECTION}/learner" not in fake.store
    complete(fake, "learner", "A")
    achievements.sync("learner")
    assert stamped(fake, "learner")


# ── Failure ──────────────────────────────────────────────────────────────────

def test_a_failed_stamp_does_not_blank_the_trophy_case(fake):
    complete(fake, "learner", *AUTHORED)
    achievements.sync("learner")

    fake.failing.add(achievements.ACHIEVEMENTS_COLLECTION)
    result = achievements.sync("learner")
    assert result["synced"] is False
    assert result["earned"] == {}, "a read that failed cannot invent a record"

    fake.failing.clear()
    assert "unit-2" in achievements.sync("learner")["earned"], "the stamp was lost"


def test_an_unreadable_state_envelope_stamps_nothing(fake):
    """Failing closed is right here: the cost is a medal stamped a moment later,
    and the alternative is stamping one nobody earned."""
    fake.failing.add(achievements.STATE_COLLECTION)
    result = achievements.sync("learner")
    assert result["earned"] == {}


# ── Privacy: the record is personal data ─────────────────────────────────────

def test_the_earned_record_is_exported_and_erased():
    """A new collection holding a uid must be reachable by both rights, or the
    two disagree and a learner can delete data they were never shown."""
    import privacy

    assert "achievements" in inspect.getsource(privacy.export_data)
    assert (
        "ACHIEVEMENTS_COLLECTION" in inspect.getsource(privacy.delete_account)
    ), "the earned record survives account deletion"


# ── The correction that arrives WITH the record ──────────────────────────────
#
# `builds` was the count of completed lesson IDS on both shipped surfaces, and
# the corpus is served as sessions, so it read roughly double. Counting authored
# lessons is right and it halves that number: the medal a learner is holding
# today goes dark tomorrow. The record cannot protect them, because their first
# sync happens after the new arithmetic. So the first sync, and only the first,
# also measures them against what they were shown. See `as_last_displayed`.


def test_a_medal_the_old_counter_showed_survives_the_new_one(fake):
    """Four sessions, two authored lessons. `build-4` was lit yesterday."""
    complete(fake, "learner", *EVERY_SESSION[:4])  # A, A II, B, B II
    assert achievements.compute_stats("learner")["builds"] == 2, "the correction halves it"
    earned = achievements.sync("learner")["earned"]
    assert "build-4" in earned, "the correction took back a medal the learner held"
    assert earned["build-4"]["backfilled"] is True


def test_the_grandfather_pass_runs_once_and_never_again(fake):
    """A second sync uses the corrected counters alone, and still cannot remove
    anything: the first stamp stands."""
    complete(fake, "learner", *EVERY_SESSION[:4])
    first = achievements.sync("learner")
    second = achievements.sync("learner")
    assert second["newlyEarned"] == []
    assert second["earned"]["build-4"]["at"] == first["earned"]["build-4"]["at"]


def test_the_grandfather_pass_invents_nothing(fake):
    """It is the higher of two counts of the SAME work, so a learner who never
    reached a threshold under either rule is stamped nothing."""
    complete(fake, "learner", "A", "A II")
    earned = achievements.sync("learner")["earned"]
    assert "build-4" not in earned
    assert "unit-1" not in earned
    assert sorted(earned) == ["build-1"]


def test_a_new_learner_is_stamped_nothing(fake):
    assert achievements.sync("nobody")["earned"] == {}


def test_the_corrected_stats_are_what_the_client_draws_with(fake):
    """The grandfather feeds the stamp, never the numbers on screen: a progress
    ring reading 4 / 4 next to a locked card would be a lie."""
    complete(fake, "learner", *EVERY_SESSION[:4])
    assert achievements.sync("learner")["stats"]["builds"] == 2
