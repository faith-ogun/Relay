// The slider's arithmetic, proved rather than eyeballed.
//
// Every reported slider defect has been arithmetic. The thumb was positioned at
// `left: frac%` with a negative margin, so at both ends half of it sat outside
// the control: "it's going behind the box, and it's going after the box". The
// touch was read through locationX, which re-bases when the finger crosses a
// child, so grabbing the thumb snapped the value to the minimum. Neither was
// visible in review. Both are trivially provable here.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'ohmlet-knob-'));
const load = async (abs, name) => {
  const js = ts.transpileModule(readFileSync(abs, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const f = join(dir, `${name}.mjs`);
  writeFileSync(f, js);
  return import(`file://${f}`);
};

const g = await load(resolve(here, '../src/components/sim/knobGeometry.ts'), 'geom');
const { LIVE_CIRCUITS } = await load(resolve(here, '../src/sim/circuits.ts'), 'circuits');

// Must match CircuitTab. Asserted below against the component itself.
const THUMB = 32;

let bad = 0;
const fail = (m) => { bad += 1; console.error(`  FAIL  ${m}`); };
const ok = (m) => console.log(`  ok    ${m}`);

// The constants in the component and the constants here must not drift.
{
  const raw = readFileSync(resolve(here, '../src/components/sim/CircuitTab.tsx'), 'utf8');
  // Strip comments first: this file EXPLAINS the old bugs, and matching the
  // explanation instead of the code is a false alarm that trains people to
  // ignore the check.
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const m = src.match(/const THUMB = (\d+)/);
  if (!m) fail('CircuitTab no longer declares THUMB');
  else if (Number(m[1]) !== THUMB) fail(`THUMB is ${m[1]} in CircuitTab but ${THUMB} here`);
  else ok(`thumb diameter agrees with the component (${THUMB}pt)`);
  // Scope this to the THUMB's own style. A negative margin is the correct way to
  // centre a tick label on its mark; on the thumb it is the bug that hung half
  // the knob outside the control.
  const thumbStyle = src.match(/\n\s*thumb:\s*\{[\s\S]*?\n\s*\},/);
  if (!thumbStyle) fail('cannot find the thumb style in CircuitTab');
  else if (/margin(Left|Horizontal|Right)?:\s*-/.test(thumbStyle[0])) {
    fail('the thumb style has a negative margin again, which is what pushed it outside the track');
  } else ok('no negative margin on the thumb');
  if (/left:\s*`\$\{[^}]*100\}%`/.test(src)) {
    fail('the thumb is positioned by percentage again; it must be positioned in points inside the travel');
  } else ok('thumb positioned in points, not percent');
  if (!/locationX/.test(src)) ok('no locationX in the slider');
  else fail('locationX is back in CircuitTab; it re-bases across child views');
}

// THE INVARIANT: the thumb never leaves the track, at any width, at any value.
for (const width of [180, 240, 320, 360, 420, 640, 32, 33]) {
  const travel = g.travelFor(width, THUMB);
  for (let i = 0; i <= 100; i += 1) {
    const left = g.thumbLeft(i / 100, width, THUMB);
    if (left < -0.001) { fail(`thumb left edge ${left} < 0 at width ${width}`); break; }
    if (left + THUMB > width + 0.001) {
      fail(`thumb right edge ${left + THUMB} exceeds track width ${width}`); break;
    }
    if (left > travel + 0.001) { fail(`thumb travelled past its travel at width ${width}`); break; }
  }
}
ok('thumb stays inside the track at every width and every value');

// Drawn position and touched position must agree, or the knob lags the finger.
for (const c of LIVE_CIRCUITS) {
  const { min, max, step } = c.control;
  const width = 320, originX = 24;
  let worst = 0;
  for (let i = 0; i <= 200; i += 1) {
    const frac = i / 200;
    // Where the thumb's centre is drawn for this fraction...
    const centre = originX + g.thumbLeft(frac, width, THUMB) + THUMB / 2;
    // ...and what a touch at exactly that point reads back as.
    const back = g.fracFromPageX(centre, originX, width, THUMB);
    worst = Math.max(worst, Math.abs(back - frac));
  }
  if (worst > 1e-9) fail(`${c.id}: touch and draw disagree by ${worst}`);
}
ok('a touch on the thumb reads back the value the thumb is drawn at');

// Both ends must be reachable, which is what "very hard to slide to the end" was.
for (const c of LIVE_CIRCUITS) {
  const { min, max, step } = c.control;
  const width = 320, originX = 24;
  const atLeft = g.valueFor(g.fracFromPageX(originX, originX, width, THUMB), min, max, step);
  const atRight = g.valueFor(g.fracFromPageX(originX + width, originX, width, THUMB), min, max, step);
  if (atLeft !== min) fail(`${c.id}: touching the left edge gives ${atLeft}, not ${min}`);
  if (atRight !== max) fail(`${c.id}: touching the right edge gives ${atRight}, not ${max}`);
  // And past the ends, because fingers overshoot.
  if (g.valueFor(g.fracFromPageX(originX - 60, originX, width, THUMB), min, max, step) !== min) {
    fail(`${c.id}: overshooting left does not clamp to ${min}`);
  }
  if (g.valueFor(g.fracFromPageX(originX + width + 60, originX, width, THUMB), min, max, step) !== max) {
    fail(`${c.id}: overshooting right does not clamp to ${max}`);
  }
}
ok('every circuit reaches both ends of its own range, and overshoot clamps');

// No value the slider can produce may fall off its own step grid.
for (const c of LIVE_CIRCUITS) {
  const { min, max, step } = c.control;
  for (let i = 0; i <= 500; i += 1) {
    const v = g.valueFor(i / 500, min, max, step);
    if (v < min || v > max) { fail(`${c.id}: produced ${v} outside ${min}..${max}`); break; }
    const off = Math.abs(v / step - Math.round(v / step));
    if (off > 1e-6 && v !== min && v !== max) { fail(`${c.id}: ${v} is not on its ${step} step grid`); break; }
  }
}
ok('every produced value is inside its range and on its own step grid');

// Each control must have enough steps to feel continuous, and few enough that
// one step is at least a pixel on a phone. "Barely moving" was partly this.
for (const c of LIVE_CIRCUITS) {
  const { min, max, step } = c.control;
  const steps = (max - min) / step;
  const pxPerStep = 320 / steps;
  // The LED slider is the one Faith calls perfect, and its step is 1 ohm over a
  // 4653 ohm range: effectively continuous, so it flows under the finger instead
  // of clicking between notches. That is the property, so hold every slider to
  // it rather than letting a coarse step make one feel dead.
  if (pxPerStep > 2.2) {
    fail(`${c.id}: ${steps} steps means ${pxPerStep.toFixed(1)}pt per step, notchy next to the LED slider's ${(320 / 4653).toFixed(2)}pt`);
  }
}
ok('every control tracks the finger continuously, like the LED one does');

// Ticks belong to their own circuit and must line up with reachable values.
for (const c of LIVE_CIRCUITS) {
  const t = c.control.ticks ?? [];
  if (t.length < 3) fail(`${c.id}: has ${t.length} labelled stops, a learner cannot tell where they are`);
  let prev = -Infinity;
  for (const tick of t) {
    if (tick.at < c.control.min || tick.at > c.control.max) {
      fail(`${c.id}: tick ${tick.at} is outside its own range ${c.control.min}..${c.control.max}`);
    }
    if (tick.at <= prev) fail(`${c.id}: ticks are not in ascending order at ${tick.at}`);
    prev = tick.at;
    const centre = g.tickCentre(tick.at, c.control.min, c.control.max, 320, THUMB);
    if (centre < THUMB / 2 - 0.001 || centre > 320 - THUMB / 2 + 0.001) {
      fail(`${c.id}: tick ${tick.at} would be drawn outside the track`);
    }
  }
  if (t.length && t[0].at !== c.control.min) fail(`${c.id}: first tick is not the minimum`);
  if (t.length && t[t.length - 1].at !== c.control.max) fail(`${c.id}: last tick is not the maximum`);

  // Overlapping labels are worse than no labels. Nunito Bold at 10pt runs about
  // 6.2pt per digit; the k and the point are narrower, so this over-estimates,
  // which is the safe direction for a collision check.
  const wide = (s) => s.length * 6.2;
  for (let i = 1; i < t.length; i += 1) {
    const a = g.tickCentre(t[i - 1].at, c.control.min, c.control.max, 320, THUMB);
    const b = g.tickCentre(t[i].at, c.control.min, c.control.max, 320, THUMB);
    const need = (wide(t[i - 1].label) + wide(t[i].label)) / 2 + 4;
    if (b - a < need) {
      fail(`${c.id}: labels "${t[i - 1].label}" and "${t[i].label}" are ${(b - a).toFixed(0)}pt apart and need ${need.toFixed(0)}pt`);
    }
  }
}
ok('every circuit labels its own scale, in order, inside the track');

// Each circuit's controls are its OWN. Sharing a range between two circuits is
// the thing Faith objected to: "why don't they just have their own?"
{
  const seen = new Map();
  for (const c of LIVE_CIRCUITS) {
    const key = `${c.control.min}:${c.control.max}:${c.control.step}`;
    if (seen.has(key)) fail(`${c.id} and ${seen.get(key)} share an identical control range; each circuit should pick its own`);
    seen.set(key, c.id);
  }
  ok('no two circuits share a control range');
}

console.log(bad === 0 ? '\nknob geometry: all checks passed' : `\nknob geometry: ${bad} failure(s)`);
process.exit(bad === 0 ? 0 : 1);
