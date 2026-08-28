"""Bosses — the unit exam a learner has to clear before the next unit opens.

A lesson asks about one idea. A checkpoint marks the end of a skill. Neither
ever asks whether the unit as a WHOLE landed, and that is the gap this fills:
the boss draws across every skill in the unit at once, with no teaching in front
of it, and reports back per skill so a learner who fails knows exactly which
stretch of path to walk again.

Four properties, and all four are why this is server work:

  1. **The exam is composed here.** Sampled across the unit's skills from the
     authored corpus, hardest questions first. A client that built its own exam
     could build an easy one, and every learner would sit a different bar.

  2. **The composition is deterministic, so the grade is ours.** `compose` is a
     pure function of (unit, seed). The client is handed a seed with its exam
     and echoes it back with the result, so the server re-derives the exact same
     question list and maps each answer to its skill itself. The client cannot
     invent questions it was never asked, inflate the length of the exam, or
     attribute a miss to a skill it did not come from. What it still reports is
     which answers were right, which is precisely the trust already extended to
     every lesson; tightening that further means grading widget steps server
     side, and belongs with `grading.ts`, not here.

  3. **The pass bar is ours.** 80% first try. Requeued steps still teach inside
     the run, but a step you had to be shown twice is not a step you knew.

  4. **The grant is atomic and paid once.** Same transaction shape as
     checkpoints: a boss re-sat for a better score records the better score and
     pays nothing further. Progression is a gate, not a printing press.

Hearts are deliberately absent. The run reports misses and the phone simply does
not charge for them, so a boss can be re-sat as often as a learner likes. A gate
that also costs a life would punish the exact behaviour it is asking for.
"""

from __future__ import annotations

import copy
import hashlib
import logging
import os
import random
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

from google.cloud import firestore

import curriculum
from checkpoints import _completed_lessons as completed_lessons

logger = logging.getLogger("ohmlet.bosses")

BOSSES_COLLECTION = os.getenv("OHMLET_BOSSES_COLLECTION", "ohmlet_bosses")

# Types the exam may draw from.
#
# Deliberately NOT every graded type. The four circuit-interaction types
# (spot_error, identify_component, fix_the_circuit, trace_current) are renderable
# only when their diagram actually carries the regions they name, which is a
# judgement the CLIENT makes in `canRender` against its own diagram registry.
# Compose one of those and the phone might drop it, every index after it would
# shift, and the server would grade answers against the wrong questions. Their 74
# steps are not worth breaking the attribution the whole design rests on.
EXAM_TYPES = frozenset({
    "multiple_choice", "true_false", "fill_blank", "match", "drag_order",
    "predict_reading", "predict_behavior", "choose_resistor",
    "draw_connection", "draw_circuit", "draw_fix", "build_to_spec",
})

# Choice steps whose option list may be reordered. Mirrors levels.ts, including
# its exception: a step carrying a meter or colour bands is graded by its widget
# and its single "option" is the answer as prose, so shuffling it is meaningless
# at best and corrupting at worst.
CHOICE_TYPES = frozenset({"multiple_choice", "predict_reading", "predict_behavior", "choose_resistor"})

# Drawing steps are slow. A couple make the exam feel like the bench; six make it
# a chore, and the boss is meant to be sat in one sitting.
MAX_DRAW_STEPS = int(os.getenv("OHMLET_BOSS_MAX_DRAW", "2"))

QUESTIONS_PER_SKILL = int(os.getenv("OHMLET_BOSS_PER_SKILL", "3"))
MIN_QUESTIONS = int(os.getenv("OHMLET_BOSS_MIN_Q", "12"))
# Capped at 16 for a reason that lives on the OTHER side of the wire.
#
# The phone plays a boss through the same `useRun` as a lesson, and
# `buildLeveledSteps` treats anything with 17+ graded steps as a POOL to sample
# 15 from. A 17-question exam would therefore arrive, be silently cut to 15, and
# the two questions the learner never saw would be graded here as missed. Stay
# under that threshold and the exam the server composed is the exam that gets
# sat. mobile/scripts/check-boss-exam-size.mjs holds the two numbers together.
MAX_QUESTIONS = int(os.getenv("OHMLET_BOSS_MAX_Q", "16"))

PASS_RATIO = float(os.getenv("OHMLET_BOSS_PASS_RATIO", "0.8"))
XP_PER_QUESTION = float(os.getenv("OHMLET_BOSS_XP_PER_QUESTION", "5"))


@lru_cache(maxsize=1)
def _unit_index() -> dict[str, dict[str, Any]]:
    """unitId -> {order, title, subtitle, accent, skills, lessonIds}.

    `order` is what the gate reads: a unit is reachable when the unit before it
    in authored order has been cleared, so the index carries position rather
    than making every call site re-derive it.
    """
    index: dict[str, dict[str, Any]] = {}
    data = curriculum._curriculum()
    for order, unit in enumerate(data.get("units", [])):
        uid_ = unit.get("id")
        if not uid_:
            continue
        skills = []
        lesson_ids: list[str] = []
        for skill in unit.get("skills", []):
            sid = skill.get("id")
            if not sid:
                continue
            ids = [l.get("id") for l in skill.get("lessons", []) if l.get("id")]
            lesson_ids.extend(ids)
            skills.append({"id": sid, "title": skill.get("title", ""), "lessonIds": ids})
        index[uid_] = {
            "order": order,
            "title": unit.get("title", ""),
            "subtitle": unit.get("subtitle", ""),
            "accent": unit.get("accent", "gold"),
            "skills": skills,
            "lessonIds": lesson_ids,
        }
    return index


def _units_in_order() -> list[str]:
    return [uid_ for uid_, _ in sorted(_unit_index().items(), key=lambda kv: kv[1]["order"])]


def _difficulty(step: dict[str, Any]) -> int:
    d = step.get("difficulty")
    return d if d in (2, 3) else 1


@lru_cache(maxsize=32)
def _pool(unit_id: str) -> tuple[tuple[str, str, int, int], ...]:
    """Every exam-eligible step in a unit, as (skillId, lessonId, stepIndex, difficulty).

    Addresses rather than step bodies, so the cache stays small and the authored
    JSON is never handed out by reference for someone downstream to mutate.
    """
    entry = _unit_index().get(unit_id)
    if not entry:
        return ()
    store = curriculum._lessons().get("lessons", {})
    out: list[tuple[str, str, int, int]] = []
    for skill in entry["skills"]:
        for lesson_id in skill["lessonIds"]:
            steps = store.get(lesson_id, {}).get("steps", [])
            for i, step in enumerate(steps):
                if isinstance(step, dict) and step.get("type") in EXAM_TYPES:
                    out.append((skill["id"], lesson_id, i, _difficulty(step)))
    return tuple(out)


def question_count(unit_id: str) -> int:
    """How long this unit's exam is: three per skill, clamped, and never longer
    than the unit can actually fill."""
    entry = _unit_index().get(unit_id)
    if not entry:
        return 0
    target = QUESTIONS_PER_SKILL * max(1, len(entry["skills"]))
    return min(max(min(target, MAX_QUESTIONS), MIN_QUESTIONS), len(_pool(unit_id)))


def xp_for(unit_id: str) -> int:
    """What clearing this unit's boss pays, rounded to a multiple of five so the
    number on the card reads as a reward rather than as arithmetic."""
    n = question_count(unit_id)
    return max(5, round(n * XP_PER_QUESTION / 5) * 5) if n else 0


def _seed_int(seed: str) -> int:
    return int(hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16], 16)


def _shuffle_options(step: dict[str, Any], rng: random.Random) -> dict[str, Any]:
    if step.get("type") not in CHOICE_TYPES:
        return step
    if step.get("meter") or step.get("bands"):
        return step
    options = step.get("options")
    correct = step.get("correct")
    if not isinstance(options, list) or len(options) < 2 or not isinstance(correct, int):
        return step
    if not 0 <= correct < len(options):
        return step
    order = list(range(len(options)))
    rng.shuffle(order)
    step["options"] = [options[i] for i in order]
    step["correct"] = order.index(correct)
    images = step.get("optionImages")
    if isinstance(images, list) and len(images) == len(options):
        step["optionImages"] = [images[i] for i in order]
    return step


def compose(unit_id: str, seed: str) -> list[dict[str, Any]]:
    """The exam, as a pure function of (unit, seed).

    Round-robin across skills rather than sampling the unit as one bag: a bag
    hands the longest skill most of the questions and can miss a short skill
    entirely, which would make the per-skill result screen lie by omission. Every
    skill with anything to ask gets asked, hardest tier first, before any skill
    is asked twice.
    """
    pool = _pool(unit_id)
    if not pool:
        return []
    entry = _unit_index()[unit_id]
    rng = random.Random(_seed_int(seed))

    by_skill: dict[str, list[tuple[str, str, int, int]]] = {s["id"]: [] for s in entry["skills"]}
    for item in pool:
        by_skill.setdefault(item[0], []).append(item)
    # Hardest first, shuffled within a tier so a replay is a different exam.
    for items in by_skill.values():
        rng.shuffle(items)
        items.sort(key=lambda it: -it[3])

    target = question_count(unit_id)
    order = [s["id"] for s in entry["skills"] if by_skill.get(s["id"])]
    picked: list[tuple[str, str, int, int]] = []
    draws = 0
    store = curriculum._lessons().get("lessons", {})
    cursor = {sid: 0 for sid in order}
    exhausted: set[str] = set()

    while len(picked) < target and len(exhausted) < len(order):
        for sid in order:
            if len(picked) >= target:
                break
            if sid in exhausted:
                continue
            items = by_skill[sid]
            took = False
            while cursor[sid] < len(items):
                cand = items[cursor[sid]]
                cursor[sid] += 1
                step = store.get(cand[1], {}).get("steps", [])[cand[2]]
                if step.get("type") in ("draw_circuit", "draw_fix", "draw_connection"):
                    if draws >= MAX_DRAW_STEPS:
                        continue
                    draws += 1
                picked.append(cand)
                took = True
                break
            if not took:
                exhausted.add(sid)

    rng.shuffle(picked)

    titles = {s["id"]: s["title"] for s in entry["skills"]}
    out: list[dict[str, Any]] = []
    for sid, lesson_id, idx, _ in picked:
        # Deep-copied before anything is touched: the source dict belongs to an
        # lru_cache shared by every request on this instance, and shuffling its
        # options in place would rewrite the authored corpus for everyone.
        step = copy.deepcopy(store.get(lesson_id, {}).get("steps", [])[idx])
        step = _shuffle_options(step, rng)
        step["skillId"] = sid
        step["skillTitle"] = titles.get(sid, "")
        out.append(step)
    return out


def _record(client: firestore.Client, uid: str) -> dict[str, Any]:
    try:
        snap = client.collection(BOSSES_COLLECTION).document(uid).get()
        if snap.exists:
            units = (snap.to_dict() or {}).get("units")
            if isinstance(units, dict):
                return units
    except Exception as exc:
        logger.warning("boss read failed for %s: %s", uid, exc)
    return {}


def status(uid: str) -> dict[str, Any]:
    """Every unit's boss: whether it is reachable, sat, and cleared.

    The gate is computed here rather than on the phone because the phone is not
    the only surface, and two surfaces deriving the same rule separately is how
    they end up disagreeing about which unit a learner is allowed into.
    """
    from state_store import get_client

    client = get_client()
    units = _record(client, uid)
    done = completed_lessons(client, uid)

    out: list[dict[str, Any]] = []
    prev_cleared = True  # the first unit's boss has nothing in front of it
    for unit_id in _units_in_order():
        entry = _unit_index()[unit_id]
        rec = units.get(unit_id) if isinstance(units.get(unit_id), dict) else {}
        lesson_ids = entry["lessonIds"]
        ready = bool(lesson_ids) and done.issuperset(lesson_ids)
        cleared = bool(rec.get("cleared"))
        out.append({
            "unitId": unit_id,
            "title": entry["title"],
            "questions": question_count(unit_id),
            "xp": xp_for(unit_id),
            # Reachable: the unit before it is cleared. Ready: its own lessons
            # are finished. Both must hold before the boss may be sat, and they
            # are reported separately so the card can say WHICH one is missing.
            "reachable": prev_cleared,
            "ready": ready,
            "cleared": cleared,
            "bestRatio": float(rec.get("bestRatio", 0.0) or 0.0),
            "attempts": int(rec.get("attempts", 0) or 0),
            "xpAwarded": int(rec.get("xp", 0) or 0),
        })
        prev_cleared = cleared
    return {"units": out, "passRatio": PASS_RATIO, "totalAwardedXp": sum(u["xpAwarded"] for u in out)}


def exam(uid: str, unit_id: str) -> dict[str, Any]:
    """Compose a fresh exam, and hand back the seed that produced it."""
    entry = _unit_index().get(unit_id)
    if not entry:
        raise KeyError(unit_id)
    seed = hashlib.sha256(os.urandom(16)).hexdigest()[:32]
    steps = compose(unit_id, seed)
    return {
        "unitId": unit_id,
        "title": entry["title"],
        "seed": seed,
        "questions": len(steps),
        "passRatio": PASS_RATIO,
        "xp": xp_for(unit_id),
        "steps": steps,
    }


def submit(uid: str, unit_id: str, seed: str, first_try_correct: list[int]) -> dict[str, Any]:
    """Grade a sat exam, record it, and pay for a first clear.

    The client sends the INDICES it answered correctly first time, nothing more.
    Every other number on the result screen — the per-skill breakdown, the totals,
    whether it passed, what it paid — is derived here from the re-composed exam.
    """
    from state_store import get_client

    entry = _unit_index().get(unit_id)
    if not entry:
        raise KeyError(unit_id)

    steps = compose(unit_id, seed)
    if not steps:
        raise ValueError("empty exam")

    correct_idx = {i for i in first_try_correct if isinstance(i, int) and 0 <= i < len(steps)}

    per_skill: dict[str, dict[str, Any]] = {}
    for i, step in enumerate(steps):
        sid = step.get("skillId") or "?"
        row = per_skill.setdefault(sid, {"skillId": sid, "title": step.get("skillTitle", ""), "asked": 0, "correct": 0})
        row["asked"] += 1
        if i in correct_idx:
            row["correct"] += 1

    total = len(steps)
    got = len(correct_idx)
    ratio = got / total if total else 0.0
    passed = ratio >= PASS_RATIO

    client = get_client()
    ref = client.collection(BOSSES_COLLECTION).document(uid)
    award = xp_for(unit_id)
    now = datetime.now(timezone.utc).isoformat()

    @firestore.transactional
    def _record_attempt(txn: firestore.Transaction) -> dict[str, Any]:
        snap = ref.get(transaction=txn)
        units = (snap.to_dict() or {}).get("units") if snap.exists else {}
        units = units if isinstance(units, dict) else {}
        prev = units.get(unit_id) if isinstance(units.get(unit_id), dict) else {}

        already = bool(prev.get("cleared"))
        granted = award if (passed and not already) else 0
        row = {
            "cleared": already or passed,
            "bestRatio": max(float(prev.get("bestRatio", 0.0) or 0.0), ratio),
            "attempts": int(prev.get("attempts", 0) or 0) + 1,
            "xp": int(prev.get("xp", 0) or 0) + granted,
            "at": now,
        }
        txn.set(ref, {"uid": uid, "units": {unit_id: row}}, merge=True)
        return {"granted": granted, "firstClear": passed and not already, "record": row}

    try:
        result = _record_attempt(client.transaction())
    except Exception as exc:
        # Loud: a swallowed failure here is a learner who cleared a boss and was
        # left standing in front of a locked unit with nothing to explain it.
        logger.error("boss submit failed for %s/%s: %s", uid, unit_id, exc)
        raise

    return {
        "unitId": unit_id,
        "passed": passed,
        "ratio": ratio,
        "correct": got,
        "total": total,
        "passRatio": PASS_RATIO,
        "xp": result["granted"],
        "firstClear": result["firstClear"],
        "cleared": result["record"]["cleared"],
        "bestRatio": result["record"]["bestRatio"],
        "attempts": result["record"]["attempts"],
        # Sorted by weakest first: the point of the screen is what to go and fix.
        "skills": sorted(per_skill.values(), key=lambda r: (r["correct"] / r["asked"] if r["asked"] else 1.0)),
    }
