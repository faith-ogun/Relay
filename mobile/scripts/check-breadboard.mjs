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
//   4. PURITY. Nothing under sandbox3d/ touches a browser only API. React
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

// ── 4. Purity ──────────────────────────────────────────────────────────────

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
