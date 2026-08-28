// A boss exam must never be long enough for the run loop to sample it down.
//
// The boss is graded by INDEX. The server composes the exam, hands back a seed,
// and re-derives the identical question list to grade the indices the phone
// reports. That only holds while the phone plays every step it was given.
//
// `buildLeveledSteps` treats any lesson with RUN_SIZE + 2 or more graded steps
// as a POOL and samples RUN_SIZE of them. A boss that crossed that line would be
// silently trimmed on the phone, and every question the learner never saw would
// be graded on the server as one they got wrong. The learner would fail an exam
// they answered perfectly, and nothing about it would look broken.
//
// The two numbers live in different languages in different halves of the repo,
// so nothing but this holds them together.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO = resolve(MOBILE, '..');

const levels = readFileSync(join(MOBILE, 'src/lesson/levels.ts'), 'utf8');
const bosses = readFileSync(join(REPO, 'backend/live-bridge/app/bosses.py'), 'utf8');

const fail = (msg) => { console.error(`check-boss-exam-size: ${msg}`); process.exit(1); };

const runSize = levels.match(/export const RUN_SIZE\s*=\s*(\d+)/);
if (!runSize) fail('could not find RUN_SIZE in src/lesson/levels.ts');

// POOL_THRESHOLD is authored as RUN_SIZE + N; read N rather than assuming 2.
const poolExpr = levels.match(/const POOL_THRESHOLD\s*=\s*RUN_SIZE\s*\+\s*(\d+)/);
if (!poolExpr) fail('could not find POOL_THRESHOLD in src/lesson/levels.ts');

const maxQ = bosses.match(/MAX_QUESTIONS\s*=\s*int\(os\.getenv\("OHMLET_BOSS_MAX_Q",\s*"(\d+)"\)\)/);
if (!maxQ) fail('could not find MAX_QUESTIONS in backend/live-bridge/app/bosses.py');

const threshold = Number(runSize[1]) + Number(poolExpr[1]);
const max = Number(maxQ[1]);

if (max >= threshold) {
  fail(
    `a boss may be ${max} questions, but the run loop samples anything with ` +
    `${threshold} or more graded steps down to ${runSize[1]}. Questions the learner ` +
    `never sees would be graded as missed. Lower OHMLET_BOSS_MAX_Q below ${threshold}, ` +
    `or teach the boss screen to bypass buildLeveledSteps.`,
  );
}

// The floor has to fit under the ceiling too, or question_count clamps to a
// contradiction and every unit silently gets a different length than intended.
const minQ = bosses.match(/MIN_QUESTIONS\s*=\s*int\(os\.getenv\("OHMLET_BOSS_MIN_Q",\s*"(\d+)"\)\)/);
if (minQ && Number(minQ[1]) > max) {
  fail(`MIN_QUESTIONS (${minQ[1]}) is above MAX_QUESTIONS (${max}).`);
}

console.log(`check-boss-exam-size: ok max ${max} question exam, sampler bites at ${threshold}`);
