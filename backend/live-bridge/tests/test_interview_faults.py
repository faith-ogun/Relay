"""The planted-fault round: the one interview exercise Ohmlet can run and the
incumbents cannot.

Taken from how hardware engineers actually interview: hand a candidate a broken
schematic and ask them to find the fault. The engineer it comes from notes the
technique is "biased in favour of experienced candidates", and that bias is the
difficulty ladder rather than a flaw, so it is encoded as tiers.

What these pin:

  1. Every fault routes to a REAL skill. This is the whole reason the round
     belongs here: the report can send a candidate who missed it to the lesson
     that closes it. A fault pointing at a skill that does not exist would be a
     dead end at the worst possible moment.
  2. Every named diagram can actually be DRAWN. Naming a circuit the client
     cannot render puts a blank box in front of someone under pressure. Faults
     with no diagram say so and are described verbally, which is what a phone
     screen is anyway.
  3. A graduate is never handed a senior fault. Asking a new graduate about
     op-amp frequency compensation measures years served, not anything they
     could have learned here.
  4. The catalogue given to the interviewer includes the ANSWER, so it can tell
     "no current-limiting resistor" from "the LED will be dim", and can give the
     better answer afterwards rather than only a score.

Point 1 is the one worth the file, and it is checked against the live curriculum
rather than a copy, so authoring that renames a skill fails here rather than in
front of a candidate.
"""

from __future__ import annotations

import interview_faults as faults
import interview_gaps as gaps


# ── The invariants that make the round safe to run ──────────────────────────

def test_every_fault_routes_to_a_real_skill():
    """Checked against the live curriculum. Rename a skill and this fails here,
    not in an interview."""
    assert faults.validate() == []
    skills = set(gaps.skill_ids())
    for f in faults.FAULTS:
        assert f["skillId"] in skills, f"{f['id']} -> {f['skillId']}"


def test_every_named_diagram_can_be_drawn():
    """A circuit id the client cannot render is a blank box in front of a
    candidate who is already nervous."""
    for f in faults.FAULTS:
        if f["circuit"] is not None:
            assert f["circuit"] in faults.RENDERABLE, f"{f['id']} names {f['circuit']}"


def test_faults_without_a_diagram_are_explicit_about_it():
    """None, not an empty string or a plausible-looking id nobody implemented."""
    for f in faults.FAULTS:
        assert f["circuit"] is None or isinstance(f["circuit"], str)
        assert f["circuit"] != ""


def test_the_six_documented_fault_classes_are_all_covered():
    """The research found six recurring planted-fault classes and all six map
    onto skills Ohmlet already teaches. That six-for-six is why this round was
    built first rather than the ones needing new curriculum."""
    ids = {f["id"] for f in faults.FAULTS}
    assert ids == {
        "no-current-limit",      # missing current-limiting resistor
        "no-decoupling",         # missing decoupling capacitors
        "regulator-bare",        # regulator without input/output caps
        "no-base-resistor",      # incorrect transistor configuration
        "floating-input",        # missing pull-up/pull-down
        "opamp-uncompensated",   # no frequency compensation
    }


# ── Tiering ─────────────────────────────────────────────────────────────────

def test_a_graduate_is_never_handed_a_senior_fault():
    ids = {f["id"] for f in faults.for_tier(faults.tier_for("Graduate Electronics Engineer"))}
    assert "opamp-uncompensated" not in ids
    assert ids, "a graduate must still get some faults"


def test_a_senior_gets_the_whole_catalogue():
    assert len(faults.for_tier(faults.tier_for("Senior Firmware Engineer"))) == len(faults.FAULTS)


def test_seniority_words_map_sensibly():
    for word in ("intern", "new grad", "Junior Hardware Engineer", "Apprentice"):
        assert faults.tier_for(word) == 1, word
    for word in ("Senior EE", "Staff Firmware Engineer", "Principal", "Tech Lead"):
        assert faults.tier_for(word) == 3, word
    # Unknown or unstated lands mid, which is the safe middle rather than the
    # hardest or the easiest.
    for word in ("", None, "Electronics Engineer"):
        assert faults.tier_for(word) == 2, word


# ── What the interviewer is actually given ──────────────────────────────────

def test_the_prompt_carries_the_answer_so_it_can_judge():
    """Without the fault and the symptom, the interviewer cannot tell a real
    answer from a component name, and cannot give the better answer after."""
    block = faults.catalogue_for_prompt(3)
    for f in faults.FAULTS:
        assert f["brief"] in block, f["id"]
        assert f["fault"] in block, f["id"]
        assert f["good"] in block, f["id"]
        assert f["skillId"] in block, f["id"]


def test_the_prompt_says_which_faults_have_a_picture():
    block = faults.catalogue_for_prompt(3)
    assert "[show the led_no_resistor schematic]" in block
    assert "[describe it in words]" in block


def test_the_instruction_is_filtered_by_seniority():
    from ohmlet_live_agent.interview_agent import instruction_for

    grad = instruction_for("Graduate Electronics Engineer")
    senior = instruction_for("Senior Firmware Engineer")

    assert "opamp-uncompensated" in senior
    assert "opamp-uncompensated" not in grad
    # The placeholder must be gone, or the interviewer reads a literal brace.
    assert "{FAULT_CATALOGUE}" not in grad
    assert "{FAULT_CATALOGUE}" not in senior


def test_every_fault_gives_a_bench_symptom_not_just_a_rule():
    """The round distinguishes a candidate who has read about a fault from one
    who has met it, and the interviewer can only draw that line if it knows what
    the failure looks like in front of you."""
    for f in faults.FAULTS:
        assert len(f["symptom"]) > 60, f["id"]
        assert len(f["good"]) > 40, f["id"]
