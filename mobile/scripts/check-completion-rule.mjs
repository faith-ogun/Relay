// A replay must keep the streak alive, and both surfaces must agree that it does.
//
// The bug this guards: the web workspace's completion handler opened with
//
//     if (level <= prevLevel) return prev;   // replay at or below: record nothing
//
// so a run that did not raise the learner's level wrote NOTHING. No XP, which is
// correct, but also no streak, no daily goal, no last-active date. A learner at
// 100% completion has nothing left to raise, so in the browser they could not
// keep a streak alive at all. The phone advanced the streak on the same replay,
// and the two write to ONE progress record, so which app they happened to open
// decided whether the streak survived the day.
//
// There is now one definition of what a completion does, duplicated verbatim
// into both surfaces because they are separate bundles with separate resolvers:
//
//     frontend/services/completion.ts
//     mobile/src/services/completion.ts
//
// This file asserts the two copies are byte for byte identical, drives the rule
// through the whole table below against BOTH copies, and asserts the web handler
// still delegates rather than growing a second private rule.
//
//   node scripts/check-completion-rule.mjs

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const MOBILE_RULE = new URL('../src/services/completion.ts', import.meta.url);
const WEB_RULE = new URL('../../frontend/services/completion.ts', import.meta.url);
const WEB_HOME = new URL('../../frontend/components/WorkspaceHome.tsx', import.meta.url);
const MOBILE_SCREEN = new URL('../src/app/lesson/[id].tsx', import.meta.url);

const failures = [];
function scenario(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`  FAIL ${name}`);
    console.log(`       ${err.message.split('\n')[0]}`);
  }
}

/** Load a TypeScript module with no runtime imports. */
function loadModule(url) {
  const js = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  const forbid = (id) => {
    throw new Error(`completion.ts must stay dependency free; it imported ${id}`);
  };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', js)(forbid, mod, mod.exports);
  return mod.exports;
}

/**
 * The body of a named `const x = useCallback(` / `const x = (` declaration,
 * by brace matching, so an assertion about one handler cannot be satisfied or
 * broken by unrelated code elsewhere in a 1200 line file.
 */
function functionBody(source, declaration) {
  const start = source.indexOf(declaration);
  if (start < 0) throw new Error(`could not find \`${declaration}\``);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced braces after \`${declaration}\``);
}

const day = (iso) => new Date(`${iso}T09:00:00.000Z`);

/** A learner's record, with the fields the rule has no opinion about attached. */
const record = (over = {}) => ({
  lessonLevels: {},
  xp: 0,
  streak: 0,
  completedToday: 0,
  todayLessonIds: [],
  lastActiveDate: '',
  checkpointXp: 40,
  metrics: { perfect: 3, drawings: 1 },
  ...over,
});

console.log('completion rule');

// ---------------------------------------------------------------------------
// 1. The two surfaces hold the SAME rule.

const mobileSrc = readFileSync(MOBILE_RULE, 'utf8');
const webSrc = readFileSync(WEB_RULE, 'utf8');

scenario('the web and the phone hold byte-identical copies of the rule', () => {
  assert.equal(
    mobileSrc,
    webSrc,
    'frontend/services/completion.ts and mobile/src/services/completion.ts have drifted.\n' +
    'They must stay identical: copy one over the other and re-run.',
  );
});

// ---------------------------------------------------------------------------
// 2. The rule itself, run against BOTH copies so neither can be fixed alone.

const copies = [
  ['phone', loadModule(MOBILE_RULE)],
  ['web', loadModule(WEB_RULE)],
];

/** Run one assertion against both surfaces' copies of the rule. */
const both = (name, fn) => scenario(name, () => {
  for (const [surface, mod] of copies) {
    try {
      fn(mod.applyCompletion);
    } catch (err) {
      throw new Error(`[${surface}] ${err.message}`);
    }
  }
});

both('a first completion pays XP, records the level and starts the streak', (apply) => {
  const next = apply(record(), 'loops', 20, 1, day('2026-03-04'));
  assert.equal(next.xp, 20);
  assert.equal(next.lessonLevels.loops, 1);
  assert.equal(next.streak, 1);
  assert.equal(next.completedToday, 1);
  assert.deepEqual(next.todayLessonIds, ['loops']);
  assert.equal(next.lastActiveDate, '2026-03-04');
});

// The reported failure, in one assertion. A learner with everything at Gold has
// no level left to raise, so this is the ONLY completion they can make.
both('a replay the next day at the SAME level keeps the streak alive', (apply) => {
  const held = record({
    lessonLevels: { loops: 3 }, xp: 500, streak: 9,
    completedToday: 1, todayLessonIds: ['loops'], lastActiveDate: '2026-03-04',
  });
  const next = apply(held, 'loops', 10, 3, day('2026-03-05'));
  assert.equal(next.streak, 10, 'the replay did not extend the streak');
  assert.equal(next.lastActiveDate, '2026-03-05', 'the replay did not mark the day active');
  assert.equal(next.completedToday, 1, 'the replay did not count toward the daily goal');
  assert.deepEqual(next.todayLessonIds, ['loops']);
  assert.equal(next.xp, 500, 'a replay must not re-award XP');
  assert.equal(next.lessonLevels.loops, 3, 'a replay must not change the level held');
});

both('a learner at 100% can hold a streak across a whole week', (apply) => {
  let state = record({
    lessonLevels: { a: 3, b: 3, c: 3 }, xp: 900, streak: 40,
    completedToday: 1, todayLessonIds: ['a'], lastActiveDate: '2026-03-01',
  });
  const days = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07'];
  for (const d of days) state = apply(state, 'a', 10, 3, day(d));
  assert.equal(state.streak, 46, `six replays produced a streak of ${state.streak}, wanted 46`);
  assert.equal(state.xp, 900, 'replays paid XP they should not have');
});

both('a replay on the SAME day changes nothing but the day stamp', (apply) => {
  const held = record({
    lessonLevels: { loops: 2 }, xp: 100, streak: 5,
    completedToday: 1, todayLessonIds: ['loops'], lastActiveDate: '2026-03-04',
  });
  const next = apply(held, 'loops', 10, 2, day('2026-03-04'));
  assert.equal(next.streak, 5, 'the streak advanced twice in one day');
  assert.equal(next.completedToday, 1, 'one lesson counted twice toward the daily goal');
  assert.equal(next.xp, 100);
});

both('a replay at a LOWER level never demotes the level held', (apply) => {
  const held = record({ lessonLevels: { loops: 3 }, xp: 100, streak: 2, lastActiveDate: '2026-03-04' });
  const next = apply(held, 'loops', 20, 1, day('2026-03-05'));
  assert.equal(next.lessonLevels.loops, 3, 'a Bronze run demoted a Gold lesson');
  assert.equal(next.xp, 100, 'a run below the level held paid XP');
  assert.equal(next.streak, 3);
});

both('reaching a HIGHER level pays and records it', (apply) => {
  const held = record({ lessonLevels: { loops: 1 }, xp: 20, streak: 2, lastActiveDate: '2026-03-04' });
  const next = apply(held, 'loops', 10, 2, day('2026-03-05'));
  assert.equal(next.lessonLevels.loops, 2);
  assert.equal(next.xp, 30, 'levelling up did not pay');
  assert.equal(next.streak, 3);
});

both('the daily goal counts DISTINCT lessons, not attempts', (apply) => {
  let state = record();
  state = apply(state, 'a', 20, 1, day('2026-03-04'));
  state = apply(state, 'a', 20, 1, day('2026-03-04'));
  state = apply(state, 'a', 20, 1, day('2026-03-04'));
  assert.equal(state.completedToday, 1, `three replays counted as ${state.completedToday}`);
  state = apply(state, 'b', 20, 1, day('2026-03-04'));
  assert.equal(state.completedToday, 2);
  assert.deepEqual(state.todayLessonIds, ['a', 'b']);
});

both('the day turning clears the goal but not the streak', (apply) => {
  const held = record({
    lessonLevels: { a: 1, b: 1 }, xp: 40, streak: 3,
    completedToday: 2, todayLessonIds: ['a', 'b'], lastActiveDate: '2026-03-04',
  });
  const next = apply(held, 'a', 20, 1, day('2026-03-05'));
  assert.deepEqual(next.todayLessonIds, ['a']);
  assert.equal(next.completedToday, 1);
  assert.equal(next.streak, 4);
});

both('a missed day restarts the streak at one', (apply) => {
  const held = record({ lessonLevels: { a: 1 }, xp: 20, streak: 12, lastActiveDate: '2026-03-04' });
  const next = apply(held, 'a', 20, 1, day('2026-03-07'));
  assert.equal(next.streak, 1);
});

both('fields the rule has no opinion about pass through untouched', (apply) => {
  const next = apply(record({ checkpointXp: 40, metrics: { perfect: 3, drawings: 1 } }), 'a', 20, 1, day('2026-03-04'));
  assert.equal(next.checkpointXp, 40, 'the checkpoint ledger was dropped');
  assert.deepEqual(next.metrics, { perfect: 3, drawings: 1 }, 'the achievement counters were dropped');
});

both('the input record is never mutated', (apply) => {
  const held = record({ lessonLevels: { a: 1 }, xp: 20, streak: 2, todayLessonIds: ['a'], lastActiveDate: '2026-03-04' });
  const snapshot = JSON.stringify(held);
  apply(held, 'b', 20, 1, day('2026-03-05'));
  assert.equal(JSON.stringify(held), snapshot, 'applyCompletion mutated its argument');
});

both('a nonsense level or XP cannot corrupt the record', (apply) => {
  const zero = apply(record(), 'a', 20, 0, day('2026-03-04'));
  assert.equal(zero.lessonLevels.a, 1, 'a level of 0 was stored as not completed');
  const nan = apply(record(), 'a', Number.NaN, 1, day('2026-03-04'));
  assert.equal(nan.xp, 0, 'a non-finite XP value reached the ledger');
});

// ---------------------------------------------------------------------------
// 3. Neither surface may grow a second, private definition.

scenario('the web workspace delegates its completion to the shared rule', () => {
  const src = readFileSync(WEB_HOME, 'utf8');
  const body = functionBody(src, 'const handleComplete = useCallback(');
  assert.match(
    body,
    /applyCompletion\(/,
    'WorkspaceHome.handleComplete no longer calls applyCompletion: it is deciding for itself again',
  );
  assert.doesNotMatch(
    body,
    /return prev;/,
    'WorkspaceHome.handleComplete bails out of recording a completion again.\n' +
    'That is the bug: a replay at or below the level held then records no streak and no daily goal.',
  );
  assert.match(
    src,
    /from '\.\.\/services\/completion'/,
    'WorkspaceHome no longer imports the shared rule',
  );
});

scenario('the web reads the level held from the RECORD, not a launch-time snapshot', () => {
  const src = readFileSync(WEB_HOME, 'utf8');
  const prop = src.match(/heldLevel=\{[^}]*\}/);
  assert.ok(prop, 'WorkspaceHome no longer tells the runner what level is held');
  assert.match(
    prop[0],
    /lessonLevels\[running\.id\]/,
    'WorkspaceHome hands the runner only the level it read when the lesson was LAUNCHED.\n' +
    'On a device with no local cache that read is the empty defaults until the record\n' +
    'arrives over the network, so a learner who taps Continue first replays a lesson\n' +
    'they already hold: the once-per-lesson `perfect` and `drawings` counters are\n' +
    'credited a second time, and the completion card promises XP the shared rule then\n' +
    'declines to pay. Levels never fall, so reading the live record can only correct it.',
  );
});

scenario('the phone screen delegates its completion to the shared rule', () => {
  const src = readFileSync(MOBILE_SCREEN, 'utf8');
  assert.match(
    src,
    /applyCompletion\(current, String\(id\), run\.earnedXp, run\.level\)/,
    'the lesson screen no longer records the level it ran at, so every round is filed as Bronze',
  );
});


scenario('the phone reward screen is never handed a streak it does not know', () => {
  const src = readFileSync(MOBILE_SCREEN, 'utf8');
  assert.match(
    src,
    /openedAgainst\.current/,
    'the lesson screen no longer projects the streak from the record the run opened\n' +
    'against, so LessonComplete renders `streak={outcome?.streak ?? 0}`, a streak of\n' +
    'zero, for as long as the load and the two PUTs take.',
  );
  assert.match(
    src,
    /applyCompletion\(opened, String\(id\), run\.earnedXp, run\.level\)/,
    'the projected streak is no longer computed by the SHARED rule, which is how the\n' +
    'screen and the record start disagreeing about what a completion does.',
  );
});

console.log('');
if (failures.length) {
  console.error(`completion rule: ${failures.length} failure(s)\n`);
  failures.forEach((f) => console.error(`  ${f}\n`));
  process.exit(1);
}
console.log('completion rule: every scenario passed.');
