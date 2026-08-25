// Every step type the curriculum authors must have a renderer that matches its
// SHAPE, not just its name.
//
// identify_component was in SUPPORTED and fell through to the choice renderer,
// which maps over `step.options` — a field it does not have. All 48 of them threw,
// taking down 42 of the 142 lessons the moment the step came up. Nothing caught
// it because "supported" only ever meant "the type is in a set".
import { readFileSync } from 'node:fs';

const LESSONS = '/Users/faith/Desktop/Ohmlet/backend/live-bridge/app/curriculum_data/lessons.json';
const VIEW = new URL('../src/lesson/StepView.tsx', import.meta.url);

const lessons = JSON.parse(readFileSync(LESSONS, 'utf8')).lessons;
const view = readFileSync(VIEW, 'utf8');

// Types the router sends to ChoiceStep: anything not named in a `case` above the
// default branch.
const cased = new Set([...view.matchAll(/case '([a-z_]+)':/g)].map((m) => m[1]));

const problems = [];
const seen = new Set();
for (const [lessonId, lesson] of Object.entries(lessons)) {
  for (const step of lesson.steps ?? []) {
    const t = step.type;
    if (cased.has(t)) continue;              // has a dedicated renderer
    if (Array.isArray(step.options)) continue; // choice renderer will work
    const key = `${t}`;
    if (seen.has(key)) continue;
    seen.add(key);
    problems.push(`${t} has no dedicated renderer and no \`options\` (first seen in "${lessonId}")`);
  }
}

if (problems.length) {
  console.error('Step types routed to the choice renderer without an options array:');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log(`OK: every authored step type has a renderer matching its shape (${cased.size} dedicated).`);
