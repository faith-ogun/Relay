"""Checkpoints — the reward for clearing a skill, granted once and only once.

A unit holds 11-14 lessons across 4-5 skills. The path draws a checkpoint at
every skill boundary; this is what makes reaching one worth something.

Three properties matter, and all three are why this is server work rather than a
client counter:

  1. **The amount is computed here.** It scales with the skill's lesson count
     (15 XP each, so a two-lesson skill pays 30 and a four-lesson skill 60),
     read from the authored curriculum. A client that asked for its own number
     could ask for any number.

  2. **The claim is verified.** Before granting anything we read the learner's
     own state envelope and check that every lesson in the skill is actually
     complete. "I finished this" is a claim, not a fact.

  3. **The claim is atomic.** Granted inside a Firestore transaction keyed on
     (uid, skillId). Without it, replaying a skill — or two devices claiming at
     once — is an XP printing press. This is the same failure hearts would have
     had with a device-owned balance, and it gets the same answer.

XP itself still lives in the client's progress envelope, so the grant is returned
rather than written: the server decides IF and HOW MUCH, the client records it.
The claim record is what makes that safe, because a second attempt grants zero no
matter what the client does.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

from google.cloud import firestore

import curriculum

logger = logging.getLogger("ohmlet.checkpoints")

CHECKPOINTS_COLLECTION = os.getenv("OHMLET_CHECKPOINTS_COLLECTION", "ohmlet_checkpoints")
STATE_COLLECTION = os.getenv("OHMLET_STATE_COLLECTION", "ohmlet_state")

# Per STEP in the skill, not per lesson.
#
# Per-lesson was packaging-dependent, and the packaging changed: splitting the
# authored lessons into shorter sessions doubled every skill's lesson count
# without adding a single question, and checkpoint payouts doubled with it —
# from 22% of total lesson XP to 48%, purely from a delivery decision. Steps are
# the invariant: the same work pays the same bonus however it is sliced.
#
# At 0.5 the checkpoints pay ~1,180 against the lessons' ~4,700, about 25% on
# top. The ceremony is the reward; the XP is the signal.
XP_PER_STEP = float(os.getenv("OHMLET_CHECKPOINT_XP_PER_STEP", "0.5"))

# A skill with a single lesson gets no checkpoint. Fifteen of the 57 skills hold
# exactly one lesson, and a boundary marked after every one of them would fire a
# celebration every other screen — which is how a reward stops being one. Only
# the 42 multi-lesson skills carry a checkpoint, roughly one per three lessons.
MIN_LESSONS_FOR_CHECKPOINT = int(os.getenv("OHMLET_CHECKPOINT_MIN_LESSONS", "2"))


@lru_cache(maxsize=1)
def _skill_index() -> dict[str, dict[str, Any]]:
    """skillId -> {unitId, title, lessonIds}, for skills that CARRY a checkpoint.

    Single-lesson skills are absent, so they can never be claimed and never
    appear as available — the eligibility rule lives in one place rather than
    being re-decided at each call site."""
    index: dict[str, dict[str, Any]] = {}
    data = curriculum._curriculum()
    store = curriculum._lessons().get("lessons", {})
    for unit in data.get("units", []):
        for skill in unit.get("skills", []):
            sid = skill.get("id")
            if not sid:
                continue
            lesson_ids = [l.get("id") for l in skill.get("lessons", []) if l.get("id")]
            if len(lesson_ids) < MIN_LESSONS_FOR_CHECKPOINT:
                continue
            index[sid] = {
                "unitId": unit.get("id"),
                "title": skill.get("title", ""),
                "lessonIds": lesson_ids,
                "steps": sum(len(store.get(lid, {}).get("steps", [])) for lid in lesson_ids),
            }
    return index


def xp_for(skill_id: str) -> int:
    entry = _skill_index().get(skill_id)
    if not entry:
        return 0
    # Rounded to a multiple of 5 so the number on the card reads as a reward
    # rather than as arithmetic.
    return max(5, round(entry["steps"] * XP_PER_STEP / 5) * 5)


def _completed_lessons(client: firestore.Client, uid: str) -> set[str]:
    """Lesson ids the learner has finished, read from their state envelope.

    Absent or malformed state means an empty set, which grants nothing. Failing
    closed is right here: the cost is a checkpoint claimed a moment later, and
    the alternative is granting XP for work we cannot see.
    """
    try:
        snap = client.collection(STATE_COLLECTION).document(uid).get()
        if not snap.exists:
            return set()
        data = (snap.to_dict() or {}).get("data") or {}
        levels = data.get("lessonLevels")
        return set(levels.keys()) if isinstance(levels, dict) else set()
    except Exception as exc:
        logger.warning("state read failed for %s: %s", uid, exc)
        return set()


def _claimed(client: firestore.Client, uid: str) -> dict[str, int]:
    try:
        snap = client.collection(CHECKPOINTS_COLLECTION).document(uid).get()
        if snap.exists:
            got = (snap.to_dict() or {}).get("claimed")
            if isinstance(got, dict):
                return {k: int(v.get("xp", 0)) for k, v in got.items() if isinstance(v, dict)}
    except Exception as exc:
        logger.warning("checkpoint read failed for %s: %s", uid, exc)
    return {}


def status(uid: str) -> dict[str, Any]:
    """What the learner has claimed, and what is sitting there unclaimed."""
    from state_store import get_client

    client = get_client()
    claimed = _claimed(client, uid)
    done = _completed_lessons(client, uid)
    available = [
        {"skillId": sid, "title": entry["title"], "unitId": entry["unitId"], "xp": xp_for(sid)}
        for sid, entry in _skill_index().items()
        if sid not in claimed and entry["lessonIds"] and done.issuperset(entry["lessonIds"])
    ]
    return {
        "claimed": claimed,
        "available": available,
        "totalClaimedXp": sum(claimed.values()),
    }


def claim_all(uid: str) -> dict[str, Any]:
    """Grant every checkpoint the learner has earned and not yet been paid for.

    Claiming everything available in one call rather than one skill at a time is
    deliberate: it is naturally idempotent (a second call finds nothing left),
    it survives a client that missed a claim while offline, and it costs one
    round trip instead of one per skill.
    """
    from state_store import get_client

    client = get_client()
    done = _completed_lessons(client, uid)
    index = _skill_index()
    ref = client.collection(CHECKPOINTS_COLLECTION).document(uid)

    @firestore.transactional
    def _grant(txn: firestore.Transaction) -> list[dict[str, Any]]:
        snap = ref.get(transaction=txn)
        existing = (snap.to_dict() or {}).get("claimed") if snap.exists else {}
        existing = existing if isinstance(existing, dict) else {}

        granted: list[dict[str, Any]] = []
        writes: dict[str, Any] = {}
        now = datetime.now(timezone.utc).isoformat()
        for sid, entry in index.items():
            if sid in existing or not entry["lessonIds"]:
                continue
            if not done.issuperset(entry["lessonIds"]):
                continue
            xp = xp_for(sid)
            writes[f"claimed.{sid}"] = {"xp": xp, "at": now}
            granted.append({"skillId": sid, "title": entry["title"], "unitId": entry["unitId"], "xp": xp})

        if writes:
            # set(merge) rather than update(): the document may not exist yet, and
            # update() would raise on a first-ever claim.
            payload: dict[str, Any] = {"uid": uid, "claimed": {}}
            for key, value in writes.items():
                payload["claimed"][key.split(".", 1)[1]] = value
            txn.set(ref, payload, merge=True)
        return granted

    try:
        granted = _grant(client.transaction())
    except Exception as exc:
        # Loud, not silent: a swallowed failure here looks to the learner like a
        # checkpoint that paid nothing, and they would have no way to tell.
        logger.error("checkpoint claim failed for %s: %s", uid, exc)
        raise

    return {
        "granted": granted,
        "xp": sum(g["xp"] for g in granted),
    }
