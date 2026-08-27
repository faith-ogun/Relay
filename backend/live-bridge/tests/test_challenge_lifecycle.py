"""The challenge lifecycle: instances, rollover, closing, and settlement.

Before this, a challenge was a static document with a `durationDays` field no
code path ever compared to a clock and a `progress` field written once as zero
and never again. These tests pin the behaviour that replaced it, and they lean on
the questions that exposed the gap in the first place:

  - Does a challenge recur, and on what clock?
  - What happens at the end: is a winner declared, are standings frozen?
  - What happens on day 8 of a seven day streak?
  - What if you join on day 5? What if nobody finishes? How are ties broken?

What they do NOT cover is the concurrency guarantee itself. Interleaved commits
are Firestore's job, and a single threaded stand-in cannot prove it. What they do
cover is the logic sitting on top: a second reader finds the instance already
there, a second close writes identical standings, a second settlement grants
nothing. A regression to a post-write read shows up here as a duplicate instance
or a doubled award.
"""

from __future__ import annotations

import copy
import re
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

import community


# ── In-memory Firestore, with the query surface this module actually uses ──

class FakeSnapshot:
    def __init__(self, key: str, data: dict | None, reference=None):
        self.id = key.split("/")[-1]
        self._data = data
        self.exists = data is not None
        self.reference = reference

    def to_dict(self):
        return copy.deepcopy(self._data) if self._data is not None else None


class FakeDoc:
    def __init__(self, store: dict, key: str):
        self._store = store
        self._key = key
        self.id = key.split("/")[-1]

    def get(self, transaction=None) -> FakeSnapshot:
        return FakeSnapshot(self._key, self._store.get(self._key), reference=self)

    def set(self, data: dict, merge: bool = False) -> None:
        if merge and self._key in self._store:
            self._store[self._key].update(copy.deepcopy(data))
        else:
            self._store[self._key] = copy.deepcopy(data)

    def update(self, data: dict) -> None:
        self._store.setdefault(self._key, {}).update(copy.deepcopy(data))

    def delete(self) -> None:
        self._store.pop(self._key, None)


class FakeQuery:
    def __init__(self, store: dict, name: str, field: str, value, cap: int | None = None):
        self._store, self._name, self._field, self._value, self._cap = store, name, field, value, cap

    def limit(self, cap: int) -> "FakeQuery":
        return FakeQuery(self._store, self._name, self._field, self._value, cap)

    def stream(self):
        rows = [
            FakeSnapshot(k, v, reference=FakeDoc(self._store, k))
            for k, v in sorted(self._store.items())
            if k.startswith(f"{self._name}/") and v.get(self._field) == self._value
        ]
        return rows[: self._cap] if self._cap else rows


class FakeCollection:
    _auto = 0

    def __init__(self, store: dict, name: str):
        self._store, self._name = store, name

    def document(self, doc_id: str | None = None) -> FakeDoc:
        if doc_id is None:
            FakeCollection._auto += 1
            doc_id = f"auto{FakeCollection._auto}"
        return FakeDoc(self._store, f"{self._name}/{doc_id}")

    def where(self, *, filter) -> FakeQuery:  # noqa: A002 - mirrors the Firestore kwarg
        return FakeQuery(self._store, self._name, filter.field_path, filter.value)

    def stream(self):
        return [
            FakeSnapshot(k, v, reference=FakeDoc(self._store, k))
            for k, v in sorted(self._store.items())
            if k.startswith(f"{self._name}/")
        ]


class FakeTransaction:
    """Writes are buffered and applied on commit, as a real transaction does."""

    def __init__(self):
        self._writes = []

    def set(self, ref, data, merge=False):
        self._writes.append(lambda: ref.set(data, merge=merge))

    def update(self, ref, data):
        self._writes.append(lambda: ref.update(data))

    def delete(self, ref):
        self._writes.append(lambda: ref.delete())

    def commit(self):
        for write in self._writes:
            write()
        self._writes.clear()


class FakeClient:
    def __init__(self):
        self.store: dict[str, dict] = {}

    def collection(self, name: str) -> FakeCollection:
        return FakeCollection(self.store, name)

    def transaction(self) -> FakeTransaction:
        return FakeTransaction()


class Clock:
    def __init__(self, start: datetime):
        self.now = start

    def advance(self, **kwargs) -> None:
        self.now = self.now + timedelta(**kwargs)


# A Monday morning, so the default starting position is the top of a fresh week
# and a test that wants a late join advances into one deliberately.
BASE = datetime(2026, 8, 24, 9, 0, tzinfo=timezone.utc)


@pytest.fixture
def env(monkeypatch):
    client = FakeClient()
    clock = Clock(BASE)

    monkeypatch.setattr(community, "_client", lambda: client)
    monkeypatch.setattr(community, "_utcnow", lambda: clock.now)
    monkeypatch.setattr(community, "_now", lambda: clock.now.isoformat())

    def passthrough(fn):
        def wrapper(transaction, *args, **kwargs):
            result = fn(transaction, *args, **kwargs)
            transaction.commit()
            return result
        return wrapper

    monkeypatch.setattr(community.firestore, "transactional", passthrough)
    community._instance_cache.clear()
    yield client, clock
    community._instance_cache.clear()


def claims(uid: str, name: str = "") -> dict:
    return {"uid": uid, "name": name or uid.title()}


def instances(client) -> list[dict]:
    return [v for k, v in client.store.items() if k.startswith(f"{community.INSTANCES}/")]


def entries(client) -> list[dict]:
    return [v for k, v in client.store.items() if k.startswith(f"{community.ENTRIES}/")]


STREAK = community.TEMPLATES["streak7"]
SEASON = community.TEMPLATES["streak30"]
LESSONS = community.TEMPLATES["firstlight"]
POSTS_CHALLENGE = community.TEMPLATES["teachback"]

# The two day-counted targets, written out rather than read from the templates.
# A test that asks the thing under test what its target is cannot fail when that
# target changes, and these numbers are the decision (Faith, 2026-08-27), not an
# implementation detail: five active days inside the seven day week, twenty
# inside the season.
STREAK_TARGET, STREAK_WINDOW = 5, 7
SEASON_TARGET, SEASON_WINDOW = 20, 90


# ── The clock: UTC week and quarter boundaries ──

def test_week_period_is_anchored_to_monday_midnight_utc():
    key, start, end = community._week_period(BASE)
    assert start == datetime(2026, 8, 24, tzinfo=timezone.utc), "the window did not start on Monday"
    assert start <= BASE < end
    assert end == start + timedelta(days=7)
    assert start.hour == 0 and start.minute == 0


def test_week_key_matches_the_iso_calendar():
    key, start, _ = community._week_period(BASE)
    year, week, _day = start.isocalendar()
    assert key == f"{year}-W{week:02d}"


def test_every_instant_in_a_week_maps_to_one_key():
    key, start, end = community._week_period(BASE)
    assert community._week_period(start)[0] == key
    assert community._week_period(end - timedelta(seconds=1))[0] == key
    assert community._week_period(end)[0] != key, "the boundary did not open a new period"


def test_season_period_is_the_calendar_quarter():
    key, start, end = community._season_period(BASE)
    assert key == "2026-S3"
    assert start == datetime(2026, 7, 1, tzinfo=timezone.utc)
    assert end == datetime(2026, 10, 1, tzinfo=timezone.utc)


def test_season_period_rolls_the_year_at_q4():
    key, start, end = community._season_period(datetime(2026, 11, 3, tzinfo=timezone.utc))
    assert key == "2026-S4"
    assert end == datetime(2027, 1, 1, tzinfo=timezone.utc)


# ── Instances are created once, not once per reader ──

def test_two_readers_create_one_instance(env):
    client, clock = env
    first = community._current_instance(client, STREAK, clock.now)
    community._instance_cache.clear()  # force the second reader down the real path
    second = community._current_instance(client, STREAK, clock.now)
    assert first["id"] == second["id"]
    assert len(instances(client)) == 1, "two readers created two instances"


def test_pointer_hands_the_outgoing_period_to_exactly_one_caller(env):
    client, clock = env
    community._current_instance(client, STREAK, clock.now)
    clock.advance(days=7)
    key, _start, _end = community._week_period(clock.now)

    outgoing = community._advance_pointer(client, "streak7", key)
    assert outgoing, "the caller that moved the pointer was not told what it displaced"

    # The pointer has already moved, so the only thing that can hand the close to
    # a later reader is the pendingClose marker. It must survive until the close
    # actually happens, or a crashed closer would strand the instance.
    assert community._advance_pointer(client, "streak7", key) == outgoing

    community._close_instance(client, "streak7", outgoing[0], clock.now)
    assert community._advance_pointer(client, "streak7", key) == [], "the to-do outlived the close"


def test_a_close_owed_from_an_earlier_period_survives_the_next_boundary(env):
    """The to-do list is APPENDED to, not replaced.

    A close that fails for a whole period is still owed when the next boundary
    arrives. Overwriting the marker there would leave that period open forever:
    its standings never freeze, and every learner in it silently loses the week's
    result and reward with nothing anywhere to say so.
    """
    client, clock = env
    community.join_challenge("streak7", claims=claims("u1"))
    week_one = community._week_period(clock.now)[0]

    def explode(*_args, **_kwargs):
        raise RuntimeError("firestore is having a bad afternoon")

    real_close = community._close_instance
    community._close_instance = explode
    try:
        clock.advance(days=7)
        community._instance_cache.clear()
        community.list_challenges(claims=claims("u1"))
    finally:
        community._close_instance = real_close

    series = client.store[f"{community.CHALLENGES}/streak7"]
    assert series["pendingClose"] == [week_one]

    # Nobody comes back until the week after, by which time TWO closes are owed.
    clock.advance(days=7)
    community._instance_cache.clear()
    community.list_challenges(claims=claims("u1"))

    assert client.store[f"{community.INSTANCES}/streak7__{week_one}"]["status"] == community.STATUS_CLOSED
    assert client.store[f"{community.CHALLENGES}/streak7"]["pendingClose"] == []


def test_a_pending_close_for_an_instance_already_closed_is_dropped(env):
    """Otherwise the marker is immortal: it names work nobody can ever do, and
    every read of the series pays for a close that returns immediately."""
    client, clock = env
    community.join_challenge("streak7", claims=claims("u1"))
    week_one = community._week_period(clock.now)[0]
    clock.advance(days=7)
    community._instance_cache.clear()
    community._close_instance(client, "streak7", week_one, clock.now)

    client.store[f"{community.CHALLENGES}/streak7"]["pendingClose"] = [week_one]
    community.list_challenges(claims=claims("u1"))
    assert client.store[f"{community.CHALLENGES}/streak7"]["pendingClose"] == []


def test_the_pointer_never_walks_backwards(env):
    """Two Cloud Run instances, one clock a second behind the other. The one that
    is behind must not reopen a week the other has already closed."""
    client, clock = env
    community._current_instance(client, STREAK, clock.now)
    behind = community._week_period(clock.now)[0]
    clock.advance(days=7)
    ahead = community._week_period(clock.now)[0]

    community._advance_pointer(client, "streak7", ahead)
    community._advance_pointer(client, "streak7", behind)  # the laggard

    assert client.store[f"{community.CHALLENGES}/streak7"]["currentPeriodKey"] == ahead


# ── Rollover ──

def test_rollover_closes_the_old_instance_and_opens_a_fresh_one(env):
    client, clock = env
    old = community._current_instance(client, STREAK, clock.now)
    community.join_challenge("streak7", claims=claims("u1"))

    clock.advance(days=7)
    community._instance_cache.clear()
    new = community._current_instance(client, STREAK, clock.now)

    assert new["id"] != old["id"], "the week turned over and the instance did not"
    assert client.store[f"{community.INSTANCES}/{old['id']}"]["status"] == community.STATUS_CLOSED
    assert new["status"] == community.STATUS_OPEN
    assert "standings" in client.store[f"{community.INSTANCES}/{old['id']}"]


def test_enrolment_survives_rollover_and_the_new_run_starts_at_zero(env):
    """Day 8 of the weekly day goal: a fresh instance, not a re-join, not a free win."""
    client, clock = env
    community.join_challenge("streak7", claims=claims("u1"))
    for _ in range(7):
        community.record_events("u1", [("lesson_complete", {})])
        clock.advance(days=1)

    old_key, _s, _e = community._week_period(BASE)
    old_entry = client.store[f"{community.ENTRIES}/streak7__{old_key}__u1"]
    # Seven active days against a five day goal reads as five: progress is capped
    # at the target, so a perfect week cannot outrank another finisher on volume.
    assert old_entry["progress"] == STREAK_TARGET and old_entry["completed"] is True

    community._instance_cache.clear()
    cards = community.list_challenges(claims=claims("u1"))["challenges"]
    streak = next(c for c in cards if c["id"] == "streak7")

    assert streak["joined"] is True, "the learner had to re-join after a rollover"
    assert streak["progress"] == 0, "day 8 inherited a completed week and would pay again"
    assert streak["instance"]["periodKey"] != old_key
    assert streak["history"]["instancesPlayed"] == 0, "the closed run was settled without being claimed"


def test_progress_after_rollover_lands_on_the_new_instance(env):
    client, clock = env
    community.join_challenge("streak7", claims=claims("u1"))
    clock.advance(days=8)
    community._instance_cache.clear()
    community.record_events("u1", [("lesson_complete", {})])

    new_key, _s, _e = community._week_period(clock.now)
    assert client.store[f"{community.ENTRIES}/streak7__{new_key}__u1"]["progress"] == 1


def test_the_card_counts_a_participant_materialised_by_a_rollover(env):
    """The entry is created during the read that renders the card, so the count
    on that card has to be the one from after it, not before."""
    client, clock = env
    community.join_challenge("streak7", claims=claims("u1"))
    clock.advance(days=8)
    community._instance_cache.clear()

    card = next(c for c in community.list_challenges(claims=claims("u1"))["challenges"] if c["id"] == "streak7")
    assert card["participantCount"] == 1, "a rollover entry was created and the card said nobody had joined"
    assert card["instance"]["participantCount"] == 1


# ── Closing: frozen standings, strict ranks, an honest empty result ──

def _run_week(client, clock, uids_progress: dict[str, int]):
    """Join several learners, give each `n` active days, then run the clock out.

    The clock always ends past the week boundary, because a week that has not
    finished cannot be closed and every close assertion would otherwise be
    testing nothing.
    """
    for uid in uids_progress:
        community.join_challenge("streak7", claims=claims(uid))
    day = 0
    while any(day < n for n in uids_progress.values()):
        for uid, target in uids_progress.items():
            if day < target:
                community.record_events(uid, [("lesson_complete", {})])
        clock.advance(days=1)
        day += 1
    _key, _start, end = community._week_period(BASE)
    if clock.now < end:
        clock.now = end + timedelta(minutes=5)
    community._instance_cache.clear()


def test_close_freezes_standings_and_names_a_winner(env):
    client, clock = env
    _run_week(client, clock, {"u1": 7, "u2": 3})
    closed = community._close_instance(client, "streak7", community._week_period(BASE)[0], clock.now)

    assert closed is not None
    assert closed["winner"]["uid"] == "u1"
    assert [row["rank"] for row in closed["standings"]] == [1, 2]
    assert closed["completedCount"] == 1
    assert closed["participantCount"] == 2


def test_close_is_idempotent(env):
    client, clock = env
    _run_week(client, clock, {"u1": 7, "u2": 3})
    key = community._week_period(BASE)[0]

    first = community._close_instance(client, "streak7", key, clock.now)
    second = community._close_instance(client, "streak7", key, clock.now)

    assert first is not None
    assert second is None, "a closed instance was closed a second time"
    stored = client.store[f"{community.INSTANCES}/streak7__{key}"]
    assert stored["standings"] == first["standings"], "the frozen standings were recomputed"
    assert client.store[f"{community.ENTRIES}/streak7__{key}__u1"]["rank"] == 1


def test_ranks_are_strict_and_ties_break_by_who_finished_first():
    rows = [
        {"uid": "late", "progress": 3, "completedAt": "2026-08-28T10:00:00+00:00", "joinedAt": "a"},
        {"uid": "early", "progress": 3, "completedAt": "2026-08-27T10:00:00+00:00", "joinedAt": "b"},
        {"uid": "unfinished", "progress": 3, "joinedAt": "c"},
        {"uid": "behind", "progress": 1, "joinedAt": "d"},
    ]
    order = [row["uid"] for row in community._rank_entries(rows)]
    assert order == ["early", "late", "unfinished", "behind"]


def test_ties_fall_back_to_uid_so_a_close_is_reproducible():
    rows = [{"uid": u, "progress": 2, "joinedAt": "same"} for u in ("c", "a", "b")]
    assert [r["uid"] for r in community._rank_entries(rows)] == ["a", "b", "c"]
    assert community._rank_entries(rows) == community._rank_entries(list(reversed(rows)))


def test_no_winner_when_nobody_completes(env):
    client, clock = env
    _run_week(client, clock, {"u1": 4, "u2": 2})
    closed = community._close_instance(client, "streak7", community._week_period(BASE)[0], clock.now)

    assert closed["winner"] is None, "a winner was invented in a week nobody cleared"
    assert closed["completedCount"] == 0
    assert [row["rank"] for row in closed["standings"]] == [1, 2], "the ladder still ranks who got furthest"


def test_an_instance_nobody_joined_closes_empty(env):
    client, clock = env
    community._current_instance(client, STREAK, clock.now)
    clock.advance(days=8)
    closed = community._close_instance(client, "streak7", community._week_period(BASE)[0], clock.now)
    assert closed["standings"] == []
    assert closed["winner"] is None


def test_a_running_instance_is_not_closed_early(env):
    client, clock = env
    community.join_challenge("streak7", claims=claims("u1"))
    assert community._close_instance(client, "streak7", community._week_period(BASE)[0], clock.now) is None


def test_a_stuck_close_can_be_retaken_after_the_lease(env):
    client, clock = env
    _run_week(client, clock, {"u1": 7})
    key = community._week_period(BASE)[0]
    ref = f"{community.INSTANCES}/streak7__{key}"
    client.store[ref].update({
        "status": community.STATUS_CLOSING,
        "closeClaimedAt": (clock.now - timedelta(seconds=community.CLOSE_LEASE_SECONDS + 5)).isoformat(),
    })
    assert community._close_instance(client, "streak7", key, clock.now) is not None
    assert client.store[ref]["status"] == community.STATUS_CLOSED


def test_a_fresh_close_claim_is_respected(env):
    client, clock = env
    _run_week(client, clock, {"u1": 7})
    key = community._week_period(BASE)[0]
    client.store[f"{community.INSTANCES}/streak7__{key}"].update({
        "status": community.STATUS_CLOSING,
        "closeClaimedAt": clock.now.isoformat(),
    })
    assert community._close_instance(client, "streak7", key, clock.now) is None


# ── Settlement ──

def test_settlement_grants_once(env):
    client, clock = env
    _run_week(client, clock, {"u1": 7})
    community._close_instance(client, "streak7", community._week_period(BASE)[0], clock.now)

    first = community.settle_for("u1")
    second = community.settle_for("u1")

    assert first["xp"] == STREAK["rewardXp"] + community.PODIUM_BONUS_XP[0]
    assert len(first["granted"]) == 1
    assert second["granted"] == [], "a second claim paid the same instance twice"
    assert second["xp"] == 0


def test_settlement_pays_no_completion_reward_when_the_goal_was_missed(env):
    client, clock = env
    _run_week(client, clock, {"u1": 4})
    community._close_instance(client, "streak7", community._week_period(BASE)[0], clock.now)

    granted = community.settle_for("u1")["granted"]
    assert granted[0]["completed"] is False
    assert granted[0]["xp"] == community.PODIUM_BONUS_XP[0], "the podium bonus is for the ladder, not the goal"


def test_podium_bonus_needs_progress_above_zero(env):
    client, clock = env
    community.join_challenge("streak7", claims=claims("idle"))
    clock.advance(days=8)
    community._close_instance(client, "streak7", community._week_period(BASE)[0], clock.now)

    granted = community.settle_for("idle")["granted"]
    assert granted[0]["rank"] == 1
    assert granted[0]["xp"] == 0, "showing up and doing nothing collected a podium bonus"


def test_the_record_survives_rollover_and_accumulates(env):
    client, clock = env
    for _week in range(2):
        community.join_challenge("streak7", claims=claims("u1"))
        for _ in range(7):
            community.record_events("u1", [("lesson_complete", {})])
            clock.advance(days=1)
        community._instance_cache.clear()
        community._current_instance(client, STREAK, clock.now)
        community.settle_for("u1")

    record = community._record_for(client, "u1")
    history = community._series_history(record, "streak7")
    assert history["instancesPlayed"] == 2, "the per-learner record did not survive the rollover"
    assert history["instancesCompleted"] == 2
    assert record["totalXp"] == 2 * (STREAK["rewardXp"] + community.PODIUM_BONUS_XP[0])


# ── Progress ──

def test_active_days_counts_distinct_days_not_events(env):
    client, clock = env
    community.join_challenge("streak7", claims=claims("u1"))
    key = community._week_period(BASE)[0]
    entry_key = f"{community.ENTRIES}/streak7__{key}__u1"

    for _ in range(5):
        community.record_events("u1", [("lesson_complete", {}), ("build_complete", {})])
    assert client.store[entry_key]["progress"] == 1, "five sessions in one day counted as five days"

    clock.advance(days=1)
    community.record_events("u1", [("lesson_complete", {})])
    assert client.store[entry_key]["progress"] == 2


def test_a_count_metric_increments_and_completion_latches(env):
    client, clock = env
    community.join_challenge("firstlight", claims=claims("u1"))
    period = f"r{community._day_key(clock.now)}"
    entry_key = f"{community.ENTRIES}/firstlight__{period}__u1"

    for _ in range(3):
        community.record_events("u1", [("lesson_complete", {})])
    assert client.store[entry_key]["progress"] == 3
    assert client.store[entry_key]["completed"] is True

    community.record_events("u1", [("lesson_complete", {})])
    assert client.store[entry_key]["progress"] == 3, "progress ran past the target"
    assert client.store[entry_key]["completed"] is True


def test_a_set_metric_counts_distinct_values(env):
    client, clock = env
    community.join_challenge("sensors", claims=claims("u1"))
    key = community._week_period(BASE)[0]
    entry_key = f"{community.ENTRIES}/sensors__{key}__u1"

    community.record_events("u1", [("sensor_verified", {"sensor": "LDR"})])
    community.record_events("u1", [("sensor_verified", {"sensor": "ldr"})])
    assert client.store[entry_key]["progress"] == 1, "the same sensor counted twice"

    community.record_events("u1", [("sensor_verified", {"sensor": "thermistor"})])
    assert client.store[entry_key]["progress"] == 2


def test_progress_is_ignored_once_the_entry_has_closed(env):
    client, clock = env
    _run_week(client, clock, {"u1": 2})
    key = community._week_period(BASE)[0]
    community._close_instance(client, "streak7", key, clock.now)
    entry_key = f"{community.ENTRIES}/streak7__{key}__u1"
    before = client.store[entry_key]["progress"]

    community._apply_progress(client, f"streak7__{key}__u1", "days", 0, {"2026-09-09"}, set(), clock.now)
    assert client.store[entry_key]["progress"] == before, "a closed entry still moved"


def test_events_that_feed_no_challenge_do_nothing(env):
    client, clock = env
    community.join_challenge("streak7", claims=claims("u1"))
    snapshot = copy.deepcopy(client.store)
    community.record_events("u1", [("paywall_view", {}), ("simulator_open", {})])
    assert client.store == snapshot


def test_an_explained_post_credits_teach_it_back(env):
    client, clock = env
    community.join_challenge("teachback", claims=claims("u1"))
    key = community._week_period(BASE)[0]
    entry_key = f"{community.ENTRIES}/teachback__{key}__u1"

    community.credit_metric("u1", community.METRIC_EXPLAINED_POSTS)
    assert client.store[entry_key]["progress"] == 1
    assert client.store[entry_key]["completed"] is True


# ── Joining late ──

def test_joining_mid_window_starts_at_zero_against_the_same_target(env):
    """The season instance is eight weeks old and still has room, so a late joiner
    goes straight in: same target as everyone else, progress at zero."""
    client, clock = env
    community.join_challenge("streak30", claims=claims("early"))
    clock.advance(days=5)
    community._instance_cache.clear()
    late = community.join_challenge("streak30", claims=claims("late"))

    assert late["enrolledFor"] == "current"
    assert late["progress"] == 0
    assert late["target"] == SEASON_TARGET, (
        "the target was pro-rated and the standings stopped comparing"
    )


def test_a_day_goal_that_can_no_longer_be_reached_books_the_next_instance(env):
    client, clock = env
    clock.advance(days=3)  # Thursday: four days left, five needed
    result = community.join_challenge("streak7", claims=claims("u1"))

    assert result["enrolledFor"] == "next", "someone was entered into a week they could not finish"
    assert entries(client) == [], "an unwinnable entry was created anyway"

    clock.advance(days=6)  # into the next week
    community._instance_cache.clear()
    community.record_events("u1", [("lesson_complete", {})])
    new_key = community._week_period(clock.now)[0]
    assert client.store[f"{community.ENTRIES}/streak7__{new_key}__u1"]["progress"] == 1


def test_the_booking_for_next_week_is_honoured_by_every_later_read(env):
    """The enrolment says "next", so nothing may put them in THIS instance.

    Booking someone out of a week they cannot finish and then entering them
    anyway on the next page load is worse than never having said it: they sit at
    the bottom of a ladder they were told they were not on.
    """
    client, clock = env
    clock.advance(days=3)  # Thursday: four days left, five needed
    assert community.join_challenge("streak7", claims=claims("u1"))["enrolledFor"] == "next"

    card = next(c for c in community.list_challenges(claims=claims("u1"))["challenges"] if c["id"] == "streak7")
    assert entries(client) == [], "the card render entered them into the week they were booked out of"
    assert card["enrolledFor"] == "next", "the card cannot explain why the bar is not moving"
    assert card["joined"] is True

    community.record_events("u1", [("lesson_complete", {})])
    assert entries(client) == [], "an event entered them into the week they were booked out of"

    clock.advance(days=5)  # the next week opens
    community._instance_cache.clear()
    community.record_events("u1", [("lesson_complete", {})])
    new_key = community._week_period(clock.now)[0]
    assert client.store[f"{community.ENTRIES}/streak7__{new_key}__u1"]["progress"] == 1


def test_a_membership_written_before_instances_existed_still_counts(env):
    """The rows in Firestore right now carry challengeId, uid and progress: 0.

    The decision doc says they read correctly as enrolments. For the rolling
    challenge that means opening a window for them the first time they are seen,
    because they have no periodKey and nothing else ever gives them one.
    """
    client, clock = env
    client.store[f"{community.MEMBERS}/firstlight__u1"] = {
        "challengeId": "firstlight", "uid": "u1", "progress": 0, "joinedAt": BASE.isoformat(),
    }

    community.record_events("u1", [("lesson_complete", {})], "U1")
    rows = entries(client)
    assert len(rows) == 1 and rows[0]["progress"] == 1, "a legacy First Light enrolment counts nothing, forever"
    assert client.store[f"{community.MEMBERS}/firstlight__u1"]["periodKey"] == rows[0]["periodKey"]

    card = next(c for c in community.list_challenges(claims=claims("u1"))["challenges"] if c["id"] == "firstlight")
    assert card["progress"] == 1
    assert card["endsInSeconds"] > 0


def test_a_count_goal_stays_joinable_to_the_last_hour(env):
    client, clock = env
    clock.advance(days=6, hours=14)  # Sunday 23:00, one hour of the week left
    result = community.join_challenge("teachback", claims=claims("u1"))
    assert result["enrolledFor"] == "current"


# ── The five-of-seven decision (Faith, 2026-08-27) ──
#
# The weekly day goal used to ask for seven days inside a seven day window, which
# made it joinable on Monday alone: everyone who found it Tuesday to Sunday was
# booked for next week and left with a card that could not move. Five of seven
# opens the first three days of the week and lets a learner miss two days without
# losing the week. These tests pin both halves of that, and the arithmetic that
# says how far it can ever be pushed.

def test_the_weekly_day_goal_is_joinable_for_the_first_three_days_of_its_window(env):
    """Seven learners, one arriving on each day of the same week.

    The joinable stretch is `durationDays - target + 1` days wide, so it is
    Monday, Tuesday and Wednesday. Under a target of seven it was Monday alone,
    which is the failure this decision was made to end.
    """
    client, clock = env
    enrolled_for: list[str] = []
    joinable_flag: list[bool] = []

    for day in range(STREAK_WINDOW):
        uid = f"day{day}"
        community._instance_cache.clear()
        enrolled_for.append(community.join_challenge("streak7", claims=claims(uid))["enrolledFor"])
        card = next(
            c for c in community.list_challenges(claims=claims(uid))["challenges"] if c["id"] == "streak7"
        )
        joinable_flag.append(card["joinableNow"])
        clock.advance(days=1)

    assert enrolled_for == ["current", "current", "current", "next", "next", "next", "next"], (
        "the joinable stretch of the week is not Monday to Wednesday"
    )
    # The card's own flag has to agree with what the join endpoint does, or the
    # learner is invited into a week the server will refuse to enter them into.
    assert joinable_flag == [True, True, True, False, False, False, False]
    assert len(entries(client)) == STREAK_WINDOW - STREAK_TARGET + 1, (
        "an entry was created for someone booked out of the week"
    )


def test_the_last_joinable_day_enters_the_current_instance_with_nothing_to_spare(env):
    """Wednesday is the last day the goal is reachable, so Wednesday goes in NOW.

    Booking a Wednesday joiner for next week would cost them a week they could
    still have won.
    """
    client, clock = env
    clock.advance(days=STREAK_WINDOW - STREAK_TARGET)  # Wednesday
    result = community.join_challenge("streak7", claims=claims("u1"))
    key, _start, end = community._week_period(clock.now)

    assert result["enrolledFor"] == "current", "the last winnable day was given away"
    assert result["target"] == STREAK_TARGET, "the target was pro-rated for the late joiner"
    assert client.store[f"{community.ENTRIES}/streak7__{key}__u1"]["progress"] == 0
    assert client.store[f"{community.MEMBERS}/streak7__u1"].get("skipPeriodKey") is None

    last_day = (end - timedelta(seconds=1)).date()
    remaining = (last_day - clock.now.date()).days + 1
    assert remaining == STREAK_TARGET, "the last joinable day is not the last reachable one"


def test_the_goal_is_genuinely_reachable_from_the_last_joinable_day(env):
    """Reachable is not a claim to make without walking it.

    Join on Wednesday, then be active on every remaining day. Five days of work
    fit into the five days that are left, and the fifth lands inside the window.
    """
    client, clock = env
    clock.advance(days=STREAK_WINDOW - STREAK_TARGET)  # Wednesday
    community.join_challenge("streak7", claims=claims("u1"))
    key, _start, end = community._week_period(clock.now)
    entry_key = f"{community.ENTRIES}/streak7__{key}__u1"

    for day in range(STREAK_TARGET):
        assert clock.now < end, "the week ran out before the goal could be cleared"
        community.record_events("u1", [("lesson_complete", {})])
        assert client.store[entry_key]["progress"] == day + 1
        clock.advance(days=1)

    assert client.store[entry_key]["progress"] == STREAK_TARGET
    assert client.store[entry_key]["completed"] is True
    assert clock.now >= end, "the goal did not use the whole of the remaining window"


def test_the_season_day_goal_stays_joinable_into_its_final_month(env):
    """Twenty of ninety, for the same reason: the dead tail is `target - 1` days.

    At thirty the whole of September was closed to new joiners; at twenty the
    season stays open until 11 September and the tail is nineteen days.
    """
    client, clock = env
    clock.now = datetime(2026, 9, 11, 9, 0, tzinfo=timezone.utc)  # twenty days of Q3 left
    community._instance_cache.clear()
    in_time = community.join_challenge("streak30", claims=claims("in-time"))
    assert in_time["enrolledFor"] == "current", "the last month of the season is still dead"
    assert in_time["target"] == SEASON_TARGET

    clock.advance(days=1)  # nineteen left, twenty needed
    community._instance_cache.clear()
    too_late = community.join_challenge("streak30", claims=claims("too-late"))
    assert too_late["enrolledFor"] == "next", "someone was entered into a season they cannot finish"


def test_a_run_in_flight_keeps_the_target_it_started_with(env):
    """Retuning a target must not move the bar under a week already in progress.

    The entry keeps the target it was created with, which is what makes the change
    safe to land mid-week. The card has to show that same number: at five on the
    card and seven in the entry, a learner fills the bar, is told nothing and is
    paid nothing, which is the worst of the three possible answers.
    """
    client, clock = env
    community.join_challenge("streak7", claims=claims("u1"))
    key, _start, _end = community._week_period(clock.now)
    entry_key = f"{community.ENTRIES}/streak7__{key}__u1"
    client.store[entry_key]["target"] = STREAK_WINDOW  # enrolled before the change

    for _ in range(STREAK_TARGET):
        community.record_events("u1", [("lesson_complete", {})])
        clock.advance(days=1)

    card = next(
        c for c in community.list_challenges(claims=claims("u1"))["challenges"] if c["id"] == "streak7"
    )
    assert card["target"] == STREAK_WINDOW, (
        "the card redrew a run in flight against a bar it is not being judged by"
    )
    assert card["progress"] == STREAK_TARGET
    assert card["completed"] is False, "the card called it done while the entry was still running"
    assert client.store[entry_key]["completed"] is False


def test_a_retune_landing_mid_round_does_not_split_that_round_into_two_bars(env):
    """Freezing the target per ENTRY is not enough: it has to be frozen per ROUND.

    The retune is meant to land on a live product, so there will be a week whose
    instance opened under the old target and whose later joiners arrive under the
    new one. If each entry took the template's number at the moment it was
    created, that one week would rank people who had to clear seven days against
    people who only had to clear five: the earlier joiner could finish with MORE
    days done, rank above, and still be told they missed the goal while the later
    one collected the reward. That is precisely what pro-rating was rejected for,
    arriving through a different door.

    So an entry takes the bar the instance froze when it opened, and a round that
    cannot be cleared under that bar books the joiner for the next round, which
    opens under the new one.
    """
    client, clock = env
    community.join_challenge("streak7", claims=claims("early"))
    key, _start, _end = community._week_period(clock.now)
    instance_key = f"{community.INSTANCES}/streak7__{key}"
    # The week that was already running when the change shipped.
    client.store[instance_key]["target"] = STREAK_WINDOW
    client.store[f"{community.ENTRIES}/streak7__{key}__early"]["target"] = STREAK_WINDOW
    community._instance_cache.clear()

    clock.advance(days=1)  # Tuesday, under the new template
    late = community.join_challenge("streak7", claims=claims("late"))

    bars = {
        row["target"]
        for row_key, row in client.store.items()
        if row_key.startswith(f"{community.ENTRIES}/streak7__{key}__")
    }
    assert bars == {STREAK_WINDOW}, "one round, two bars: the standings stopped comparing"
    assert late["enrolledFor"] == "next", (
        "a joiner was waved into a round whose frozen bar they cannot clear"
    )

    # And the round that opens after it uses the new target, for everyone.
    clock.advance(days=7)
    community._instance_cache.clear()
    community.record_events("late", [("lesson_complete", {})])
    next_key = community._week_period(clock.now)[0]
    assert client.store[f"{community.ENTRIES}/streak7__{next_key}__late"]["target"] == STREAK_TARGET


def test_the_join_confirmation_names_the_bar_it_just_wrote(env):
    """The number in the response is the number on the entry, not the template's.

    A confirmation that says five while the entry says seven is a promise the
    close will not keep.
    """
    client, clock = env
    community.join_challenge("streak7", claims=claims("early"))
    key, _start, _end = community._week_period(clock.now)
    client.store[f"{community.INSTANCES}/streak7__{key}"]["target"] = STREAK_WINDOW
    community._instance_cache.clear()

    joined = community.join_challenge("streak7", claims=claims("same-day"))
    assert joined["enrolledFor"] == "current"
    assert joined["target"] == client.store[f"{community.ENTRIES}/streak7__{key}__same-day"]["target"]
    assert joined["target"] == STREAK_WINDOW


def test_no_day_goal_asks_for_every_day_of_its_own_window():
    """The invariant behind the decision, checked against the shipped templates.

    A day-counted goal is closed to new joiners for the last `target - 1` days of
    its window, so a target equal to the window length leaves exactly one joinable
    day. Two days of slack is the floor: it keeps three days of the week open and
    lets a learner miss a day without the rest of the window becoming pointless.
    """
    day_goals = [c for c in community.DEFAULT_CHALLENGES if c["metric"] == community.METRIC_ACTIVE_DAYS]
    assert day_goals, "the day-counted challenges vanished"

    for template in day_goals:
        window = int(template["durationDays"])
        target = community._target(template)
        assert target <= window - 2, (
            f"{template['id']} asks for {target} of {window} days, so it is joinable on "
            f"{window - target + 1} day(s) of its own window"
        )
        assert community._day_goal_join_window(template) == window - target + 1

    assert community._target(STREAK) == STREAK_TARGET
    assert STREAK["durationDays"] == STREAK_WINDOW
    assert community._day_goal_join_window(STREAK) == 3, "the week is not open for three days"
    assert community._target(SEASON) == SEASON_TARGET
    assert community._day_goal_join_window(SEASON) == SEASON_WINDOW - SEASON_TARGET + 1


# Enough of the language to catch a card that names a number the goal does not
# ask for. Spelled numbers count: "Five in Seven" is a claim like "5 of 7".
_NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
    "eight": 8, "nine": 9, "ten": 10, "fourteen": 14, "twenty": 20, "thirty": 30, "ninety": 90,
}


def _numbers_in(text: str) -> set[int]:
    found = {int(n) for n in re.findall(r"\d+", text)}
    for word, value in _NUMBER_WORDS.items():
        if re.search(rf"\b{word}\b", text, re.IGNORECASE):
            found.add(value)
    return found


def test_the_day_goal_copy_states_the_number_the_goal_actually_asks_for():
    """A card that says seven while the goal counts five is a lie on the surface
    the learner reads first. The only quantities these cards may name are the
    target and the length of the window it sits in."""
    for template in [c for c in community.DEFAULT_CHALLENGES if c["metric"] == community.METRIC_ACTIVE_DAYS]:
        allowed = {community._target(template), int(template["durationDays"])}
        for field in ("title", "tagline", "desc", "goal"):
            claimed = _numbers_in(template[field])
            assert claimed <= allowed, (
                f"{template['id']} {field} claims {sorted(claimed - allowed)}, "
                f"but the goal is {community._target(template)} of {template['durationDays']} days"
            )


def test_a_day_goal_never_calls_itself_a_streak():
    """Progress is the count of DISTINCT active days in the window, which has not
    required consecutive days since the target dropped below the window length.
    Calling it a streak would also confuse it with the daily streak counter, which
    is a different number the product already shows the learner."""
    # Patterns, not substrings: "not every day" is the truth, "every day" is the
    # old promise, and a plain `in` check cannot tell them apart.
    banned = (r"streak", r"\bin a row\b", r"(?<!not )\bevery day\b", r"\bconsecutive days\b")
    for template in [c for c in community.DEFAULT_CHALLENGES if c["metric"] == community.METRIC_ACTIVE_DAYS]:
        for field in ("title", "tagline", "desc", "goal", "longDesc"):
            text = template[field].lower()
            for pattern in banned:
                assert not re.search(pattern, text), (
                    f"{template['id']} {field} matches {pattern!r}, which promises days in a row"
                )


def test_leaving_forfeits_the_run_and_frees_the_seat(env):
    client, clock = env
    community.join_challenge("streak7", claims=claims("u1"))
    community.record_events("u1", [("lesson_complete", {})])
    left = community.leave_challenge("streak7", claims=claims("u1"))

    assert left["joined"] is False
    assert left["participantCount"] == 0
    assert entries(client) == []
    assert community.list_challenges(claims=claims("u1"))["challenges"][0]["joined"] is False


# ── Participant counting, which now lives on the instance ──

def test_joining_twice_counts_once(env):
    client, _clock = env
    first = community.join_challenge("streak7", claims=claims("u1"))
    second = community.join_challenge("streak7", claims=claims("u1"))
    assert first["participantCount"] == 1
    assert second["participantCount"] == 1, "a double join inflated the participant count"
    assert len(entries(client)) == 1


def test_only_the_first_ever_join_is_reported_as_first(env):
    """The achievement is credited on firstJoin, so firstJoin has to survive a
    leave. It did not: leaving deletes the enrolment, so a re-join looked brand
    new and "Joined a challenge" (and "Joined 5 challenges") could be farmed from
    one card by tapping two buttons alternately."""
    client, _clock = env
    assert community.join_challenge("streak7", claims=claims("u1"))["firstJoin"] is True
    assert community.join_challenge("streak7", claims=claims("u1"))["firstJoin"] is False, (
        "a double tap reported two first joins"
    )

    community.leave_challenge("streak7", claims=claims("u1"))
    again = community.join_challenge("streak7", claims=claims("u1"))
    assert again["firstJoin"] is False, "join, leave, join reported a second first join"
    assert again["joined"] is True, "the learner is genuinely enrolled again"
    assert again["participantCount"] == 1, "the participant count still follows enrolment"


def test_first_join_is_per_series_not_per_learner(env):
    """A learner joining their second challenge is a first join OF THAT SERIES.
    Making it per-learner would mean only the very first challenge ever counted,
    and "Joined 5 challenges" would be unearnable."""
    client, _clock = env
    assert community.join_challenge("streak7", claims=claims("u1"))["firstJoin"] is True
    assert community.join_challenge("nokit", claims=claims("u1"))["firstJoin"] is True


def test_first_join_is_per_learner_not_global(env):
    client, _clock = env
    community.join_challenge("streak7", claims=claims("u1"))
    assert community.join_challenge("streak7", claims=claims("u2"))["firstJoin"] is True


def test_two_learners_are_counted_separately(env):
    client, _clock = env
    community.join_challenge("streak7", claims=claims("u1"))
    assert community.join_challenge("streak7", claims=claims("u2"))["participantCount"] == 2


def test_leaving_never_takes_the_count_below_zero(env):
    client, _clock = env
    community.join_challenge("streak7", claims=claims("u1"))
    assert community.leave_challenge("streak7", claims=claims("u1"))["participantCount"] == 0
    assert community.leave_challenge("streak7", claims=claims("u1"))["participantCount"] == 0


def test_the_card_count_is_the_series_and_does_not_empty_at_a_rollover(env):
    """"214 joined" is the social proof on the card. If it were this round's
    count it would read zero every Monday morning, which looks like a dead
    product rather than a week that has turned. The round's own count is on the
    instance for anyone who wants it."""
    client, clock = env
    community.join_challenge("streak7", claims=claims("u1"))
    community.join_challenge("streak7", claims=claims("u2"))

    clock.advance(days=8)
    community._instance_cache.clear()
    card = next(c for c in community.list_challenges(claims=claims("u1"))["challenges"] if c["id"] == "streak7")

    assert card["participantCount"] == 2, "the rollover emptied the card"
    assert card["instance"]["participantCount"] == 1, "only u1 has been seen since the week turned"


def test_a_rolling_challenge_shows_its_real_membership(env):
    client, _clock = env
    community.join_challenge("firstlight", claims=claims("u1"))
    joined = community.join_challenge("firstlight", claims=claims("u2"))
    assert joined["participantCount"] == 2

    card = next(c for c in community.list_challenges(claims=claims("u1"))["challenges"] if c["id"] == "firstlight")
    assert card["participantCount"] == 2, "First Light said nobody had ever joined it"


def test_an_unknown_challenge_is_404(env):
    for call in (community.join_challenge, community.leave_challenge):
        with pytest.raises(HTTPException) as exc:
            call("nope", claims=claims("u1"))
        assert exc.value.status_code == 404


def test_a_closed_instance_is_not_rejoinable_in_place(env):
    """Leaving after a close must not resurrect a seat in a finished week."""
    client, clock = env
    _run_week(client, clock, {"u1": 7})
    key = community._week_period(BASE)[0]
    community._close_instance(client, "streak7", key, clock.now)
    community.leave_challenge("streak7", claims=claims("u1"))
    assert client.store[f"{community.ENTRIES}/streak7__{key}__u1"]["rank"] == 1


def test_results_skip_a_round_nobody_entered(env):
    """A week with no participants had no standings to freeze. Defaulting to it
    would greet the next learner with an empty podium."""
    client, clock = env
    _run_week(client, clock, {"u1": 7})
    played = community._week_period(BASE)[0]
    community._close_instance(client, "streak7", played, clock.now)

    # A quiet week: an instance exists because somebody looked, but nobody joined.
    clock.advance(days=7)
    community._instance_cache.clear()
    quiet = community._week_period(clock.now)[0]
    community._current_instance(client, community.TEMPLATES["streak7"], clock.now)
    clock.advance(days=7)
    community._instance_cache.clear()
    community._current_instance(client, community.TEMPLATES["streak7"], clock.now)

    assert client.store[f"{community.INSTANCES}/streak7__{quiet}"]["participantCount"] == 0
    results = community.challenge_results("streak7", claims=claims("u1"))
    assert results["periodKey"] == played, "the empty week became the headline result"
    assert results["winner"]["name"] == "U1"


# ── Erasure ──

def test_forget_uid_anonymises_frozen_standings(env):
    client, clock = env
    _run_week(client, clock, {"u1": 7, "u2": 2})
    key = community._week_period(BASE)[0]
    community._close_instance(client, "streak7", key, clock.now)

    assert community.forget_uid(client, "u1") == 1
    stored = client.store[f"{community.INSTANCES}/streak7__{key}"]
    winner_row = stored["standings"][0]
    assert winner_row["uid"] is None
    assert winner_row["name"] == "Deleted account"
    assert winner_row["rank"] == 1, "erasing one row renumbered a result other people had seen"
    assert stored["winner"]["uid"] is None
    assert stored["standings"][1]["uid"] == "u2", "an unrelated learner was scrubbed"
