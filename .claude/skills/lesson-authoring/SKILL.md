---
name: lesson-authoring
description: Author or rebuild Ohmlet electronics curriculum lessons (lessons.ts + curriculum.ts) to the quality bar, grounded in the source books, lint-clean. Use whenever creating a new unit, rebuilding lessons, or adding exercise types. Encodes the schema, the quality bar, the balanced-distractor rule, the citation format, and the lint-to-zero workflow.
---

# Lesson authoring skill

The procedural playbook for building Ohmlet curriculum lessons. Read this fully
before authoring. The single source of truth for *what* to build is
`content/CURRICULUM_PLAN.md`; this skill is *how* to build it correctly the first
time so the linter passes with zero warnings.

## The two files you edit

- **`frontend/components/ohmlet/data/lessons.ts`** — `LESSON_CONTENT`: a flat map
  keyed by lesson id → `{ steps: AuthoredStep[]; xpReward: number }`.
- **`frontend/components/ohmlet/data/curriculum.ts`** — `CURRICULUM`: the Unit →
  Skill → Lesson tree. Every `CurriculumLesson.id` MUST equal a key in
  `LESSON_CONTENT` (validateCurriculum / the linter checks this).

Provenance goes in **`content/CURRICULUM_CITATIONS.md`** (per-lesson, which book +
chapter). The dated build note goes in **`metadata/curriculum-changelog.md`**, never
in the plan.

## Step types (the schema — only these exist)

`teach` · `multiple_choice` · `true_false` · `fill_blank` · `match` · `drag_order` ·
`spot_error` · `identify_component` · `draw_connection` · `predict_reading` ·
`predict_behavior` · `choose_resistor` · `trace_current` · `fix_the_circuit` ·
`build_to_spec`.

**The construction/repair/trace family (prefer these over multiple_choice where they fit):**
- `trace_current` — `{ question; circuitDiagram; correctPath: string[]; explanation }`.
  The learner taps the parts current flows through, in loop order. Each id in
  `correctPath` must be a clickable region of the circuit. Great for the
  "current gets used up" misconception. Example: "The Closed Loop".
- `fix_the_circuit` — `{ question; circuitDiagram; faultRegion; fixes: string[]; correctFix; explanation }`.
  Two stages: tap the faulty region, then pick the repair. `faultRegion` must be a
  clickable region; `fixes` follow the balanced-distractor rule. A step beyond
  `spot_error` (diagnose + remedy). Example: "Powering an LED Safely".
- `build_to_spec` — `{ instruction; palette: string[]; slots; correct: number[]; explanation; circuitDiagram? }`.
  Assemble a circuit by placing parts from a palette (include DISTRACTOR parts, so
  palette length > slots) into ordered slots. `correct` lists one palette index per
  slot. Synthesis. Example: "Build a Series LED Circuit". (This is the constrained
  constructor; the open-ended free-wire + live-sim "draw the circuit" is a separate
  future feature, not this.)

Each graded step may carry `difficulty: 1 | 2 | 3`. Exact field shapes are the
`LessonStep*` types at the top of `lessons.ts` — match them exactly (TypeScript
must compile). `correct` is a 0-based index. `correctOrder` (drag_order) must be a
permutation of the items. `correctRegion`/`correctComponent` MUST be a clickable
region id of the referenced `circuitDiagram` (see the region registry).

## The quality bar (non-negotiable; the linter enforces most of it)

1. **Balanced distractors — the #1 rule.** The correct option must NOT be the lone
   longest. The linter flags it when the correct option is the unique maximum AND
   ≥1.6× the average distractor length AND ≥12 chars longer than the average.
   **Fastest reliable fix: write at least one distractor as long as (or longer than)
   the correct option.** Do this while drafting, not after.
2. **Distractors are real mistakes**, not filler. The wrong numeric answers should be
   the results of the actual errors a learner makes (e.g. forgetting an LED's Vf →
   `5/220` instead of `(5−2)/220`; forgetting to convert µF → off by 1,000,000).
3. **Hints nudge the method, never name the answer.** A `fill_blank` hint must not
   contain the answer as a substring — watch digit runs ("1000" contains "10"). Say
   "apply the multiplier band, then convert to kΩ", not "10 × 100".
4. **Depth: ≥6 graded steps is the floor; aim 8–14**, 12+ for a unit's deep lessons
   so Bronze/Silver/Gold replays draw different, harder slices.
5. **Real difficulty via tiers.** Tier 1 = recall; Tier 2 = one calculation/
   application; Tier 3 = multi-step reasoning or a real computation. Every deep lesson
   should span all three. "Advanced" means harder *reasoning*, not just a harder topic.
6. **Vary the exercise type.** Lead with 1–2 `teach`, then a MIX favouring the
   predict/choose/identify/spot families; end on a `match` or `drag_order` synthesis.
   multiple_choice should be well under half of graded steps. Never 3 consecutive
   `teach`. Never a majority-passive lesson.
7. **No em dashes, no emojis** in any learner-facing copy (project rule). Use commas/
   colons/periods; use lucide/SVG iconography, never emoji glyphs.

Reference lessons that embody the bar (copy their shape): **"The Closed Loop"** and
**"Powering an LED Safely"** in `lessons.ts`.

## Grounding in the books (mandatory)

Author *original* lessons grounded in `content/Books/md/` — never reproduce text
verbatim. Workflow: `grep -rin` the book(s) for the concept, read enough of the real
passage to get the facts/figures right, author in your own words, record the source
in `CURRICULUM_CITATIONS.md`. Book key + strengths are in `CURRICULUM_PLAN.md §9`.
Verify every number you put in a question (do the arithmetic).

## Circuit diagrams

Reuse existing diagrams where they fit (`rc_low_pass`, `transistor_switch`,
`series_circuit`, `voltage_divider`, `ldr_alarm`, `breadboard_layout`,
`led_no_resistor`, `reversed_led`, `short_circuit`, `parallel_circuit`). If a unit
needs a new diagram, prefer the DSL (`circuits/specs.ts` as data) but a brand-new
schematic that needs visual iteration should be DEFERRED to a dedicated diagram pass
(note it in the changelog) — teach via calculation/concept meanwhile rather than ship
a wrong picture. Do not invent a `circuitDiagram` id that does not exist.

## Wiring a unit (exact pattern)

1. Add each lesson's content to `LESSON_CONTENT` in `lessons.ts` (append before the
   closing `};`). Group with a `// ═══ Unit N: Title ═══` banner comment.
2. Register the unit in `CURRICULUM` (`curriculum.ts`): a `CurriculumUnit` with
   `id`, `title`, `subtitle`, `level`, `accent`, and `skills[]` (3–5 skills, each
   3–4 lessons), ending with a checkpoint skill. Every lesson `id` must match a
   `LESSON_CONTENT` key exactly.
3. End the unit with a **checkpoint** lesson (xpReward 50, no `teach` steps, mixed
   cumulative retrieval over the unit, ≥8 graded).

## The done-definition (run these; do not stop until both pass)

```bash
cd frontend && npm run lint:lessons   # MUST be: 0 errors, 0 warnings
cd frontend && npm run build          # MUST pass
```

If the linter warns, fix and re-run. The most common warning is the "longest answer"
tell — lengthen one distractor in the flagged step. Re-run until clean. Only then is
the unit ready for the human `/author` review gate.

## After it's clean

- Add per-lesson provenance to `CURRICULUM_CITATIONS.md`.
- Add a one-line-per-lesson summary to `metadata/curriculum-changelog.md` (NOT the plan).
- Update the unit's row in `CURRICULUM_PLAN.md §3` (status → built; lesson count).
- Commit with explicit paths only (never `git add -A`). Do not push unless asked.
