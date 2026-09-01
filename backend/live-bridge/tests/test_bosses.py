"""The boss contract: composed here, graded here, paid once, and it gates.

A boss is the only thing in the product that can stop a learner moving forward,
so the tests that matter are the ones about authority. Every number on the
result screen has to be derivable by the server from (unit, seed) alone, or a
client could clear a unit it never sat.

What these pin down, in the order a learner meets them:

  1. The exam covers every skill in the unit, so the per-skill screen cannot
     lie by omission.
  2. It is deterministic for a seed, which is the whole basis for re-grading a
     result without storing the exam.
  3. Shuffling the options never moves the answer out from under `correct`.
  4. The gate is real: a boss cannot be sat early, and unit N+1 stays shut
     until unit N is cleared.
  5. A pass pays once. A second pass, from anywhere, pays zero.
  6. A client cannot report questions it was not asked.

Point 6 is the one worth the file. `firstTryCorrect` is the only thing a client
sends, and if out-of-range or repeated indices counted, any learner could clear
any unit by posting a long enough list of numbers.

The fakes come from test_checkpoints so both suites exercise the same Firestore
stand-in, including its nested-merge behaviour, rather than one file quietly
testing against a friendlier fake than the other.
"""

from __future__ import annotations

import copy

import pytest

import bosses
import curriculum
from test_checkpoints import FakeClient


def _steps(prefix: str, n: int) -> list[dict]:
    """n answerable steps, alternating shapes so composition sees real variety."""
    out: list[dict] = []
    for i in range(n):
        if i % 3 == 0:
            out.append({
                "type": "multiple_choice",
                "question": f"{prefix}-q{i}",
                "options": ["right", "wrong-a", "wrong-b", "wrong-c"],
                "correct": 0,
                "explanation": "because",
                "difficulty": (i % 3) + 1,
            })
        elif i % 3 == 1:
            out.append({"type": "true_false", "question": f"{prefix}-q{i}", "answer": True, "explanation": "because"})
        else:
            out.append({"type": "fill_blank", "question": f"{prefix}-q{i}", "answer": "ohm", "explanation": "because"})
    return out


FAKE_CURRICULUM = {
    "version": "test",
    "units": [
        {
            "id": "u1", "title": "First", "subtitle": "", "level": "beginner", "accent": "gold",
            "skills": [
                {"id": "s-a", "title": "Skill A", "lessons": [{"id": "a1"}, {"id": "a2"}]},
                {"id": "s-b", "title": "Skill B", "lessons": [{"id": "b1"}, {"id": "b2"}]},
            ],
        },
        {
            "id": "u2", "title": "Second", "subtitle": "", "level": "beginner", "accent": "blue",
            "skills": [
                {"id": "s-c", "title": "Skill C", "lessons": [{"id": "c1"}, {"id": "c2"}]},
            ],
        },
    ],
}

FAKE_LESSONS = {
    "version": "test",
    "lessons": {
        "a1": {"steps": [{"type": "teach", "title": "t", "body": "b"}] + _steps("a1", 8), "xpReward": 20},
        "a2": {"steps": _steps("a2", 8), "xpReward": 20},
        "b1": {"steps": _steps("b1", 8), "xpReward": 20},
        "b2": {"steps": _steps("b2", 8), "xpReward": 20},
        "c1": {"steps": _steps("c1", 8), "xpReward": 20},
        "c2": {"steps": _steps("c2", 8), "xpReward": 20},
    },
}

U1_LESSONS = ["a1", "a2", "b1", "b2"]
U2_LESSONS = ["c1", "c2"]


@pytest.fixture
def fake(monkeypatch):
    client = FakeClient()

    monkeypatch.setattr(curriculum, "_curriculum", lambda: FAKE_CURRICULUM)
    monkeypatch.setattr(curriculum, "_lessons", lambda: FAKE_LESSONS)
    # Both are lru_cached against the REAL curriculum in any other test in this
    # process. Cleared on the way in and out so this file neither inherits nor
    # leaves a poisoned cache.
    bosses._unit_index.cache_clear()
    bosses._pool.cache_clear()

    import state_store
    monkeypatch.setattr(state_store, "get_client", lambda: client)

    def passthrough(fn):
        def wrapper(transaction, *args, **kwargs):
            result = fn(transaction, *args, **kwargs)
            transaction.commit()
            return result
        return wrapper

    monkeypatch.setattr(bosses.firestore, "transactional", passthrough)

    yield client
    bosses._unit_index.cache_clear()
    bosses._pool.cache_clear()


def complete(client, uid: str, *lesson_ids: str) -> None:
    key = f"ohmlet_state/{uid}"
    data = client.store.setdefault(key, {"data": {"lessonLevels": {}}})
    for lid in lesson_ids:
        data["data"]["lessonLevels"][lid] = 1


def unit_row(uid: str, unit_id: str) -> dict:
    return {u["unitId"]: u for u in bosses.status(uid)["units"]}[unit_id]


# ── Composition ──────────────────────────────────────────────────────────────

def test_exam_covers_every_skill_in_the_unit(fake):
    steps = bosses.compose("u1", "seed-1")
    assert {s["skillId"] for s in steps} == {"s-a", "s-b"}


def test_exam_never_includes_teaching(fake):
    # a1 opens with a teach step. An exam that taught first would not be one.
    assert all(s["type"] != "teach" for s in bosses.compose("u1", "seed-1"))
    assert all(s["type"] in bosses.EXAM_TYPES for s in bosses.compose("u1", "seed-1"))


def test_same_seed_composes_the_same_exam(fake):
    # The entire grading design rests on this: without it the server cannot
    # re-derive what it asked, and every result would have to be taken on trust.
    assert bosses.compose("u1", "seed-1") == bosses.compose("u1", "seed-1")


def test_different_seeds_compose_different_exams(fake):
    assert bosses.compose("u1", "seed-1") != bosses.compose("u1", "seed-2")


def test_shuffling_options_keeps_the_answer_correct(fake):
    # Every authored multiple_choice above has "right" at index 0. Wherever the
    # shuffle moved it, `correct` must still point at it.
    seen = 0
    for s in bosses.compose("u1", "seed-3"):
        if s["type"] == "multiple_choice":
            assert s["options"][s["correct"]] == "right"
            seen += 1
    assert seen, "no choice steps composed, so this proved nothing"


def test_composition_does_not_mutate_the_cached_corpus(fake):
    # The steps come from an lru_cached dict shared by every request on the
    # instance. Shuffling one in place would rewrite the authored corpus for
    # everybody, and the next learner would get a lesson with a wrong answer key.
    before = copy.deepcopy(FAKE_LESSONS)
    for seed in ("s1", "s2", "s3"):
        bosses.compose("u1", seed)
    assert FAKE_LESSONS == before


def test_exam_is_capped_by_what_the_unit_can_fill(fake):
    # u2 has one skill and 16 eligible steps, so it cannot reach MIN_QUESTIONS
    # by inventing questions; it must simply be shorter.
    assert bosses.question_count("u2") == min(bosses.MIN_QUESTIONS, len(bosses._pool("u2")))


# ── The gate ─────────────────────────────────────────────────────────────────

def test_boss_is_not_ready_until_the_unit_is_finished(fake):
    complete(fake, "u", "a1", "a2")          # b1/b2 outstanding
    assert unit_row("u", "u1")["ready"] is False


def test_first_unit_is_reachable_from_the_start(fake):
    assert unit_row("u", "u1")["reachable"] is True


def test_next_unit_is_unreachable_until_this_one_is_cleared(fake):
    complete(fake, "u", *U1_LESSONS, *U2_LESSONS)
    assert unit_row("u", "u2")["reachable"] is False

    ex = bosses.exam("u", "u1")
    bosses.submit("u", "u1", ex["seed"], list(range(ex["questions"])))
    assert unit_row("u", "u2")["reachable"] is True


# ── Grading and payment ──────────────────────────────────────────────────────

def test_a_pass_pays_and_a_second_pass_pays_nothing(fake):
    complete(fake, "u", *U1_LESSONS)
    ex = bosses.exam("u", "u1")
    everything = list(range(ex["questions"]))

    first = bosses.submit("u", "u1", ex["seed"], everything)
    assert first["passed"] and first["firstClear"]
    assert first["xp"] == bosses.xp_for("u1") > 0

    again = bosses.submit("u", "u1", ex["seed"], everything)
    assert again["passed"] and not again["firstClear"]
    assert again["xp"] == 0, "clearing a boss twice must not pay twice"


def test_a_fail_pays_nothing_but_is_recorded(fake):
    complete(fake, "u", *U1_LESSONS)
    ex = bosses.exam("u", "u1")
    result = bosses.submit("u", "u1", ex["seed"], [0])

    assert not result["passed"] and result["xp"] == 0
    assert result["attempts"] == 1
    assert 0 < result["bestRatio"] < bosses.PASS_RATIO
    assert unit_row("u", "u1")["cleared"] is False


def test_a_later_worse_attempt_does_not_lower_the_best_score(fake):
    complete(fake, "u", *U1_LESSONS)
    ex = bosses.exam("u", "u1")
    good = bosses.submit("u", "u1", ex["seed"], list(range(ex["questions"])))
    poor = bosses.submit("u", "u1", ex["seed"], [0])
    assert poor["bestRatio"] == good["bestRatio"] == 1.0
    assert poor["cleared"] is True, "a bad re-sit must not un-clear a cleared unit"


def test_indices_outside_the_exam_are_discarded(fake):
    # The one thing a client controls. If these counted, a long enough list of
    # numbers would clear any unit without answering anything.
    complete(fake, "u", *U1_LESSONS)
    ex = bosses.exam("u", "u1")
    result = bosses.submit("u", "u1", ex["seed"], list(range(500)))
    assert result["correct"] == result["total"] == ex["questions"]
    assert result["ratio"] == 1.0


def test_repeated_indices_are_counted_once(fake):
    complete(fake, "u", *U1_LESSONS)
    ex = bosses.exam("u", "u1")
    result = bosses.submit("u", "u1", ex["seed"], [0] * 50)
    assert result["correct"] == 1, "a repeated index is one question, not fifty"
    assert not result["passed"]


def test_per_skill_breakdown_reports_the_weakest_first(fake):
    complete(fake, "u", *U1_LESSONS)
    ex = bosses.exam("u", "u1")
    steps = bosses.compose("u1", ex["seed"])
    # Answer every s-a question and none of s-b's.
    right = [i for i, s in enumerate(steps) if s["skillId"] == "s-a"]
    result = bosses.submit("u", "u1", ex["seed"], right)

    rows = {r["skillId"]: r for r in result["skills"]}
    assert rows["s-a"]["correct"] == rows["s-a"]["asked"]
    assert rows["s-b"]["correct"] == 0
    assert result["skills"][0]["skillId"] == "s-b", "the screen leads with what to go and fix"
    assert sum(r["asked"] for r in result["skills"]) == result["total"]
