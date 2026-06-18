# Ohmlet Curriculum Plan

> The master plan for what the Ohmlet curriculum is, how it is structured, how
> learners progress, and how we author it at scale. Synthesised from an LLM
> council (learning science, electronics pedagogy, content-pipeline engineering)
> on 2026-06-18, plus the confirmed strategy decisions.
>
> Operational companion docs: [`CURRICULUM_AUTHORING.md`](./CURRICULUM_AUTHORING.md)
> (how to author and ship one lesson) and [`LEARNING_RESOURCES.md`](./LEARNING_RESOURCES.md)
> (the source books). This file is the "what and why and how much."

---

## 0. Guiding principle: depth-first, not breadth-first

We build depth-first, not a shallow spread across many topics. The committed
targets (see §5b/§5c): **v1 launch at ~143 lessons / 12 units**, headed for the
**reasonable ceiling of ~450–650 lessons / ~35–45 units**, with Bronze→Silver→Gold
leveling multiplying felt depth on top. (The original framing below was a 40–80
floor; it has since been superseded by those numbers.) This is the answer to "why
not Duolingo's 7,500 lessons":

- Duolingo's 7,500 is the *mature* state of one course after 13+ years and a large
  team. It launched with a few dozen skills and grew. Our 80 is day one, not the
  ceiling.
- A language needs thousands of tiny lessons because vocabulary is effectively
  unbounded. Beginner-to-intermediate electronics is a few hundred core concepts,
  taught in denser lessons (one whole concept per lesson, a real build per unit).
- The failure mode for a solo founder pre-launch is "shallow everywhere,
  finishable nowhere," not "too few lessons." Retention comes from a path a learner
  can complete and feel mastery on, plus the live tutor and the build payoff.
- 80 is the floor of a ramp. The pipeline and circuit DSL in this plan are built so
  that going from 80 to 800 is an approval-queue exercise, not a rebuild. Electronics
  is deep (analog, digital, power, sensors, audio, robotics, embedded), so the
  long-term ceiling is genuinely thousands across many paths.

**80 is the minimum viable curriculum: the smallest thing that is genuinely
complete.** Scale content deliberately after retention and unit economics are proven.

---

## 1. Structure and sizing

Hierarchy: **Units → Skills → Lessons → Steps.** A lesson contains *steps* (the
individual exercises), not units. Targets are variable with guardrails:

| Level | Target | Range | Rule |
|-------|--------|-------|------|
| Steps per lesson | 7 | 5 to 9 | One concept per lesson, time-boxed to 3 to 5 min |
| Lessons per skill | 4 | 3 to 6 | A skill = one coherent capability |
| Skills per unit | 3 to 4 | 2 to 5 | A unit = a milestone the learner can name |
| Lessons per unit | ~12 to 16 | emergent | — |
| Total path | 40 to 80 | — | ~5 to 7 units |

**Vary lesson structure by role, not just count** (uniform length reads as a content
mill):

- **Intro lesson** in a skill: more `teach` + `multiple_choice` (build intuition).
- **Practice lessons:** `identify_component`, `match`, `drag_order`, `spot_error`,
  the predict exercises (active recall, little new teaching).
- **Capstone lesson** in a skill: heavy `draw_connection`, `build_to_spec`,
  `fix_the_circuit`. The "do the thing" lesson; should feel harder.

**Hard rules:** never more than 2 consecutive `teach` steps; never a
majority-passive lesson. That line is the difference between Brilliant and a
slideshow.

---

## 2. Mastery and progression

**Mastery is per-Skill, not per-Lesson.** We do NOT use Duolingo's "repeat the same
lesson 5x" model: that is tuned for vocabulary recall, and we teach skills.

- A lesson is completed **once** to unlock the next, gated at **≥80% of graded steps
  correct** (teach steps do not count).
- Below threshold, the learner does **not** redo the whole lesson. They get a
  **remixed targeted retry of only the missed steps** (different distractors,
  mirrored circuit, swapped values).
- Repeated failure **escalates modality** instead of repeating the quiz:
  quiz → AI tutor reteaches the micro-concept live → build it on camera. This is
  the point of having a live tutor; do not waste it on more taps.
- A **Skill** is mastered by completing its lessons plus passing one short
  **Skill Check** (interleaved retrieval across the skill's lessons).

---

## 2b. Difficulty sequencing & unit checkpoints (decided 2026-06-18)

Three questions came up while building; here are the decisions.

**How is difficulty ordered, beginner-then-intermediate or interleaved?**
Progressive, not interleaved. The path runs several **beginner** units, then
**intermediate**, then **advanced**, each unit a notch harder than the last (this
mirrors Duolingo's sections: beginner sections 1–4, intermediate 5–8). Every unit
carries a `level` field and the path shows the level badge. Current order:
Foundations (beginner) → On the Breadboard (beginner) → Sensors & Signals
(intermediate) → … We do not randomly mix easy and hard units; the ramp is the
point. Difficulty rises *within* a unit too (intro → practice → capstone lessons).

**Is there a test at the end of each unit before you progress?**
Yes. Every unit now ends in a **Unit Checkpoint**: a mixed, cumulative test drawn
from across the unit, with **no teach steps** (pure retrieval) and bonus XP (50).
Because the path unlocks linearly (the next lesson unlocks when the previous is
complete), the checkpoint is automatically the gate: you cannot reach the next
unit's lessons until you have passed that unit's checkpoint. This is the concrete
implementation of the "Unit Checkpoint ceremony" in §3.

**How is mastery actually tested, is it just "didn't lose 3 hearts"?**
Today, yes, plus the checkpoint. A lesson is mastered by getting through all its
steps without losing all 3 hearts; lose all 3 and you restart **that lesson** from
the beginning (hearts reset to 3, never carrying between lessons). The unit
checkpoint then re-tests the whole unit. The richer model in §2 (80% pass with a
remixed targeted retry, per-skill strength) is the planned upgrade; the hearts +
checkpoint model is the shipped version and is genuinely Duolingo-shaped.

## 3. Spaced repetition and review

Right-sized for skill mastery and sparse early data (not raw Half-Life Regression,
which models millions of vocab items).

**Within a lesson — interleaving.** Reserve 1 to 2 of the ~7 steps to retrieve a
*prior* skill, not the brand-new one. End on a cumulative step. Interleaved practice
beats blocked practice for durable transfer.

**Across the path — two layers:**

1. **Skill strength decay (the engine).** Each skill carries a `strength ∈ [0,1]`,
   starts at 1.0 on mastery, decays on an expanding (Leitner-style) schedule:
   review due at **1 → 3 → 7 → 16 → 35 days**, advancing a box on a successful
   Refresh, dropping on a miss. When strength crosses a threshold, the path surfaces
   a **Refresh node** (a short 4 to 5 step interleaved set, NOT a lesson replay).
   Ship Leitner now (cheap, interpretable); graduate to a fitted DAS3H/HLR model
   later once we have enough traces. Same schema, swap the interval function.
2. **Unit Checkpoints (ceremony).** Each unit ends in a cumulative, interleaved
   checkpoint that pays disproportionate XP and animates the reward (the
   "Legendary" moment).

**Ohmlet-specific divergence:** a **camera-verified real build is the strongest
retrieval event.** A quiz pass restores skill strength to ~0.9; a verified live
build restores to 1.0 and jumps two Leitner boxes. The scheduler must not treat a
build as worth the same as a tap-quiz.

---

## 4. Exercise types

We already have **9** (in `lessons.ts`): `teach`, `multiple_choice`, `true_false`,
`fill_blank`, `match`, `drag_order`, `spot_error`, `identify_component`,
`draw_connection`.

The core principle for new ones: because our circuit diagrams are **executable code,
not pictures**, the highest-value exercises are **predict → commit → reveal**, where
the learner commits to a prediction and the circuit *truthfully* responds. A
misconception only dies when the learner watches a truthful simulation contradict
their wrong prediction.

Recommended additions, highest value first:

| New type | Teaches | Notes |
|----------|---------|-------|
| `predict_reading` ★ | Ohm's law applied, the LDR analog value | "What will the meter / serial read?" then reveal |
| `trace_current` ★ | Complete-loop rule; kills "current gets used up" | Tap the path, animation confirms |
| `choose_resistor` / `set_value` ★ | Current limiting as design | Pick part / slide value; LED survives, dims, or burns |
| `predict_behavior` ★ | Sensor → logic → actuator causality | Animated outcome states, capstone-concept exercise |
| `read_resistor_band` | The colour code, reading real parts | Needs a real illustration (see §5) |
| `fix_the_circuit` | Repair (distinct from `spot_error`'s diagnosis) | Rewire/replace until it actually works |
| `build_to_spec` | Synthesis ("draw the circuit") | Open-ended; validated by simulation, accepts any valid topology |
| `place_missing_component` | Component roles + polarity ("draw the missing component") | Orientation matters (anode/cathode, cap, diode) |
| `match_image` | Schematic symbol ↔ real-part photo ↔ name | Connective tissue to the live camera tutor |
| `read_waveform` / `annotate_signal` | PWM, duty cycle, timing | Later units (motors, sound, dimming) |

De-prioritised: free-form hand-drawn schematic recognition (expensive, hard to
grade; `build_to_spec` on the sim teaches the same synthesis with truthful
validation).

The founder's three original ideas all map and are kept: "match the image"
(`match_image`), "draw the circuit" (`build_to_spec`), "draw the missing component"
(`place_missing_component`).

---

## 5. Visual strategy: which medium tells which truth

| Medium | Use for | Share |
|--------|---------|-------|
| **Code-driven interactive SVG** (the workhorse) | Topology, current flow, cause-effect, anything to predict or manipulate; schematic symbols | ~70% |
| **Real photo / faithful illustration** (narrow, mandatory) | Where physical appearance IS the objective: resistor colour bands, electrolytic vs ceramic cap, breadboard rails, LED leg polarity, real Arduino pins | small |
| **3D sandbox** | Free synthesis + physical layout intuition, AFTER a unit. Practice, not instruction. Does not duplicate authored lessons | — |
| **Live camera tutor** | The reality bridge: seeing the learner's actual bench and catching real-world errors. Reserved for the real build (Unit 9+), not for re-teaching theory (wasteful of model cost) | — |

Rule of thumb: if the schematic symbol is a deliberate simplification of something
the learner must recognise in their hand, you need the photo. A schematic resistor
is a zigzag; a real one is striped, and they must learn both.

---

## 5b. LAUNCH PLAN: the full unit map (locked 2026-06-18)

The committed target for launch. 12 units, ~143 lessons. Levels ramp
beginner → intermediate → advanced (re-tag Unit 5 down to intermediate; advanced
is reserved for Units 8–12). Lesson counts include each unit's checkpoint.

| #  | Unit                            | Level        | Status   | Lessons |
|----|---------------------------------|--------------|----------|---------|
| 1  | Foundations                     | beginner     | ✅ built  | 13 |
| 2  | On the Breadboard               | beginner     | ✅ built  | 11 |
| 3  | Sensors & Signals               | intermediate | ✅ built  | 11 |
| 4  | Meet the Arduino                | intermediate | ✅ built  | 11 |
| 5  | Inputs, Outputs & Code          | intermediate | ✅ built  | 10 |
| 6  | Capacitors, RC & Timing         | intermediate | planned  | 12 |
| 7  | Transistors & Switching         | intermediate | planned  | 13 |
| 8  | Op-Amps & Signal Conditioning   | advanced     | planned  | 12 |
| 9  | Filters, Oscillators & Signals  | advanced     | planned  | 12 |
| 10 | Power Supplies & Regulation     | advanced     | planned  | 11 |
| 11 | Digital Logic & Embedded        | advanced     | planned  | 14 |
| 12 | Comms, Motors & Robotics        | advanced     | planned  | 13 |

**Milestones:**
- **Built now:** 5 units, 56 lessons (~2 hrs).
- **Launch core (Units 1–8):** 8 units, ~93 lessons. The minimum to honestly sell a
  monthly Pro subscription.
- **Full v1 (Units 1–12):** 12 units, ~143 lessons. Unlocks the annual plan and
  makes max / Interview Mode credible (embedded + hardware peripherals land in
  Units 11–12).
- **Still to author:** 87 lessons across Units 6–12.

This sits above the pricing council's 120-lesson floor and approaches its 180–220
"good" target; the remaining gap to 180+ is closed post-launch by deepening units
and adding the labelled advanced tracks (RTOS, FPGA, RF) noted in §6.

Counts are targets, not contracts: a unit may land at ±2 lessons as the material
dictates. The 12-unit shape and the level ramp are the fixed commitments.

## 5c. Scale ceiling and the engagement multiplier (target: 450–650 lessons)

The committed long-term goal is the **reasonable ceiling: ~450–650 lessons across
~35–45 units**, a genuine Brilliant-scale product. v1 (~143 lessons) is the launch
floor; this is where the curriculum is headed.

**What the 9 books on hand can support** (~1.41M words):

| Scenario | Lessons | Units | What it means |
|----------|---------|-------|---------------|
| Worst case | ~250–350 | ~20–25 | Only clearly in-scope, non-redundant material |
| **Reasonable (target)** | **~450–650** | **~35–45** | Full beginner→advanced + components + robotics tracks |
| Best case | ~900–1,200 | ~70–90 | Mine every drop (incl. reference drills, adapted grad material) |

The pure word-count ceiling is ~1,000–1,200 lessons; it's discounted for
cross-book redundancy (~30–40% overlap on fundamentals) and out-of-scope grad
material (much of *Art of Electronics*). Adding 2–3 more books (robotics, digital
logic) pushes the reasonable target past 800.

**The engagement multiplier (Bronze → Silver → Gold), shipped 2026-06-18.** Duolingo's
"repeat the circle" is not 3–5 new lessons; it is the same content replayed at
rising difficulty. We do the same, adapted for a skill app, so **felt depth is
2–4× the authored lesson count** without authoring 2–4× the lessons:

- The next lesson unlocks after a single pass (**Bronze**) — no forced grinding.
- A learner can replay any lesson to reach **Silver** then **Gold** for more XP.
- Each level is harder: Silver drops the teach steps and shuffles the practice
  steps + their options into a pure-recall run; Gold does the same with fewer
  hearts. (`components/ohmlet/data/levels.ts`.)
- The path shows a medal per lesson (bronze/silver/gold) with level pips and a
  "mastery" counter (gold points / total). Per-lesson levels persist per user.

So engagement hours scale on two independent axes: **authored lessons** (toward the
450–650 ceiling) and **leveling/review** (3× replay per lesson). A 450-lesson
library with leveling is comparable in playtime to a 1,000+ lesson flat library.

## 6a. What actually shipped vs this outline (reconciliation, 2026-06-18)

The 12-unit sketch below was a fine-grained CONCEPT list. The built curriculum
deliberately compresses it into **fewer, deeper units** (each ~11–13 lessons, the
sizing in §1), the Duolingo "section" model, rather than 12 thin units. The
mapping:

| Built unit | Level | Covers outline units | Lessons |
|---|---|---|---|
| 1. Foundations | beginner | 1–5 (loop, V/I/R, Ohm, LEDs, series/parallel) | 13 |
| 2. On the Breadboard | beginner | 6 + building/debugging | 11 |
| 3. Sensors & Signals | intermediate | 8–9 (analog sensors + the alarm) | 11 |
| 4. Meet the Arduino | intermediate | 7 (microcontroller, sketch, Blink, serial) | 11 |
| 5. Inputs, Outputs & Code | advanced | 10, 12 (PWM, inputs, debug) + code the alarm | 10 |

**Why the Light-Activated Alarm lands at the end of Unit 3, not "Unit 9":** in a
build-first product, reaching a real, satisfying build EARLY is the point (it
drives First-Build-Completed and retention, §0). Making learners grind eight units
first would be the wrong call. So the alarm is the **beginner-arc capstone** as a
HARDWARE build at the end of Unit 3 (wire it, understand sense/decide/act), and
then Unit 5 brings it to life in CODE (analogRead → if → digitalWrite) as a
deliberate callback. Build the circuit, learn the Arduino, code it to life: the way
real makers actually do it. The "Unit 9" in the outline below was under the old
12-thin-unit numbering and no longer applies.

## 6. Proposed path outline (first ~12 units)

Discovery-first (Platt's *Make: Electronics* template), with theory pulled in
just-in-time, broadly tracking Adafruit's validated Arduino lesson order. The path
**converges on the LDR Light-Activated Alarm as an earned capstone around Unit 9**,
not a day-one tutorial.

| # | Unit | Core concepts |
|---|------|---------------|
| 1 | Current Needs a Loop | Closed circuit, source, complete-loop rule, shorts |
| 2 | Voltage, Current, Resistance | The three quantities + relationship; water model and its limits |
| 3 | Light It Up: LEDs & Resistors | LED polarity, current limiting, why no bare LED |
| 4 | Ohm's Law for Real | V=IR as a design tool, the limiting resistor, colour code |
| 5 | Series & Parallel | Voltage divides in series, current in parallel |
| 6 | Switches & Inputs | Switches, pull-up/down, the floating-input problem |
| 7 | Meet the Microcontroller | What an Arduino is, pins, digitalWrite, Blink |
| 8 | Reading the World: Analog Sensors | analogRead, divider as sensor interface, the LDR |
| 9 | ★ Capstone: Light-Activated Alarm | LDR divider → threshold → output; calibration; live build |
| 10 | Making Things Move & Glow | PWM, analogWrite, fading, transistor as a switch |
| 11 | Sound & Output | tone(), buzzers, simple displays |
| 12 | Debugging & Measurement | Multimeter, serial, systematic fault-finding |

Units 1 to 2 deliberately teach the mental model before any Arduino: beginners who
skip "current is a loop" never recover, and the Arduino's abstraction hides exactly
what they need to internalise. After Unit 12 the tree can branch (robotics, sensors
deep-dive, comms).

A safety note for productive-failure exercises: only use "let them fail first"
framing in the simulation/sandbox where mistakes are free; in live-build guidance,
teach-then-do (a wrong attempt on real hardware has a real cost).

---

## 7. Misconceptions to target (the spot_error / predict backlog)

Build `trace_current` / `predict_reading` / `spot_error` exercises around the
documented beginner killers:

1. Current gets "used up" by a component (the most pervasive error).
2. Batteries are constant-current sources (they are constant-voltage).
3. No current-limiting resistor on an LED.
4. LED polarity ignored / reversed.
5. Higher voltage always means more current (ignores resistance).
6. No complete loop / switch in the wrong place / unintended short.
7. Floating digital input (forgot the pull-up/down).
8. One resistor "covers" parallel LEDs.
9. Conventional current vs electron flow (teach once, do not over-test).

Meta-principle: bake **predict → commit → reveal** into all of these.

---

## 8. Content pipeline (summary)

Full operational detail in [`CURRICULUM_AUTHORING.md`](./CURRICULUM_AUTHORING.md).
The discipline that keeps this from becoming a full-time job: **never write a lesson
or a diagram by hand, and never manually QA correctness.** Tooling and an AI critic
do the grunt work; the human only judges at the gate.

```
books (markdown, DONE: content/Books/md/)
   │  chunk + tag with provenance {book, chapter, page, concept}
   ▼
   you author the Unit→Skill tree by hand   ← the one creative human step (the spine)
   ▼
   LLM drafts each lesson, grounded ONLY in the relevant chunks,
     with a citation on every factual step   ← anti-hallucination: no claim without a source
   ▼
   automated QA lint (deterministic, no LLM):
     schema valid · MC has one in-range correct · diagram region ids resolve ·
     every step cited · n-gram verbatim/copyright check
   ▼
   LLM-as-critic pass (scores correctness against cited chunks only)
   ▼
   single HUMAN APPROVAL GATE at a /author preview route
     (renders through the real LessonRunner + citations + critic flags)
   ▼
   approved (status + content hash) → ships. Nothing unapproved ships.
```

Books are reference/grounding to author *original* lessons, never reproduced
verbatim (the n-gram check enforces this mechanically).

---

## 9. Circuit DSL (the scaling unlock for diagrams)

Today `CircuitDiagram.tsx` is a hardcoded `if (circuit === 'ldr_alarm')` switch over
a `CircuitId` union: every new diagram needs an engineer. We replace the switch with
a thin **circuit DSL**: declarative JSON (`nodes` + `wires`) that drives the SVG
primitives we already have (battery, resistor, LED, LDR, wire, Arduino pin). We are
not writing a renderer; we are putting a data layer in front of the one we built.

```ts
type CircuitSpec = {
  id: string;
  viewBox: [number, number];
  nodes: CircuitNode[];
  wires: { from: PortRef; to: PortRef; color?: string; error?: boolean }[];
};
type CircuitNode = {
  id: string;                    // == clickable-region / correctComponent id (auto-validates)
  type: 'battery'|'resistor'|'led'|'ldr'|'arduino_pin'|'ground'|'junction'|'buzzer';
  at: [number, number];
  rotation?: 0|90|180|270;
  label?: string;
  props?: { value?: string; color?: string; pin?: string };
  highlight?: boolean; error?: boolean;
};
type PortRef = { node: string; port?: 'a'|'b'|'+'|'-' };
```

Payoffs: a new diagram becomes **data an LLM can emit and a human can read**, and the
`correctRegion`/`correctComponent` ids in exercises **validate automatically**
because they must equal a `node.id`. Current-flow animation works because wires form
a traceable graph. Hand-placed `at` coordinates are fine for an authored curriculum;
auto-layout is a later nicety. We do NOT LLM-generate raw SVG (unthemeable,
unverifiable, slop) and we do NOT use photos as the primary mechanism.

Reference patterns (do not adopt wholesale, they are PCB-grade): tscircuit /
Circuit JSON, netlistsvg.

---

## 10. Build order

Build the rails first so every later lesson is cheap and safe.

- **Week 1 — Foundations, no LLM yet.** Generate a Zod schema from the TS step union;
  write the lesson linter (`npm run lint:lessons`); build the `/author` preview
  route. Author the `curriculum.ts` tree by hand for ONE full path (Fundamentals →
  LDR Alarm, ~8 skills).
- **Week 2 — DSL renderer.** Refactor `CircuitDiagram` from the if-chain to the
  `CircuitSpec` registry + node map. Port the existing 8 circuits to DSL data.
- **Week 3 — Pipeline, manual first.** Chunk + tag the 2 to 3 books covering the
  first path. Write the draft prompt and the critic prompt. Run ONE lesson end to
  end through the gate.
- **Week 4+ — Batch with the gate.** Assembly line: LLM drafts a skill's lessons →
  auto QA → critic → you approve/edit at `/author`. Realistic solo throughput: a
  skill (5 to 8 lessons) per focused session.

---

## 11b. Council II — launch scale, difficulty ramp, and how we build it (2026-06-18)

A second LLM council (pricing/value, difficulty/scope, pipeline/execution)
deliberated "how many lessons to launch with, how hard should they get, and how
do we produce them." They converged.

### Launch scale (pricing lens)
- 57 lessons (~2 hrs) is a demo, not a sellable annual subscription.
- **Floor: ~120 lessons (~12 engaged hrs)** to honestly sell a monthly Pro.
- **Good: ~180–220 lessons (~25–30 hrs)** with a real advanced track to justify
  the **annual** plan and make **max / Interview Mode** non-embarrassing.
- Do NOT chase Duolingo's launch count (~247 short language drills); chase
  **Brilliant's depth × breadth** (that is the price band, ~$162/yr, we match).
- Lesson count buys *trust at point of sale*; the live tutor + retention loop buy
  *renewal*. Need both. Sell the visible roadmap ("more builds shipping monthly").
- Gating: if not at target by launch, ship Pro **monthly only** and withhold the
  **annual discount + max/Interview Mode** until the advanced units exist.

### The difficulty ramp (curriculum lens)
Current 56 top out at ~high-school-maker level; "advanced" on Unit 5 is generous.
Four regimes:
- **A Intuition** (U1–2, 3–8 min): numbers given, no math to pass.
- **B First real calculation** (mid-U1→U3, 8–14 min): first calc at "Powering an
  LED Safely" (R = (Vsupply−Vf)/I, non-round values, pick E12, predict current);
  then divider math.
- **C Multi-step design with constraints** (new units, 12–20 min): coupled
  equations + a parts choice (RC τ=RC, transistor biasing, op-amp gain, regulator
  dissipation).
- **D Spec-driven / open-ended** (top units, 20–35 min, multi-part): given a spec,
  pick topology AND values AND justify. Interview-grade.

A genuinely hard lesson (the target for ~lesson 80): *"Drive the Relay"* — Arduino
pin sources 20mA at 5V, switch a 12V 120mA relay coil; size the NPN base resistor
for saturation (β_min given), orient the flyback diode, vision-verify the build,
confirm the relay clicks and pin current stayed safe. Two calculations, a parts
choice, a polarity gotcha, a verified build. (~25 min.)

### Full roadmap: 12 units, ~130 lessons (complete beginner→advanced v1)
Existing U1–5 stay; **add 7 units** (books strongly support each; AoE alone could
justify hundreds more, so ~130 is a confident v1 ceiling, not a stretch):

| # | Unit | Level | Sources |
|---|------|-------|---------|
| 6 | Capacitors, RC & Timing | intermediate | AoE ch.1, PEI ch.2–3, 555 |
| 7 | Transistors & Switching | intermediate→adv | AoE ch.2, PEI ch.4 |
| 8 | Op-Amps & Signal Conditioning | advanced | AoE ch.4, PEI ch.8 |
| 9 | Filters, Oscillators & Signals | advanced | AoE ch.6, PEI ch.9–10 |
| 10 | Power Supplies & Regulation | advanced | AoE ch.9, PEI ch.11 |
| 11 | Digital Logic & Embedded Deep-Dive | advanced | AoE ch.10–11, Blum |
| 12 | Comms, Motors & Robotics | advanced | Blum, PEI ch.14, EoEC |

Re-tag levels honestly: beginner U1–2, intermediate U3–7, advanced U8–12.
**Interview Mode is honest with U11–12 shipped**, scoped to hardware fundamentals +
embedded peripherals (I2C/SPI/UART, interrupts, timers/PWM, GPIO/ADC) + embedded-C
basics — explicitly NOT RTOS/FPGA/RF (a later labelled max track).
**Launch v1 = U1–8 (~78 lessons); fast-follow U9–12** to unlock annual + Interview Mode.

### Gating the ramp so it feels earned
Add a `rigor` flag (calculator / datasheet glyph on the node); enforce real
`prerequisite` locks (not just order); make U6+ checkpoints graded design problems,
not recall; add two **gateway exams** (after U5, after U10); on hard lessons require
the calculation AND the vision-verified build AND the running result to pass.

### How we build it (execution lens) — THE KEY CALL
**Stop hand-authoring; build the rails.** We are at 57, the threshold where
hand-authoring stops being rational is ~40–60. Rails = a few build days; then it
becomes *review, not authoring* at ~80–120 lessons/week, so 57 → ~130–200 in a few
weeks. Minimum viable rails:
1. **Schema-as-law**: Zod/TS schema + `npm run lint:lessons` (indices in range, one
   correct answer, region ids resolve, choose_resistor/divider math actually
   computes, difficulty monotonic). Makes malformed lessons impossible to merge.
2. **Grounded drafts with per-step citations** from the 9 books (no citation →
   reject); a deterministic linter + an LLM faithfulness critic before a single
   human approval gate.
3. **`/author` preview route**: review rendered lessons (not JSON), ~3–5 min each.
4. **Circuit DSL** (the real bottleneck): ~130 lessons need **40–70 diagrams, not
   8**. DSL renders ~30–40 parameterised topologies as data; a **curated-SVG escape
   hatch** (~15) covers irregular advanced circuits (op-amp stages, H-bridges).
   Build the DSL first; add curated SVGs lazily for advanced units.

Pragmatic note: the generation model is the assistant itself, so the heavy RAG +
vector-DB version is optional. The durable, high-leverage rails are the **linter +
the circuit DSL + the `/author` preview**; with those, batch-authoring grounded in
the books (with citations) is fast and consistent. Never generate more than one
batch ahead of review.

## 11. Open decisions / next actions

- Confirm or tweak the 12-unit outline in §6 before committing the spine.
- Refine the task list into concrete pieces: circuit DSL (#13 area), authoring
  tooling + linter + `/author` route, the new exercise types, the first unit.
- Recommended first build: the rails (schema validator, `/author` preview, circuit
  DSL), NOT lesson generation. Rails turn this from a content job into an approval
  queue.

---

## Sources

Learning science: [Duolingo HLR (ACL 2016)](https://research.duolingo.com/papers/settles.acl16.pdf) ·
[DAS3H (arXiv 1905.06873)](https://arxiv.org/pdf/1905.06873) ·
[Brilliant — learn by doing](https://brilliant.org/about/) ·
[Retrieval practice in real classrooms (Frontiers 2025)](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1632206/full)

Electronics pedagogy: [Common electricity misconceptions (Furry Elephant)](https://www.furryelephant.com/content/electricity/teaching-learning/misconceptions/) ·
[SparkFun — Ohm's Law](https://learn.sparkfun.com/tutorials/voltage-current-resistance-and-ohms-law/all) ·
[Platt, Make: Electronics](https://www.oreilly.com/library/view/make-electronics/9781449377267/) ·
[Adafruit Arduino lesson order](https://learn.adafruit.com/lesson-0-getting-started/the-lessons)

Pipeline / diagrams-as-code: [Instructional Agents (arXiv 2508.19611)](https://arxiv.org/pdf/2508.19611) ·
[tscircuit / Circuit JSON](https://github.com/tscircuit/circuit-json) ·
[netlistsvg](https://github.com/nturley/netlistsvg) ·
[JSON Schema](https://json-schema.org/)
