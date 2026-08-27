// A learner who finished the whole curriculum must still hold every unit medal.
//
// This is the regression Faith reported, driven through the REAL corpus rather
// than a fixture. The 142 authored lessons are cut into 284 learner-sized
// sessions (part one keeps the authored id, later parts take a Roman numeral).
// Unit completion used to be "every lesson on the path is done", so the moment
// the web converged onto the 284, a learner who had genuinely finished all 142
// had every part one complete and every part two untouched: their unit medals
// evaporated, up to four of them, and path progress halved.
//
// So this walks three edges and joins them:
//
//   components/ohmlet/data/lessons.ts      what was AUTHORED (142)
//   components/ohmlet/data/curriculum.ts   what is DELIVERED (284 sessions)
//   services/achievementRules.ts           how the two are counted
//
// plus the durability rule on top: an achievement that has been stamped stays
// earned however the counter behind it is later derived.
//
// It also checks the far edge, backend/live-bridge/app/achievements.py, for a
// source for every metric the catalogue counts. An achievement whose metric
// nothing computes is permanently unearnable, and nothing else would notice.
//
//   node scripts/check-achievement-durability.mjs

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const SERVER_MODULE = resolve(root, '../backend/live-bridge/app/achievements.py');

/** Bundle a TypeScript module in memory and evaluate it, stubbing the UI. */
async function loadModule(entry) {
  const result = await build({
    entryPoints: [resolve(root, entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    // The data modules import React and lucide icons for the UI. None of that is
    // data and none of it can evaluate outside a React runtime, so every such
    // import becomes an inert stub.
    plugins: [
      {
        name: 'stub-ui-imports',
        setup(b) {
          const UI = /^(react|react-dom|react\/jsx-runtime|react\/jsx-dev-runtime|lucide-react)$/;
          b.onResolve({ filter: UI }, (args) => ({ path: args.path, namespace: 'ui-stub' }));
          b.onLoad({ filter: /.*/, namespace: 'ui-stub' }, () => ({
            contents: `
              const noop = () => null;
              export const jsx = noop; export const jsxs = noop; export const jsxDEV = noop;
              export const Fragment = noop; export const createElement = noop;
              export default new Proxy({}, { get: () => noop });
            `,
            loader: 'js',
          }));
        },
      },
    ],
    logLevel: 'silent',
  });
  const code = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

const [lessons, curriculum, catalogue, rules] = await Promise.all([
  loadModule('components/ohmlet/data/lessons.ts'),
  loadModule('components/ohmlet/data/curriculum.ts'),
  loadModule('components/ohmlet/data/achievements.tsx'),
  loadModule('services/achievementRules.ts'),
]);

const UNITS = curriculum.SESSION_CURRICULUM;
const AUTHORED_IDS = Object.keys(lessons.LESSON_CONTENT);
const SESSION_IDS = UNITS.flatMap((u) => u.skills.flatMap((s) => s.lessons.map((l) => l.id)));
const ACHIEVEMENTS = catalogue.ACHIEVEMENTS;

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

// ── The corpus really is cut ─────────────────────────────────────────────────

check('the delivered corpus is bigger than the authored one', () => {
  assert.ok(
    SESSION_IDS.length > AUTHORED_IDS.length,
    `nothing is split: ${SESSION_IDS.length} sessions for ${AUTHORED_IDS.length} authored lessons`,
  );
});

check('every authored lesson is on the delivered path', () => {
  const onPath = new Set(SESSION_IDS);
  const missing = AUTHORED_IDS.filter((id) => !onPath.has(id));
  assert.deepEqual(missing, [], 'an authored lesson has no part one carrying its id');
});

check('every session folds back onto an authored lesson', () => {
  const corpusIds = new Set(SESSION_IDS);
  const authored = new Set(AUTHORED_IDS);
  const orphans = SESSION_IDS.filter((id) => !authored.has(rules.authoredLessonId(id, corpusIds)));
  assert.deepEqual(orphans, [], 'a session id resolves to a lesson nobody authored');
});

// ── The learner who finished everything ──────────────────────────────────────
//
// Their record names the 142 authored lessons, because that is what part one is
// keyed by and what every pre-split completion was keyed by.

const FINISHED = new Set(AUTHORED_IDS);

check('the reported failure is reproduced by the old rule', () => {
  const before = countingSessions(UNITS, FINISHED);
  assert.ok(
    before < UNITS.length,
    'the corpus no longer reproduces the failure, so this check proves nothing',
  );
});

check('a learner who finished all 142 authored lessons has finished all 12 units', () => {
  assert.equal(rules.authoredUnitsCompleted(UNITS, FINISHED), UNITS.length);
});

check('sitting through all 284 sessions is the same 12 units, not 24 lessons more', () => {
  assert.equal(rules.authoredUnitsCompleted(UNITS, new Set(SESSION_IDS)), UNITS.length);
});

check('builds counts the authored lessons, whichever ids the record holds', () => {
  assert.equal(rules.authoredLessonsCompleted(UNITS, FINISHED), AUTHORED_IDS.length);
  assert.equal(rules.authoredLessonsCompleted(UNITS, new Set(SESSION_IDS)), AUTHORED_IDS.length);
});

check('every unit medal is held by a learner who finished the curriculum', () => {
  const stats = {
    units: rules.authoredUnitsCompleted(UNITS, FINISHED),
    builds: rules.authoredLessonsCompleted(UNITS, FINISHED),
  };
  const lost = ACHIEVEMENTS
    .filter((a) => a.metric === 'units' || a.metric === 'builds')
    .filter((a) => stats[a.metric] < a.threshold && a.threshold <= AUTHORED_IDS.length)
    .map((a) => a.id);
  assert.deepEqual(lost, [], 'a finished learner does not hold these');
});

// ── Earned is earned ─────────────────────────────────────────────────────────

check('every stamped medal survives every counter going to zero', () => {
  const stamped = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, { at: '2026-08-01T00:00:00Z' }]));
  const lost = ACHIEVEMENTS.filter((a) => !rules.isEarnedWith(a, {}, stamped)).map((a) => a.id);
  assert.deepEqual(lost, [], 'these were un-earned by a counter change');
});

check('an unstamped medal is earned exactly when its threshold is met', () => {
  for (const a of ACHIEVEMENTS) {
    assert.equal(rules.isEarnedWith(a, { [a.metric]: a.threshold }, {}), true, a.id);
    assert.equal(rules.isEarnedWith(a, { [a.metric]: a.threshold - 1 }, {}), false, a.id);
  }
});

// ── Every metric has a source ────────────────────────────────────────────────

check('the server computes every metric the catalogue counts', () => {
  const server = readFileSync(SERVER_MODULE, 'utf8');
  const computed = server.slice(server.indexOf('def compute_stats'));
  const missing = [...new Set(ACHIEVEMENTS.map((a) => a.metric))]
    .filter((metric) => !computed.includes(`"${metric}":`));
  assert.deepEqual(missing, [], 'these metrics are unearnable: nothing on the server computes them');
});

if (failures.length) {
  console.error('Achievement durability broken:\n');
  failures.forEach((f) => console.error(`  ${f}\n`));
  process.exit(1);
}
console.log(
  `OK: ${AUTHORED_IDS.length} authored lessons delivered as ${SESSION_IDS.length} sessions, `
  + `${UNITS.length} units still complete, and no stamped medal can be un-earned.`,
);
