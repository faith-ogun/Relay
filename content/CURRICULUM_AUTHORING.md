# Curriculum authoring pipeline

How Ohmlet turns source material (textbooks, references) into a deep, trustworthy
electronics curriculum. The guiding decision (see the strategy notes): **lessons
are offline-authored and human-approved, not generated at runtime.** A tutor that
hallucinates a wiring step destroys trust permanently, so every lesson is verified
once and reused. RAG is reserved for a separate, clearly-labeled "ask anything"
Beta sidecar, never for authoritative teaching.

## The pipeline

```
textbook / reference
        │  (1) convert to markdown
        ▼
   source .md  (raw knowledge, not yet a lesson)
        │  (2) LLM-assisted authoring (Gemini Pro, OFFLINE) drafts structured steps
        ▼
   draft lesson  (steps in the LessonStep schema)
        │  (3) HUMAN REVIEW — correct facts, wiring, resistor math, pedagogy
        ▼
   approved lesson  → add to LESSON_CONTENT (lessons.ts)
        │  (4) place in the tree
        ▼
   CURRICULUM (curriculum.ts): Unit → Skill → Lesson reference by id
        │  (5) validateCurriculum() — every referenced id has content, ids unique
        ▼
   shipped: Duolingo-style path in the app
```

Step 2 uses the LLM as an **authoring accelerant**, never as the runtime source of
truth. Step 3 (human review) is non-negotiable for anything that touches a real
circuit.

## The two data layers

| Layer | File | Holds |
|-------|------|-------|
| **Content** | `frontend/components/ohmlet/data/lessons.ts` (`LESSON_CONTENT`) | The authored steps for each lesson, keyed by lesson id |
| **Structure** | `frontend/components/ohmlet/data/curriculum.ts` (`CURRICULUM`) | Units → Skills → Lessons; references content by id |

Keeping them separate means the curriculum tree can be reordered, re-grouped, and
grown without touching lesson content, and lessons can be QA'd independently.

## Lesson step schema (the authoring target)

A lesson is `{ steps: LessonStep[]; xpReward: number }`. Each step is one of these
types (defined in `lessons.ts`):

| Step type | Use it for |
|-----------|-----------|
| `teach` | Explain a concept (optional circuit diagram, current-flow animation) |
| `multiple_choice` | Check recall/understanding with options |
| `true_false` | Quick concept check |
| `fill_blank` | Recall a value or term (with a hint) |
| `match` | Pair terms to definitions |
| `drag_order` | Order the steps of a procedure |
| `identify_component` | Click the right part on a diagram |
| `spot_error` | Find the mistake in a circuit |
| `draw_connection` | Wire terminals together (touch-friendly) |

Author a mix: lead with `teach`, reinforce with 2–4 interactive checks, end with a
`match` or `drag_order` synthesis step.

## Adding a lesson (checklist)

1. Author the steps and add an entry to `LESSON_CONTENT` keyed by a stable id.
2. Reference that id from a Skill in `CURRICULUM` (or create a new Unit/Skill).
3. Run `npm run lint:lessons` (must pass with 0 errors) and `npm run build`.
4. Open `/author` (admin only) and preview the lesson through the real runner.
5. Keep the tutor grounded: the live tutor is fed the current lesson's authored
   content so it teaches from verified material, not free recall.

## The rails (authoring tooling)

Three pieces turn lesson-writing from slow hand-craft into reviewed assembly:

### 1. The linter — `npm run lint:lessons`

`frontend/components/ohmlet/data/lessonSchema.ts` validates every lesson and step;
`frontend/scripts/lint-lessons.mjs` runs it over the real data (via Vite's module
loader, no extra tooling) and exits non-zero on any error. It catches what a human
would otherwise only find by playing every lesson:

- out-of-range `correct` indices, empty options/questions, duplicate options
- `drag_order.correctOrder` that is not a permutation of the items
- `spot_error` / `identify_component` whose region is **not a clickable region of
  that circuit** (the most common silent bug)
- unknown circuit references; malformed `draw_connection` terminals/connections
- lessons referenced in the curriculum with no content, and orphans
- warnings: missing explanations, 3+ consecutive teach steps, all-teach lessons

The same `summarizeLint()` runs in the browser, so the `/author` console shows live
status without a build step.

### 2. The `/author` preview route (admin only)

`AuthorPreview.tsx` lists every lesson grouped by unit with a red/amber/green lint
status, the problems inline, and a **Preview** button that renders the lesson
through the real `LessonRunner` (preview = exactly what ships). This is the human
approval gate: review and approve in minutes instead of re-reading JSON.

### 3. Circuit diagrams: curated SVG + the DSL

Two ways to get a circuit diagram, both sharing one primitive palette
(`circuits/primitives.tsx`):

- **Curated (hand-coded):** the original 8 in `CircuitDiagram.tsx`. Frozen, pixel-
  tuned. Use the escape hatch here only for irregular one-off circuits.
- **DSL (data-authored):** add a `CircuitSpec` to `circuits/specs.ts` —
  `{ nodes, wires, annotations }`. The renderer (`SpecCircuit.tsx`) draws it, and
  the region registry **auto-derives** its clickable regions from the node ids, so
  the linter validates lessons that use it for free. This is the scalable path for
  new diagrams (Units 6+). Add new component shapes to `primitives.tsx`.

Region source of truth: `circuits/registry.ts` (`CIRCUIT_REGIONS`) merges the
hand-written legacy regions with the DSL-derived ones.

## The quality bar (non-negotiable, partly linter-enforced)

The first 56 lessons were too easy and guessable. The bar, grounded in standard
item-writing research:

- **Balanced distractors.** All options similar in length, grammar, and
  plausibility. The correct answer must NOT be the longest/most-detailed one (the
  "longest answer" tell). The linter warns when it is.
- **Distractors are common mistakes.** The wrong numeric answers should be the
  results of the errors a learner actually makes (e.g. forgetting to subtract an
  LED's forward voltage → `5/220` instead of `(5−2)/220`). A plausible distractor
  teaches; a silly one gives the answer away.
- **Hints nudge the method, never name the answer.** No "less-than sign" for a `<`
  answer, no "5/1000" hint for a `5` answer. The linter warns when a fill-blank
  hint literally contains the answer (it can't catch semantic giveaways, so judge
  those at the /author gate).
- **Depth: aim for 8+ graded questions; 12+ for a tiered pool that levels well.**
  The linter warns below 6.
- **Real difficulty, not just a harder topic.** Tag questions with
  `difficulty: 1 | 2 | 3`. Tier 1 = recall, Tier 2 = one calculation/application,
  Tier 3 = multi-step reasoning or a real computation (e.g. size a base resistor
  for saturation; two LEDs in series; power vs the resistor's rating). Bronze
  favours Tier 1, Silver Tier 2, Gold Tier 3 (see `data/levels.ts`), so a deep
  pool makes replays genuinely escalate.

Reference rebuilds to copy the bar from: **The Closed Loop** (tiered beginner pool)
and **Powering an LED Safely** (real calculations with common-mistake distractors).
The other ~54 lessons predate this bar and are flagged by `npm run lint:lessons`
(currently ~51 "longest answer" + ~42 "too short") — that is the re-authoring
backlog.

## Depth target

Benchmark: Mimo ships thousands of exercises per path; Duolingo's depth is the
reason streaks work. The first goal is ONE genuinely deep, finishable path
(40–80 lessons) with real progression, not breadth across many shallow ones.
