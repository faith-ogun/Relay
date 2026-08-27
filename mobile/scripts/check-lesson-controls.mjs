// The two interactive controls behind 200 exercises, proved against the real
// corpus rather than eyeballed.
//
// These steps used to render as a single button printing their own answer, so
// the controls are new and nothing has ever exercised them. A resistor decoder
// that is subtly wrong is worse than no decoder: it teaches the colour code
// incorrectly to someone who has no way to know, and 45 steps in the shipped
// curriculum grade against it.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const LESSONS = '/Users/faith/Desktop/Ohmlet/backend/live-bridge/app/curriculum_data/lessons.json';
const dir = mkdtempSync(join(tmpdir(), 'ohmlet-controls-'));

const load = async (rel, name) => {
  const js = ts.transpileModule(readFileSync(resolve(here, '..', rel), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const f = join(dir, `${name}.mjs`);
  writeFileSync(f, js);
  return import(`file://${f}`);
};

const rc = await load('src/lesson/resistorCode.ts', 'rc');
const ms = await load('src/lesson/meterScale.ts', 'ms');
const lessons = JSON.parse(readFileSync(LESSONS, 'utf8')).lessons;

let bad = 0;
const fail = (m) => { bad += 1; console.error(`  FAIL  ${m}`); };
const ok = (m) => console.log(`  ok    ${m}`);

// Collect the real specs the curriculum ships.
const bandTargets = new Set();
const meters = [];
for (const [lessonId, lesson] of Object.entries(lessons)) {
  for (const s of lesson.steps ?? []) {
    if (s.bands?.targetOhms !== undefined) bandTargets.add(s.bands.targetOhms);
    if (s.meter) meters.push({ lessonId, m: s.meter });
  }
}

// ── The resistor colour code ─────────────────────────────────────────────────
//
// Hand-checked anchors first. If these drift, the decoder is wrong in a way no
// round-trip test would catch, because a self-consistent wrong code round-trips
// perfectly.
{
  const before = bad;
  const KNOWN = {
    100: ['brown', 'black', 'brown'],
    220: ['red', 'red', 'brown'],
    470: ['yellow', 'violet', 'brown'],
    1000: ['brown', 'black', 'red'],
    4700: ['yellow', 'violet', 'red'],
    10000: ['brown', 'black', 'orange'],
    100000: ['brown', 'black', 'yellow'],
  };
  const nameOf = (i) => rc.BAND_COLOURS[i]?.name ?? String(rc.BAND_COLOURS[i] ?? i);
  for (const [ohms, want] of Object.entries(KNOWN)) {
    const got = (rc.encodeOhms(Number(ohms)) ?? []).map(nameOf);
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      fail(`${ohms} ohms encodes to ${JSON.stringify(got)}, but the real colour code is ${JSON.stringify(want)}`);
    }
  }
  if (bad === before) ok(`the colour code matches a real resistor on ${Object.keys(KNOWN).length} hand-checked values`);
}

// Every target the curriculum actually asks for must be reachable and gradeable.
{
  const before = bad;
  for (const t of [...bandTargets].sort((a, b) => a - b)) {
    const b = rc.encodeOhms(t);
    if (!b) { fail(`${t} ohms is asked for by the curriculum and cannot be set on the bands at all`); continue; }
    const back = rc.decodeBands(b);
    if (back !== t) fail(`${t} ohms encodes to ${JSON.stringify(b)} which decodes back as ${back}`);
  }
  if (bad === before) ok(`all ${bandTargets.size} band targets in the curriculum are settable and grade correctly`);
}

// And every position the learner can turn the bands to must read out correctly,
// because the decoded value is shown live and IS the lesson.
{
  const before = bad;
  let checked = 0;
  const mult = rc.MULTIPLIER_MAX ?? 7;
  for (let a = 0; a < 10; a += 1) {
    for (let b = 0; b < 10; b += 1) {
      for (let m = 0; m <= mult; m += 1) {
        const expect = (a * 10 + b) * 10 ** m;
        const got = rc.decodeBands([a, b, m]);
        checked += 1;
        if (got !== expect) { fail(`bands [${a},${b},${m}] read as ${got}, the real code says ${expect}`); m = mult; b = 10; a = 10; }
      }
    }
  }
  if (bad === before) ok(`all ${checked} band positions a learner can set read out correctly`);
}

// ── The meter ────────────────────────────────────────────────────────────────
{
  const before = bad;
  for (const { lessonId, m } of meters) {
    if (!(m.max > m.min)) { fail(`"${lessonId}": meter range ${m.min}..${m.max} is empty`); continue; }
    if (m.target < m.min || m.target > m.max) {
      fail(`"${lessonId}": the answer ${m.target} is outside the dial's own range ${m.min}..${m.max}, so it cannot be reached`);
      continue;
    }
    // The target must be landable on the dial's step grid, or the learner can
    // sweep the whole range and never be marked right.
    const step = ms.meterStep(m);
    const positions = ms.meterPositions(m);
    if (!(positions >= 10)) fail(`"${lessonId}": the dial has ${positions} positions, too coarse to be a question`);
    let reachable = false;
    for (let i = 0; i <= positions; i += 1) {
      if (ms.withinTolerance(m.min + i * step, m)) { reachable = true; break; }
    }
    if (!reachable) fail(`"${lessonId}": no position on the dial grades as correct (target ${m.target}, tolerance ${m.tolerance}, step ${step})`);
    // And a value well outside tolerance must NOT grade correct, or the step
    // accepts anything.
    const far = m.target + (m.max - m.min);
    if (ms.withinTolerance(Math.min(far, m.max + 1), m) && (m.max + 1) - m.target > (m.tolerance ?? 0)) {
      fail(`"${lessonId}": a reading far outside tolerance still grades as correct`);
    }
  }
  if (bad === before) ok(`all ${meters.length} meter steps have a reachable, gradeable answer inside their own range`);
}

console.log(bad === 0 ? '\nlesson controls: all checks passed' : `\nlesson controls: ${bad} failure(s)`);
process.exit(bad === 0 ? 0 : 1);
