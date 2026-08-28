"""Routing an interview's weaknesses to the lessons that close them.

This is the only thing that makes Interview Mode belong on Ohmlet rather than on
any of the products already doing AI mock interviews. Yoodli, Huru and Final
Round can all tell a candidate they were weak on decoupling capacitors. None of
them owns 284 lessons about decoupling capacitors.

Ohmlet could and did not: `recommendedTopics` was an array of free text, so the
report named a weakness and linked nowhere. The tiering review's words were that
without this, Interview Mode "becomes indistinguishable from Yoodli or Huru,
sitting on the most expensive tier".

What these pin:

  1. A real skill id routes, carrying the lesson's title and unit so the report
     can deep-link rather than describe.
  2. An id the model invented is reported as UNCOVERED, not dropped. Dropping it
     would hide the signal.
  3. Nothing is stretched onto a lesson that merely shares a word. A candidate
     sent to the wrong lesson is worse off than one told we do not cover it yet.
  4. Uncovered topics are COUNTED, because the set of things candidates get asked
     and Ohmlet cannot teach is a curriculum backlog written by the job market.
  5. Review and gateway skills are not routable: they are the boss's ground, not
     a lesson to study.

Point 4 has teeth. The interviewer is instructed to probe RTOS, `volatile`,
Nyquist, CAN bus and metastability, and all five score zero mentions across the
2,355 authored steps. The product can diagnose gaps it cannot close, and the
right response is to say so and write it down, not to paper over it.
"""

from __future__ import annotations

import interview_gaps as gaps


# ── The catalogue ───────────────────────────────────────────────────────────

def test_the_catalogue_comes_from_the_curriculum():
    ids = gaps.skill_ids()
    assert len(ids) >= 40, f"only {len(ids)} routable skills"
    assert "caps-at-work" in ids
    assert "leds-limiting" in ids


def test_review_and_gateway_skills_are_not_routable():
    """Sending someone to a unit checkpoint to 'study' is sending them to an
    exam. The boss covers that ground; a film or a lesson closes a gap."""
    for sid in gaps.skill_ids():
        assert not sid.endswith("-check"), sid
        assert not sid.endswith("-gateway"), sid


def test_the_prompt_catalogue_names_skills_not_just_ids():
    """A model matching a weakness to `opamp-real-world` needs to know what is
    in it. An id alone does not say."""
    block = gaps.catalogue_for_prompt()
    assert "caps-at-work" in block
    assert "Capacitors at Work" in block
    assert "Capacitors, RC & Timing" in block


# ── Routing ─────────────────────────────────────────────────────────────────

def test_a_real_skill_routes_with_enough_to_deep_link():
    routed, uncovered = gaps.resolve([
        {"topic": "Decoupling capacitors", "skillId": "caps-at-work", "why": "could not explain why"},
    ])
    assert uncovered == []
    (r,) = routed
    assert r["covered"] is True
    assert r["skillId"] == "caps-at-work"
    assert r["skillTitle"] and r["unitId"] and r["unitTitle"]
    assert r["why"] == "could not explain why"


def test_an_invented_id_is_reported_uncovered_not_dropped():
    """The signal is the point. Dropping it would hide that the interviewer is
    probing something the curriculum does not teach."""
    routed, uncovered = gaps.resolve([
        {"topic": "RTOS mutexes and priority inversion", "skillId": "rtos-basics", "why": "asked, no answer"},
    ])
    assert uncovered == ["RTOS mutexes and priority inversion"]
    (r,) = routed
    assert r["covered"] is False
    assert r["skillId"] is None
    # Still carries the topic and the reason, so the report can say it plainly.
    assert r["topic"] and r["why"]


def test_the_none_sentinel_is_a_valid_answer():
    """`none` is what the model is told to send when nothing teaches a topic.
    It must land as uncovered rather than as an error."""
    routed, uncovered = gaps.resolve([
        {"topic": "CAN bus arbitration", "skillId": "none", "why": "not covered"},
    ])
    assert uncovered == ["CAN bus arbitration"]
    assert routed[0]["covered"] is False


def test_a_review_skill_id_does_not_route():
    """Even a REAL id that is not routable must not route."""
    routed, uncovered = gaps.resolve([
        {"topic": "Revision", "skillId": "foundations-check", "why": "weak overall"},
    ])
    assert routed[0]["covered"] is False
    assert uncovered == ["Revision"]


def test_legacy_free_text_topics_still_parse():
    """Reports written before this existed are plain strings. They must not
    crash the endpoint, and they are correctly unroutable."""
    routed, uncovered = gaps.resolve(["I2C bus debugging", "RTOS mutexes"])
    assert len(routed) == 2
    assert all(r["covered"] is False for r in routed)
    assert uncovered == ["I2C bus debugging", "RTOS mutexes"]


def test_junk_is_ignored_without_raising():
    routed, uncovered = gaps.resolve([None, 42, {}, {"topic": ""}, {"skillId": "caps-at-work"}])
    assert routed == []
    assert uncovered == []


def test_an_empty_list_is_fine():
    assert gaps.resolve([]) == ([], [])
    assert gaps.resolve(None) == ([], [])


# ── The finding this whole module exists because of ─────────────────────────

def test_the_interviewer_probes_topics_the_curriculum_does_not_teach():
    """Not a bug in this module: a measured fact about the product.

    ohmlet_live_agent/interview_agent.py instructs the interviewer to probe
    RTOS, `volatile`, Nyquist, CAN bus and metastability. None appears anywhere
    in the 2,355 authored steps. Interview Mode can therefore diagnose gaps
    Ohmlet cannot close.

    This test does not fail today, and it is not meant to: it documents the gap
    and will start passing MORE meaningfully as those skills get authored. What
    it does enforce is that none of them is silently mapped onto an unrelated
    lesson.
    """
    import json
    import pathlib

    corpus = json.dumps(
        json.loads(
            (pathlib.Path(__file__).resolve().parents[1] / "app" / "curriculum_data" / "lessons.json").read_text()
        )
    ).lower()

    untaught = [t for t in ("rtos", "volatile", "nyquist", "can bus", "metastab") if t not in corpus]
    # If this shrinks, somebody authored the lessons and that is good news.
    assert untaught, "every probed topic is now taught, update this test's premise"

    # Whatever is untaught must route to nothing rather than to a near-miss.
    routed, uncovered = gaps.resolve(
        [{"topic": t, "skillId": "none", "why": "probed but not taught"} for t in untaught]
    )
    assert all(r["covered"] is False for r in routed)
    assert uncovered == untaught
