// The mobile and web circuit engines must agree exactly.
//
// They are the same file, copied. That is deliberate: the physics has no
// business differing between a phone and a browser. But a copy drifts the
// moment someone fixes a bug in one and forgets the other, and the failure is
// silent and awful — the same circuit teaches two different lessons depending
// on which surface a learner opened.
//
// This runs real netlists through BOTH and asserts identical numbers.
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// TypeScript is a mobile devDependency; esbuild is not. Using tsc's own
// transpiler keeps this script runnable from the mobile package with no
// extra install, which is what makes it viable as a build gate.
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const MOBILE = resolve(here, '../src/sim/engine.ts');
const WEB = resolve(here, '../../frontend/components/ohmlet/sim/engine.ts');

async function load(tsPath, dir, name) {
  const js = ts.transpileModule(readFileSync(tsPath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const file = join(dir, `${name}.mjs`);
  writeFileSync(file, js);
  return import(`file://${file}`);
}

const dir = mkdtempSync(join(tmpdir(), 'ohmlet-engine-'));
const [m, w] = await Promise.all([load(MOBILE, dir, 'mobile'), load(WEB, dir, 'web')]);

// Real circuits from the curriculum, not toy cases.
const CASES = {
  'series LED with 220R on 9V': [
    { kind: 'V', id: 'bat', pos: 1, neg: 0, value: 9 },
    { kind: 'R', id: 'r1', a: 1, b: 2, value: 220 },
    { kind: 'LED', id: 'led', anode: 2, cathode: 0 },
  ],
  'LED with no current limiting': [
    { kind: 'V', id: 'bat', pos: 1, neg: 0, value: 9 },
    { kind: 'LED', id: 'led', anode: 1, cathode: 0 },
  ],
  'reversed LED blocks': [
    { kind: 'V', id: 'bat', pos: 1, neg: 0, value: 9 },
    { kind: 'R', id: 'r1', a: 1, b: 2, value: 220 },
    { kind: 'LED', id: 'led', anode: 0, cathode: 2 },
  ],
  'voltage divider 10k/10k on 5V': [
    { kind: 'V', id: 'src', pos: 1, neg: 0, value: 5 },
    { kind: 'R', id: 'r1', a: 1, b: 2, value: 10000 },
    { kind: 'R', id: 'r2', a: 2, b: 0, value: 10000 },
  ],
  'parallel resistors': [
    { kind: 'V', id: 'src', pos: 1, neg: 0, value: 9 },
    { kind: 'R', id: 'r1', a: 1, b: 0, value: 1000 },
    { kind: 'R', id: 'r2', a: 1, b: 0, value: 2000 },
  ],
  'NPN switch driving an LED': [
    { kind: 'V', id: 'vcc', pos: 1, neg: 0, value: 5 },
    { kind: 'V', id: 'sig', pos: 4, neg: 0, value: 5 },
    { kind: 'R', id: 'rb', a: 4, b: 3, value: 10000 },
    { kind: 'R', id: 'rc', a: 1, b: 2, value: 220 },
    { kind: 'LED', id: 'led', anode: 2, cathode: 5 },
    { kind: 'Q', id: 'q1', base: 3, collector: 5, emitter: 0 },
  ],
};

const round = (n) => Math.round(n * 1e6) / 1e6;
const norm = (r) => ({
  V: Object.fromEntries(Object.entries(r.V).map(([k, v]) => [k, round(v)])),
  I: Object.fromEntries(Object.entries(r.I ?? {}).map(([k, v]) => [k, round(v)])),
});

let failed = 0;
console.log('circuit engine: mobile vs web');
for (const [name, netlist] of Object.entries(CASES)) {
  const a = norm(m.solve(netlist));
  const b = norm(w.solve(netlist));
  const same = JSON.stringify(a) === JSON.stringify(b);
  if (!same) {
    failed += 1;
    console.error(`  DRIFT  ${name}`);
    console.error(`     mobile ${JSON.stringify(a)}`);
    console.error(`     web    ${JSON.stringify(b)}`);
  } else {
    console.log(`  ok     ${name}`);
  }
}

// Transient too: an RC charging curve must match step for step.
const rc = [
  { kind: 'V', id: 'src', pos: 1, neg: 0, value: 5 },
  { kind: 'R', id: 'r', a: 1, b: 2, value: 10000 },
  { kind: 'C', id: 'c', a: 2, b: 0, value: 1e-5 },
];
let sa = m.initTransient(rc), sb = w.initTransient(rc);
let drifted = false;
for (let i = 0; i < 200; i += 1) {
  const ra = m.stepTransient(rc, sa, 0.001);
  const rb = w.stepTransient(rc, sb, 0.001);
  if (round(ra.V[2]) !== round(rb.V[2])) { drifted = true; break; }
}
if (drifted) { failed += 1; console.error('  DRIFT  RC transient diverges'); }
else console.log('  ok     RC transient, 200 steps');

// And a sanity check that the physics is RIGHT, not merely consistent.
// Tolerance is 1mV, not machine epsilon. MNA regularises the conductance
// matrix to keep it non-singular, which lands this divider 12.5uV below the
// ideal 2.5V. That is four orders of magnitude below anything a learner could
// measure with a multimeter, and tightening the assertion would only make the
// check fail on correct physics.
const div = m.solve(CASES['voltage divider 10k/10k on 5V']);
if (Math.abs(div.V[2] - 2.5) > 1e-3) {
  failed += 1;
  console.error(`  WRONG  a 10k/10k divider on 5V should read 2.5V, got ${div.V[2]}`);
} else console.log(`  ok     divider midpoint reads ${div.V[2].toFixed(4)}V (physics, not just agreement)`);

// Ohm's law end to end, on the circuit the curriculum opens with.
const series = m.solve(CASES['series LED with 220R on 9V']);
const mA = (series.I.r1 ?? 0) * 1000;
if (!(mA > 5 && mA < 40)) {
  failed += 1;
  console.error(`  WRONG  a 9V supply through 220R into an LED should pass roughly 10-35mA, got ${mA.toFixed(1)}mA`);
} else console.log(`  ok     series LED draws ${mA.toFixed(1)}mA, which is a real LED current`);

rmSync(dir, { recursive: true, force: true });
if (failed) { console.error(`\n${failed} problem(s)`); process.exit(1); }
console.log('circuit engine: mobile and web agree.');
