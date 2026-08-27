// A medal that has been earned must never be un-earned, and how a lesson is
// PACKAGED must never move one.
//
// Both halves of that shipped broken. Every achievement was recomputed from live
// counters on every render, so any change to how a counter was derived stripped
// medals from learners who had done the work; and unit completion was "every
// lesson on the path is done" while the 142 authored lessons were being served
// as 284 shorter sessions, so a learner who had finished the whole curriculum
// held every part one and no part two, and their unit medals vanished.
//
// The rules live in services/achievementRules.ts, duplicated verbatim into
// frontend/services and mobile/src/services because the two apps are separate
// bundles with separate module resolvers. This drives the real file, and asserts
// the two copies are byte for byte identical so a fix to one cannot be a fix to
// only one.
//
//   node scripts/check-achievement-rules.mjs

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const here = dirname(fileURLToPath(import.meta.url));
const MOBILE = resolve(here, '../src/services/achievementRules.ts');
const WEB = resolve(here, '../../frontend/services/achievementRules.ts');

// ── The two copies are one file ──────────────────────────────────────────────

const mobileSource = readFileSync(MOBILE);
const webSource = readFileSync(WEB);
assert.ok(
  mobileSource.equals(webSource),
  'frontend/services/achievementRules.ts and mobile/src/services/achievementRules.ts have drifted. '
  + 'They are one rule; copy the corrected file over the other.',
);

const dir = mkdtempSync(join(tmpdir(), 'ohmlet-achievement-rules-'));
const js = ts.transpileModule(mobileSource.toString('utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const file = join(dir, 'rules.mjs');
writeFileSync(file, js);
const rules = await import(`file://${file}`);

// ── A corpus cut the way the real one is ─────────────────────────────────────
//
//   u1  authored "A" -> A, "A II";  authored "B" -> B, "B II"
//   u2  authored "C" (not split);   authored "D" -> D, "D II", "D III"

const CORPUS = [
  { skills: [{ lessons: [{ id: 'A' }, { id: 'A II' }, { id: 'B' }, { id: 'B II' }] }] },
  { skills: [{ lessons: [{ id: 'C' }, { id: 'D' }, { id: 'D II' }, { id: 'D III' }] }] },
];
const AUTHORED = ['A', 'B', 'C', 'D'];
const EVERY_SESSION = ['A', 'A II', 'B', 'B II', 'C', 'D', 'D II', 'D III'];

/** The rule as it was: every lesson on the path, sessions and all. */
const countingSessions = (units, done) =>
  units.filter((u) => u.skills.every((s) => s.lessons.every((l) => done.has(l.id)))).length;

const failures = [];
const check = (name, fn) => {
  try {
    fn();
  } catch (err) {
    failures.push(`${name}\n    ${err.message.split('\n')[0]}`);
  }
};

// ── Packaging must not move a medal ──────────────────────────────────────────

check('the reported failure is reproduced by the old rule', () => {
  assert.equal(countingSessions(CORPUS, new Set(AUTHORED)), 0);
});

check('a learner who finished every authored lesson has finished every unit', () => {
  assert.equal(rules.authoredUnitsCompleted(CORPUS, new Set(AUTHORED)), 2);
});

check('sitting through every session is the same completion, not twice as much', () => {
  assert.equal(rules.authoredUnitsCompleted(CORPUS, new Set(EVERY_SESSION)), 2);
});

check('progress keyed by a later part counts for its authored lesson', () => {
  assert.equal(rules.authoredUnitsCompleted(CORPUS, new Set(['A II', 'B II', 'C', 'D III'])), 2);
});

check('an unfinished unit is still unfinished', () => {
  assert.equal(rules.authoredUnitsCompleted(CORPUS, new Set(['A', 'A II'])), 0);
  assert.equal(rules.authoredUnitsCompleted(CORPUS, new Set(['A', 'B'])), 1);
});

check('builds counts authored lessons, so re-cutting cannot halve a threshold', () => {
  assert.equal(rules.authoredLessonsCompleted(CORPUS, new Set(EVERY_SESSION)), 4);
  assert.equal(rules.authoredLessonsCompleted(CORPUS, new Set(AUTHORED)), 4);
});

check('a lesson genuinely titled with a numeral is not swallowed by its head', () => {
  assert.equal(rules.authoredLessonId('Chapter II', new Set(['Chapter II'])), 'Chapter II');
  assert.equal(rules.authoredLessonId('Grade I', new Set(['Grade', 'Grade I'])), 'Grade I');
  assert.equal(rules.authoredLessonId('A II', new Set(EVERY_SESSION)), 'A');
});

check('progress against a corpus this client does not hold still counts', () => {
  assert.equal(rules.authoredLessonsCompleted(CORPUS, new Set(['A', 'Elsewhere'])), 2);
});

// ── Earned is earned ─────────────────────────────────────────────────────────

const UNIT_12 = { id: 'unit-12', metric: 'units', threshold: 12 };

check('a stamped medal survives its counter going to zero', () => {
  assert.equal(rules.isEarnedWith(UNIT_12, { units: 0 }, { 'unit-12': { at: '2026-08-01' } }), true);
});

check('a stamped medal survives the metric disappearing entirely', () => {
  assert.equal(rules.isEarnedWith(UNIT_12, {}, { 'unit-12': { at: '2026-08-01' } }), true);
});

check('an unstamped medal still lights up the moment it is true', () => {
  assert.equal(rules.isEarnedWith(UNIT_12, { units: 12 }, {}), true);
  assert.equal(rules.isEarnedWith(UNIT_12, { units: 11 }, {}), false);
});

check('a record for a different medal earns nothing', () => {
  assert.equal(rules.isEarnedWith(UNIT_12, { units: 0 }, { 'unit-1': { at: '2026-08-01' } }), false);
});

check('the better informed counter wins, and neither side can lower the other', () => {
  assert.deepEqual(rules.mergeStats({ units: 3, xp: 900 }, { units: 12, xp: 100 }), { units: 12, xp: 900 });
  assert.deepEqual(rules.mergeStats({ units: 3 }, null), { units: 3 });
  assert.deepEqual(rules.mergeStats({ units: 3 }, { units: 'twelve' }), { units: 3 });
});

rmSync(dir, { recursive: true, force: true });

if (failures.length) {
  console.error('Achievement rules broken:\n');
  failures.forEach((f) => console.error(`  ${f}\n`));
  process.exit(1);
}
console.log('OK: unit medals survive the session split, and an earned medal stays earned.');
