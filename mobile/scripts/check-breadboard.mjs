// The breadboard has to be a breadboard.
//
// This file exists because the sandbox cannot be checked by looking at it. A
// board can render beautifully and still have row e joined to row f, and the
// only symptom is that a learner's circuit works on the phone and not on their
// desk. That is the worst failure this product has: it teaches the wrong thing
// and blames the learner.
//
// So the topology, the netlist bridge and the geometry budget are all asserted
// here, in Node, against the real TypeScript sources. Four things are proved:
//
//   1. TOPOLOGY. 830 tie points, five hole strips, the ravine actually breaks
//      the column, rails run the length of the board, and the tap-to-hole
//      inverse round trips for every hole on the board.
//   2. ELECTRICAL. A real circuit is assembled out of real parts, pushed
//      through the real MNA solver, and the LED current is checked against the
//      number Ohm's law gives. If the netlist bridge is wrong this fails.
//   3. BUDGET. The scene is built headless with three.js and its draw calls,
//      triangles, materials and geometries are counted. A phone has a frame
//      budget of 16.6 ms and draw call submission is what spends it, so the
//      count is a build gate, not a note.
//   4. LEGIBILITY. The painted silkscreen is measured: hole to plastic contrast,
//      texels per inch against what the phone's fitted camera asks for, glyph
//      size against the texels under it, and every printing clearance. A board
//      that reads as one grey slab on a phone fails here.
//   5. ADDRESSABILITY. A learner can name any hole they can see without
//      touching it. The board's own row letters are printed at its two ends
//      and no phone camera has both in frame, so the names are laid out from
//      the live camera into the view; this drives that with the real OrbitRig
//      at every preset and across the whole camera envelope.
//   6. PURITY. Nothing under sandbox3d/ touches a browser only API. React
//      Native has no document, and the failure mode is a red screen at runtime.
//
//   node scripts/check-breadboard.mjs

import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../src');
const SANDBOX = join(SRC, 'components/sandbox3d');

// ── Loading real TypeScript in Node ────────────────────────────────────────
//
// The sources are transpiled into a temp mirror of src/ so their relative
// imports still resolve. Specifiers get an .mjs extension because Node's ESM
// resolver, unlike Metro's, will not guess one.

// Inside node_modules rather than the system temp directory, because the
// transpiled modules import 'three' and Node resolves that by walking up from
// the importing file. From /tmp there is nothing to walk up to.
const CACHE = resolve(here, '../node_modules/.cache');
mkdirSync(CACHE, { recursive: true });
const out = mkdtempSync(join(CACHE, 'ohmlet-breadboard-'));

function walk(dir, hit) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, hit);
    else hit(path);
  }
}

function transpileTree() {
  const files = [];
  walk(SANDBOX, (p) => { if (p.endsWith('.ts')) files.push(p); });
  files.push(join(SRC, 'sim/engine.ts'));
  files.push(join(SRC, 'theme/tokens.ts'));

  for (const file of files) {
    const js = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      fileName: file,
    }).outputText.replace(
      /(\bfrom\s*|\bimport\s*\()(['"])(\.[^'"]*?)\2/g,
      (_m, lead, quote, spec) => `${lead}${quote}${spec}.mjs${quote}`,
    );
    const dest = join(out, relative(SRC, file)).replace(/\.ts$/, '.mjs');
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, js);
  }
}

const load = (rel) => import(`file://${join(out, rel)}`);

let failures = 0;
const results = [];
function check(name, fn) {
  try {
    const note = fn();
    results.push(`  ok    ${name}${note ? `  ${note}` : ''}`);
  } catch (err) {
    failures += 1;
    results.push(`  FAIL  ${name}\n          ${err.message.split('\n').join('\n          ')}`);
  }
}

transpileTree();

const spec = await load('components/sandbox3d/boardSpec.mjs');
const topo = await load('components/sandbox3d/topology.mjs');
const parts = await load('components/sandbox3d/parts.mjs');
const net = await load('components/sandbox3d/netlist.mjs');

// ── 1. Topology ────────────────────────────────────────────────────────────

check('830 tie points', () => {
  const holes = topo.allHoles();
  assert.equal(holes.length, 830, `got ${holes.length}`);
  assert.equal(spec.TIE_POINTS, 830);
  assert.equal(new Set(holes).size, 830, 'hole ids are not unique');
  return `${spec.COLS} columns x ${spec.ROWS} rows + 4 rails x ${spec.RAIL_HOLES}`;
});

check('a column below the ravine is one five hole strip', () => {
  for (const col of [0, 12, 31, 62]) {
    const lower = ['a', 'b', 'c', 'd', 'e'].map((_, r) => topo.holeId.bb(col, r));
    const nets = new Set(lower.map(topo.netOfHole));
    assert.equal(nets.size, 1, `column ${col} rows a-e resolve to ${nets.size} nets`);
    assert.equal(topo.holesInNet([...nets][0]).length, 5);
  }
});

check('the ravine breaks the column', () => {
  for (const col of [0, 20, 62]) {
    assert.equal(
      topo.sameNet(topo.holeId.bb(col, 4), topo.holeId.bb(col, 5)), false,
      `column ${col} row e is joined to row f, so no DIP chip can work`,
    );
  }
  // And the two halves really are separate five hole strips.
  assert.equal(topo.sameNet(topo.holeId.bb(7, 5), topo.holeId.bb(7, 9)), true);
});

check('adjacent columns are independent', () => {
  assert.equal(topo.sameNet(topo.holeId.bb(11, 2), topo.holeId.bb(12, 2)), false);
  assert.equal(topo.sameNet(topo.holeId.bb(11, 2), topo.holeId.bb(11, 3)), true);
});

check('a rail runs the whole length and the two polarities do not touch', () => {
  assert.equal(topo.sameNet(topo.holeId.rail(3, 0), topo.holeId.rail(3, 49)), true);
  assert.equal(topo.sameNet(topo.holeId.rail(3, 0), topo.holeId.rail(2, 0)), false);
  assert.equal(topo.sameNet(topo.holeId.rail(3, 0), topo.holeId.rail(0, 0)), false);
  assert.equal(spec.RAIL_SEGMENTS, 1, 'the rail model changed; the curriculum assumes continuity');
  const polarity = spec.RAILS.map((r) => r.polarity).join('');
  assert.equal(polarity, '+--+', 'the positive line must be the outer one on both sides');
});

check('holes sit on a 0.1 inch grid inside the board outline', () => {
  const onGrid = (v) => Math.abs(v / spec.PITCH - Math.round(v / spec.PITCH)) < 1e-9;
  for (const id of topo.allHoles()) {
    const info = topo.holeInfo(id);
    assert.ok(info, `${id} did not parse`);
    const [x, , z] = info.world;
    assert.ok(onGrid(x), `${id} x=${x} is off the pitch`);
    assert.ok(Math.abs(x) <= spec.BOARD.length / 2, `${id} x=${x} is off the board`);
    assert.ok(Math.abs(z) <= spec.BOARD.width / 2, `${id} z=${z} is off the board`);
  }
  // Row e to row f is the 0.3 inch DIP span, not one pitch.
  assert.ok(Math.abs((spec.rowZ(5) - spec.rowZ(4)) - 0.3) < 1e-12, 'the ravine is not 0.3 inch wide');
});

check('every hole can be tapped and lands on itself', () => {
  let worst = 0;
  for (const id of topo.allHoles()) {
    const [x, , z] = topo.holeInfo(id).world;
    assert.equal(topo.holeAtPoint(x, z), id, `tapping ${id} dead centre selected something else`);
    // And a tap a third of a pitch away still finds it, which is what makes a
    // fingertip usable on a 1.2 mm socket.
    const off = spec.PITCH / 3;
    assert.equal(topo.holeAtPoint(x + off, z), id, `${id} is unreachable off centre`);
    worst = Math.max(worst, off);
  }
  return `snap tolerance ${(worst * 25.4).toFixed(1)} mm`;
});

check('a tap that misses the board returns nothing', () => {
  assert.equal(topo.holeAtPoint(spec.BOARD.length, 0), null);
  assert.equal(topo.holeAtPoint(0, spec.BOARD.width), null);
});

check('Arduino pins are addressable and GND is one net', () => {
  const g1 = topo.netOfHole(topo.holeId.uno('GND'));
  assert.equal(topo.netOfHole(topo.holeId.uno('GND')), g1);
  assert.notEqual(topo.netOfHole(topo.holeId.uno('5V')), g1);
  for (const name of ['D13', 'D9', 'D0', 'A0', 'A5', '5V', '3V3', 'VIN']) {
    assert.ok(topo.holeInfo(topo.holeId.uno(name)), `${name} is missing from the header`);
  }
  const pins = spec.UNO_PINS;
  assert.equal(pins.filter((p) => /^D\d+$/.test(p.name)).length, 14, 'the digital header is not 14 pins');
  assert.equal(pins.filter((p) => /^A\d$/.test(p.name)).length, 6);
  return `${pins.length} header positions`;
});

check('the digital header reads the way the board is printed', () => {
  // With the USB socket on the left, a real Uno reads AREF, GND, 13 down to 8,
  // a gap, then 7 down to 0. Mirroring it is invisible in a screenshot and
  // makes every wiring instruction in the curriculum point at the wrong pin,
  // which is a lesson that fails on the learner's desk and not on the phone.
  const far = spec.UNO_PINS.filter((p) => p.z < 0).sort((a, b) => a.x - b.x);
  const order = far.map((p) => p.name).join(' ');
  assert.equal(
    order,
    'AREF GND D13 D12 D11 D10 D9 D8 D7 D6 D5 D4 D3 D2 D1 D0',
    'the digital header is in the wrong order',
  );
  // And the 0.16 inch jog between D7 and D8 that keeps a shield the right way up.
  const d8 = far.find((p) => p.name === 'D8');
  const d7 = far.find((p) => p.name === 'D7');
  assert.ok(Math.abs((d7.x - d8.x) - 0.16) < 1e-9, `the D7 to D8 gap is ${(d7.x - d8.x).toFixed(3)} inch`);

  const near = spec.UNO_PINS.filter((p) => p.z > 0).sort((a, b) => a.x - b.x);
  assert.equal(
    near.map((p) => p.name).join(' '),
    'IOREF RESET 3V3 5V GND GND VIN A0 A1 A2 A3 A4 A5',
    'the power and analog headers are in the wrong order',
  );
  return order;
});

check('no two header labels overlap', () => {
  // Silkscreen labels are sized to fit the 0.1 inch pitch. Without that, "3V3"
  // and "GND" run into each other until the whole header reads as one word,
  // and a learner cannot find 5V at all.
  const glyphs = readFileSync(join(SANDBOX, 'geometry/uno.ts'), 'utf8');
  assert.ok(/textWidth\(pin\.label\)/.test(glyphs),
    'the pin labels are no longer sized to fit the pitch');
  const worst = spec.UNO_PINS.reduce((m, p) => Math.max(m, p.label.length), 0);
  return `longest label ${worst} characters`;
});

// ── 2. Electrical ──────────────────────────────────────────────────────────

check('part footprints land in the strips the catalogue promises', () => {
  // A resistor bent to 0.4 inch spans four columns, so its ends are in two
  // different strips. If they were one, the part would short itself out.
  const r = { id: 'r', kind: 'resistor', anchor: topo.holeId.bb(10, 2) };
  const holes = parts.partHoles(r);
  assert.deepEqual(holes, [topo.holeId.bb(10, 2), topo.holeId.bb(14, 2)]);
  assert.equal(topo.sameNet(holes[0], holes[1]), false);

  // Rotated a quarter turn it runs across the rows instead, and from row a it
  // stays inside the lower half.
  const rotated = { ...r, anchor: topo.holeId.bb(10, 0), rotation: 1 };
  assert.deepEqual(parts.partHoles(rotated), [topo.holeId.bb(10, 0), topo.holeId.bb(10, 4)]);

  // Off the edge is null, not a throw and not a wrapped coordinate.
  assert.deepEqual(parts.partHoles({ ...r, anchor: topo.holeId.bb(61, 2) })[1], null);
  assert.equal(parts.isPlaceable({ ...r, anchor: topo.holeId.bb(61, 2) }), false);
});

check('a button straddling the ravine shorts neither half on its own', () => {
  const b = { id: 'b', kind: 'pushbutton', anchor: topo.holeId.bb(20, 4) };
  const holes = parts.partHoles(b);
  assert.equal(topo.netOfHole(holes[0]), 'strip:20:lower');
  assert.equal(topo.netOfHole(holes[2]), 'strip:20:upper');

  const open = net.buildNetlist({ parts: [b], wires: [] });
  assert.equal(open.node['strip:20:lower'] === open.node['strip:20:upper'], false,
    'an unpressed button is conducting');

  const shut = net.buildNetlist({ parts: [{ ...b, pressed: true }], wires: [] });
  assert.equal(shut.node['strip:20:lower'], shut.node['strip:20:upper'],
    'a pressed button is not conducting');
});

check('5 V through 220 ohm into a red LED gives the current Ohm predicts', () => {
  const board = {
    parts: [
      { id: 'r1', kind: 'resistor', anchor: topo.holeId.bb(10, 5), value: 220 },
      { id: 'd1', kind: 'led', anchor: topo.holeId.bb(14, 6), color: 'red' },
    ],
    wires: [
      { id: 'w1', from: topo.holeId.uno('5V'), to: topo.holeId.bb(10, 6) },
      { id: 'w2', from: topo.holeId.bb(15, 7), to: topo.holeId.uno('GND') },
    ],
  };
  const { solution } = net.solveBoard(board);
  assert.equal(solution.ok, true, 'the matrix was singular');

  // (5 - 1.9) / (220 + 15 on-resistance + 0.35 supply) = 13.2 mA.
  const mA = solution.parts.d1.current * 1000;
  assert.ok(mA > 12 && mA < 14.5, `LED current was ${mA.toFixed(2)} mA, expected about 13`);
  assert.equal(solution.parts.d1.on, true, 'the LED is not lit');
  assert.ok(solution.parts.d1.brightness > 0.7, 'a 13 mA LED should read as bright');
  assert.equal(solution.shorted, false);
  return `${mA.toFixed(1)} mA`;
});

check('an LED wired backwards stays dark', () => {
  const board = {
    parts: [
      { id: 'r1', kind: 'resistor', anchor: topo.holeId.bb(10, 5), value: 220 },
      // Anode towards ground: the mistake every learner makes once.
      { id: 'd1', kind: 'led', anchor: topo.holeId.bb(15, 6), rotation: 2, color: 'red' },
    ],
    wires: [
      { id: 'w1', from: topo.holeId.uno('5V'), to: topo.holeId.bb(10, 6) },
      { id: 'w2', from: topo.holeId.bb(15, 7), to: topo.holeId.uno('GND') },
    ],
  };
  const { solution } = net.solveBoard(board);
  assert.ok(Math.abs(solution.parts.d1.current) < 1e-6, 'a reversed LED is conducting');
  assert.equal(solution.parts.d1.on, false);
});

check('both legs of an LED in one strip is a dead short, not a light', () => {
  // a5 and a6 look different and are the same copper. This is the single most
  // common first mistake on a breadboard, so the simulator has to reproduce it.
  const board = {
    parts: [
      { id: 'r1', kind: 'resistor', anchor: topo.holeId.bb(10, 5), value: 220 },
      { id: 'd1', kind: 'led', anchor: topo.holeId.bb(14, 6), rotation: 1, color: 'red' },
    ],
    wires: [
      { id: 'w1', from: topo.holeId.uno('5V'), to: topo.holeId.bb(10, 6) },
      { id: 'w2', from: topo.holeId.bb(14, 8), to: topo.holeId.uno('GND') },
    ],
  };
  const holes = parts.partHoles(board.parts[1]);
  assert.equal(topo.netOfHole(holes[0]), topo.netOfHole(holes[1]),
    'the two legs should be in the same strip for this test to mean anything');
  const { solution } = net.solveBoard(board);
  assert.ok(Math.abs(solution.parts.d1.current) < 1e-6, 'a bridged LED is somehow lit');
});

check('the photocell divider moves the way the datasheet says', () => {
  const board = {
    parts: [
      { id: 'ldr1', kind: 'ldr', anchor: topo.holeId.bb(10, 5) },
      { id: 'r1', kind: 'resistor', anchor: topo.holeId.bb(12, 6), value: 10_000 },
    ],
    wires: [
      { id: 'w1', from: topo.holeId.uno('5V'), to: topo.holeId.bb(10, 6) },
      { id: 'w2', from: topo.holeId.bb(16, 7), to: topo.holeId.uno('GND') },
      { id: 'w3', from: topo.holeId.bb(12, 7), to: topo.holeId.uno('A0') },
    ],
  };
  const dark = net.solveBoard({ ...board, light: 0 });
  const bright = net.solveBoard({ ...board, light: 1 });
  const at = (r) => net.voltageAtHole(r.solution, topo.holeId.uno('A0'));
  assert.ok(at(dark) < 0.6, `A0 in the dark was ${at(dark).toFixed(2)} V, should be near zero`);
  assert.ok(at(bright) > 4.5, `A0 in sunlight was ${at(bright).toFixed(2)} V, should be near 5`);
  assert.ok(parts.ldrOhms(0) > parts.ldrOhms(1) * 100, 'the photocell curve is not steep enough');
  return `A0 swings ${at(dark).toFixed(2)} V to ${at(bright).toFixed(2)} V`;
});

check('a driven pin sources current and an undriven one floats', () => {
  const board = {
    parts: [
      { id: 'r1', kind: 'resistor', anchor: topo.holeId.bb(10, 5), value: 220 },
      { id: 'd1', kind: 'led', anchor: topo.holeId.bb(14, 6), color: 'red' },
    ],
    wires: [
      { id: 'w1', from: topo.holeId.uno('D9'), to: topo.holeId.bb(10, 6) },
      { id: 'w2', from: topo.holeId.bb(15, 7), to: topo.holeId.uno('GND') },
    ],
  };
  const off = net.solveBoard({ ...board, pinDrive: { D9: 0 } });
  assert.equal(off.solution.parts.d1.on, false, 'a pin driven low is lighting the LED');

  const on = net.solveBoard({ ...board, pinDrive: { D9: 1 } });
  assert.ok(on.solution.parts.d1.current * 1000 > 10, 'a pin driven high is not lighting the LED');

  // analogWrite(9, 64). The peak current is unchanged, the perceived
  // brightness is a quarter of it.
  const pwm = net.solveBoard({ ...board, pinDrive: { D9: 0.25 } });
  assert.ok(Math.abs(pwm.solution.parts.d1.current - on.solution.parts.d1.current) < 1e-9,
    'PWM changed the peak current, which is not what a square wave does');
  assert.ok(pwm.solution.parts.d1.brightness < on.solution.parts.d1.brightness * 0.35,
    'a quarter duty is not a quarter as bright');

  const floating = net.solveBoard(board);
  assert.equal(floating.solution.parts.d1.on, false, 'a floating input pin is powering a circuit');
});

check('shorting the rails is reported, not crashed on', () => {
  const board = {
    parts: [],
    wires: [
      { id: 'w1', from: topo.holeId.uno('5V'), to: topo.holeId.rail(3, 2) },
      { id: 'w2', from: topo.holeId.uno('GND'), to: topo.holeId.rail(2, 2) },
      { id: 'w3', from: topo.holeId.rail(3, 30), to: topo.holeId.rail(2, 30) },
    ],
  };
  const { solution } = net.solveBoard(board);
  assert.equal(solution.ok, true, 'a short made the solver give up');
  assert.equal(solution.shorted, true, 'a rail to rail short was not flagged');
  assert.ok(Number.isFinite(solution.supplyCurrent));
  return `${solution.supplyCurrent.toFixed(1)} A`;
});

check('the starter build lights its LED', () => {
  const build = parts.starterBuild();
  const { solution } = net.solveBoard({ ...build, light: 0.9, pinDrive: { D9: 1 } });
  assert.equal(solution.ok, true);
  assert.equal(solution.parts['led-1'].on, true, 'the offered starter build does not work');
  const a0 = net.voltageAtHole(solution, topo.holeId.uno('A0'));
  assert.ok(a0 > 2, `A0 reads ${a0.toFixed(2)} V in bright light, so the divider is wired wrong`);
  return `LED ${(solution.parts['led-1'].current * 1000).toFixed(1)} mA, A0 ${a0.toFixed(2)} V`;
});

check('a capacitor charges through a resistor on the real clock', () => {
  // One RC time constant is 0.1 s here, so after 0.1 s the cap should be at
  // 63 percent of the rail. This is the whole timing unit, checked.
  const board = {
    parts: [
      { id: 'r1', kind: 'resistor', anchor: topo.holeId.bb(10, 5), value: 10_000 },
      { id: 'c1', kind: 'capacitor', anchor: topo.holeId.bb(14, 6), value: 10e-6 },
    ],
    wires: [
      { id: 'w1', from: topo.holeId.uno('5V'), to: topo.holeId.bb(10, 6) },
      { id: 'w2', from: topo.holeId.bb(15, 7), to: topo.holeId.uno('GND') },
    ],
  };
  const built = net.buildNetlist(board);
  assert.equal(net.BoardTransient.needed(built), true, 'a board with a cap should step time');
  const run = new net.BoardTransient(built, board);
  const dt = 0.0005;
  let sol;
  for (let t = 0; t < 0.1; t += dt) sol = run.step(dt);
  const v = net.voltageAtHole(sol, topo.holeId.bb(14, 6));
  assert.ok(v > 2.9 && v < 3.3, `after one time constant the cap was at ${v.toFixed(2)} V, expected 3.16`);
  return `${v.toFixed(2)} V after 1 RC`;
});

// ── 3. Geometry budget ─────────────────────────────────────────────────────
//
// three.js builds geometry with no GL context, so the real scene graph can be
// assembled in Node and counted. These numbers are the reason the board is one
// textured quad and one instanced mesh rather than 1660 little ones.

const THREE = await import('three');
const build = await load('components/sandbox3d/geometry/breadboard.mjs');
const partGeo = await load('components/sandbox3d/geometry/parts.mjs');
const unoGeo = await load('components/sandbox3d/geometry/uno.mjs');
const mats = await load('components/sandbox3d/materials.mjs');

function census(root) {
  let draws = 0;
  let tris = 0;
  const geometries = new Set();
  const materials = new Set();
  root.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh && !o.isLine) return;
    // An invisible mesh costs nothing: the renderer skips it before it ever
    // reaches the render list. Counting the hidden selection rings would make
    // this number a third higher than the truth.
    if (!o.visible) return;
    const g = o.geometry;
    geometries.add(g.uuid);
    const list = Array.isArray(o.material) ? o.material : [o.material];
    list.forEach((m) => materials.add(m.uuid));
    // A geometry's groups only become separate draw calls when the mesh has an
    // ARRAY of materials. A single material draws the whole buffer once,
    // however many groups it carries, which is why the board's rounded box is
    // one call and not the six that BoxGeometry declares.
    draws += Array.isArray(o.material) ? Math.max(1, g.groups.length) : 1;
    const index = g.getIndex();
    const count = index ? index.count : g.getAttribute('position').count;
    tris += (count / 3) * (o.isInstancedMesh ? o.count : 1);
  });
  return { draws, tris: Math.round(tris), geometries: geometries.size, materials: materials.size };
}

check('the breadboard is a handful of draw calls, not one per hole', () => {
  const library = mats.createMaterials();
  const board = build.buildBreadboard(library);
  const c = census(board);
  assert.ok(c.draws <= 8, `the board costs ${c.draws} draw calls`);
  assert.ok(c.geometries <= 8, `${c.geometries} distinct geometries for one board`);
  // The 830 sockets must be one instanced mesh. A per hole mesh is the single
  // easiest way to make this scene unshippable.
  const instanced = [];
  board.traverse((o) => { if (o.isInstancedMesh) instanced.push(o); });
  assert.equal(instanced.length, 1, 'the sockets are not instanced');
  assert.equal(instanced[0].count, 830, `the instanced mesh holds ${instanced[0].count} sockets`);
  return `${c.draws} draws, ${c.tris.toLocaleString()} triangles, ${c.materials} materials`;
});

check('the Arduino is a fixed cost too', () => {
  const library = mats.createMaterials();
  const uno = unoGeo.buildUno(library);
  const c = census(uno);
  assert.ok(c.draws <= 10, `the Uno costs ${c.draws} draw calls`);
  return `${c.draws} draws, ${c.tris.toLocaleString()} triangles`;
});

check('parts share geometry between instances', () => {
  const library = mats.createMaterials();
  const kinds = Object.keys(parts.PART_SPECS);
  const first = kinds.map((k) => partGeo.partBodyGeometry(k, library));
  const second = kinds.map((k) => partGeo.partBodyGeometry(k, library));
  first.forEach((g, i) => {
    assert.equal(g.geometry.uuid, second[i].geometry.uuid,
      `${kinds[i]} rebuilt its geometry instead of reusing the cached one`);
  });

  // Fifty parts on a board is a busier build than any lesson uses. Count it.
  const board = new THREE.Group();
  const total = 50;
  for (let i = 0; i < total; i++) {
    const kind = kinds[i % kinds.length];
    const placed = { id: `p${i}`, kind, anchor: topo.holeId.bb(i % 60, 5), color: 'red' };
    const obj = partGeo.createPart(placed, library);
    obj.place(parts.partHoles(placed).map((h) => {
      const info = h && topo.holeInfo(h);
      return info ? new THREE.Vector3(...info.world) : null;
    }));
    board.add(obj.root);
  }
  const c = census(board);
  assert.ok(c.draws <= 260, `${total} parts cost ${c.draws} draw calls`);
  // Bodies are shared; only the per instance legs and animated pieces add one.
  assert.ok(c.geometries <= kinds.length + total * 3,
    `${c.geometries} geometries for ${total} parts`);
  return `${total} parts: ${c.draws} draws, ${(c.draws / total).toFixed(1)} per part`;
});

check('every part is its datasheet size and sits ON the board', () => {
  // Two failures this catches, both of which look fine in a still and wrong the
  // moment the camera tilts:
  //   a body centred at y = 0, which buries half the part in the plastic
  //     (the resistor's colour code did exactly this),
  //   and PART_SPECS.height drifting away from the mesh it describes.
  const library = mats.createMaterials();
  const rows = [];
  for (const [kind, spec] of Object.entries(parts.PART_SPECS)) {
    const placed = { id: 'm', kind, anchor: topo.holeId.bb(20, 5), color: 'red' };
    const obj = partGeo.createPart(placed, library);
    obj.place(parts.partHoles(placed).map((h) => {
      const info = h && topo.holeInfo(h);
      return info ? new THREE.Vector3(...info.world) : null;
    }));
    obj.root.updateMatrixWorld(true);

    const bounds = new THREE.Box3();
    obj.root.traverse((o) => {
      if (!o.isMesh || !o.visible || !o.geometry) return;
      o.geometry.computeBoundingBox();
      bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
    });

    // Nothing may hang more than a lead's thickness below the board surface.
    assert.ok(bounds.min.y > -0.03,
      `${kind} reaches ${(bounds.min.y * 25.4).toFixed(1)} mm INTO the board`);
    assert.ok(Math.abs(bounds.max.y - spec.height) < 0.03,
      `${kind} is ${bounds.max.y.toFixed(3)} inch tall but PART_SPECS says ${spec.height}`);
    // Sanity on the outline: nothing in a starter kit is bigger than a servo.
    const size = bounds.getSize(new THREE.Vector3());
    assert.ok(size.x < 1.4 && size.z < 0.7, `${kind} is ${size.x.toFixed(2)} by ${size.z.toFixed(2)} inch`);
    rows.push(`${kind} ${(bounds.max.y * 25.4).toFixed(1)}mm`);
  }
  return `${rows.length} parts measured`;
});

check('a full scene stays inside a phone frame budget', () => {
  const library = mats.createMaterials();
  const scene = new THREE.Group();
  scene.add(build.buildBreadboard(library));
  scene.add(unoGeo.buildUno(library));
  const kinds = Object.keys(parts.PART_SPECS);
  for (let i = 0; i < 24; i++) {
    const placed = { id: `q${i}`, kind: kinds[i % kinds.length], anchor: topo.holeId.bb(i * 2, 5), color: 'red' };
    const obj = partGeo.createPart(placed, library);
    obj.place(parts.partHoles(placed).map((h) => {
      const info = h && topo.holeInfo(h);
      return info ? new THREE.Vector3(...info.world) : null;
    }));
    scene.add(obj.root);
  }
  const c = census(scene);
  // 24 parts is more than any lesson build uses. 250 draw calls at 60 Hz is
  // comfortable on an A series GPU; past about 400 the submission cost alone
  // starts eating the frame on the JavaScript thread.
  assert.ok(c.draws < 250, `a busy board costs ${c.draws} draw calls`);
  assert.ok(c.tris < 250_000, `a busy board is ${c.tris} triangles`);
  return `${c.draws} draws, ${c.tris.toLocaleString()} triangles, ${c.materials} materials`;
});

check('one material library is shared by everything', () => {
  const library = mats.createMaterials();
  const a = build.buildBreadboard(library);
  const b = unoGeo.buildUno(library);
  const seen = new Set();
  [a, b].forEach((root) => root.traverse((o) => {
    if (!o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => seen.add(m.name || m.uuid));
  }));
  // Every material three.js has never seen before costs a shader compile, and
  // a compile on the first frame is a visible hitch.
  assert.ok(seen.size <= 24, `${seen.size} distinct materials across the two boards`);
  return `${seen.size} materials`;
});

// ── 4. Legibility ──────────────────────────────────────────────────────────
//
// This section exists because the board was reported three times as "you still
// cannot see the pins, the entire breadboard is one solid colour" and twice
// fixed by eye against a desktop screenshot, which is a scale nothing on a
// phone shares. Everything below is measured off the painted pixels and the
// real geometry, in the units the device works in, so that a change that makes
// the board unreadable fails here instead of in someone's hand.
//
// The device the numbers are calibrated for: a 350 by 340 point GL view at
// device pixel ratio 3, at the default 'fit' camera. That framing puts 25.5
// device pixels on a 0.1 inch pitch along the board's length and 27.8 across
// it, so the screen is asking the texture for 255 and 278 pixels per inch.

const printed = build.paintBreadboard();
const PRINT = build.BREADBOARD_PRINT;
const TEX = { w: printed.image.width, h: printed.image.height, data: printed.image.data };
const TOP_W = PRINT.texture.spanX;
const TOP_D = PRINT.texture.spanZ;
const pxPerInchX = TEX.w / TOP_W;
const pxPerInchZ = TEX.h / TOP_D;

/** Pixels per inch the fitted camera asks for on the reference device. */
const SCREEN_PPI = { x: 255, z: 278 };

const texelAt = (x, z) => {
  const c = Math.min(TEX.w - 1, Math.max(0, Math.round((x / TOP_W + 0.5) * TEX.w)));
  const r = Math.min(TEX.h - 1, Math.max(0, Math.round((z / TOP_D + 0.5) * TEX.h)));
  const i = (r * TEX.w + c) * 4;
  return [TEX.data[i], TEX.data[i + 1], TEX.data[i + 2]];
};

/** sRGB relative luminance, the quantity a contrast ratio is defined on. */
function luminance([r, g, b]) {
  const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const [hi, lo] = [Math.max(luminance(a), luminance(b)), Math.min(luminance(a), luminance(b))];
  return (hi + 0.05) / (lo + 0.05);
}

check('the printing is at the resolution the phone asks for', () => {
  const pot = (n) => (n & (n - 1)) === 0;
  assert.ok(pot(TEX.w) && pot(TEX.h),
    `${TEX.w} by ${TEX.h} is not a power of two, so a WebGL 1 context cannot mipmap it`);
  // Twice the fitted camera's demand, so the detail camera (radius 2.4, about
  // 520 by 718 pixels per inch) is still sampling real texels rather than a
  // magnified smear. The board that shipped supplied 319 and 246: short of the
  // fitted requirement across the rows before anyone had zoomed at all.
  assert.ok(pxPerInchX >= 600,
    `${pxPerInchX.toFixed(0)} texels per inch along the board, screen wants ${SCREEN_PPI.x}`);
  assert.ok(pxPerInchZ >= 450,
    `${pxPerInchZ.toFixed(0)} texels per inch across the board, screen wants ${SCREEN_PPI.z}`);
  return `${TEX.w}x${TEX.h} = ${pxPerInchX.toFixed(0)} by ${pxPerInchZ.toFixed(0)} texels/in`;
});

check('a socket reads as a hole and not as a mark', () => {
  // Sampled at a real tie point (g30, the one in the report) rather than at a
  // colour constant, so a change to the painting is what is measured.
  const x = spec.columnX(29);
  const z = spec.rowZ(6);
  const mouth = texelAt(x, z);
  const rim = texelAt(x + (PRINT.socket.mouth + PRINT.socket.lip) / 2, z);
  const plastic = texelAt(x + spec.PITCH / 2, z + spec.PITCH / 2);

  const mouthToPlastic = contrast(mouth, plastic);
  const mouthToRim = contrast(mouth, rim);
  const rimToPlastic = contrast(rim, plastic);

  assert.ok(mouthToPlastic >= 12,
    `the socket is only ${mouthToPlastic.toFixed(1)}:1 against the plastic`);
  // The failure this catches by name: a lip dark enough to merge with the hole
  // turns every tie point into one blob and the grid into a grey field.
  assert.ok(mouthToRim >= 4,
    `the lip is only ${mouthToRim.toFixed(1)}:1 against the socket, so they read as one mark`);
  assert.ok(rimToPlastic >= 1.5,
    `the lip is only ${rimToPlastic.toFixed(2)}:1 against the plastic and disappears into it`);
  return `${mouthToPlastic.toFixed(1)}:1 socket, ${mouthToRim.toFixed(1)}:1 lip to socket`;
});

check('neighbouring holes are separated by clear plastic', () => {
  // The one that actually broke the board. The lip used to be 0.091 inch across
  // on a 0.1 inch pitch, leaving about two device pixels of plastic between
  // adjacent tie points at the fitted camera, so the whole field averaged into
  // one flat grey and there was no way to tell g29 from g30 by eye.
  const bright = luminance(texelAt(spec.columnX(29) + spec.PITCH / 2, spec.rowZ(6) + spec.PITCH / 2));
  const runs = [];
  const axes = [
    ['along the board', (t) => [spec.columnX(29) + t, spec.rowZ(6)], pxPerInchX],
    ['across the board', (t) => [spec.columnX(29), spec.rowZ(6) + t], pxPerInchZ],
  ];
  for (const [name, at, ppi] of axes) {
    let clear = 0;
    const steps = 400;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * spec.PITCH;
      if (luminance(texelAt(...at(t))) >= bright * 0.9) clear += spec.PITCH / steps;
    }
    const fraction = clear / spec.PITCH;
    assert.ok(fraction >= 0.3,
      `only ${(fraction * 100).toFixed(0)}% of the pitch ${name} is clear plastic; the holes merge`);
    runs.push(`${name} ${(fraction * 100).toFixed(0)}% (${(clear * ppi).toFixed(0)} texels, ` +
      `${(clear * SCREEN_PPI.x).toFixed(1)} device px at fit)`);
  }
  return runs.join(', ');
});

check('every printed label has enough texels to be a shape', () => {
  // The silkscreen font is 5 by 7, so one glyph pixel is cap height over 7. Any
  // less than four texels on the SHORTER axis and the mipmap chain averages the
  // strokes into the plastic: that is why the row letters and column numbers
  // rendered as smudges at 2048 by 512.
  const shorter = Math.min(pxPerInchX, pxPerInchZ);
  const labels = [
    ['column numbers', PRINT.glyph.number.cap],
    ['row letters', PRINT.glyph.letter.cap],
    ['rail polarity', PRINT.glyph.polarity.cap],
  ];
  const rows = [];
  for (const [name, cap] of labels) {
    const texels = (cap / 7) * shorter;
    assert.ok(texels >= 4,
      `${name} draw one glyph pixel into ${texels.toFixed(1)} texels`);
    // And on the device: a 5 by 7 glyph under about 16 device pixels of cap
    // height is not read, it is guessed at.
    const devicePx = cap * SCREEN_PPI.z;
    assert.ok(devicePx >= 15,
      `${name} are ${devicePx.toFixed(0)} device pixels tall at the fitted camera`);
    rows.push(`${name} ${texels.toFixed(1)} texels/px, ${devicePx.toFixed(0)}px on screen`);
  }
  return rows.join('; ');
});

check('nothing printed lands on top of anything else', () => {
  // Every clearance the layout depends on, checked rather than eyeballed. The
  // column numbers used to be printed straight through the blue rail line,
  // which is most of why they could not be read.
  const lip = PRINT.socket.lip;
  const halfStripe = spec.STRIPE_WIDTH / 2;
  const clashes = [];
  const clear = (what, a, b) => { if (a < b) clashes.push(`${what} overlaps by ${(b - a).toFixed(4)} in`); };

  for (const rail of spec.RAILS) {
    const stripe = spec.railStripeZ(rail.id);
    // stripe against its own rail's holes
    clear(`rail ${rail.id} stripe and its holes`,
      Math.abs(stripe - rail.z), lip + halfStripe);
    // polarity mark against the stripe
    clear(`rail ${rail.id} polarity mark and its stripe`,
      Math.abs(stripe - rail.z), PRINT.glyph.polarity.cap / 2 + halfStripe);
    // polarity mark against the neighbouring rail's holes
    const other = spec.RAILS.find((r) => r.id !== rail.id && r.side === rail.side);
    clear(`rail ${rail.id} polarity mark and rail ${other.id} holes`,
      Math.abs(other.z - rail.z), PRINT.glyph.polarity.cap / 2 + lip);
  }

  // Column numbers: between the near rail stripe and row a / row j.
  const numberZ = spec.rowZ(0) - PRINT.glyph.number.offset;
  const halfNumber = PRINT.glyph.number.cap / 2;
  const nearStripe = spec.railStripeZ(1);
  clear('column numbers and the blue rail line',
    Math.abs(numberZ - nearStripe), halfNumber + halfStripe);
  clear('column numbers and row a',
    Math.abs(spec.rowZ(0) - numberZ), halfNumber + lip);

  // Row letters: between the last column's holes and the board's own edge.
  const glyphHalfWidth = (PRINT.glyph.letter.cap / 7) * 5 / 2;
  const letterX = TOP_W / 2 - PRINT.glyph.letter.inset;
  clear('row letters and column 63',
    letterX - glyphHalfWidth, spec.columnX(spec.COLS - 1) + lip);
  clear('row letters and the board edge', TOP_W / 2, letterX + glyphHalfWidth);
  // Row letters against the next row along.
  clear('row letters and the next row',
    spec.PITCH, PRINT.glyph.letter.cap / 2 + lip);

  // Polarity marks mid rail sit in the gaps between groups of five, so they
  // must not land on a rail hole.
  for (const col of PRINT.glyph.polarity.columns) {
    const x = spec.columnX(col);
    for (let i = 0; i < spec.RAIL_HOLES; i++) {
      clear(`polarity mark at column ${col + 1} and a rail hole`,
        Math.abs(spec.railHoleX(i) - x), glyphHalfWidth + lip);
    }
  }

  assert.equal(clashes.length, 0, clashes.join('\n'));
  return 'stripes, numbers, letters and polarity marks all clear';
});

check('rail polarity is readable without scrolling to an end of the board', () => {
  // The other half of the report: "I cannot even see gnd". A real board prints
  // + and - only at its two ends, and the fitted camera on a phone never has an
  // end of a 6.5 inch board on screen, so there was nothing to read.
  const marks = [
    -(TOP_W / 2 - PRINT.glyph.polarity.inset),
    ...PRINT.glyph.polarity.columns.map((c) => spec.columnX(c)),
    TOP_W / 2 - PRINT.glyph.polarity.inset,
  ].sort((a, b) => a - b);
  let widest = 0;
  for (let i = 1; i < marks.length; i++) widest = Math.max(widest, marks[i] - marks[i - 1]);
  // The fitted camera shows about 4.4 inches of the board's length, so a mark
  // at worst every 1.3 inches puts at least three in frame at all times.
  assert.ok(widest <= 1.3, `${widest.toFixed(2)} inch between polarity marks`);
  assert.ok(marks.length >= 7, `only ${marks.length} polarity marks per rail`);
  return `${marks.length} per rail, at most ${widest.toFixed(2)} in apart`;
});

check('the socket faces are not buried under the printed top', () => {
  // They were. The top surface is an opaque quad with no aperture in it, and
  // the 830 sockets were built below it, so every one of them was occluded and
  // the board paid for geometry that drew no pixels at all.
  const library = mats.createMaterials();
  const board = build.buildBreadboard(library);
  const top = board.getObjectByName('breadboard.top');
  const sockets = board.getObjectByName('breadboard.sockets');
  assert.ok(top && sockets, 'the board no longer has a named top and socket mesh');

  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  let lowest = Infinity;
  for (let i = 0; i < sockets.count; i++) {
    sockets.getMatrixAt(i, m);
    v.setFromMatrixPosition(m);
    lowest = Math.min(lowest, v.y);
  }
  assert.ok(lowest > top.position.y,
    `the sockets sit at y ${lowest} and the opaque printed top is at ${top.position.y}, so they are invisible`);
  assert.ok(sockets.geometry.getAttribute('color'),
    'the socket lip and mouth need vertex colours to draw in one call');
  assert.ok(sockets.material.vertexColors,
    'the socket material ignores the geometry colours, so every socket is one flat tone');
  // They sit two hundredths of a millimetre above a surface that takes shadow.
  // If they do not take it too, every part's shadow comes out full of brightly
  // lit rings, which reads as holes painted onto the board rather than in it.
  assert.equal(sockets.receiveShadow, top.receiveShadow,
    'the socket faces and the printed surface under them disagree about shadow');
  return `sockets at y ${lowest.toFixed(4)}, printed top at ${top.position.y}`;
});

check('the finger down affordance still names the hole', () => {
  // A 1.2 mm target under an 8 mm fingertip cannot be aimed at blind, so the
  // component rings the hole under the finger and labels it before release.
  // Deleting that quietly puts the sandbox straight back where it was.
  const src = readFileSync(join(SRC, 'components/sandbox3d/Sandbox3D.tsx'), 'utf8');
  assert.match(src, /onPanResponderGrant[\s\S]{0,2000}?showAim\(/,
    'the hole under the finger is no longer named on touch down');
  assert.match(src, /onPanResponderRelease[\s\S]{0,900}?setAim\(null\)/,
    'the aim label is not cleared when the finger lifts');
  assert.match(src, /onPanResponderTerminate[\s\S]{0,600}?setAim\(null\)/,
    'the aim label survives a cancelled gesture');
  assert.match(src, /projectHole\(/, 'the label is no longer anchored to the hole it names');
  const scene = readFileSync(join(SRC, 'components/sandbox3d/scene.ts'), 'utf8');
  assert.match(scene, /HOLE_HIGHLIGHT_RADIUS/,
    'the target ring no longer uses the shared hole radius, so it can drift off the grid');
});

check('a resting finger keeps the label it is reading', () => {
  // The affordance above is worth nothing if it dies on the first pixel of
  // movement, and it did: one finger that is not dragging a part, drawing a
  // wire or placing something is an ORBIT, and the orbit branch threw the label
  // away on any move event at all. The default tool is 'select', so that was
  // every ordinary press. A fingertip on glass jitters a pixel or two a frame,
  // so the label flashed and went.
  //
  // The test for "still a press" therefore has to be the DISTANCE from where
  // the finger landed, not the length of the path it has wandered since: the
  // second one runs past the slop on its own in about a second of holding
  // still, taking the label, the camera and the tap with it.
  const src = readFileSync(join(SRC, 'components/sandbox3d/Sandbox3D.tsx'), 'utf8');
  assert.match(src, /Math\.abs\(locationX - t\.startX\)[\s\S]{0,120}?t\.panning = true/,
    'a press is no longer measured from where the finger landed');
  assert.match(src, /if \(!t\.panning\)[\s\S]{0,600}?showAim\(/,
    'a finger that has not travelled no longer keeps naming the hole under it');
  assert.match(src, /if \(!t\.panning\) commitTap\(/,
    'a press that has not travelled no longer commits where its label said');
  assert.doesNotMatch(src, /const quick =/,
    'the tap is time limited again, so holding still to read the label times it out');
  return 'jitter does not take the label, the camera or the tap';
});

check('the sandbox is marked beta on the phone as it is on the web', () => {
  const src = readFileSync(join(SRC, 'components/sim/SandboxTab.tsx'), 'utf8');
  assert.match(src, /BETA/, 'the mobile sandbox no longer says it is in beta');
  assert.match(src, /betaText:\s*\{[^}]*colors\.blueDeep/,
    'the beta mark is not on the blue plate the web uses');
});

// ── 5. Addressability ──────────────────────────────────────────────────────
//
// "I can't even see the lanes like a3 or whatever or even gnd."
//
// A real board prints its row letters and its column numbers at its two ENDS,
// six and a half inches apart, and there is no free lane between columns 1 and
// 63 to print a second set into: everything in between is tie points. Ray
// casting the five camera presets says what that means on a phone. The fitted
// camera frames about four inches of the middle of the board, so at four of
// the five presets not one row letter is anywhere in the view, and the answer
// to "which lane is a3" is that there is no way to tell.
//
// So the names are drawn in the VIEW instead, laid out from the live camera by
// components/sandbox3d/ruler.ts, against the edge of the frame. Everything
// below drives that with the real OrbitRig and measures the answer in the same
// points the component lays out in, because the one thing this must not become
// again is a thing somebody checked by looking at a screenshot.

const ruler = await load('components/sandbox3d/ruler.mjs');
const rigs = await load('components/sandbox3d/camera.mjs');
const RULER = ruler.RULER;

/** GL view sizes in points: a phone, a short phone, a small phone, a tablet. */
const VIEWPORTS = [[350, 340], [350, 260], [320, 300], [420, 500], [812, 340]];
const PRESETS = ['fit', 'top', 'front', 'left', 'detail'];

const _proj = new THREE.Vector3();
function toView(camera, x, z, w, h) {
  _proj.set(x, 0, z).project(camera);
  if (!Number.isFinite(_proj.x) || _proj.z > 1) return null;
  return { x: (_proj.x * 0.5 + 0.5) * w, y: (-_proj.y * 0.5 + 0.5) * h };
}
const inView = (p, w, h) => !!p && p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h;

/**
 * A camera preset, optionally flicked and pinched away from it.
 *
 * The gesture is divided by the momentum factor first. A flick keeps going and
 * settles, carrying about 1/(1 - damping) times its one frame delta, so asking
 * for a 90 degree turn by passing 90 degrees of pixels actually asks for 640
 * and slams the rig into its own limits. Every pose below is a pose a thumb
 * could really leave the camera in.
 */
const MOMENTUM = 7.14;
function rigAt(view, w, h, turn = 0, tilt = 0, zoom = 1) {
  const rig = new rigs.OrbitRig(w / h);
  rig.jumpTo(view);
  const scale = (Math.PI * 1.6) / h;
  if (turn || tilt) rig.orbit(-turn / (scale * MOMENTUM), -tilt / (scale * MOMENTUM), h);
  if (zoom !== 1) rig.dolly(Math.pow(zoom, 1 / MOMENTUM));
  for (let f = 0; f < 200; f++) rig.update(1 / 60);
  return rig;
}

/**
 * Two points on the screen line a label has to be standing on.
 *
 * Sampled along the board line rather than taken from its two ends, because an
 * end can be behind the lens: a straight line in the world is still a straight
 * line on screen for the part of it in front of the camera, so any two points
 * from that part define the same axis, and the ends do not always qualify.
 */
function axisOf(camera, label, w, h) {
  const at = label.kind === 'col'
    ? (t) => [spec.columnX(label.index), spec.rowZ(0) + (spec.rowZ(spec.ROWS - 1) - spec.rowZ(0)) * t]
    : label.kind === 'row'
      ? (t) => [spec.columnX(0) + (spec.columnX(spec.COLS - 1) - spec.columnX(0)) * t, spec.rowZ(label.index)]
      : (t) => [spec.railHoleX(0) + (spec.railHoleX(spec.RAIL_HOLES - 1) - spec.railHoleX(0)) * t,
        spec.RAILS[label.index].z];
  let first = null;
  let last = null;
  // Whether each end of the sample run is the BOARD's own end of the line, or
  // a point the near plane forced us to start from because the rest of the
  // line is behind the lens. The layout draws that distinction too, and the
  // "left out" check below has to know it.
  let nearFirst = false;
  let nearLast = true;
  for (let i = 0; i <= 256; i++) {
    const p = toView(camera, ...at(i / 256), w, h);
    if (!p) { if (!first) nearFirst = true; continue; }
    if (!first) first = p;
    last = p;
    nearLast = i !== 256;
  }
  return first && last && Math.hypot(last.x - first.x, last.y - first.y) > 1
    ? [first, last, nearFirst, nearLast]
    : [null, null, false, false];
}

/** Perpendicular distance from a point to the line through a and b. */
function offAxis(a, b, p) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return 0;
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

/** Points of clear space between two label boxes. Negative means they overlap. */
function clearance(a, b) {
  return Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.y - b.y) - (a.h + b.h) / 2);
}

const everyLabel = (layout) => [
  ...layout.bands.map((b) => ({ ...b, what: `row/rail ${b.text}` })),
  ...layout.columns.map((c) => ({ ...c, kind: 'col', what: `column ${c.text}` })),
];

/**
 * The bands the ruler owes a name to, worked out from the raw projection
 * rather than read back off the layout.
 *
 * A band qualifies when enough of its tie points are in frame that a learner
 * is looking at it, AND it is far enough on screen from the band beside it to
 * be told apart from it at all. The second half is not a let out clause: seen
 * nearly edge on, two rows land a point and a half apart, and no label can
 * make a hole identifiable that the eye cannot separate in the first place.
 */
function owed(camera, w, h) {
  const bands = [];
  for (const rail of spec.RAILS) bands.push({ kind: 'rail', index: rail.id, z: rail.z });
  for (let row = 0; row < spec.ROWS; row++) bands.push({ kind: 'row', index: row, z: spec.rowZ(row) });
  bands.sort((a, b) => a.z - b.z);

  const cols = [];
  for (let col = 0; col < spec.COLS; col++) {
    let seen = 0;
    for (let row = 0; row < spec.ROWS; row++) {
      if (inView(toView(camera, spec.columnX(col), spec.rowZ(row), w, h), w, h)) seen += 1;
    }
    if (seen) cols.push({ index: col, seen });
  }
  const refX = spec.columnX(cols.length ? cols[Math.floor(cols.length / 2)].index : Math.floor(spec.COLS / 2));

  for (const band of bands) {
    let seen = 0;
    if (band.kind === 'row') {
      for (let col = 0; col < spec.COLS; col++) {
        if (inView(toView(camera, spec.columnX(col), band.z, w, h), w, h)) seen += 1;
      }
    } else {
      for (let i = 0; i < spec.RAIL_HOLES; i++) {
        if (inView(toView(camera, spec.railHoleX(i), band.z, w, h), w, h)) seen += 1;
      }
    }
    band.present = seen;
    band.at = toView(camera, refX, band.z, w, h);
  }
  for (let i = 0; i < bands.length; i++) {
    const here = bands[i].at;
    bands[i].apart = false;
    if (!here) continue;
    for (const step of [-1, 1]) {
      const next = bands[i + step];
      if (!next || !next.at) continue;
      if (Math.hypot(here.x - next.at.x, here.y - next.at.y) >= RULER.resolve) bands[i].apart = true;
    }
  }

  // A column is worth a number when it is on screen at all and its holes are
  // far enough from the next column's to be a different column.
  const readable = [];
  for (const col of cols) {
    if (col.seen < RULER.presentCol) continue;
    let apart = false;
    for (let row = 0; row < spec.ROWS && !apart; row++) {
      const here = toView(camera, spec.columnX(col.index), spec.rowZ(row), w, h);
      if (!inView(here, w, h)) continue;
      for (const step of [-1, 1]) {
        const n = col.index + step;
        if (n < 0 || n >= spec.COLS) continue;
        const next = toView(camera, spec.columnX(n), spec.rowZ(row), w, h);
        if (!inView(next, w, h)) continue;
        if (Math.hypot(here.x - next.x, here.y - next.y) >= RULER.resolve) { apart = true; break; }
      }
    }
    if (apart) readable.push(col.index);
  }

  return {
    bands: bands.filter((b) => b.present >= RULER.present && b.apart),
    columns: readable,
    visible: cols.map((c) => c.index),
  };
}

check('the board alone cannot name a row at any camera a phone can hold', () => {
  // The measurement this whole section exists because of. If a way is ever
  // found to print row letters where the fitted camera can see them, this is
  // the check that will fail, and the ruler can then be reconsidered on
  // purpose rather than left in by accident.
  const w = 350;
  const h = 340;
  const inset = PRINT.glyph.letter.inset;
  const half = PRINT.texture.spanX / 2;
  const seen = {};
  for (const view of PRESETS) {
    const camera = rigAt(view, w, h).camera;
    let count = 0;
    for (let row = 0; row < spec.ROWS; row++) {
      for (const end of [-1, 1]) {
        if (inView(toView(camera, end * (half - inset), spec.rowZ(row), w, h), w, h)) count += 1;
      }
    }
    seen[view] = count;
  }
  const blind = PRESETS.filter((v) => seen[v] === 0);
  assert.ok(blind.length >= 4,
    `the printed row letters are now in frame at ${5 - blind.length} of the five presets: ${JSON.stringify(seen)}`);
  assert.equal(seen.fit, 0, 'the fitted camera can suddenly see a printed row letter');
  return `printed letters in frame: ${PRESETS.map((v) => `${v} ${seen[v]}`).join(', ')}`;
});

check('every row and rail in frame is named, at every camera preset', () => {
  const rows = [];
  for (const [w, h] of VIEWPORTS) {
    for (const view of PRESETS) {
      const camera = rigAt(view, w, h).camera;
      const layout = ruler.measureRuler(camera, w, h);
      const named = new Set(layout.bands.map((b) => `${b.kind}:${b.index}`));
      const want = owed(camera, w, h);
      const missing = want.bands.filter((b) => !named.has(`${b.kind}:${b.index}`));
      assert.equal(missing.length, 0,
        `${view} at ${w}x${h} leaves ${missing.map((b) => `${b.kind} ${b.index}`).join(', ')} unnamed`);
      // And the ten row letters specifically, which is the report.
      const letters = layout.bands.filter((b) => b.kind === 'row').length;
      if (view === 'fit' || view === 'top' || view === 'detail') {
        assert.equal(letters, spec.ROWS, `${view} at ${w}x${h} names only ${letters} of the ten rows`);
      }
      rows.push(`${view} ${w}x${h}: ${layout.bands.map((b) => b.text).join('')}`);
    }
  }
  return `${rows.length} camera and viewport pairs, all ten rows and both rails named`;
});

/**
 * The worst count from a printed number anywhere in the camera envelope.
 *
 * `RULER.reach` is the promise and it is kept at every preset, at every
 * viewport, which is where a learner spends their time. It cannot be kept
 * everywhere: turned right off the board's own axis and pinched, the visible
 * columns run diagonally corner to corner and no regular scale both fits
 * between the row letters and spans them, so the widest stride that does fit
 * leaves the far end counting. This is the measured worst over 4375 poses, and
 * it is asserted so that it cannot quietly get worse. It was 10 before the
 * ends of a picked run were made required.
 */
const REACH_CEILING = 7;

check('no hole is more than four columns from a printed number', () => {
  // What the board itself promises: it prints 1, 5, 10 and so on, so a leg
  // going into column 29 is counted from 25 or 30 and never from further. The
  // ruler is not allowed to be worse than the board it stands in for.
  //
  // Swept over the whole envelope, not just the presets. The presets are held
  // to the promise exactly; a camera a thumb has thrown somewhere odd is held
  // to REACH_CEILING. Checking only the presets, which is what this did, hid
  // poses one flick away that left a hole ten columns from a number.
  const worst = [];
  let overPromise = 0;
  for (const [w, h] of VIEWPORTS) {
    for (const view of PRESETS) {
      for (const turn of [-2.6, -1.3, -0.5, 0, 0.5, 1.3, 2.6]) {
        for (const tilt of [-0.5, -0.2, 0, 0.2, 0.5]) {
          for (const zoom of [0.45, 0.7, 1, 1.5, 2.2]) {
            const plain = turn === 0 && tilt === 0 && zoom === 1;
            const camera = rigAt(view, w, h, turn, tilt, zoom).camera;
            const layout = ruler.measureRuler(camera, w, h);
            const want = owed(camera, w, h);
            if (want.columns.length < 6) continue;
            assert.ok(layout.columns.length >= 3,
              `${view} at ${w}x${h} prints ${layout.columns.length} numbers against ${want.columns.length} readable columns`);
            let reach = 0;
            for (const col of want.columns) {
              let near = Infinity;
              for (const number of layout.columns) near = Math.min(near, Math.abs(number.index - col));
              reach = Math.max(reach, near);
            }
            const cap = plain ? RULER.reach : REACH_CEILING;
            assert.ok(reach <= cap,
              `${view} at ${w}x${h} turn ${turn} tilt ${tilt} zoom ${zoom} leaves a hole ` +
              `${reach} columns from the nearest number, over a cap of ${cap}`);
            if (reach > RULER.reach) overPromise += 1;
            worst.push(reach);
          }
        }
      }
    }
  }
  return `worst count from a number: ${Math.max(...worst)} columns over ${worst.length} cameras; `
    + `${overPromise} of them past the ${RULER.reach} the board itself promises`;
});

check('the numbers are a scale and not a scattering', () => {
  // A scale is regular or it is not a scale. Dropping whatever will not fit
  // and keeping the rest gets the densest set of numbers that can be drawn and
  // reads as digits scattered along an edge: 12, 15, 17, 18, 20, 23. One
  // number may go missing where the row letters cross it. Two in a row may
  // not, and nothing may be printed against a column that is not there.
  //
  // Swept over turn and tilt as well as zoom. It was zoom only, and that was
  // not enough to defend the property it names: the whole regularity guard in
  // the layout could be deleted and this stayed green, because the presets
  // seen square on happen to produce regular runs anyway. Turned off the
  // board's axis they do not, and a scale reading 12, 14, 15, 16, 18, 19 is
  // the failure this check is for.
  const strides = new Set();
  let numbers = 0;
  for (const [w, h] of VIEWPORTS) {
    for (const view of PRESETS) {
      for (const turn of [-2.6, -1.3, 0, 1.3, 2.6]) {
      for (const tilt of [-0.5, 0, 0.5]) {
      for (const zoom of [0.5, 1, 2]) {
        const camera = rigAt(view, w, h, turn, tilt, zoom).camera;
        const layout = ruler.measureRuler(camera, w, h);
        const where = `${view} at ${w}x${h} turn ${turn} tilt ${tilt} zoom ${zoom}`;
        strides.add(layout.stride);
        const onScreen = new Set(owed(camera, w, h).visible);
        for (let i = 0; i < layout.columns.length; i++) {
          const col = layout.columns[i];
          numbers += 1;
          assert.equal(col.text, String(col.index + 1),
            `${where} prints "${col.text}" against column ${col.index + 1}`);
          assert.ok(onScreen.has(col.index),
            `${where} prints ${col.text} against a column nobody can see`);
          if (i === 0) continue;
          const gap = col.index - layout.columns[i - 1].index;
          assert.ok(gap > 0, `${where} prints ${col.text} out of order`);
          assert.equal(gap % layout.stride, 0,
            `${where} jumps ${gap} columns on a stride of ${layout.stride}`);
          assert.ok(gap <= layout.stride * 2,
            `${where} skips two numbers in a row before column ${col.text}`);
        }
      }
      }
      }
    }
  }
  return `${numbers} numbers, strides ${[...strides].sort((a, b) => a - b).join(', ')}`;
});

check('every label stands on the axis of the thing it names', () => {
  // The one that catches a wrong projection. A label may slide as far along
  // its own row or column as it likes, and may not leave it: that is what
  // makes a chip at the edge of the frame readable as row G's name rather
  // than as a caption floating near row G.
  let worst = 0;
  let where = '';
  let counted = 0;
  for (const [w, h] of VIEWPORTS) {
    for (const view of PRESETS) {
      for (const turn of [-2.6, -1.3, 0, 1.3, 2.6]) {
        for (const zoom of [0.5, 1, 2]) {
          const camera = rigAt(view, w, h, turn, 0, zoom).camera;
          const layout = ruler.measureRuler(camera, w, h);
          for (const label of everyLabel(layout)) {
            const [a, b] = axisOf(camera, label, w, h);
            if (!a || !b) continue;
            counted += 1;
            const off = offAxis(a, b, label);
            if (off > worst) { worst = off; where = `${label.what} at ${view} ${w}x${h}`; }
          }
        }
      }
    }
  }
  assert.ok(worst < 0.75, `${where} sits ${worst.toFixed(2)} points off the line it names`);
  return `${counted} labels, worst ${worst.toFixed(3)} points off axis`;
});

check('no two labels ever overlap and none leaves the frame', () => {
  // Over the whole camera envelope, not just the presets: a pinch can put the
  // lens an inch from the board and a flick can lay it almost level with the
  // table, and two chips drawn on top of each other name neither of the things
  // they are standing on.
  let poses = 0;
  let tightest = Infinity;
  for (const [w, h] of VIEWPORTS) {
    for (const view of PRESETS) {
      for (const turn of [-2.6, -1.3, -0.5, 0, 0.5, 1.3, 2.6]) {
        for (const tilt of [-0.5, -0.2, 0, 0.2, 0.5]) {
          for (const zoom of [0.45, 0.7, 1, 1.5, 2.2]) {
            const layout = ruler.measureRuler(rigAt(view, w, h, turn, tilt, zoom).camera, w, h);
            poses += 1;
            const all = everyLabel(layout);
            for (let i = 0; i < all.length; i++) {
              const one = all[i];
              assert.ok(one.x - one.w / 2 >= -0.01 && one.x + one.w / 2 <= w + 0.01
                && one.y - one.h / 2 >= -0.01 && one.y + one.h / 2 <= h + 0.01,
              `${one.what} hangs off the edge at ${view} ${w}x${h} turn ${turn} zoom ${zoom}`);
              for (let j = i + 1; j < all.length; j++) {
                const gap = clearance(one, all[j]);
                if (gap < tightest) tightest = gap;
                assert.ok(gap >= 0,
                  `${one.what} and ${all[j].what} overlap by ${(-gap).toFixed(1)} points ` +
                  `at ${view} ${w}x${h} turn ${turn} tilt ${tilt} zoom ${zoom}`);
              }
            }
          }
        }
      }
    }
  }
  return `${poses} camera poses, tightest pair ${tightest.toFixed(1)} points apart`;
});

check('a name is only ever left out when there was nowhere to put it', () => {
  // The escape hatch, held shut. A band can be dropped, but only when every
  // position it was ALLOWED to take is already occupied by a label that IS
  // drawn. That is worked out here by walking the axis, so it is an
  // independent verdict on the layout rather than a restatement of how the
  // layout searches.
  //
  // Allowed is not the same as "anywhere on the axis inside the frame". A row
  // letter may sit past either end of its own line, where it is off the board
  // and reads as silkscreen; it may not come back INSIDE the board's own span,
  // because there it is a dark chip parked on the tie points it was drawn to
  // name. The exception is an end the frame has already cut: there is no past
  // the end to have there, the label is pinned against the inset, and sliding
  // inward along the line is the ruler behaviour. So the span is off limits
  // only when the board owns both of its ends.
  let dropped = 0;
  let poses = 0;
  let tightest = 0;
  for (const [w, h] of VIEWPORTS) {
    for (const view of PRESETS) {
      for (const turn of [-2.6, -1.3, -0.5, 0, 0.5, 1.3, 2.6]) {
        for (const tilt of [-0.5, -0.2, 0, 0.2, 0.5]) {
          for (const zoom of [0.45, 0.7, 1, 1.5, 2.2]) {
            const camera = rigAt(view, w, h, turn, tilt, zoom).camera;
            const layout = ruler.measureRuler(camera, w, h);
            poses += 1;
            const named = new Set(layout.bands.map((b) => `${b.kind}:${b.index}`));
            const missing = owed(camera, w, h).bands.filter((b) => !named.has(`${b.kind}:${b.index}`));
            if (!missing.length) continue;
            dropped += missing.length;
            const drawn = everyLabel(layout);
            for (const band of missing) {
              const [a, b, nearA, nearB] = axisOf(camera, band, w, h);
              assert.ok(a && b, `${band.kind} ${band.index} was dropped and has no axis to check`);
              const len = Math.hypot(b.x - a.x, b.y - a.y);
              assert.ok(len > 1, `${band.kind} ${band.index} projects to a point`);
              const ux = (b.x - a.x) / len;
              const uy = (b.y - a.y) / len;
              // An end the board owns is one that is in front of the lens and
              // inside the frame. If either end is cut, the whole line is fair
              // game; if neither is, the board's own span is off limits.
              const open = nearA || nearB || !inView(a, w, h) || !inView(b, w, h);
              const box = { w: ruler.labelWidth(band.kind === 'row' ? 'A' : '+'), h: RULER.height };
              // Walked as RUNS, not as points. The layout combs its axis on a
              // grid RULER.comb points apart, so every free window wider than
              // one step holds a probe and has to be found; a window narrower
              // than a step is a knife edge nobody could have aimed at, and
              // demanding it be found is demanding a different algorithm, not
              // a bug fix. Measured: the tightest slot the layout ever walks
              // past is one point wide, eighty points out along a leader.
              let run = 0;
              let widest = 0;
              let at = null;
              for (let t = -4000; t <= 4000; t += 1) {
                let free = !open ? !(t > 0 && t < len) : true;
                const box0 = { x: a.x + ux * t, y: a.y + uy * t, w: box.w, h: box.h };
                if (free && (box0.x - box.w / 2 < RULER.inset || box0.x + box.w / 2 > w - RULER.inset)) free = false;
                if (free && (box0.y - box.h / 2 < RULER.inset || box0.y + box.h / 2 > h - RULER.inset)) free = false;
                if (free) free = drawn.every((other) => clearance(box0, other) >= RULER.gap);
                if (!free) { run = 0; continue; }
                run += 1;
                if (run > widest) { widest = run; at = box0; }
              }
              if (widest > tightest) tightest = widest;
              assert.ok(widest <= RULER.comb,
                `${band.kind} ${band.index} was left out at ${view} ${w}x${h} turn ${turn} ` +
                `tilt ${tilt} zoom ${zoom}, and ${widest} points of its own axis around ` +
                `(${at ? at.x.toFixed(0) : '-'}, ${at ? at.y.toFixed(0) : '-'}) were free`);
            }
          }
        }
      }
    }
  }
  return `${dropped} bands dropped over ${poses} poses, widest slot any of them walked past `
    + `${tightest} points against a ${RULER.comb} point comb`;
});

check('a name never stands on the tie points it is naming', () => {
  // The other half of "you cannot see the lanes": a dark chip parked on row
  // F's own holes, to tell you that is row F, hides the very thing it was
  // drawn for. A label may slide as far as it likes PAST either end of its
  // line, where it is off the board and reads as silkscreen; it may not come
  // back inside the board's own span while the board still owns both ends of
  // that line. Once the frame has cut an end there is no past-the-end left and
  // sliding along the line is the ruler behaviour, which is allowed.
  //
  // Measured against the layout's output rather than against its search, so it
  // is an independent verdict. Before this rule the crowded poses laid fourteen
  // chips along the board itself: 367 of the board's own tie points covered at
  // the worst camera, more than half of what was on screen.
  let checked = 0;
  let worst = 0;
  let where = '';
  for (const [w, h] of VIEWPORTS) {
    for (const view of PRESETS) {
      for (const turn of [-2.6, -1.3, -0.5, 0, 0.5, 1.3, 2.6]) {
        for (const tilt of [-0.5, -0.2, 0, 0.2, 0.5]) {
          for (const zoom of [0.45, 0.7, 1, 1.5, 2.2]) {
            const camera = rigAt(view, w, h, turn, tilt, zoom).camera;
            const layout = ruler.measureRuler(camera, w, h);
            for (const band of layout.bands) {
              const [a, b, nearA, nearB] = axisOf(camera, band, w, h);
              if (!a || !b) continue;
              if (nearA || nearB || !inView(a, w, h) || !inView(b, w, h)) continue;
              const len = Math.hypot(b.x - a.x, b.y - a.y);
              const t = ((band.x - a.x) * (b.x - a.x) + (band.y - a.y) * (b.y - a.y)) / len;
              checked += 1;
              // How far inside the board's own span the chip's centre sits.
              const inside = Math.min(t, len - t);
              if (inside > worst) { worst = inside; where = `${band.text} at ${view} ${w}x${h} turn ${turn} tilt ${tilt} zoom ${zoom}`; }
            }
          }
        }
      }
    }
  }
  assert.ok(worst <= 0.5,
    `${where} stands ${worst.toFixed(1)} points inside the board's own span, on the holes it names`);
  return `${checked} names on a board that owned both ends of their line, none of them on it`;
});

check('a band nobody could pick out is not named at all', () => {
  // A row seen so nearly edge on that it is a point from the row beside it is
  // not a row a learner can aim at, and a chip standing on it names nothing.
  // Worse, its own axis is the only line it may slide along, so a frame full
  // of unpickable bands lays their chips out ALONG the board and buries it.
  // Both halves of that are why RULER.visible exists.
  let named = 0;
  let smear = 0;
  for (const [w, h] of VIEWPORTS) {
    for (const view of PRESETS) {
      for (const turn of [-2.6, -1.3, 0, 1.3, 2.6]) {
        for (const tilt of [-0.5, 0, 0.5]) {
          for (const zoom of [0.45, 1, 2.2]) {
            const camera = rigAt(view, w, h, turn, tilt, zoom).camera;
            const layout = ruler.measureRuler(camera, w, h);
            const bands = owed(camera, w, h);
            // Every band on the board, with how far it is from its neighbour.
            const all = [];
            for (const rail of spec.RAILS) all.push({ kind: 'rail', index: rail.id, z: rail.z });
            for (let row = 0; row < spec.ROWS; row++) all.push({ kind: 'row', index: row, z: spec.rowZ(row) });
            all.sort((p, q) => p.z - q.z);
            const refX = spec.columnX(bands.visible.length
              ? bands.visible[Math.floor(bands.visible.length / 2)] : Math.floor(spec.COLS / 2));
            const at = all.map((band) => toView(camera, refX, band.z, w, h));
            for (const band of layout.bands) {
              const i = all.findIndex((p) => p.kind === band.kind && p.index === band.index);
              if (i < 0 || !at[i]) continue;
              let apart = 0;
              for (const step of [-1, 1]) {
                const n = i + step;
                if (n < 0 || n >= all.length || !at[n]) continue;
                apart = Math.max(apart, Math.hypot(at[i].x - at[n].x, at[i].y - at[n].y));
              }
              named += 1;
              if (apart < RULER.visible) smear += 1;
            }
          }
        }
      }
    }
  }
  assert.equal(smear, 0,
    `${smear} of ${named} names were drawn against a band closer than ${RULER.visible} points to the one beside it`);
  return `${named} names drawn, every one against a band a learner can pick out`;
});

check('the numbers do not go when the letters do', () => {
  // Laid level with the table the rows collapse into one smear and none of
  // them is named, which is honest. The numbers along the board are then all a
  // learner has left, and they used to go too: the layout bailed out of the
  // whole pose the moment no row letter could be placed, and the ruler came up
  // completely blank at six of the poses below.
  let blank = 0;
  let rescued = 0;
  for (const [w, h] of VIEWPORTS) {
    for (const view of PRESETS) {
      for (const turn of [-2.6, -1.3, -0.5, 0, 0.5, 1.3, 2.6]) {
        for (const tilt of [-0.5, -0.2, 0, 0.2, 0.5]) {
          for (const zoom of [0.45, 0.7, 1, 1.5, 2.2]) {
            const camera = rigAt(view, w, h, turn, tilt, zoom).camera;
            const layout = ruler.measureRuler(camera, w, h);
            const readable = owed(camera, w, h).columns.length;
            if (readable < 6) continue;
            assert.ok(layout.columns.length >= 3,
              `${view} at ${w}x${h} turn ${turn} tilt ${tilt} zoom ${zoom} prints ` +
              `${layout.columns.length} numbers against ${readable} readable columns`);
            if (!layout.bands.length) { blank += 1; rescued += layout.columns.length; }
          }
        }
      }
    }
  }
  return `${blank} poses named no band at all, and still printed ${rescued} numbers between them`;
});

check('the ruler is rebuilt when the camera moves and not otherwise', () => {
  // Three things hold this up and all three are easy to delete by accident.
  const cameraSrc = readFileSync(join(SANDBOX, 'camera.ts'), 'utf8');
  assert.match(cameraSrc, /private apply\(\): void \{\s*this\.stamp \+= 1;/,
    'the camera no longer stamps its own movement, so nothing can tell when it moved');

  const sceneSrc = readFileSync(join(SANDBOX, 'scene.ts'), 'utf8');
  assert.match(sceneSrc, /const CAMERA_MS = \d+;/, 'the camera report is no longer rate limited');
  assert.match(sceneSrc, /now - this\.cameraAt >= CAMERA_MS[\s\S]{0,220}?onCamera\?\.\(\)/,
    'the scene no longer tells the shell the camera moved');
  assert.match(sceneSrc, /const settled = stamp === this\.cameraLast;/,
    'a settled camera is no longer reported once more, so the ruler can stop short of where it landed');

  const shellSrc = readFileSync(join(SRC, 'components/sandbox3d/Sandbox3D.tsx'), 'utf8');
  assert.match(shellSrc, /sameRuler\(prev, next\) \? prev : next/,
    'the shell re-renders on every camera report instead of only on a real change');
  assert.match(shellSrc, /onCamera: remeasure/, 'the shell is no longer listening for camera movement');

  // And the layout itself must not drag three.js in: it reads one matrix.
  const rulerSrc = readFileSync(join(SANDBOX, 'ruler.ts'), 'utf8');
  assert.match(rulerSrc, /^import type \* as THREE from 'three';$/m,
    'ruler.ts imports three for real, so the layout can allocate scene objects');
  assert.equal(rulerSrc.match(/new THREE\./g), null, 'the ruler layout allocates three.js objects');
  return 'stamped, rate limited, settled, and diffed before it reaches React';
});

check('the ruler is drawn over the view, not added to the scene', () => {
  // Native text, at the device's own resolution, for nothing per frame. Put
  // into the scene it would be either another texture (the reason the printed
  // letters are only as sharp as a texel in the first place) or a glyph atlas
  // and a pile of draw calls against a budget that is already counted above.
  const shellSrc = readFileSync(join(SRC, 'components/sandbox3d/Sandbox3D.tsx'), 'utf8');
  assert.match(shellSrc, /ruler\.bands\.map\(/, 'the rows and rails are no longer drawn over the view');
  assert.match(shellSrc, /ruler\.columns\.map\(/, 'the column numbers are no longer drawn over the view');
  assert.match(shellSrc, /rulerChip:[\s\S]{0,400}?position: 'absolute'/,
    'the ruler labels are not positioned against the frame');
  assert.match(shellSrc, /accessibilityLabel=\{describeRuler\(ruler\)\}/,
    'the ruler says nothing to a screen reader');
  const sceneSrc = readFileSync(join(SANDBOX, 'scene.ts'), 'utf8');
  assert.doesNotMatch(sceneSrc, /rulerLayer|rulerMesh/, 'the ruler has been moved into the scene graph');
  return 'React Native text over the GL surface, zero draw calls';
});

check('a drawn label is exactly the box the layout cleared', () => {
  // The collision arithmetic is only worth anything if the thing on the glass
  // is the size the arithmetic used. The chip takes its width and height from
  // the layout rather than from the text inside it, which is what makes that
  // true whatever the font metrics turn out to be on the device.
  const shellSrc = readFileSync(join(SRC, 'components/sandbox3d/Sandbox3D.tsx'), 'utf8');
  assert.match(shellSrc, /left: band\.x - band\.w \/ 2, top: band\.y - band\.h \/ 2, width: band\.w, height: band\.h/,
    'a row label no longer draws at the size and place it was measured at');
  assert.match(shellSrc, /left: col\.x - col\.w \/ 2, top: col\.y - col\.h \/ 2, width: col\.w, height: col\.h/,
    'a column number no longer draws at the size and place it was measured at');
  assert.match(shellSrc, /fontSize: RULER\.fontSize/, 'the label type size has drifted from the measured one');

  // The width the layout budgets has to be enough for the glyphs that go in
  // it, or the text is clipped by its own chip.
  const perGlyph = RULER.fontSize * RULER.advance + RULER.tracking;
  assert.ok(perGlyph >= RULER.fontSize * 0.62,
    `${RULER.advance} em is thinner than a Nunito Black digit really is`);
  assert.equal(ruler.labelWidth('29'), Math.round(2 * perGlyph + RULER.padX * 2));
  assert.ok(RULER.height >= RULER.fontSize * 1.3,
    `a ${RULER.fontSize} point glyph does not fit in a ${RULER.height} point box`);
  return `${RULER.fontSize}pt in a ${ruler.labelWidth('29')} by ${RULER.height} box`;
});

// ── 6. Purity ──────────────────────────────────────────────────────────────

check('nothing reaches for a browser API', () => {
  // React Native has no document, no window and no HTMLCanvasElement. Importing
  // a module that touches one is a red screen, not a type error, so this is the
  // only place it gets caught.
  const banned = /\b(document|localStorage|sessionStorage|HTMLCanvasElement|getContext|XMLHttpRequest)\b/;
  const offenders = [];
  walk(SANDBOX, (path) => {
    if (!/\.tsx?$/.test(path)) return;
    readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      if (banned.test(code)) offenders.push(`${relative(SANDBOX, path)}:${i + 1}  ${code.trim().slice(0, 70)}`);
    });
  });
  assert.equal(offenders.length, 0, `browser only API in a React Native module:\n${offenders.join('\n')}`);
});

check('the scene never allocates inside its frame loop', () => {
  // A `new THREE.Vector3()` per frame is 60 allocations a second per call site,
  // and on Hermes that is a garbage collection pause the learner sees as a
  // stutter while they are dragging the camera. The scratch vectors are hoisted
  // to module scope instead; this asserts they stayed there.
  const src = readFileSync(join(SANDBOX, 'scene.ts'), 'utf8');
  const from = src.indexOf('// ── frame loop ──');
  const to = src.indexOf('// ── end frame loop');
  assert.ok(from > 0 && to > from, 'the frame loop markers moved; this check is looking at nothing');
  const loop = src.slice(from, to);
  assert.ok(loop.length > 200, 'the frame loop markers moved; this check is no longer looking at it');
  const alloc = loop.match(/new THREE\.\w+\(/g);
  assert.equal(alloc, null, `the frame loop allocates: ${alloc && alloc.join(', ')}`);
});

// ── Report ─────────────────────────────────────────────────────────────────

rmSync(out, { recursive: true, force: true });

console.log('\nBreadboard\n');
console.log(results.join('\n'));
console.log('');

if (failures) {
  console.error(`${failures} check${failures === 1 ? '' : 's'} failed.\n`);
  process.exit(1);
}
console.log(`All ${results.length} checks passed.\n`);
