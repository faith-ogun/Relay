"""The planted-fault round: hand the candidate a broken schematic.

Taken from how hardware engineers actually interview. Nash Reilly hands a
candidate a deliberately broken schematic and asks them to find the faults, and
notes the technique is "biased in favour of experienced candidates" because
juniors lack the context to spot the subtler ones. That bias is not a flaw to
correct, it is the difficulty ladder, handed over for free: tier a fault by how
much context it takes to see.

Why this round and not another. Every fault class below maps onto a skill Ohmlet
already teaches, with lessons that already exist. Six for six. It is the one
interview exercise where the gap-to-lesson routing works TODAY, with no new
curriculum, unlike RTOS or CAN which have to be authored first. It is also the
one exercise the incumbents structurally cannot run: Snubber is text, Yoodli and
Final Round judge delivery rather than engineering, and none of them owns a
schematic renderer or the lessons to send you to afterwards.

**On diagrams.** Some faults have a real circuit the app can draw, because the
curriculum already needed a broken one to teach with. The rest are described in
words, which is honest: a voice interview describing a circuit is exactly what a
phone screen is, and inventing a diagram id that does not render would put a
blank box in front of a candidate under pressure.
"""

from __future__ import annotations

from typing import Any

# Diagrams the client can actually draw. Anything not in here is described
# verbally instead of referencing a picture that would render as nothing.
# Mirrors CIRCUITS in mobile/src/components/circuits/CircuitDiagram.tsx.
RENDERABLE = frozenset({
    "series_circuit", "parallel_circuit", "voltage_divider", "led_no_resistor",
    "reversed_led", "short_circuit", "ldr_alarm", "transistor_switch",
    "rc_low_pass", "opamp_inverting", "opamp_noninverting", "voltage_regulator",
    "h_bridge", "breadboard_layout",
})

# tier 1: visible to a beginner who has done the lesson
# tier 2: needs the habit of checking, not just the knowledge
# tier 3: needs experience of it going wrong in the field
FAULTS: list[dict[str, Any]] = [
    {
        "id": "no-current-limit",
        "tier": 1,
        "title": "An LED straight across the supply",
        "circuit": "led_no_resistor",
        "brief": "Here is an LED wired directly across a 9V supply. What is wrong with it?",
        "fault": "There is no current-limiting resistor.",
        "symptom": "The LED is very bright for a moment and then dead. A diode has no "
                   "internal resistance to speak of once it is conducting, so the current "
                   "is limited only by the supply and the wiring.",
        "good": "Size a resistor from (Vsupply - Vf) / If. At 9V with a red LED at 2V and "
                "20mA that is 350 ohms, so 330 or 390 from the E12 series.",
        "skillId": "leds-limiting",
    },
    {
        "id": "no-decoupling",
        "tier": 2,
        "title": "A logic chip with no decoupling",
        "circuit": None,
        "brief": "A schematic shows a microcontroller and two logic ICs, each with VCC "
                 "and GND connected to the rails, and nothing else near the supply pins. "
                 "What is missing?",
        "fault": "There are no decoupling capacitors at the supply pins.",
        "symptom": "It usually works on the bench and fails intermittently under load. "
                   "Switching current has to come from somewhere, and without a local "
                   "reservoir it comes down the track inductance as a supply dip.",
        "good": "100nF ceramic as close to each VCC pin as the layout allows, plus one "
                "bulk capacitor of a few microfarads per board section.",
        "skillId": "caps-at-work",
    },
    {
        "id": "regulator-bare",
        "tier": 2,
        "title": "A regulator with bare pins",
        "circuit": "voltage_regulator",
        "brief": "A linear regulator takes 12V in and gives 5V out. Its input and output "
                 "pins go straight to the rails with nothing on them. Is that complete?",
        "fault": "No input or output capacitors.",
        "symptom": "The regulator can oscillate. Its feedback loop is compensated on the "
                   "assumption of a capacitive load, and without one the output can ring "
                   "at hundreds of kilohertz while reading correct on a slow meter.",
        "good": "Read the datasheet, because the values are not folklore: typically "
                "0.33uF at the input and 0.1uF at the output for a 78xx, and low-ESR types "
                "with a minimum capacitance for an LDO.",
        "skillId": "linear-regulation",
    },
    {
        "id": "no-base-resistor",
        "tier": 1,
        "title": "A pin wired straight to a base",
        "circuit": "transistor_switch",
        "brief": "A microcontroller pin drives the base of an NPN transistor that switches "
                 "a motor. The pin connects directly to the base. What have they missed?",
        "fault": "There is no base resistor.",
        "symptom": "The base-emitter junction looks like a forward-biased diode to the pin, "
                   "roughly a short at 0.7V, so the pin sources far beyond its rating and "
                   "is damaged. Often it half works for a week first.",
        "good": "(Vpin - 0.7) / Ibase. At 5V wanting 2mA that is about 2.2k, and 1k to 2.2k "
                "is the usual answer. Overdrive it five to ten times the calculated minimum "
                "so the transistor saturates rather than sitting half on and heating.",
        "skillId": "driving-loads",
    },
    {
        "id": "floating-input",
        "tier": 2,
        "title": "A button with nothing holding the pin",
        "circuit": None,
        "brief": "A push button connects a microcontroller input pin to ground. Nothing "
                 "else is attached to that pin. What happens when the button is not pressed?",
        "fault": "The input floats. There is no pull-up.",
        "symptom": "The pin reads whatever charge and noise leave on it, so the input "
                   "flickers between states and the code sees phantom presses, worse near "
                   "a motor or a mains cable.",
        "good": "A pull-up to VCC, 10k is conventional, or the internal pull-up if the part "
                "has one. Then the button pulls the pin low and the resting state is defined.",
        "skillId": "reading-inputs",
    },
    {
        "id": "opamp-uncompensated",
        "tier": 3,
        "title": "An amplifier that will not sit still",
        "circuit": "opamp_noninverting",
        "brief": "A non-inverting amplifier has a gain of 2 and drives a long cable into a "
                 "capacitive load. On the bench it oscillates. The maths is right. Why?",
        "fault": "No frequency compensation for the capacitive load.",
        "symptom": "A capacitive load adds a pole inside the feedback loop, eating phase "
                   "margin until the amplifier rings or oscillates outright. The DC "
                   "behaviour is exactly as designed, which is what makes it hard to see.",
        "good": "An isolation resistor of tens of ohms between output and load, outside the "
                "feedback loop, or a unity-gain-stable part specified to drive capacitance. "
                "Check the phase margin, not just the gain.",
        "skillId": "opamp-real-world",
    },
]


def for_tier(max_tier: int) -> list[dict[str, Any]]:
    """Faults at or below a difficulty tier.

    A junior gets the ones their lessons have prepared them for. Handing a
    graduate the op-amp compensation fault tests whether they have shipped
    hardware, not whether they have learned anything, and an interview that only
    measures years is not one Ohmlet should imitate.
    """
    return [f for f in FAULTS if f["tier"] <= max_tier]


def tier_for(seniority: str | None) -> int:
    """Map a free-text seniority onto a difficulty tier.

    `grad` rather than `graduate`, because "new grad" is how most people write
    it and matching the long form alone silently tiered them as mid, which hands
    a new graduate the op-amp compensation fault. Caught by a test rather than by
    a candidate.

    Anything unrecognised lands at tier 2. Middle is the right default: tier 1
    would waste a senior's time and tier 3 would ambush a beginner, and an
    unstated seniority is more often mid than either extreme.
    """
    s = (seniority or "").strip().lower()
    if any(w in s for w in ("intern", "grad", "junior", "entry", "apprentice", "trainee", "placement")):
        return 1
    if any(w in s for w in ("senior", "staff", "principal", "lead", "architect")):
        return 3
    return 2


def catalogue_for_prompt(max_tier: int) -> str:
    """The round, as the interviewer sees it.

    Includes the answer and the symptom on purpose: the interviewer has to be
    able to tell a candidate who said "no current limiting resistor" from one who
    said "the LED will be dim", and to give the better answer afterwards rather
    than only a score.
    """
    out = []
    for f in for_tier(max_tier):
        picture = f"[show the {f['circuit']} schematic]" if f["circuit"] in RENDERABLE else "[describe it in words]"
        out.append(
            f"- {f['id']} (tier {f['tier']}) {picture}\n"
            f"    ask: {f['brief']}\n"
            f"    fault: {f['fault']}\n"
            f"    symptom: {f['symptom']}\n"
            f"    a strong answer: {f['good']}\n"
            f"    if they miss it, the lesson is: {f['skillId']}"
        )
    return "\n".join(out)


def validate() -> list[str]:
    """Every fault must route to a real skill and any diagram must render.

    Called by the test rather than at import: a broken entry should fail a build,
    not a live interview.
    """
    import interview_gaps

    skills = set(interview_gaps.skill_ids())
    problems = []
    for f in FAULTS:
        if f["skillId"] not in skills:
            problems.append(f"{f['id']}: skillId {f['skillId']!r} is not a routable skill")
        if f["circuit"] is not None and f["circuit"] not in RENDERABLE:
            problems.append(f"{f['id']}: circuit {f['circuit']!r} cannot be drawn")
        if f["tier"] not in (1, 2, 3):
            problems.append(f"{f['id']}: tier {f['tier']} is not 1, 2 or 3")
    return problems
