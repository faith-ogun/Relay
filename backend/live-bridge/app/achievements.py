"""Achievements: the durable record of what a learner has EARNED.

Earning is an event that happened. It is not a property of today's counters.

Before this module every achievement was recomputed from live counters on every
render, on both surfaces, which made a medal only as permanent as the arithmetic
behind it. Three counter corrections shipped in one day, and each one silently
stripped medals from learners who had genuinely earned them:

  * the session split cut 142 authored lessons into 284 shorter sessions, so a
    learner who had finished every authored lesson suddenly had every part one
    complete and every part two untouched. Unit completion is "every lesson in
    this unit is done", so up to four unit medals evaporated;
  * checkpoint XP moved from per-lesson to per-step, changing the XP total;
  * community counters moved to the server's authoritative tally.

None of those learners un-learned anything. So the fix is not a better counter,
it is a record: the first time a condition is met it is STAMPED, and the stamp
is what "earned" means from then on. Counters may then be corrected, curricula
re-cut and metrics re-derived without ever taking a medal back.

Three properties, and all three are why this is server work:

  1. **It is stamped from data the server owns.** Every metric is computed here
     from the learner's own Firestore records (their state envelope, their
     metrics record, their community footprint) and the authored curriculum. A
     client that could report its own stats could report any stats, and this
     record is permanent.

  2. **It is idempotent.** Stamping happens inside a Firestore transaction that
     skips anything already present, so syncing twice, from two devices, or
     mid-flight of another sync, grants the same set once. Same shape as
     checkpoints.claim_all, for the same reason.

  3. **It survives the device.** A reinstall, a cleared cache or a second phone
     all read the same record, because it hangs off the uid rather than the
     client.

BACKFILL. A learner who earned a medal before this record existed has nothing
stamped, so the first sync stamps everything currently satisfied and marks those
entries `backfilled`. That is safe precisely because the evaluation is the
server's: nothing is stamped unless the learner's own server-side records, read
against the CORRECTED rules below, satisfy the threshold at that instant. A
learner who never earned something has counters below its threshold and gets
nothing; there is no path by which a client can assert an achievement into the
record.

PACKAGING INDEPENDENCE. Two metrics are counted in lessons, and both are now
counted in AUTHORED lessons rather than in sessions:

  * `units`, a unit is complete when its authored lessons are done. Cutting one
    authored lesson into two parts must not double the bar for that unit.
  * `builds`, the count of lessons completed. Cutting the corpus in two would
    otherwise halve every threshold in the family.

The cut is recoverable from the corpus itself: part one keeps the authored id
and later parts take a Roman numeral suffix (see `splitLesson` in
frontend/components/ohmlet/data/lessons.ts), so a session id whose head is
itself a lesson id in the same corpus is a continuation of that lesson.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any, Iterable

from fastapi import APIRouter, Depends
from google.cloud import firestore

import curriculum
import obs
from auth import require_uid

logger = logging.getLogger("ohmlet.achievements")

ACHIEVEMENTS_COLLECTION = os.getenv("OHMLET_ACHIEVEMENTS_COLLECTION", "ohmlet_achievements")
STATE_COLLECTION = os.getenv("OHMLET_STATE_COLLECTION", "ohmlet_state")

router = APIRouter(prefix="/v1/me/achievements", tags=["achievements"])

# Part one never carries a suffix, so 'I' is deliberately NOT a continuation
# marker: a lesson genuinely titled "... I" must not be read as a second part of
# something. The rest mirror SESSION_NUMERALS in the authored source.
CONTINUATION_NUMERALS: frozenset[str] = frozenset({"II", "III", "IV", "V"})

# Counters that live in the learner's own `metrics` state record.
_METRIC_RECORD_FIELDS = (
    "liveSessions", "drawings", "perfect", "twins",
    "posts", "comments", "challenges", "leagueWins",
)


# ── The authored shape of the served corpus ───────────────────────────────────

def authored_lesson_id(lesson_id: str, corpus_ids: frozenset[str] | set[str]) -> str:
    """The AUTHORED lesson a session id belongs to.

    Resolved against the corpus itself rather than against a table, so it holds
    for any corpus this service is serving, including one authored after this
    code was written. Part one keeps the authored id, so it maps to itself; a
    later part is `"<authored id> <numeral>"` and maps to its head, but only when
    that head is genuinely a lesson in the same corpus. Anything else is returned
    untouched, which is the right answer for an id that was never split.
    """
    cut = lesson_id.rfind(" ")
    if cut <= 0:
        return lesson_id
    if lesson_id[cut + 1:] not in CONTINUATION_NUMERALS:
        return lesson_id
    head = lesson_id[:cut]
    return head if head in corpus_ids else lesson_id


@lru_cache(maxsize=1)
def _corpus() -> tuple[frozenset[str], tuple[tuple[str, frozenset[str]], ...]]:
    """(every session id, per-unit authored lesson ids) for the served corpus."""
    data = curriculum._curriculum()
    session_ids: set[str] = set()
    raw_units: list[tuple[str, list[str]]] = []
    for unit in data.get("units", []):
        ids = [
            lesson.get("id")
            for skill in unit.get("skills", [])
            for lesson in skill.get("lessons", [])
            if lesson.get("id")
        ]
        session_ids.update(ids)
        raw_units.append((str(unit.get("id") or ""), ids))

    frozen = frozenset(session_ids)
    units = tuple(
        (unit_id, frozenset(authored_lesson_id(i, frozen) for i in ids))
        for unit_id, ids in raw_units
    )
    return frozen, units


def authored_completions(completed: Iterable[str]) -> set[str]:
    """Completed session ids collapsed onto the authored lessons they belong to.

    An authored lesson counts as done once the learner has finished a session of
    it. That is what makes the bar independent of the packaging: the same work
    counts once whether it was delivered in one sitting or three, and a record
    written before the cut (which names the authored lesson) reads identically
    to one written after it (which names part one, the same id).
    """
    corpus_ids, _ = _corpus()
    return {authored_lesson_id(i, corpus_ids) for i in completed}


def units_completed(completed: Iterable[str]) -> int:
    """How many units the learner has finished, counted in authored lessons."""
    done = authored_completions(completed)
    _, units = _corpus()
    return sum(1 for _, authored in units if authored and authored <= done)


# ── The learner's own records ─────────────────────────────────────────────────

def _progress(uid: str) -> dict[str, Any]:
    """The learner's progress envelope's `data`, or {} if there is none."""
    from state_store import get_client

    try:
        snap = get_client().collection(STATE_COLLECTION).document(uid).get()
        if not snap.exists:
            return {}
        data = (snap.to_dict() or {}).get("data")
        return data if isinstance(data, dict) else {}
    except Exception as exc:
        logger.warning("progress read failed for %s: %s", uid, exc)
        return {}


def completed_lessons(progress: dict[str, Any]) -> set[str]:
    """Session ids the learner has finished.

    `lessonLevels` maps id -> level, where 1 is the first pass; a level below 1
    is not a completion. `completedLessonIds` is the pre-levels shape and is read
    when levels are absent, because the learners this record exists to protect
    are exactly the ones whose progress is oldest.
    """
    levels = progress.get("lessonLevels")
    if isinstance(levels, dict) and levels:
        done: set[str] = set()
        for lesson_id, level in levels.items():
            if not isinstance(lesson_id, str):
                continue
            if isinstance(level, (int, float)):
                if level >= 1:
                    done.add(lesson_id)
            elif level:
                # A non-numeric entry can only mean "recorded", and the record it
                # was recorded by is long gone. Presence is the honest reading.
                done.add(lesson_id)
        return done
    legacy = progress.get("completedLessonIds")
    if isinstance(legacy, list):
        return {i for i in legacy if isinstance(i, str)}
    return set()


def _metrics(uid: str, progress: dict[str, Any]) -> dict[str, int]:
    """The counters that xp, streak and lessons do not cover.

    Read from BOTH places they can live and merged by taking the higher of the
    two: the keyed `metrics` record the web writes, and the copy nested inside
    the progress record that builds already installed on phones still write.
    Every one of them is monotonic, so the larger number is the one that saw
    more of the learner's activity.
    """
    merged = {name: 0 for name in _METRIC_RECORD_FIELDS}

    def absorb(source: Any) -> None:
        if not isinstance(source, dict):
            return
        for name in _METRIC_RECORD_FIELDS:
            value = source.get(name)
            if isinstance(value, (int, float)) and value > merged[name]:
                merged[name] = int(value)

    absorb(progress.get("metrics"))
    try:
        from state_store import load_record

        absorb((load_record(uid, "metrics") or {}).get("data"))
    except Exception as exc:
        logger.warning("metrics record read failed for %s: %s", uid, exc)
    return merged


def _community(uid: str) -> dict[str, int]:
    """Likes received, posts and comments, from the authoritative tally.

    Likes RECEIVED only exist on other people's screens, so no client can see
    them. A failure here returns zeroes, which can only ever delay a stamp: the
    record is never rewritten downward, so a transient miss costs nothing.
    """
    try:
        import community

        stats = community.community_stats({"uid": uid})
        return {
            "likes": max(0, int(stats.get("likesReceived") or 0)),
            "posts": max(0, int(stats.get("posts") or 0)),
            "comments": max(0, int(stats.get("comments") or 0)),
        }
    except Exception as exc:
        logger.warning("community stats unavailable for %s: %s", uid, exc)
        return {"likes": 0, "posts": 0, "comments": 0}



def current_streak(progress: dict, at: datetime | None = None) -> int:
    """The streak as it stands NOW, mirroring `currentStreak` in completion.ts.

    A streak is the only counter here that decreases while nobody is looking.
    The stored number is written by a completion, so it cannot be what breaks a
    streak: on the day a streak dies there is, by definition, no completion to
    trigger the write. Read raw, a learner who stopped three weeks ago still
    reports the streak they had, which is enough to mint a streak medal they no
    longer hold.

    Today and yesterday both count as alive: missing today breaks nothing while
    today is still running. Anything older is 0.

    UTC on both sides, deliberately, matching `isoDay` on the clients. The three
    copies of this rule must agree or the phone, the web and the medal ledger
    will each believe a different streak.
    """
    raw = progress.get("streak")
    held = int(raw) if isinstance(raw, (int, float)) and raw > 0 else 0
    last = str(progress.get("lastActiveDate") or "")
    if held <= 0 or not last:
        return 0
    now = at or datetime.now(timezone.utc)
    today = now.date()
    return held if last in (today.isoformat(), (today - timedelta(days=1)).isoformat()) else 0

def compute_stats(uid: str, progress: dict[str, Any] | None = None) -> dict[str, int]:
    """Every metric an achievement can unlock against, derived server-side.

    `progress` may be passed in by a caller that has already read the envelope,
    so a sync that needs it twice pays for one read rather than two.
    """
    progress = _progress(uid) if progress is None else progress
    done = completed_lessons(progress)
    metrics = _metrics(uid, progress)
    social = _community(uid)

    def whole(value: Any) -> int:
        return int(value) if isinstance(value, (int, float)) and value > 0 else 0

    return {
        "xp": whole(progress.get("xp")),
        "streak": current_streak(progress),
        # Both lesson-counted metrics are counted in AUTHORED lessons, so a
        # change to how sessions are packaged cannot move either one.
        "builds": len(authored_completions(done)),
        "units": units_completed(done),
        "liveSessions": metrics["liveSessions"],
        "drawings": metrics["drawings"],
        "perfect": metrics["perfect"],
        "twins": metrics["twins"],
        "challenges": metrics["challenges"],
        "leagueWins": metrics["leagueWins"],
        "likes": social["likes"],
        # The server's tally survives a cleared cache and a second device where a
        # local one does not, but a local tally can legitimately lead it between
        # a post being written and the feed counting it.
        "posts": max(metrics["posts"], social["posts"]),
        "comments": max(metrics["comments"], social["comments"]),
    }


def as_last_displayed(stats: dict[str, int], progress: dict[str, Any]) -> dict[str, int]:
    """The same counters as the shipped clients showed BEFORE this module.

    Correcting a counter downward un-earns a medal exactly as surely as any of
    the three corrections that made this record necessary, and the record cannot
    protect a learner from the correction that arrives WITH it: their first sync
    happens after the new arithmetic, so the lower number is what gets stamped
    and the medal they were holding is simply gone.

    One counter moves downward here. `builds` was the count of completed lesson
    ids on both surfaces (`completed.size` in the web workspace,
    `Object.keys(lessonLevels).length` on the phone), and the corpus is served
    as 284 sessions, so a learner who had finished 55 lessons was shown 110
    builds and a lit "Centurion". Counting authored lessons is the right rule
    and it halves that number.

    So the FIRST sync, and only the first, is evaluated against the higher of
    the two: what the learner actually holds today, and what they were shown
    they held yesterday. Nothing here invents a medal. It stamps what the
    product itself displayed as earned, once, and every sync afterwards uses the
    corrected counters alone.
    """
    return {**stats, "builds": max(stats["builds"], len(completed_lessons(progress)))}


# ── The catalogue ─────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _catalogue() -> tuple[tuple[str, str, int], ...]:
    """(id, metric, threshold) for every achievement, from the served catalogue."""
    out: list[tuple[str, str, int]] = []
    for item in curriculum._achievements().get("achievements", []):
        aid = item.get("id")
        metric = item.get("metric")
        threshold = item.get("threshold")
        if isinstance(aid, str) and isinstance(metric, str) and isinstance(threshold, (int, float)):
            out.append((aid, metric, int(threshold)))
    return tuple(out)


def satisfied_now(stats: dict[str, int]) -> list[tuple[str, str, int, int]]:
    """Every achievement whose condition holds right now, with the value seen."""
    return [
        (aid, metric, threshold, stats.get(metric, 0))
        for aid, metric, threshold in _catalogue()
        if stats.get(metric, 0) >= threshold
    ]


# ── The durable record ────────────────────────────────────────────────────────

def _read_earned(uid: str) -> tuple[dict[str, Any], bool]:
    """(the stored earned map, whether the learner has a record at all)."""
    from state_store import get_client

    try:
        snap = get_client().collection(ACHIEVEMENTS_COLLECTION).document(uid).get()
        if snap.exists:
            stored = (snap.to_dict() or {}).get("earned")
            return (stored if isinstance(stored, dict) else {}), True
    except Exception as exc:
        logger.warning("achievement record read failed for %s: %s", uid, exc)
    return {}, False


def sync(uid: str) -> dict[str, Any]:
    """Stamp everything the learner has earned and does not yet hold.

    Stamping everything in one call rather than one achievement at a time is
    deliberate, and is the same choice checkpoints makes: it is naturally
    idempotent (a second call finds nothing left), it catches up a client that
    was offline when a threshold was crossed, and it costs one round trip.

    Nothing is ever removed. A stat that later falls below its threshold, or a
    metric that is later derived differently, leaves the stamp exactly where it
    is, which is the entire point of the record.
    """
    from state_store import get_client

    progress = _progress(uid)
    stats = compute_stats(uid, progress)
    # What the learner was last SHOWN, for the one-off backfill below. Computed
    # out here because the transaction body may be retried and must not read.
    displayed = as_last_displayed(stats, progress)
    client = get_client()
    ref = client.collection(ACHIEVEMENTS_COLLECTION).document(uid)
    existing, had_record = _read_earned(uid)
    now = datetime.now(timezone.utc).isoformat()

    @firestore.transactional
    def _stamp(txn: firestore.Transaction) -> tuple[dict[str, Any], dict[str, Any]]:
        snap = ref.get(transaction=txn)
        held = (snap.to_dict() or {}).get("earned") if snap.exists else {}
        held = held if isinstance(held, dict) else {}

        fresh: dict[str, Any] = {}
        # A learner with no record is being caught up, so they are measured
        # against what they were shown as well as against what they hold. Every
        # sync after that uses the corrected counters only.
        for aid, metric, threshold, value in satisfied_now(stats if snap.exists else displayed):
            if aid in held:
                continue
            entry: dict[str, Any] = {"at": now, "metric": metric, "threshold": threshold, "value": value}
            if not snap.exists:
                # The learner earned this before there was anywhere to record it,
                # so the instant is when we noticed, not when it happened. Said
                # out loud rather than presented as a precise date we do not have.
                entry["backfilled"] = True
            fresh[aid] = entry

        if fresh:
            # set(merge) rather than update(): the document may not exist yet, and
            # update() would raise on a first-ever stamp. Firestore merges nested
            # maps field by field, so previously stamped entries survive.
            txn.set(ref, {"uid": uid, "earned": fresh, "updatedAt": now}, merge=True)
        return {**held, **fresh}, fresh

    synced = True
    try:
        earned, newly = _stamp(client.transaction())
    except Exception as exc:
        # A failed stamp must not blank the trophy case: the record already read
        # is returned and the client keeps whatever it can prove locally. Logged
        # at error level because a medal not stamped is a medal that has to be
        # re-earned on the next visit before it sticks.
        logger.error("achievement stamp failed for %s: %s", uid, exc)
        earned, newly, synced = existing, {}, False

    if newly:
        obs.audit(
            "achievement.earned",
            uid=uid,
            ids=sorted(newly),
            backfilled=not had_record,
        )

    return {
        "earned": earned,
        "newlyEarned": sorted(newly),
        "stats": stats,
        # True only on the very first sync a learner ever does, so a client can
        # tell "you just earned this" apart from "we are recording what you
        # already had" and skip the confetti for a backfill.
        "backfilled": not had_record,
        "synced": synced,
        "version": curriculum.content_version(),
    }


@router.post("/sync")
def sync_achievements(uid: str = Depends(require_uid)) -> dict[str, Any]:
    """Record everything earned, and report the durable record plus live stats.

    No idempotency header needed: the transaction inside is the guard, and a
    repeated call finds nothing left to stamp. That is a stronger promise than a
    key, which only protects against a retry of the SAME request.
    """
    return sync(uid)
