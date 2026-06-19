# Ohmlet Curriculum Plan

> **The single source of truth for the curriculum: what it is, how it's sized, how
> learners progress, and how we author it.** This is a *spec*, not a diary. The dated
> build-log lives in [`metadata/curriculum-changelog.md`](../metadata/curriculum-changelog.md);
> "what we did on day X" goes there, never here. If anything ever conflicts, this file wins.
>
> Companion docs: [`CURRICULUM_AUTHORING.md`](./CURRICULUM_AUTHORING.md) (how to author
> and ship one lesson, incl. the quality bar) · [`CURRICULUM_CITATIONS.md`](./CURRICULUM_CITATIONS.md)
> (per-lesson source grounding) · [`LEARNING_RESOURCES.md`](./LEARNING_RESOURCES.md) (the books).
>
> **Status (live):** 12 units · 141 lessons · lint 0 errors / 0 warnings · build green. **v1 complete.**

---

## 1. The target — one ramp, three milestones

There is **one** plan. It is a ramp, not a set of competing numbers. Earlier drafts
quoted several totals (40–80, 130, 143, 450–650); those were milestones on this ramp,
now stated once, here:

| Milestone | Units | Lessons | What it means |
|-----------|-------|---------|---------------|
| **Built now (v1 complete)** | 12 | 141 | Beginner → advanced: analog core + digital/embedded + comms/motors/robotics, all at the quality bar |
| **v1 launch** | 12 | 141 | ✅ shipped — Units 1–12 (through comms/motors/robotics). The sellable product. |
| **Ceiling** | ~35–45 | ~450–650 | Brilliant-scale: deepened units + added tracks (robotics, digital, audio, power, RF) |

- **Felt depth multiplier:** Bronze → Silver → Gold leveling replays each lesson at
  rising difficulty, so playtime is ~3× the authored lesson count without authoring 3×.
  A 450-lesson library with leveling rivals a 1,000+ flat one.
- **Why not Duolingo's thousands at launch:** that's the mature state of a 13-year course.
  Beginner→advanced electronics is a few hundred *core* concepts taught in dense lessons
  (one whole concept each, a real build per unit). We reach the ceiling by *deepening*
  after retention is proven, not by front-loading breadth.
- **Reference points (not targets):** the pricing analysis put a ~120-lesson floor for a
  monthly Pro and ~180–220 for "good / annual-worthy." v1's ~145 clears the floor; the
  advanced tracks toward the ceiling clear "good." These inform pricing, they are not
  separate curriculum targets.

The original "40–80 lessons / 5–7 units" floor from the first draft is **retired** (we
passed it); it is kept only in the changelog for history.

---

## 2. Structure & sizing

Hierarchy: **Units → Skills → Lessons → Steps.** A lesson contains *steps* (the
individual exercises).

| Level | Target | Hard rule |
|-------|--------|-----------|
| Graded steps / lesson | **8–14** | **≥6 is the floor** (linter warns below 6) |
| `teach` steps / lesson | 1–3 | Never 3 *consecutive*; never a majority-passive lesson |
| Lessons / skill | 3–4 | A skill = one coherent capability |
| Skills / unit | 3–5 | A unit = a milestone the learner can name |
| Lessons / unit | ~11–13 | Includes the unit checkpoint |

**Vary lesson role, not just length** (uniform lessons read as a content mill):

- **Intro** lesson: more `teach` + `multiple_choice` (build intuition).
- **Practice** lessons: active recall — identify, match, drag_order, spot_error, the
  predict family. Little new teaching.
- **Capstone** lesson: "do the thing" — draw_connection / build_to_spec / fix_the_circuit.
  Should feel harder.

---

## 3. The unit map (v1)

Levels ramp beginner → intermediate → advanced. Counts are targets (±2 as material dictates);
the 12-unit shape and the level ramp are fixed.

| #  | Unit | Level | Status | Lessons |
|----|------|-------|--------|---------|
| 1  | Foundations | beginner | ✅ built | 13 |
| 2  | On the Breadboard | beginner | ✅ built | 11 |
| 3  | Sensors & Signals | intermediate | ✅ built | 11 |
| 4  | Meet the Arduino | intermediate | ✅ built | 11 |
| 5  | Inputs, Outputs & Code | intermediate | ✅ built | 10 |
| 6  | Capacitors, RC & Timing | intermediate | ✅ built | 12 |
| 7  | Transistors & Switching | intermediate→adv | ✅ built | 12 |
| 8  | Op-Amps & Signal Conditioning | advanced | ✅ built | 12 |
| 9  | Filters, Oscillators & Signals | advanced | ✅ built | 12 |
| 10 | Power Supplies & Regulation | advanced | ✅ built | 11 |
| 11 | Digital Logic & Embedded | advanced | ✅ built | 14 |
| 12 | Comms, Motors & Robotics | advanced | ✅ built | 12 |

**Launch core (U1–8)** is the minimum to honestly sell monthly Pro; **full v1 (U1–12)**
unlocks the annual plan and makes max / Interview Mode credible (embedded peripherals +
hardware land in U11–12). **Interview Mode** is honest once U11–12 ship, scoped to
hardware fundamentals + embedded peripherals (I2C/SPI/UART, interrupts, timers/PWM,
GPIO/ADC) + embedded-C basics — explicitly NOT RTOS/FPGA/RF (a later labelled max track).

**Beyond v1 (toward the ceiling):** the tree branches into tracks — Robotics, Digital/FPGA,
Audio, Power/RF, Sensors deep-dive — each a sequence of units deepening a domain. New
tracks are added after retention + unit economics are proven, not before.

---

## 4. Capstones (the rule)

**A capstone closes the unit (or arc) it completes.** There is no fixed "capstone unit."
A capstone is the satisfying real build that proves the skills just learned.

| Capstone | Closes | Form |
|----------|--------|------|
| Light-Activated Alarm (wired) | Unit 3 (sense→decide→act, hardware) | draw_connection build |
| Light-Activated Alarm (coded) | Unit 5 (analogRead→if→digitalWrite) | code build (callback to U3) |
| Drive the Relay | Unit 7 (transistor switching) | calc + verified build |
| *(future)* Line-follower / robot | a Robotics unit | live camera-verified build |
| *(future)* Audio amplifier | a signal/audio unit | build + measurement |

Reaching a real build **early** is deliberate: it drives first-build-completion and
retention. The flagship Arduino-Starter-Kit demo (LDR + LED/buzzer) is the Unit 3/5 alarm.

---

## 5. Exercise types — real inventory

### Built and in use (14 graded types + `teach`)

Defined in `frontend/components/ohmlet/data/lessons.ts`, rendered by `LessonRunner.tsx`,
validated by the linter. The construction/repair/trace family was added 2026-06-19.

| Type | Note |
|------|------|
| `multiple_choice` | Over-used today; the rebalance trims its share |
| `true_false` | Quick concept check |
| `fill_blank` | Recall a value/term (method-only hints) |
| `predict_behavior` ★ | Predict → commit → reveal |
| `predict_reading` ★ | "What will the meter / serial read?" |
| `match` | Pair terms ↔ definitions (both columns shuffle) |
| `identify_component` | Click the right part on a diagram |
| `spot_error` | Find the fault in a circuit |
| `choose_resistor` ★ | Current-limiting / sizing as design |
| `drag_order` | Order a procedure |
| `draw_connection` | Wire fixed terminals together |
| `trace_current` ★ NEW | Tap the current path in loop order; kills "current gets used up" |
| `fix_the_circuit` ★ NEW | Tap the fault, then pick the repair (diagnose + remedy) |
| `build_to_spec` ★ NEW | Assemble from a parts palette (with distractors) into ordered slots |

### Still on the backlog (not built)

| Proposed type | Teaches | Note |
|---------------|---------|------|
| `build_to_spec` open-ended | Free-wire synthesis validated by a live sim, any valid topology | Bigger feature; belongs with the Sandbox/sim work. The shipped `build_to_spec` is the constrained palette-and-slots constructor. |
| `place_missing_component` | Component roles + polarity | medium |
| `match_image` | Schematic symbol ↔ real-part photo ↔ name | medium; needs photos |
| `read_waveform` / `annotate_signal` | PWM, duty cycle, timing | medium |

**The variety mandate:** no single type should dominate a lesson; lead with `teach`,
reinforce with a *mix* (favour the predict/build/trace/fix family), end on a synthesis
step. Target: multiple_choice well under half of graded steps once the rebalance is done.

**Core principle:** because our diagrams are *executable code, not pictures*, the
highest-value exercises are **predict → commit → reveal** — the learner commits to a
prediction and the circuit truthfully responds. A misconception only dies when a truthful
simulation contradicts the wrong prediction.

---

## 6. Difficulty, mastery & progression

**Difficulty tiers (per question):** `difficulty: 1 | 2 | 3`. Tier 1 = recall, Tier 2 =
one calculation/application, Tier 3 = multi-step reasoning or real computation. A deep,
tiered pool lets replays escalate.

**Four difficulty regimes across the path:**
- **A — Intuition** (U1–2): numbers given, no math required to pass.
- **B — First real calculation** (mid-U1→U3): Ohm's law as a tool, divider math, E12 picks.
- **C — Multi-step design with constraints** (U6+): coupled equations + a parts choice
  (τ=RC, transistor biasing, op-amp gain, regulator dissipation).
- **D — Spec-driven / open-ended** (top units): given a spec, pick topology AND values AND
  justify. Interview-grade.

**Leveling (Bronze → Silver → Gold):** the next lesson unlocks after one pass (Bronze).
Replays reach Silver then Gold for more XP; each level is harder (Silver drops the teach
steps and shuffles to pure recall; Gold does the same with fewer hearts). Deep tiered
pools make replays draw *different, harder* questions. (`data/levels.ts`.)

**Mastery (shipped model):** a lesson is mastered by getting through all steps without
losing all hearts; lose them and restart that lesson. Each unit ends in a **checkpoint**
(cumulative, no teach steps, bonus XP) which gates the next unit. *(Planned upgrade: 80%
pass with a remixed targeted retry of only the missed steps; per-skill strength.)*

**Gating the ramp (planned, task #42):** a `rigor` flag (calculator/datasheet glyph),
real `prerequisite` locks (not just order), graded *design-problem* checkpoints in U6+,
and two **gateway exams** (after U5, after U10). On hard lessons, require the calculation
AND the vision-verified build AND the running result to pass.

---

## 7. Spaced repetition & review

Right-sized for skill mastery (not raw vocab HLR):

- **Within a lesson — interleaving.** Reserve 1–2 steps to retrieve a *prior* skill; end
  on a cumulative step.
- **Across the path — Leitner skill-strength.** Each skill carries `strength ∈ [0,1]`,
  decaying on an expanding schedule (1 → 3 → 7 → 16 → 35 days). When it crosses a
  threshold the path surfaces a short **Refresh node** (4–5 interleaved steps, not a
  replay). Ship Leitner now; graduate to a fitted model once we have traces.
- **Unit checkpoints** pay disproportionate XP (the "Legendary" moment).
- **Ohmlet divergence:** a camera-verified real build is the strongest retrieval event.
  A quiz pass restores strength to ~0.9; a verified live build restores 1.0 and jumps two
  Leitner boxes.

---

## 8. Visual strategy & the Circuit DSL

| Medium | Use for | Share |
|--------|---------|-------|
| **Code-driven interactive SVG** (workhorse) | Topology, current flow, cause/effect, anything to predict or manipulate; schematic symbols | ~70% |
| **Real photo / faithful illustration** (narrow, mandatory) | Where physical appearance IS the objective: resistor colour bands, electrolytic vs ceramic, breadboard rails, LED leg polarity, real Arduino pins | small |
| **3D sandbox** | Free synthesis + layout intuition, AFTER a unit (practice, not instruction) | — |
| **Live camera tutor** | The reality bridge: the learner's actual bench, real-world errors. Reserved for real builds, not re-teaching theory | — |

**The Circuit DSL** (`circuits/spec.ts` + `specs.ts` + `SpecCircuit.tsx`): diagrams are
*data* (`nodes` + `wires`), drawn from shared primitives. Region ids = node ids, so the
linter validates `spot_error`/`identify_component` targets for free. New diagrams are data
an agent can emit and a human can read. Curated hand-coded SVGs (the original 8) are the
escape hatch for irregular one-offs.

**Diagram backlog (deliberate):** the signature advanced schematics — op-amp inverting/
non-inverting, voltage regulator, bridge rectifier, H-bridge — are **not yet drawn.** They
need visual iteration to avoid slop, so Units 8–10 currently teach via calculation/concept
and reuse `rc_low_pass` where it fits. These diagrams are a dedicated, visually-verified
pass (own task), not something to rush mid-authoring.

---

## 9. The source books (all 9) + grounding rule

All in `content/Books/md/`. Lessons are **grounded in** these to author *original*
content with a per-step citation; **never reproduced verbatim** (the pipeline n-gram check
enforces this). Per-lesson provenance is tracked in `CURRICULUM_CITATIONS.md`.

| Key | Book | Strong for |
|-----|------|-----------|
| **STG** | All New Electronics Self-Teaching Guide (Kybett & Boysen) | Teach-then-question; DC, Ohm, series/parallel, transistors (β), resonance/filters, rectification, zener |
| **ME** | Make: Electronics (Platt) | Discovery builds; first circuit, LEDs, breadboard, switches, caps/time, 555 |
| **MME** | Make: More Electronics (Platt) | Logic chips, op-amps, comparators, sensors (U8, U11) |
| **EAC1** | Encyclopedia of Electronic Components Vol.1 (Platt) | Resistors, caps, inductors, switches, **regulators/DC-DC**, flyback diode |
| **EAC2** | Encyclopedia of Electronic Components Vol.2 (Platt & Jansson) | LEDs, audio, **op-amps, comparators**, digital logic, amplification |
| **EAC3** | Encyclopedia of Electronic Components Vol.3 (Platt & Jansson) | Sensors (LDR, thermistor, etc.) |
| **PEI** | Practical Electronics for Inventors (Scherz & Monk) | Broad reference; theory, components, op-amps, filters, power |
| **EA** | Exploring Arduino (Blum) | Arduino code, pins, serial, PWM, inputs (U4–5, U11) |
| **AoE** | The Art of Electronics (Horowitz & Hill) | Authoritative depth; op-amp golden rules, filters, advanced topics |

Adding 2–3 more books (dedicated robotics, digital logic) pushes the reasonable ceiling
past 800; current 9 comfortably support ~450–650.

---

## 10. The authoring engine (subagents) + pipeline

**Decided 2026-06-19: author with subagents, one per unit.** Hand-authoring hundreds of
lessons through a single growing conversation bloats context, causes stalling, and lets
quality drift. The engine:

```
consensus spec (this file) + CURRICULUM_AUTHORING.md (rules + quality bar)
        │
        ▼
  per-unit subagent  ← fresh context each time
    • reads the relevant book chapter(s) deeply (not grep-and-cite)
    • drafts the unit's lessons to the schema + quality bar
    • runs npm run lint:lessons until 0/0
    • writes per-step citations to CURRICULUM_CITATIONS.md
        │
        ▼
  HUMAN APPROVAL GATE at /author  ← renders through the real LessonRunner
        │
        ▼
  merged into lessons.ts + curriculum.ts; changelog entry in metadata/
```

This makes the **books actually drive** the content (each agent reads chapters without
drowning the main context) and removes the stall-after-one-unit pattern. Run agents in
parallel where units are independent; never merge an unreviewed unit; never run more than
one batch ahead of review.

**The rails (already built, the durable high-leverage pieces):**
1. **Linter** — `npm run lint:lessons` (`lessonSchema.ts` + `scripts/lint-lessons.mjs`):
   schema valid, one in-range correct answer, region ids resolve, choose_resistor/divider
   math computes, no "longest answer" tell, hints don't contain the answer, ≥6 graded.
   Malformed lessons can't merge.
2. **Circuit DSL** — diagrams as data (§8).
3. **`/author` preview** — review rendered lessons (not JSON), ~3–5 min each; the approval gate.

---

## 11. The quality bar (summary; full detail in CURRICULUM_AUTHORING.md)

Non-negotiable, partly linter-enforced:

- **Balanced distractors.** All options similar in length/grammar/plausibility; the correct
  answer must NOT be the longest. Practical rule: write at least one distractor as long as
  the correct option.
- **Distractors are common mistakes** (e.g. forgetting an LED's Vf → `5/220`). A plausible
  distractor teaches; a silly one gives the answer away.
- **Hints nudge the method, never name the answer** (watch digit substrings: "1000"
  contains "10").
- **Depth:** aim 8+ graded; 12+ for a tiered pool that levels well.
- **Real difficulty, not just a harder topic** (tiers 1/2/3).

Reference lessons that set the bar: **The Closed Loop** (tiered beginner pool) and
**Powering an LED Safely** (real calculations, common-mistake distractors).

---

## 12. Misconceptions to target (the predict / spot_error backlog)

Build `trace_current` / `predict_reading` / `spot_error` around the documented beginner
killers, baking in predict → commit → reveal:

1. Current gets "used up" by a component (most pervasive).
2. Batteries are constant-current (they're constant-voltage).
3. No current-limiting resistor on an LED.
4. LED polarity ignored / reversed.
5. Higher voltage always means more current (ignores resistance).
6. No complete loop / switch in the wrong place / unintended short.
7. Floating digital input (forgot the pull-up/down).
8. One resistor "covers" parallel LEDs.
9. Conventional current vs electron flow (teach once, don't over-test).

---

## Sources (learning-science & pedagogy references)

Learning science: [Duolingo HLR (ACL 2016)](https://research.duolingo.com/papers/settles.acl16.pdf) ·
[DAS3H (arXiv 1905.06873)](https://arxiv.org/pdf/1905.06873) ·
[Brilliant — learn by doing](https://brilliant.org/about/) ·
[Retrieval practice (Frontiers 2025)](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1632206/full)

Electronics pedagogy: [Common electricity misconceptions (Furry Elephant)](https://www.furryelephant.com/content/electricity/teaching-learning/misconceptions/) ·
[SparkFun — Ohm's Law](https://learn.sparkfun.com/tutorials/voltage-current-resistance-and-ohms-law/all) ·
[Adafruit Arduino lesson order](https://learn.adafruit.com/lesson-0-getting-started/the-lessons)

Pipeline / diagrams-as-code: [tscircuit / Circuit JSON](https://github.com/tscircuit/circuit-json) ·
[netlistsvg](https://github.com/nturley/netlistsvg) · [JSON Schema](https://json-schema.org/)

*(The day-by-day build history — snapshots, council notes, what-shipped reconciliations —
lives in [`metadata/curriculum-changelog.md`](../metadata/curriculum-changelog.md).)*
