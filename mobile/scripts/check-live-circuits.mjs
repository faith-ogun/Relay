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
// Tau is read off the netlist rather than hardcoded, so changing R or C moves
// the assertion with the circuit instead of breaking it.
const rc = LIVE_CIRCUITS.find((c) => c.id === 'rc');
if (rc) {
  const net = rc.build(rc.control.initial);
  const R = net.find((x) => x.kind === 'R').value;
  const C = net.find((x) => x.kind === 'C').value;
  const supply = net.find((x) => x.kind === 'V').value;
  const tau = R * C;
  const dt = tau / 100;
  const st = initTransient(net);
  const at = {};
  for (let i = 1; i <= 200; i += 1) at[i] = stepTransient(net, st, dt).V[2];
  const oneTau = at[100];
  if (!(oneTau > supply * 0.55 && oneTau < supply * 0.70)) {
    fail(`RC: after one time constant (${tau.toFixed(3)}s) the capacitor reads ${oneTau.toFixed(2)}V, expected roughly ${(supply * 0.632).toFixed(2)}V`);
  } else if (!(at[10] < at[100] && at[100] < at[200])) {
    fail('RC: the voltage is not rising monotonically, so it is not charging');
  } else {
    console.log(`  ok    RC charges on a real curve: tau=${tau.toFixed(2)}s, ${at[10].toFixed(2)}V, ${at[100].toFixed(2)}V at one tau, ${at[200].toFixed(2)}V`);
  }

  // The control changes the TIME, and the time is the only thing it changes, so
  // the fill must be visibly slower at the top of the travel than at the bottom
  // and both must be watchable rather than instant or interminable.
  const secondsToFull = (r) => {
    const n = rc.build(r);
    const s2 = initTransient(n);
    const step = (r * C) / 50;
    let t = 0;
    for (let i = 0; i < 20000; i += 1) {
      const v = stepTransient(n, s2, step).V[2];
      t += step;
      if (v >= supply * 0.99) return t;
    }
    return Infinity;
  };
  const fast = secondsToFull(rc.control.min);
  const slow = secondsToFull(rc.control.max);
  if (!(fast >= 0.15)) fail(`RC: fills in ${fast.toFixed(2)}s at the fast end, too quick to watch`);
  if (!(slow <= 8)) fail(`RC: takes ${slow.toFixed(1)}s at the slow end, nobody waits that long`);
  if (!(slow / fast >= 3)) fail(`RC: only ${(slow / fast).toFixed(1)}x between the ends, the knob will not feel like it does anything`);
  else console.log(`  ok    RC fill time answers to the knob: ${fast.toFixed(2)}s at ${rc.control.min}Ω to ${slow.toFixed(2)}s at ${rc.control.max}Ω`);
}

// THE ONE THAT MATTERS. A slider whose readout does not change is a slider the
// learner believes is broken, and they are right to. Before this check the RC
// circuit showed 5.00V and 0.00mA at every position on its travel, because the
// settled state of an RC circuit does not depend on R at all, and the transistor
// showed a flat 12.24mA across the whole saturated third. Both looked frozen.
//
// So sample what the learner ACTUALLY SEES, which is the state banner, the lead
// reading, the derived rows and the instrument rows together, and require that
// it keeps changing across the travel.
const before1 = bad;
for (const c of LIVE_CIRCUITS) {
  const N = 41;
  const seen = new Set();
  const settle = (net) => {
    if (!c.transient) return solve(net);
    const st = initTransient(net);
    let r;
    for (let i = 0; i < 600; i += 1) r = stepTransient(net, st, 0.005);
    return r;
  };
  for (let i = 0; i < N; i += 1) {
    const v = c.control.min + ((c.control.max - c.control.min) * i) / (N - 1);
    const snapped = Math.min(c.control.max, Math.max(c.control.min, Math.round(v / c.control.step) * c.control.step));
    const r = settle(c.build(snapped));
    const st = c.state ? c.state(snapped, r) : null;
    const dv = (c.derive ? c.derive(snapped, r) : []).map((d) => `${d.label}=${d.value}`).join('|');
    const rows = [
      ...c.probes.map((p) => (r.V[p.node] ?? 0).toFixed(2)),
      ...c.currents.map((x) => (Math.abs(r.I[x.id] ?? 0) * 1000).toFixed(2)),
    ].join(',');
    seen.add(`${st ? st.title + st.body : ''}~${dv}~${rows}`);
  }
  const pct = (seen.size / N) * 100;
  if (seen.size < N * 0.85) {
    fail(`${c.id}: only ${seen.size}/${N} positions on this slider show the learner anything different (${pct.toFixed(0)}%). The knob will look broken.`);
  }
}
if (bad === before1) console.log('  ok    every slider changes what is on screen across at least 85% of its own travel');

// Each circuit must speak for itself rather than share one generic readout.
const before2 = bad;
for (const c of LIVE_CIRCUITS) {
  if (!c.state) fail(`${c.id}: has no state verdict, so a flat stretch of its travel reads as the app being stuck`);
  if (!c.derive) fail(`${c.id}: has no derived reading of its own`);
  if (!c.control.ticks || c.control.ticks.length < 3) fail(`${c.id}: does not label its own scale`);
}
if (bad === before2) console.log('  ok    every circuit brings its own verdict, its own reading and its own labelled scale');

rmSync(dir, { recursive: true, force: true });
if (bad) { console.error(`\n${bad} problem(s)`); process.exit(1); }
console.log('live circuits: all good.');
