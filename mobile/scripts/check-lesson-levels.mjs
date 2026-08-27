// Bronze, Silver and Gold must exist on the phone, and mean the same thing there.
//
// The bug this guards: the web has had three levels since levelling shipped, and
// the phone had none. `src/app/lesson/[id].tsx` called
//
//     applyCompletion(current, String(id), run.earnedXp)
//
// with the level argument left off, so it took its default of 1. Every round on
// the phone was played as Bronze and filed as Bronze. A phone-only learner could
// never leave Bronze, and a learner who earned Gold in the browser had it
// overwritten as Bronze by the next save from their phone, because the two write
// to ONE progress record.
//
// The progression itself is one rule in two files, identical below the marker:
//
//     frontend/components/ohmlet/data/levels.ts
//     mobile/src/lesson/levels.ts
//
// Only the lines ABOVE the marker differ, because the step types come from a
// different module on each surface. This file asserts the shared halves match,
// drives the rule, and asserts the phone actually plays and records a level.
//
//   node scripts/check-lesson-levels.mjs

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const MOBILE_LEVELS = new URL('../src/lesson/levels.ts', import.meta.url);
const WEB_LEVELS = new URL('../../frontend/components/ohmlet/data/levels.ts', import.meta.url);
const MOBILE_RUN = new URL('../src/lesson/useRun.ts', import.meta.url);
const MOBILE_SCREEN = new URL('../src/app/lesson/[id].tsx', import.meta.url);
const MOBILE_COMPLETE = new URL('../src/components/LessonComplete.tsx', import.meta.url);

const MARKER = '// ── The rule (identical on both surfaces';

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

/** Everything from the shared-rule marker to the end of the file. */
function sharedHalf(url) {
  const src = readFileSync(url, 'utf8');
  const at = src.indexOf(MARKER);
  if (at < 0) throw new Error(`${url.pathname} has lost its shared-rule marker`);
  return src.slice(at);
}

/** Load levels.ts. Its only import is type-only, so transpiling elides it. */
function loadLevels(url) {
  const js = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  const forbid = (id) => {
    throw new Error(`levels.ts must have no runtime imports; it imported ${id}`);
  };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', js)(forbid, mod, mod.exports);
  return mod.exports;
}

const teach = (title) => ({ type: 'teach', title, body: 'x' });
const choice = (question, difficulty) => ({
  type: 'multiple_choice',
  question,
  options: ['right', 'wrong a', 'wrong b', 'wrong c'],
  correct: 0,
  explanation: 'because',
  ...(difficulty ? { difficulty } : {}),
});

console.log('lesson levels');

// ---------------------------------------------------------------------------
// 1. One rule, two files.

scenario('the web and the phone share one levelling rule', () => {
  assert.equal(
    sharedHalf(MOBILE_LEVELS),
    sharedHalf(WEB_LEVELS),
    'the levelling rule has drifted between\n' +
    '  frontend/components/ohmlet/data/levels.ts\n' +
    '  mobile/src/lesson/levels.ts\n' +
    'Everything from the marker down must stay identical.',
  );
});

const levels = loadLevels(MOBILE_LEVELS);

// ---------------------------------------------------------------------------
// 2. The ladder.

scenario('the ladder climbs to Gold and stops there', () => {
  assert.equal(levels.nextAttemptLevel(0), 1);
  assert.equal(levels.nextAttemptLevel(1), 2);
  assert.equal(levels.nextAttemptLevel(2), 3);
  assert.equal(levels.nextAttemptLevel(3), 3, 'Gold offered a fourth level');
  assert.equal(levels.MAX_LEVEL, 3);
});

scenario('all three medals are named and coloured', () => {
  assert.deepEqual(Object.keys(levels.LEVEL_META), ['1', '2', '3']);
  assert.equal(levels.LEVEL_META[1].name, 'Bronze');
  assert.equal(levels.LEVEL_META[2].name, 'Silver');
  assert.equal(levels.LEVEL_META[3].name, 'Gold');
  for (const tier of [1, 2, 3]) {
    assert.match(levels.LEVEL_META[tier].color, /^#[0-9a-f]{6}$/i);
    assert.match(levels.LEVEL_META[tier].soft, /^#[0-9a-f]{6}$/i);
  }
});

scenario('Bronze pays full price, Silver and Gold pay half, with a floor', () => {
  assert.equal(levels.xpForLevel(20, 1), 20);
  assert.equal(levels.xpForLevel(20, 2), 10);
  assert.equal(levels.xpForLevel(20, 3), 10);
  assert.equal(levels.xpForLevel(4, 2), 5, 'a cheap lesson paid less than the floor');
});

// ---------------------------------------------------------------------------
// 3. What each level plays. The served corpus is 7 to 10 steps a lesson, so the
//    small-lesson path is the one every real learner takes.

const small = [teach('what a loop is'), teach('what a switch does'), choice('q1'), choice('q2'), choice('q3')];

scenario('Bronze plays the lesson exactly as authored', () => {
  const run = levels.buildLeveledSteps(small, 1);
  assert.deepEqual(run, small, 'Bronze changed the authored lesson');
});

scenario('Silver and Gold drop the teaching and leave only recall', () => {
  for (const level of [2, 3]) {
    const run = levels.buildLeveledSteps(small, level);
    assert.equal(run.length, 3, `level ${level} kept ${run.length} steps, wanted the 3 graded ones`);
    assert.ok(run.every((s) => s.type !== 'teach'), `level ${level} still teaches`);
  }
});

scenario('a shuffled question still points at the right answer', () => {
  // Run it enough times that a broken remap cannot pass by luck.
  let moved = 0;
  for (let i = 0; i < 200; i += 1) {
    const run = levels.buildLeveledSteps(small, 2);
    for (const step of run) {
      assert.equal(step.options[step.correct], 'right', 'the correct index survived the shuffle pointing at a distractor');
      if (step.correct !== 0) moved += 1;
    }
  }
  assert.ok(moved > 0, 'options were never actually shuffled');
});

scenario('a metered or banded question is never shuffled', () => {
  // These are graded by their widget, and their single option holds the answer.
  const metered = [
    choice('a'), choice('b'),
    { type: 'predict_reading', question: 'read it', options: ['4.2 V'], correct: 0, explanation: 'x', meter: { unit: 'V' } },
    { type: 'choose_resistor', question: 'dial it', options: ['220R'], correct: 0, explanation: 'x', bands: { targetOhms: 220 } },
  ];
  for (let i = 0; i < 50; i += 1) {
    for (const step of levels.buildLeveledSteps(metered, 3)) {
      if (step.meter || step.bands) {
        assert.equal(step.options.length, 1);
        assert.equal(step.correct, 0, 'a widget-graded step had its answer index moved');
      }
    }
  }
});

scenario('a lesson with nothing to recall is left alone', () => {
  const thin = [teach('all there is'), choice('the only question')];
  assert.deepEqual(levels.buildLeveledSteps(thin, 3), thin, 'a one-question lesson was shuffled into a stub');
});

scenario('a deep pool draws a harder slice for a higher level', () => {
  const pool = [
    teach('intro'), teach('more'),
    ...Array.from({ length: 10 }, (_, i) => choice(`easy ${i}`, 1)),
    ...Array.from({ length: 10 }, (_, i) => choice(`mid ${i}`, 2)),
    ...Array.from({ length: 10 }, (_, i) => choice(`hard ${i}`, 3)),
  ];
  const tierOf = (s) => (s.question.startsWith('hard') ? 3 : s.question.startsWith('mid') ? 2 : 1);
  const meanTier = (level) => {
    const graded = levels.buildLeveledSteps(pool, level).filter((s) => s.type !== 'teach');
    assert.equal(graded.length, levels.RUN_SIZE, `level ${level} ran ${graded.length} questions, wanted ${levels.RUN_SIZE}`);
    return graded.reduce((n, s) => n + tierOf(s), 0) / graded.length;
  };
  const hardCount = (level) =>
    levels.buildLeveledSteps(pool, level).filter((s) => s.type !== 'teach' && tierOf(s) === 3).length;
  const bronze = meanTier(1);
  const gold = meanTier(3);
  assert.ok(gold > bronze, `Gold drew tier ${gold.toFixed(2)}, no harder than Bronze at ${bronze.toFixed(2)}`);
  // Ten hard questions and a fifteen question round: Gold must take all ten and
  // top up from the tier below, while Bronze fills up before it reaches any.
  assert.equal(hardCount(3), 10, `Gold left ${10 - hardCount(3)} of the hardest questions out`);
  assert.equal(hardCount(1), 0, 'Bronze reached into the hardest tier with easier questions left');
});

scenario('a drawing step is pinned into every round of a deep pool', () => {
  const pool = [
    { type: 'draw_circuit', instruction: 'draw it', expected: ['led'], hint: 'h', explanation: 'e' },
    ...Array.from({ length: 25 }, (_, i) => choice(`q ${i}`, 1)),
  ];
  for (const level of [1, 2, 3]) {
    const run = levels.buildLeveledSteps(pool, level);
    assert.ok(
      run.some((s) => s.type === 'draw_circuit'),
      `level ${level} dropped the drawing step, so a learner never meets the canvas`,
    );
  }
});

// ---------------------------------------------------------------------------
// 4. The phone must actually play the level, record it, and show it.

scenario('the phone builds its round for the level it is playing', () => {
  const src = readFileSync(MOBILE_RUN, 'utf8');
  assert.match(src, /buildLeveledSteps\(/, 'useRun no longer builds its steps for a level, so every round is Bronze');
  assert.match(src, /xpForLevel\(/, 'useRun no longer prices the round by level');
});

scenario('the phone records the level it ran at', () => {
  const src = readFileSync(MOBILE_SCREEN, 'utf8');
  assert.match(
    src,
    /applyCompletion\(current, String\(id\), run\.earnedXp, run\.level\)/,
    'the lesson screen dropped the level argument again, so a Gold round is filed as Bronze',
  );
  assert.match(
    src,
    /nextAttemptLevel\(held\)/,
    'the lesson screen no longer works out which level to attempt from the record',
  );
});

scenario('the phone shows the learner which medal they took', () => {
  const complete = readFileSync(MOBILE_COMPLETE, 'utf8');
  assert.match(complete, /LEVEL_META/, 'the completion screen no longer names the level');
  assert.match(complete, /paysXp/, 'the completion screen lost the honest reading of what a replay pays');
  const screen = readFileSync(MOBILE_SCREEN, 'utf8');
  assert.match(screen, /level=\{run\.level\}/, 'the completion screen is no longer told which level was played');
});

console.log('');
if (failures.length) {
  console.error(`lesson levels: ${failures.length} failure(s)\n`);
  failures.forEach((f) => console.error(`  ${f}\n`));
  process.exit(1);
}
console.log('lesson levels: every scenario passed.');
