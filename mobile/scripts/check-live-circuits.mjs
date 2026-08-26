// Every circuit the Circuit tab offers, driven at both ends of its knob.
//
// This exists because the tab claims its numbers are solved rather than drawn.
// If a circuit throws, returns NaN, or reads outside its own supply rails, a
// learner sees a confident-looking lie. Cheap to check, and impossible to eyeball
// once there are five circuits with a continuous control each.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const SIM = resolve(here, '../src/sim');
const dir = mkdtempSync(join(tmpdir(), 'ohmlet-circ-'));

const load = async (file, name) => {
  const src = readFileSync(join(SIM, file), 'utf8').replace(/from '\.\/engine'/, "from './engine.mjs'");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const f = join(dir, `${name}.mjs`);
  writeFileSync(f, js);
  return import(`file://${f}`);
};

const engine = await load('engine.ts', 'engine');
const { LIVE_CIRCUITS } = await load('circuits.ts', 'circuits');
const { solve, initTransient, stepTransient } = engine;

const mA = (a) => (a ?? 0) * 1000;
let bad = 0;
const fail = (m) => { bad += 1; console.error(`  FAIL  ${m}`); };

for (const c of LIVE_CIRCUITS) {
  for (const v of [c.control.min, c.control.initial, c.control.max]) {
    const net = c.build(v);
    try {
      let r;
      if (c.transient) {
        const st = initTransient(net);
        for (let i = 0; i < 1000; i += 1) r = stepTransient(net, st, 0.005);
      } else {
        r = solve(net);
      }
      for (const p of c.probes) {
        const V = r.V[p.node];
        if (!Number.isFinite(V)) fail(`${c.id} @ ${v}: ${p.label} is ${V}`);
        else if (V < -0.5 || V > 12) fail(`${c.id} @ ${v}: ${p.label} = ${V.toFixed(2)}V, outside any rail in this circuit`);
      }
      for (const x of c.currents) {
        const I = r.I[x.id];
        if (I !== undefined && !Number.isFinite(I)) fail(`${c.id} @ ${v}: ${x.label} is ${I}`);
      }
    } catch (e) {
      fail(`${c.id} @ ${v} threw: ${e.message}`);
    }
  }
}
console.log(`  ok    all ${LIVE_CIRCUITS.length} circuits solve at both ends of their control, no NaN, no reading outside its rails`);

for (const c of LIVE_CIRCUITS.filter((x) => !x.transient)) {
  const lo = solve(c.build(c.control.min));
  const hi = solve(c.build(c.control.max));
  const moved = c.currents.some((x) => Math.abs(mA(lo.I[x.id]) - mA(hi.I[x.id])) > 0.05);
  if (!moved) fail(`${c.id}: nothing measurable changes across the whole control range`);
}
console.log('  ok    every control moves at least one reading');

// The parallel circuit teaches independence, so branch 1 must NOT move when
// branch 2 does. That is the lesson, and an engine change that broke it would
// otherwise look like a passing test.
const par = LIVE_CIRCUITS.find((c) => c.id === 'parallel');
if (par) {
  const a = solve(par.build(par.control.min));
  const b = solve(par.build(par.control.max));
  const drift = Math.abs(mA(a.I.r1) - mA(b.I.r1));
  const other = Math.abs(mA(a.I.r2) - mA(b.I.r2));
  if (drift > 0.01) fail(`parallel: branch 1 moved ${drift.toFixed(3)}mA when branch 2 changed, which is not what parallel means`);
  else if (other < 1) fail('parallel: branch 2 barely moved, so the control does nothing');
  else console.log(`  ok    parallel independence holds: branch 2 moves ${other.toFixed(1)}mA, branch 1 moves ${drift.toFixed(4)}mA`);
}

// RC has to be a CURVE, not a step. One time constant should land near 63.2%.
const rc = LIVE_CIRCUITS.find((c) => c.id === 'rc');
if (rc) {
  const net = rc.build(rc.control.initial);
  const st = initTransient(net);
  const at = {};
  for (let i = 1; i <= 200; i += 1) at[i] = stepTransient(net, st, 0.001).V[2];
  const oneTau = at[100];
  if (!(oneTau > 5 * 0.55 && oneTau < 5 * 0.70)) {
    fail(`RC: after one time constant the capacitor reads ${oneTau.toFixed(2)}V, expected roughly ${(5 * 0.632).toFixed(2)}V`);
  } else if (!(at[10] < at[100] && at[100] < at[200])) {
    fail('RC: the voltage is not rising monotonically, so it is not charging');
  } else {
    console.log(`  ok    RC charges on a real curve: ${at[10].toFixed(2)}V, ${at[100].toFixed(2)}V at one tau, ${at[200].toFixed(2)}V`);
  }
}

rmSync(dir, { recursive: true, force: true });
if (bad) { console.error(`\n${bad} problem(s)`); process.exit(1); }
console.log('live circuits: all good.');
