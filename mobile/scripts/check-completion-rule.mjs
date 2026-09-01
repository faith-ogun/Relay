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
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const MOBILE_RULE = new URL('../src/services/completion.ts', import.meta.url);
const WEB_RULE = new URL('../../frontend/services/completion.ts', import.meta.url);
const WEB_HOME = new URL('../../frontend/components/WorkspaceHome.tsx', import.meta.url);
const MOBILE_SCREEN = new URL('../src/app/lesson/[id].tsx', import.meta.url);
const BACKEND_APP = fileURLToPath(new URL('../../backend/live-bridge/app', import.meta.url));

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
      fn(mod.applyCompletion, mod);
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

// ---------------------------------------------------------------------------
// 4. The streak BREAKS. It is the only counter that decays with time.
//
// The bug this guards, reported 2026-08-30: "I had a 2-day streak, then I went a
// full day without doing a lesson, but the 2-day streak still persists."
//
// The write rule above was already correct. `applyCompletion` resets to 1 when
// the last active day is neither today nor yesterday. But it can only run ON a
// completion, and on the day a streak dies there is no completion to run it. So
// every surface displayed the number last written, which meant a streak could
// not be broken by not showing up, only corrected days later at the moment the
// learner finally did some work, downward, as their reward for coming back.

const STREAK_TABLE = [
  { last: '2026-03-10', streak: 2, want: 2, why: 'worked today' },
  { last: '2026-03-09', streak: 2, want: 2, why: 'worked yesterday: alive, at risk until midnight' },
  { last: '2026-03-08', streak: 2, want: 0, why: 'MISSED A FULL DAY: this is the reported bug' },
  { last: '2026-01-01', streak: 40, want: 0, why: 'gone for months' },
  { last: '2026-03-10', streak: 0, want: 0, why: 'no streak to keep' },
  { last: '', streak: 3, want: 0, why: 'never active, so nothing to carry' },
];
const NOW = day('2026-03-10');

for (const { last, streak, want, why } of STREAK_TABLE) {
  both(`streak ${streak} last active ${last || '(never)'} reads as ${want}: ${why}`, (_apply, mod) => {
    const got = mod.currentStreak({ streak, lastActiveDate: last }, NOW);
    assert.equal(got, want,
      `currentStreak returned ${got}, wanted ${want}. ` +
      'A streak that cannot be broken is a counter with a flame on it.');
  });
}

both('at-risk is true only on the day after the last completion', (_apply, mod) => {
  assert.equal(mod.streakAtRisk({ streak: 5, lastActiveDate: '2026-03-09' }, NOW), true,
    'a learner who worked yesterday and not yet today is exactly who a nudge is for');
  assert.equal(mod.streakAtRisk({ streak: 5, lastActiveDate: '2026-03-10' }, NOW), false,
    'already worked today, nothing at risk');
  assert.equal(mod.streakAtRisk({ streak: 5, lastActiveDate: '2026-03-08' }, NOW), false,
    'a streak that is already gone cannot be at risk; that would promise a rescue that is not available');
});

// ---------------------------------------------------------------------------
// 5. Every surface that SHOWS a streak must show the live one.
//
// The rule existing is not the fix. Three places rendered `progress.streak`
// directly, and any one of them left alone reproduces the bug in full.

const RENDER_SITES = [
  ['../src/app/home.tsx', 'the phone stat strip'],
  ['../src/app/profile.tsx', 'the phone profile'],
  ['../../frontend/components/WorkspaceHome.tsx', 'the web workspace'],
];

for (const [rel, label] of RENDER_SITES) {
  scenario(`${label} reads the live streak, not the stored one`, () => {
    const src = readFileSync(new URL(rel, import.meta.url), 'utf8');
    const raw = src.match(/progress\.streak/g) ?? [];
    assert.equal(raw.length, 0,
      `${label} still reads progress.streak directly (${raw.length} time(s)). ` +
      'The stored number is only correct on a day the learner completed something; ' +
      'every other day it overstates the streak. Use currentStreak(progress).');
    assert.match(src, /currentStreak\(/,
      `${label} does not call currentStreak, so whatever it shows cannot decay.`);
  });
}

// ---------------------------------------------------------------------------
// 6. The SERVER agrees, because it mints the medals.
//
// achievements.py stamps a medal permanently the first time a condition is met.
// If its streak reading disagreed with the clients', a learner could be minted a
// 7-day-streak medal on a streak the app had already shown as broken. Run the
// two languages over one table and compare.

scenario('the Python rule agrees with the TypeScript rule, case for case', () => {
  const cases = STREAK_TABLE.map(({ last, streak }) => ({ streak, lastActiveDate: last }));
  const py = spawnSync('python3', ['-c', `
import json, sys
from datetime import datetime, timezone
sys.path.insert(0, ${JSON.stringify(BACKEND_APP)})
from achievements import current_streak
now = datetime(2026, 3, 10, 9, 0, tzinfo=timezone.utc)
print(json.dumps([current_streak(c, now) for c in json.loads(sys.argv[1])]))
`, JSON.stringify(cases)], { encoding: 'utf8' });
  assert.equal(py.status, 0, `python3 could not run the server rule:\n${py.stderr}`);
  const fromPython = JSON.parse(py.stdout.trim());
  const fromTs = cases.map((c) => copies[0][1].currentStreak(c, NOW));
  assert.deepEqual(fromPython, fromTs,
    `the server and the clients disagree about live streaks.\n` +
    `  python: ${JSON.stringify(fromPython)}\n` +
    `  ts:     ${JSON.stringify(fromTs)}\n` +
    'achievements.py stamps medals permanently, so a disagreement mints a medal ' +
    'for a streak the learner can see is broken.');
});

// ---------------------------------------------------------------------------
// 7. The DAILY GOAL resets when the day turns, on both surfaces.
//
// Reported 2026-09-01, alongside the streak: "daily goal, again, just like the
// streaks, doesn't reset after each day."
//
// Identical shape to the streak defect and shipped in the same place. The write
// rule already clears `todayLessonIds` when the day turns, but it only runs ON a
// completion, and a new day begins with no completion to run it. So the stored
// count stood: three lessons on Saturday, and Monday opened with the goal
// already showing 3 of 3.
//
// Worse than the streak in one respect. A stale streak flatters the learner; a
// stale goal DELETES the thing they were meant to do today. The ring is already
// full, so there is nothing left to close and the clearest single reason to open
// the app has quietly gone.
//
// The web guarded this inline and the phone did not, which is exactly the split
// the shared rule exists to prevent, and exactly how the streak bug survived too.

const GOAL_TABLE = [
  { last: '2026-03-10', ids: ['a', 'b'], want: 2, why: 'two done today' },
  { last: '2026-03-09', ids: ['a', 'b'], want: 0, why: 'YESTERDAY: the day turned, the goal is fresh' },
  { last: '2026-03-08', ids: ['a', 'b', 'c'], want: 0, why: 'the reported bug, days later' },
  { last: '2026-03-10', ids: [], want: 0, why: 'active today but nothing counted yet' },
  { last: '', ids: ['a'], want: 0, why: 'never active' },
];

for (const { last, ids, want, why } of GOAL_TABLE) {
  both(`goal ${ids.length} last active ${last || '(never)'} reads as ${want}: ${why}`, (_apply, mod) => {
    const rec = { completedToday: ids.length, todayLessonIds: ids, lastActiveDate: last };
    assert.equal(mod.completedTodayNow(rec, NOW), want,
      'a goal that does not reset removes the one thing the learner was meant to do today');
    assert.equal(mod.todayLessonIdsNow(rec, NOW).length, want,
      'the id list and the count must agree, or a lesson done yesterday still blocks today');
  });
}

both('a record written before todayLessonIds existed still resets', (_apply, mod) => {
  assert.equal(mod.completedTodayNow({ completedToday: 3, lastActiveDate: '2026-03-08' }, NOW), 0);
  assert.equal(mod.completedTodayNow({ completedToday: 3, lastActiveDate: '2026-03-10' }, NOW), 3,
    'an older record with no id list must still report its count on the day it was written');
});

// Unlike the streak, YESTERDAY is not alive here. A streak survives the night
// because the learner has until midnight to keep it; a daily goal is the work of
// one calendar day and starts empty.
both('yesterday counts for the streak but NOT for the goal', (_apply, mod) => {
  const rec = { streak: 4, completedToday: 2, todayLessonIds: ['a', 'b'], lastActiveDate: '2026-03-09' };
  assert.equal(mod.currentStreak(rec, NOW), 4, 'the streak is still alive until midnight');
  assert.equal(mod.completedTodayNow(rec, NOW), 0, "today's goal has not been started");
});

const GOAL_SITES = [
  ['../src/app/home.tsx', 'the phone stat strip'],
  ['../../frontend/components/WorkspaceHome.tsx', 'the web workspace'],
];

for (const [rel, label] of GOAL_SITES) {
  scenario(`${label} reads today's goal through the shared rule`, () => {
    const src = readFileSync(new URL(rel, import.meta.url), 'utf8');
    const raw = src.match(/progress\.completedToday/g) ?? [];
    assert.equal(raw.length, 0,
      `${label} still reads progress.completedToday directly (${raw.length} time(s)). ` +
      'That number is only correct on a day the learner completed something. ' +
      'Use completedTodayNow(progress).');
    assert.match(src, /completedTodayNow\(/,
      `${label} does not call completedTodayNow, so its daily goal cannot reset.`);
  });
}

console.log('');
if (failures.length) {
  console.error(`completion rule: ${failures.length} failure(s)\n`);
  failures.forEach((f) => console.error(`  ${f}\n`));
  process.exit(1);
}
console.log('completion rule: every scenario passed.');
