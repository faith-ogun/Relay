// The free-form circuit builder must build the netlist it looks like it built,
// and must be honest about the circuits that do not work.
//
// The builder's failure modes are arithmetic and topological, not visual: a
// battery whose two pins land on the same node, a part wired at one end only,
// an LED past its rated current, a capacitor that blocks DC. None of those need
// a screen to check, and none of them are visible in a screenshot either, which
// is exactly why they need a script.
//
// This drives src/components/sim/circuitModel.ts headlessly through the same
// calls the component makes when a thumb taps the canvas: place a part, join two
// pins, set a value, solve. Then it asserts the numbers, which come out of the
// real engine, against hand-worked answers.
//
//   node scripts/check-circuit-builder.mjs

import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as pathJoin, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
// TypeScript is a devDependency here and esbuild is not, so tsc's own
// transpiler keeps this runnable straight from the mobile package.
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dir = mkdtempSync(pathJoin(tmpdir(), 'ohmlet-builder-'));

/**
 * Transpile one source file into the temp tree at the same relative path.
 *
 * The relative import specifiers have to grow a .mjs extension on the way out:
 * TypeScript writes `from '../../sim/engine'`, and Node's ESM loader will not
 * guess an extension.
 */
function emit(relPath) {
  const js = ts.transpileModule(readFileSync(pathJoin(root, relPath), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/(from\s*|import\s*\()(['"])(\.[^'"]+)\2/g, (_, pre, q, spec) => `${pre}${q}${spec}.mjs${q}`);
  const out = pathJoin(dir, relPath.replace(/\.ts$/, '.mjs'));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, js);
  return out;
}

emit('src/sim/engine.ts');
const modelPath = emit('src/components/sim/circuitModel.ts');
const M = await import(`file://${modelPath}`);

// A canvas the size of an iPhone content column, so slot placement is exercised
// against the real geometry rather than a convenient made up one.
const W = 342;
const H = 420;

let checks = 0;
const near = (actual, expected, tol, what) => {
  checks++;
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tol,
    `${what}: expected ${expected} +/- ${tol}, got ${actual}`,
  );
};
const is = (actual, expected, what) => { checks++; assert.equal(actual, expected, what); };
const ok = (cond, what) => { checks++; assert.ok(cond, what); };

const codes = (analysis) => analysis.findings.map((f) => f.code);
const readOf = (analysis, id) => analysis.readouts.find((r) => r.id === id);

/** Place parts by kind the way the palette does, and hand back their ids. */
function bench(kinds) {
  let snap = M.EMPTY;
  const ids = [];
  for (const k of kinds) {
    const r = M.addPart(snap, k, W, H);
    snap = r.snap;
    ids.push(r.id);
  }
  return { snap, ids };
}

/** Join two pins, failing loudly if the model refused, which a test never wants silently. */
function join(snap, a, ai, b, bi) {
  const next = M.connect(snap, M.pinRef(a, ai), M.pinRef(b, bi));
  assert.ok(next, `connect ${a}#${ai} to ${b}#${bi} was refused`);
  return next;
}

// ── 1. The flagship circuit: 5 V, 220 ohm, red LED in series ──
//
// Worked by hand from the engine's own LED model, a 2.0 V forward drop in
// series with 15 ohms:  I = (5 - 2) / (220 + 15) = 12.77 mA.
//
// The defaults matter as much as the arithmetic. 9 V through 220 ohms is
// 29.8 mA, past a red LED's 25 mA absolute maximum, so a learner's very first
// circuit would have opened on a warning. 5 V is the rail the Starter Kit runs
// on and it is the pairing every beginner tutorial teaches.
{
  let { snap, ids } = bench(['battery', 'resistor', 'led']);
  const [bat, r1, led] = ids;
  is(bat, 'BAT1', 'first battery is BAT1');
  is(r1, 'R1', 'first resistor is R1');
  is(led, 'LED1', 'first LED is LED1');

  snap = join(snap, bat, 0, r1, 0);
  snap = join(snap, r1, 1, led, 0);
  snap = join(snap, led, 1, bat, 1);

  const a = M.analyse(snap);
  ok(a.solved, 'series LED circuit solves');
  is(a.netlist.length, 3, 'three components reach the engine');
  is(a.build.nodes.length, 3, 'three electrical nodes: +9, the junction, and ground');
  is(a.build.nodeOf[M.pinRef(bat, 1)], 0, "the battery's negative pin is ground");

  near(readOf(a, led).amps * 1000, 12.77, 0.05, 'LED current in mA');
  near(readOf(a, r1).amps * 1000, 12.77, 0.05, 'resistor current in mA');
  near(readOf(a, bat).amps * 1000, 12.77, 0.05, 'battery delivers the same current');
  ok(readOf(a, bat).amps > 0, 'a delivering battery reads positive, not negative');
  near(readOf(a, r1).volts, 2.81, 0.02, 'resistor drop, 12.77 mA through 220 ohms');
  near(readOf(a, led).volts, 2.19, 0.02, 'LED drop, 2 V plus 12.77 mA through 15 ohms');
  near(readOf(a, led).brightness, 0.638, 0.01, 'brightness is the solved current against a 20 mA rating');
  is(readOf(a, led).state, 'Lit', 'LED reads as lit');
  near(readOf(a, bat).watts, 0.0638, 0.002, 'battery power, 5 V times 12.77 mA');
  is(readOf(a, bat).valueText, '5 V', 'a part label carries the nominal value, not a measurement');

  is(a.verdict.code, 'running', 'a working circuit reports as running');
  is(a.verdict.severity, 'ok', 'and at ok severity');
  is(codes(a).length, 1, 'a working circuit raises nothing else');

  // Changing the resistor must change the current, because Ohm's law says so
  // and nothing here is scripted.  I = (5 - 2) / (1000 + 15) = 2.96 mA.
  const turned = M.analyse(M.setValue(snap, r1, 1000));
  near(readOf(turned, led).amps * 1000, 2.96, 0.05, 'LED current after turning the resistor up to 1k');
  near(readOf(turned, led).brightness, 0.148, 0.01, 'and brightness follows the solved current');
  is(readOf(turned, led).state, 'Dim', 'a few milliamps is dim, not lit');

  // And turning it down until the LED is past its limit must say so.
  const hot = M.analyse(M.setValue(snap, r1, 47));
  ok(codes(hot).includes('led-overcurrent'), 'a 47 ohm resistor on 5 V overdrives the LED');

  // The example the builder opens on is this same circuit, already wired.
  const ex = M.analyse(M.exampleCircuit(W, H));
  is(ex.verdict.code, 'running', 'the built in example is a working circuit');
  near(readOf(ex, 'LED1').amps * 1000, 12.77, 0.05, 'and solves to the same current');
}

// ── 2. Voltage divider: two 10k resistors across 5 V ──
{
  let { snap, ids } = bench(['battery', 'resistor', 'resistor']);
  const [bat, top, bottom] = ids;
  snap = M.setValue(snap, bat, 5);
  snap = M.setValue(snap, top, 10000);
  snap = M.setValue(snap, bottom, 10000);
  snap = join(snap, bat, 0, top, 0);
  snap = join(snap, top, 1, bottom, 0);
  snap = join(snap, bottom, 1, bat, 1);

  const a = M.analyse(snap);
  ok(a.solved, 'divider solves');
  const mid = a.build.nodeOf[M.pinRef(top, 1)];
  near(a.nodeVolts[mid], 2.5, 1e-3, 'the midpoint of a matched divider sits at half the supply');
  near(readOf(a, top).amps * 1000, 0.25, 1e-3, 'divider current, 5 V over 20k');
  is(M.fmtVolts(a.nodeVolts[mid]), '2.50 V', 'and it formats as an instrument would');

  // A tenth of the bottom leg pulls the midpoint down to 5 * 1k/11k = 0.4545 V.
  const loaded = M.analyse(M.setValue(snap, bottom, 1000));
  near(loaded.nodeVolts[loaded.build.nodeOf[M.pinRef(top, 1)]], 0.4545, 1e-3, 'divider midpoint after loading the bottom leg');
}

// ── 3. Degenerate: a battery shorted by a wire ──
//
// The two pins land on one node, which gives the solver a row that says
// V - V = 9. There is no answer, and the engine says so. What matters is that
// the builder names the cause rather than reporting a solver failure.
{
  let { snap, ids } = bench(['battery']);
  const [bat] = ids;
  snap = join(snap, bat, 0, bat, 1);

  const a = M.analyse(snap);
  is(a.build.nodeOf[M.pinRef(bat, 0)], a.build.nodeOf[M.pinRef(bat, 1)], 'both pins are the same node');
  is(a.solved, false, 'and the circuit does not solve');
  is(a.verdict.code, 'shorted-source', 'the verdict names the short');
  is(a.verdict.severity, 'danger', 'at danger severity');
  ok(a.verdict.title.includes('BAT1'), 'and names the battery');
  ok(!codes(a).includes('unsolvable'), 'the generic unsolvable finding is suppressed once the real cause is known');
  is(readOf(a, bat).amps, null, 'no current is reported, because none is known');
  is(M.fmtAmps(readOf(a, bat).amps), 'unknown', 'and an unknown value is never printed as zero');

  // Joining two pins that are already the same node is a no-op, not a
  // duplicate wire that quietly does nothing.
  is(M.connect(snap, M.pinRef(bat, 0), M.pinRef(bat, 1)), null, 'a redundant wire is refused');
  is(M.connect(snap, M.pinRef(bat, 0), M.pinRef(bat, 0)), null, 'a pin cannot be wired to itself');
}

// ── 4. Degenerate: a battery shorted through a closed switch ──
//
// This one DOES solve, which makes it the more dangerous of the two: the
// numbers look like numbers. 5 V across 0.02 ohms of contact resistance is
// 250 amps, and the builder has to call that what it is.
{
  let { snap, ids } = bench(['battery', 'switch']);
  const [bat, sw] = ids;
  snap = join(snap, bat, 0, sw, 0);
  snap = join(snap, sw, 1, bat, 1);

  const a = M.analyse(snap);
  ok(a.solved, 'a short through contact resistance still solves');
  near(readOf(a, bat).amps, 250, 1, 'and the battery is asked for 250 A');
  is(a.verdict.code, 'source-overcurrent', 'which is reported as a short');
  is(a.verdict.severity, 'danger', 'at danger severity');
  ok(a.verdict.title.includes('250'), 'with the real number in the headline');

  // Opening the switch is a tap, and it must stop the short dead.
  const opened = M.analyse(M.toggleSwitch(snap, sw));
  ok(Math.abs(readOf(opened, bat).amps) < 1e-5, 'an open switch stops the current');
  ok(codes(opened).includes('switch-open'), 'and the open switch is called out');
  ok(!codes(opened).includes('source-overcurrent'), 'the short is gone');
}

// ── 5. Degenerate: parts wired at one end, or not at all ──
{
  // A resistor on the board on its own, with nothing else.
  const alone = M.analyse(bench(['resistor']).snap);
  ok(codes(alone).includes('no-source'), 'no battery is called out');
  ok(codes(alone).includes('floating'), 'and so is a part wired to nothing');
  is(readOf(alone, 'R1').pinsWired, 0, 'neither pin is wired');

  // A battery and a resistor joined at one end only: a dead end, no loop.
  let { snap, ids } = bench(['battery', 'resistor']);
  const [bat, r1] = ids;
  snap = join(snap, bat, 0, r1, 0);

  const a = M.analyse(snap);
  ok(a.solved, 'a dead end still solves, it just carries nothing');
  is(readOf(a, r1).pinsWired, 1, 'the resistor is wired at one pin');
  ok(codes(a).includes('dangling'), 'and that is reported');
  ok(codes(a).includes('open-loop'), 'along with the battery having no way back');
  ok(Math.abs(readOf(a, r1).amps) < 1e-6, 'nothing flows through a dead end');

  // Closing the loop clears both findings and current appears.
  const closed = M.analyse(join(snap, r1, 1, bat, 1));
  is(closed.verdict.code, 'running', 'closing the loop clears it');
  near(readOf(closed, r1).amps * 1000, 22.7, 0.1, '5 V over 220 ohms is 22.7 mA');
}

// ── 6. An LED with no resistor, and an LED in backwards ──
{
  let { snap, ids } = bench(['battery', 'led']);
  const [bat, led] = ids;
  snap = join(snap, bat, 0, led, 0);
  snap = join(snap, led, 1, bat, 1);

  const a = M.analyse(snap);
  // (5 - 2) / 15 ohms of LED on-resistance = 200 mA, eight times its rating.
  near(readOf(a, led).amps * 1000, 200, 1, 'an unlimited LED pulls far too much');
  ok(codes(a).includes('led-overcurrent'), 'and that is the warning');
  ok(a.findings.find((f) => f.code === 'led-overcurrent').detail.includes('resistor'), 'the fix is named');

  // Same circuit with the LED the other way round: it blocks.
  let back = bench(['battery', 'led']).snap;
  back = join(back, 'BAT1', 0, 'LED1', 1);
  back = join(back, 'LED1', 0, 'BAT1', 1);
  const b = M.analyse(back);
  ok(Math.abs(readOf(b, 'LED1').amps) < 1e-6, 'a reversed LED passes nothing');
  is(readOf(b, 'LED1').brightness, 0, 'and is dark');
  ok(codes(b).includes('led-reverse'), 'and the builder says it is in backwards');
}

// ── 7. A transistor switching an LED ──
//
// 10k from the supply into the base gives Ib = (5 - 0.7) / 10040 = 0.43 mA,
// so the part can pass up to beta * Ib = 43 mA. The collector leg only wants
// (5 - 2) / (220 + 15 + 10) = 12.2 mA, so it saturates.
{
  let { snap, ids } = bench(['battery', 'resistor', 'resistor', 'led', 'npn']);
  const [bat, rBase, rLed, led, q] = ids;
  snap = M.setValue(snap, rBase, 10000);
  snap = M.setValue(snap, rLed, 220);

  snap = join(snap, bat, 0, rBase, 0);
  snap = join(snap, rBase, 1, q, 0);          // base
  snap = join(snap, bat, 0, rLed, 0);
  snap = join(snap, rLed, 1, led, 0);
  snap = join(snap, led, 1, q, 1);            // collector
  snap = join(snap, q, 2, bat, 1);            // emitter to the negative rail

  const a = M.analyse(snap);
  ok(a.solved, 'the transistor stage solves');
  near(readOf(a, led).amps * 1000, 12.2, 0.3, 'collector current through the LED');
  is(readOf(a, q).state, 'Saturated, fully on', 'and the transistor is hard on');
  is(readOf(a, led).state, 'Lit', 'so the LED is lit');
  is(a.verdict.code, 'running', 'nothing is wrong with it');

  // Break the base drive and the whole thing shuts off. This is the lesson.
  const noBase = M.analyse(M.removePart(snap, rBase));
  ok(Math.abs(readOf(noBase, led).amps) < 1e-4, 'no base current, no collector current');
  is(readOf(noBase, q).state, 'Off', 'the transistor is off');
  is(M.wiresAtPart(M.removePart(snap, rBase), rBase).length, 0, 'removing a part takes its wires with it');
  is(M.wiresAtPart(snap, rBase).length, 2, 'while it is on the board it has both of its wires');

  // Pulling one wire off is how a mis-wired pin gets fixed without undo.
  const cut = M.wiresAtPart(snap, rBase)[0];
  const snipped = M.analyse(M.disconnect(snap, cut.id));
  is(M.wiresAtPart(M.disconnect(snap, cut.id), rBase).length, 1, 'disconnect removes exactly one wire');
  ok(codes(snipped).includes('dangling'), 'and the part it left hanging is reported');
  ok(Math.abs(readOf(snipped, led).amps) < 1e-4, 'with the base drive cut, the LED goes out');
}

// ── 8. A capacitor, which blocks DC and therefore has to be run in time ──
{
  let { snap, ids } = bench(['battery', 'resistor', 'capacitor']);
  const [bat, r1, cap] = ids;
  snap = M.setValue(snap, bat, 5);
  snap = M.setValue(snap, r1, 1000);
  snap = M.setValue(snap, cap, 100e-6);
  snap = join(snap, bat, 0, r1, 0);
  snap = join(snap, r1, 1, cap, 0);
  snap = join(snap, cap, 1, bat, 1);

  const a = M.analyse(snap);
  ok(a.solved, 'an RC leg solves at DC');
  ok(codes(a).includes('cap-blocks-dc'), 'and the builder explains that the capacitor is the only way back');
  ok(Math.abs(readOf(a, r1).amps) < 1e-6, 'no steady current flows through a capacitor');
  ok(M.isReactive(a.netlist), 'the circuit is flagged as needing a live run');

  // Now step it in real time. Tau is 1k times 100uF = 0.1 s, so one tau should
  // land near 63% of 5 V. Backward Euler at 5 ms undershoots slightly, which is
  // why the tolerance is one sided rather than tight.
  const st = M.startLive(a.netlist);
  const capNode = a.build.nodeOf[M.pinRef(cap, 0)];
  let frame = M.advanceLive(a.netlist, st, 0.1);
  near(frame.V[capNode], 3.1, 0.25, 'after one time constant the capacitor is about two thirds charged');
  ok(frame.V[capNode] < 5, 'and not yet full');

  for (let i = 0; i < 10; i++) frame = M.advanceLive(a.netlist, st, 0.1);
  near(frame.V[capNode], 5, 0.05, 'after ten time constants it has settled at the supply');
  const settled = M.readouts(snap, a.build, frame);
  ok(Math.abs(settled.find((r) => r.id === r1).amps) < 1e-4, 'and the current has stopped');
  ok(settled.find((r) => r.id === cap).state.startsWith('Charged to'), 'the readout says how charged it is');

  ok(!M.isReactive(M.analyse(M.removePart(snap, cap)).netlist), 'without a capacitor there is nothing to run in time');
}

// ── 9. Two batteries of different sizes, wired straight across each other ──
{
  let { snap, ids } = bench(['battery', 'battery']);
  const [a1, a2] = ids;
  snap = M.setValue(snap, a2, 9);
  snap = join(snap, a1, 0, a2, 0);
  snap = join(snap, a1, 1, a2, 1);

  const a = M.analyse(snap);
  is(a.solved, false, 'two sources insisting on the same nodes has no answer');
  is(a.verdict.code, 'unsolvable', 'and the builder says so plainly');
  is(a.verdict.severity, 'danger', 'at danger severity');
}

// ── 10. Geometry: every touch target clears the 44pt floor and nothing overlaps ──
//
// This is the rule the whole interaction rests on. If two pins of one part
// share hit box area, tapping one of them is a coin flip.
{
  const half = M.PIN_HIT / 2;
  for (const kind of M.PART_KINDS) {
    for (const vertical of [false, true]) {
      const part = { id: 'X1', kind, x: 200, y: 200, vertical, value: 0 };
      const n = M.SPECS[kind].pins.length;
      const boxes = Array.from({ length: n }, (_, i) => {
        const p = M.pinPoint(part, i);
        return { minX: p.x - half, maxX: p.x + half, minY: p.y - half, maxY: p.y + half };
      });
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const A = boxes[i]; const B = boxes[j];
          const hit = A.minX < B.maxX && B.minX < A.maxX && A.minY < B.maxY && B.minY < A.maxY;
          ok(!hit, `${kind}${vertical ? ' upright' : ' flat'}: pins ${i} and ${j} have overlapping 44pt targets`);
        }
      }
      // The body strip between the pins has to stay grabbable too.
      const b = M.partBounds(part);
      ok(b.maxX - b.minX >= M.PIN_HIT && b.maxY - b.minY >= M.PIN_HIT, `${kind} footprint is at least one touch target across`);
    }
  }

  // Auto placement must not stack parts on top of each other while there is room.
  let snap = M.EMPTY;
  for (let i = 0; i < 6; i++) snap = M.addPart(snap, 'resistor', W, H).snap;
  for (let i = 0; i < snap.parts.length; i++) {
    for (let j = i + 1; j < snap.parts.length; j++) {
      const A = M.partBounds(snap.parts[i]); const B = M.partBounds(snap.parts[j]);
      ok(!(A.minX < B.maxX && B.minX < A.maxX && A.minY < B.maxY && B.minY < A.maxY),
        `auto placed parts ${i} and ${j} overlap`);
    }
  }
  for (const p of snap.parts) {
    const b = M.partBounds(p);
    ok(b.minX >= 0 && b.minY >= 0 && b.maxX <= W && b.maxY <= H, `${p.id} was placed off the canvas`);
  }

  // Dragging a part off the edge pulls it back on, whole footprint included.
  const dragged = M.movePart(snap, snap.parts[0].id, -400, -400, W, H);
  const b = M.partBounds(dragged.parts[0]);
  ok(b.minX >= 0 && b.minY >= 0, 'a part dragged off the top left is clamped back on');
  is(dragged.parts[0].x % M.SNAP, 0, 'and snaps to the grid');
}

// ── 11. Formatting, because a jittering readout reads as a bug ──
{
  is(M.fmtOhms(220), '220 Ω', 'ohms under a thousand');
  is(M.fmtOhms(4700), '4.7 kΩ', 'kilohms');
  is(M.fmtOhms(1e6), '1 MΩ', 'megohms');
  is(M.fmtFarads(100e-6), '100 µF', 'microfarads');
  is(M.fmtFarads(1000e-6), '1 mF', 'and a thousand of them is a millifarad');
  is(M.fmtAmps(0.0298), '29.8 mA', 'milliamps');
  is(M.fmtAmps(0.00025), '250 µA', 'below a milliamp an instrument switches unit, it does not add decimals');
  is(M.fmtAmps(0.0025), '2.50 mA', 'and a few milliamps keeps two decimals');
  is(M.fmtAmps(1.5), '1.50 A', 'amps');
  is(M.fmtAmps(1e-9), '0 A', 'and leakage is not dressed up as a measurement');
  is(M.fmtVolts(null), 'unknown', 'an unknown voltage says so');
  is(M.fmtWatts(0.268), '268 mW', 'milliwatts');
  is(M.fmtVoltsNominal(9), '9 V', 'a nominal cell voltage carries no false precision');
  is(M.fmtVoltsNominal(1.5), '1.5 V', 'but keeps the precision it has');
}

// ── 12. Sign conventions, checked by Kirchhoff rather than by eye ──
//
// The canvas draws current crawling along each wire, and the direction comes
// from pinCurrent(). Get a sign wrong and the dots run backwards round the
// loop, which is worse than not drawing them: it teaches the opposite of the
// truth, confidently, and no screenshot would catch it.
//
// The invariant that pins every sign at once: nothing accumulates at a node, so
// the currents into every part attached to a node must sum to zero.
{
  const kcl = (snap, what) => {
    const a = M.analyse(snap);
    ok(a.solved, `${what} solves`);
    const byId = new Map(snap.parts.map((q) => [q.id, q]));
    for (const node of a.build.nodes) {
      // A ground symbol is a sink with no current of its own to report, so a
      // node holding one is not required to balance across the parts we can see.
      if (node.partIds.some((id) => byId.get(id).kind === 'ground')) continue;
      let sum = 0;
      for (const ref of node.pins) sum += M.pinCurrent(byId.get(M.pinOwner(ref)), M.pinIndexOf(ref), a.dc.I);
      // Not exactly zero, and it should not be. The engine hangs a 1 nS
      // conductance off every node to ground so a floating node still has an
      // answer, which is standard SPICE practice. At 5 V that leaks about 5 nA
      // per node, and the tolerance below is that leakage and nothing else.
      near(sum, 0, 1e-7, `${what}: node ${node.id} balances to within GMIN leakage`);
    }
    return a;
  };

  // Series loop.
  let series = M.EMPTY;
  for (const k of ['battery', 'resistor', 'led']) series = M.addPart(series, k, W, H).snap;
  series = join(series, 'BAT1', 0, 'R1', 0);
  series = join(series, 'R1', 1, 'LED1', 0);
  series = join(series, 'LED1', 1, 'BAT1', 1);
  const a1 = kcl(series, 'series loop');

  // Conventional current leaves the positive terminal. If this flips, so does
  // every animated wire on the canvas.
  const outOfPlus = -M.pinCurrent(series.parts.find((q) => q.id === 'BAT1'), 0, a1.dc.I);
  ok(outOfPlus > 0, 'current leaves the battery at its positive pin');
  near(outOfPlus * 1000, 12.77, 0.05, 'and it is the loop current');

  // Every wire carries what leaves one end into the other.
  for (const c of series.connections) {
    const from = series.parts.find((q) => q.id === M.pinOwner(c.a));
    const to = series.parts.find((q) => q.id === M.pinOwner(c.b));
    near(
      -M.pinCurrent(from, M.pinIndexOf(c.a), a1.dc.I),
      M.pinCurrent(to, M.pinIndexOf(c.b), a1.dc.I),
      1e-7, `wire ${from.id} to ${to.id} carries one current, to within GMIN leakage`,
    );
  }

  // A junction, where a node has three pins and the current splits.
  let split = M.EMPTY;
  for (const k of ['battery', 'resistor', 'resistor']) split = M.addPart(split, k, W, H).snap;
  split = M.setValue(split, 'R2', 470);
  split = join(split, 'BAT1', 0, 'R1', 0);
  split = join(split, 'BAT1', 0, 'R2', 0);
  split = join(split, 'R1', 1, 'BAT1', 1);
  split = join(split, 'R2', 1, 'BAT1', 1);
  const a2 = kcl(split, 'two branches in parallel');
  near(readOf(a2, 'R1').amps * 1000, 22.73, 0.02, '5 V over 220 ohms');
  near(readOf(a2, 'R2').amps * 1000, 10.64, 0.02, '5 V over 470 ohms');
  near(readOf(a2, 'BAT1').amps * 1000, 33.37, 0.05, 'and the battery supplies both');

  // The transistor, where the emitter carries collector plus base.
  let stage = M.EMPTY;
  for (const k of ['battery', 'resistor', 'resistor', 'led', 'npn']) stage = M.addPart(stage, k, W, H).snap;
  stage = M.setValue(stage, 'R1', 10000);
  stage = M.setValue(stage, 'R2', 220);
  stage = join(stage, 'BAT1', 0, 'R1', 0);
  stage = join(stage, 'R1', 1, 'Q1', 0);
  stage = join(stage, 'BAT1', 0, 'R2', 0);
  stage = join(stage, 'R2', 1, 'LED1', 0);
  stage = join(stage, 'LED1', 1, 'Q1', 1);
  stage = join(stage, 'Q1', 2, 'BAT1', 1);
  kcl(stage, 'transistor stage');
}

// ── 13. Wires elbow out of a pin along its own lead ──
//
// A wire that leaves a pin sideways crosses the component body and the canvas
// turns to spaghetti. The corner has to follow the lead the pin sits on.
{
  const flat = { id: 'R1', kind: 'resistor', x: 100, y: 100, vertical: false, value: 220 };
  const upright = { id: 'R2', kind: 'resistor', x: 220, y: 240, vertical: true, value: 220 };

  // Flat part, so its pin's lead runs horizontally: leave sideways first.
  const fromFlat = M.wirePath(flat, 1, upright, 0);
  is(fromFlat.length, 3, 'an offset pair of pins gets one corner');
  is(fromFlat[1].y, M.pinPoint(flat, 1).y, 'the first leg leaves a flat part horizontally');
  is(fromFlat[1].x, M.pinPoint(upright, 0).x, 'and arrives under the upright one');

  // Upright part, so its pin's lead runs vertically: leave upward first.
  const fromUpright = M.wirePath(upright, 0, flat, 1);
  is(fromUpright[1].x, M.pinPoint(upright, 0).x, 'the first leg leaves an upright part vertically');

  // Pins that already line up get a straight wire, not a pointless dogleg.
  const aligned = { id: 'R3', kind: 'resistor', x: 100, y: 300, vertical: false, value: 220 };
  is(M.wirePath(flat, 0, aligned, 0).length, 2, 'aligned pins get a straight wire');
}

// ── 14. The example survives any phone, and any tablet ──
{
  for (const [w, h] of [[300, 360], [342, 420], [430, 520], [700, 620]]) {
    const ex = M.exampleCircuit(w, h);
    const a = M.analyse(ex);
    is(a.verdict.code, 'running', `the example works at ${w} by ${h}`);
    for (const part of ex.parts) {
      const b = M.partBounds(part);
      ok(b.minX >= 0 && b.minY >= 0 && b.maxX <= w && b.maxY <= h,
        `${part.id} is fully on a ${w} by ${h} canvas`);
    }
  }
}

rmSync(dir, { recursive: true, force: true });
console.log(`OK: ${checks} assertions across 14 groups, including four degenerate circuits.`);
