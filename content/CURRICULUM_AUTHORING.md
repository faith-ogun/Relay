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
3. Run `validateCurriculum()` (returns `[]` when healthy) and `npm run build`.
4. Keep the tutor grounded: the live tutor is fed the current lesson's authored
   content so it teaches from verified material, not free recall.

## Depth target

Benchmark: Mimo ships thousands of exercises per path; Duolingo's depth is the
reason streaks work. The first goal is ONE genuinely deep, finishable path
(40–80 lessons) with real progression, not breadth across many shallow ones.
