import {
  initTransient, solve, stepTransient,
  type Comp, type SolveResult, type TransientState,
} from '../../sim/engine';

// ── The free-form circuit model ──
//
// Everything about a hand built circuit that does not need a screen: what parts
// exist, where their pins sit, which pins are joined, the netlist that falls out
// of that, the solve, and an honest reading of what came back.
//
// It is deliberately a separate file from the component. The failures that
// matter here are arithmetic and topological, not visual: a battery whose two
// ends land on the same electrical node, a resistor wired at one end only, an
// LED past its rated current. Those are testable without rendering anything,
// and scripts/check-circuit-builder.mjs drives this module directly. A model
// buried inside a .tsx can only be checked by mounting it.
//
// Nothing in here imports React or react-native, and it must stay that way.

// ── Parts ──

export type PartKind =
  | 'battery' | 'resistor' | 'led' | 'capacitor' | 'npn' | 'diode' | 'switch' | 'ground';

export interface Part {
  /** Also the reference designator the learner sees: R1, LED2, BAT1. */
  id: string;
  kind: PartKind;
  /** Canvas points, body centre. */
  x: number;
  y: number;
  /** Two-pin parts only: pins run top and bottom when true, left and right when false. */
  vertical: boolean;
  /** Volts for a battery, ohms for a resistor, farads for a capacitor, gain for an NPN. */
  value: number;
  /** Switch only. */
  closed?: boolean;
}

/** A wire. `a` and `b` are pin references, not parts: a wire joins two pins. */
export interface Connection { id: string; a: string; b: string }

export interface CircuitSnapshot { parts: Part[]; connections: Connection[] }

export const pinRef = (partId: string, index: number): string => `${partId}#${index}`;
export const pinOwner = (ref: string): string => ref.slice(0, ref.lastIndexOf('#'));
export const pinIndexOf = (ref: string): number => Number(ref.slice(ref.lastIndexOf('#') + 1));

export interface KindSpec {
  label: string;
  /** Reference designator prefix. */
  prefix: string;
  /** Pin names in engine order. The order is load bearing: see buildNetlist. */
  pins: string[];
  values: readonly number[];
  defaultValue: number;
  rotatable: boolean;
  /** One line for the palette. Plain language: a learner reads this, not a datasheet. */
  blurb: string;
}

// Value ladders are E12 preferred values and real cell voltages rather than a
// continuous slider. Two reasons, and the second is the important one: a slider
// is imprecise under a thumb, and real components do not come in arbitrary
// values. Picking 220 from a row of chips is what happens at a real bench.
export const SPECS: Record<PartKind, KindSpec> = {
  battery: {
    label: 'Battery', prefix: 'BAT', pins: ['positive', 'negative'],
    values: [1.5, 3, 4.5, 5, 6, 9, 12], defaultValue: 5, rotatable: true,
    blurb: 'Pushes current round the loop.',
  },
  resistor: {
    label: 'Resistor', prefix: 'R', pins: ['end A', 'end B'],
    values: [10, 22, 47, 100, 220, 470, 1000, 2200, 4700, 10000, 22000, 47000, 100000],
    defaultValue: 220, rotatable: true,
    blurb: 'Limits how much current can flow.',
  },
  led: {
    label: 'LED', prefix: 'LED', pins: ['anode', 'cathode'],
    values: [], defaultValue: 0, rotatable: true,
    blurb: 'Lights up. Only one way round.',
  },
  capacitor: {
    label: 'Capacitor', prefix: 'C', pins: ['plate A', 'plate B'],
    values: [1e-6, 10e-6, 47e-6, 100e-6, 220e-6, 470e-6, 1000e-6],
    defaultValue: 100e-6, rotatable: true,
    blurb: 'Stores charge, then blocks steady current.',
  },
  npn: {
    label: 'NPN', prefix: 'Q', pins: ['base', 'collector', 'emitter'],
    values: [50, 100, 200, 400], defaultValue: 100, rotatable: false,
    blurb: 'A small base current switches a big one.',
  },
  diode: {
    label: 'Diode', prefix: 'D', pins: ['anode', 'cathode'],
    values: [], defaultValue: 0, rotatable: true,
    blurb: 'Lets current through one way only.',
  },
  switch: {
    label: 'Switch', prefix: 'SW', pins: ['end A', 'end B'],
    values: [], defaultValue: 0, rotatable: true,
    blurb: 'Breaks the loop, or closes it.',
  },
  ground: {
    label: 'Ground', prefix: 'GND', pins: ['ground'],
    values: [], defaultValue: 0, rotatable: false,
    blurb: 'The 0 V everything else is measured against.',
  },
};

export const PART_KINDS: PartKind[] = [
  'battery', 'resistor', 'led', 'capacitor', 'switch', 'npn', 'diode', 'ground',
];

// ── Geometry ──
//
// Every discrete touch target on the canvas is PIN_HIT square, which is the 44pt
// floor, and no two hit boxes of one part overlap. That constraint is what sets
// LEAD: a pin box spans LEAD ± PIN_HIT/2, so the body strip left between two
// pins is 2*LEAD - PIN_HIT wide. Shrink LEAD and the part stops being grabbable;
// grow it and fewer parts fit on a phone. 34 is the balance point.

export const PIN_HIT = 44;
export const PIN_R = 10;
const LEAD = 34;
/** Positions snap to this, so two parts can share an axis exactly and wires run straight. */
export const SNAP = 22;

const PIN_OFFSETS: Record<PartKind, ReadonlyArray<readonly [number, number]>> = {
  battery: [[-LEAD, 0], [LEAD, 0]],
  resistor: [[-LEAD, 0], [LEAD, 0]],
  led: [[-LEAD, 0], [LEAD, 0]],
  diode: [[-LEAD, 0], [LEAD, 0]],
  capacitor: [[-LEAD, 0], [LEAD, 0]],
  switch: [[-LEAD, 0], [LEAD, 0]],
  // Base out to the left, collector up, emitter down: the way the symbol is
  // always drawn, so the canvas matches every schematic the learner will meet.
  // The x is where the collector and emitter leads turn vertical in the glyph,
  // so the pin sits on the end of a drawn lead rather than floating beside one.
  npn: [[-34, 0], [14, -38], [14, 38]],
  ground: [[0, -24]],
};

/** Pin offset from the part centre, after rotation. */
export function pinOffset(part: Part, index: number): [number, number] {
  const raw = PIN_OFFSETS[part.kind][index] ?? [0, 0];
  if (!part.vertical || !SPECS[part.kind].rotatable) return [raw[0], raw[1]];
  // Quarter turn clockwise. Pin 0 goes to the top, which puts a battery's
  // positive plate uppermost, the way a schematic reads.
  return [-raw[1], raw[0]];
}

export function pinPoint(part: Part, index: number): { x: number; y: number } {
  const [dx, dy] = pinOffset(part, index);
  return { x: part.x + dx, y: part.y + dy };
}

export const pinCount = (kind: PartKind): number => SPECS[kind].pins.length;

/** True when the lead into this pin runs vertically, which decides how a wire elbows out of it. */
export function pinLeadVertical(part: Part, index: number): boolean {
  const [dx, dy] = pinOffset(part, index);
  return Math.abs(dy) > Math.abs(dx);
}

export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

/** The full footprint including every pin's hit box. This is the drag surface. */
export function partBounds(part: Part): Bounds {
  const half = PIN_HIT / 2;
  let b: Bounds = { minX: part.x - half, minY: part.y - half, maxX: part.x + half, maxY: part.y + half };
  for (let i = 0; i < pinCount(part.kind); i++) {
    const p = pinPoint(part, i);
    b = {
      minX: Math.min(b.minX, p.x - half), minY: Math.min(b.minY, p.y - half),
      maxX: Math.max(b.maxX, p.x + half), maxY: Math.max(b.maxY, p.y + half),
    };
  }
  return b;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const overlaps = (a: Bounds, b: Bounds, gap = 4) =>
  a.minX - gap < b.maxX && b.minX - gap < a.maxX && a.minY - gap < b.maxY && b.minY - gap < a.maxY;

/** Keep a part's whole footprint on the canvas, moving its centre as little as possible. */
export function clampToCanvas(part: Part, w: number, h: number): Part {
  const b = partBounds(part);
  let { x, y } = part;
  if (b.minX < 0) x += -b.minX;
  if (b.maxX > w) x -= b.maxX - w;
  if (b.minY < 0) y += -b.minY;
  if (b.maxY > h) y -= b.maxY - h;
  return { ...part, x: Math.round(x), y: Math.round(y) };
}

const EDGE = 66;
const STEP_X = 88;
const STEP_Y = 132;

export const slotColumns = (w: number): number[] => {
  const n = Math.max(1, Math.floor((w - EDGE * 2) / STEP_X) + 1);
  return Array.from({ length: n }, (_, i) => EDGE + i * STEP_X);
};
export const slotRows = (h: number): number[] => {
  const n = Math.max(1, Math.floor((h - EDGE * 2) / STEP_Y) + 1);
  return Array.from({ length: n }, (_, i) => EDGE + i * STEP_Y);
};

/**
 * Where a newly placed part goes.
 *
 * Parts are dropped into the first free slot rather than dragged out of the
 * palette. Dragging across a container boundary on a touch screen is a coin
 * flip about which view owns the gesture, and it asks the learner to be precise
 * before they have even chosen what they are building. One tap places it; drag
 * only ever means "move something that already exists".
 */
export function freeSlot(parts: Part[], kind: PartKind, vertical: boolean, w: number, h: number): { x: number; y: number } {
  const taken = parts.map(partBounds);
  for (const y of slotRows(h)) {
    for (const x of slotColumns(w)) {
      const probe = clampToCanvas({ id: '', kind, x, y, vertical, value: 0 }, w, h);
      const b = partBounds(probe);
      if (!taken.some((t) => overlaps(b, t))) return { x: probe.x, y: probe.y };
    }
  }
  // Every slot is occupied. Stack near the middle with a small offset rather
  // than refusing to place the part: the learner can drag it out, and a palette
  // tap that silently does nothing is worse than a crowded canvas.
  const n = parts.length;
  const probe = clampToCanvas(
    { id: '', kind, x: Math.round(w / 2) + (n % 3) * 16, y: Math.round(h / 2) + (n % 4) * 16, vertical, value: 0 },
    w, h,
  );
  return { x: probe.x, y: probe.y };
}

/** Corner points of the wire between two pins, elbowed so it reads as a schematic. */
export function wirePath(a: Part, ai: number, b: Part, bi: number): Array<{ x: number; y: number }> {
  const p = pinPoint(a, ai);
  const q = pinPoint(b, bi);
  if (p.x === q.x || p.y === q.y) return [p, q];
  // Leave the first pin along its own lead, so the wire looks soldered on
  // rather than crossing the component body.
  const elbow = pinLeadVertical(a, ai) ? { x: p.x, y: q.y } : { x: q.x, y: p.y };
  return [p, elbow, q];
}

// ── Netlist ──

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let cur = x;
    while (this.parent.get(cur) !== root) { const next = this.parent.get(cur)!; this.parent.set(cur, root); cur = next; }
    return root;
  }
  union(a: string, b: string): void { this.parent.set(this.find(a), this.find(b)); }
}

export interface CircuitNode { id: number; pins: string[]; partIds: string[] }

export interface NetlistBuild {
  netlist: Comp[];
  /** pin reference to engine node id. */
  nodeOf: Record<string, number>;
  nodes: CircuitNode[];
  /** True when a reference was found, either a ground symbol or a battery's negative pin. */
  grounded: boolean;
}

/** A closed switch still has contact resistance. Zero would be a perfect short, which teaches nothing. */
export const SWITCH_ON_OHMS = 0.02;
export const SWITCH_OFF_OHMS = 1e7;

/**
 * Pins joined by wires become one electrical node, and node 0 is ground.
 *
 * Ground is taken from a ground symbol if one is placed, and otherwise from the
 * first battery's negative pin. That fallback is not a shortcut: in a single
 * supply circuit the negative rail IS the reference everything is measured
 * against, and demanding the learner place a ground symbol before any number
 * appears would make the builder feel broken on the first try.
 */
export function buildNetlist(snap: CircuitSnapshot): NetlistBuild {
  const uf = new UnionFind();
  const refs: string[] = [];
  for (const p of snap.parts) {
    for (let i = 0; i < pinCount(p.kind); i++) { const r = pinRef(p.id, i); refs.push(r); uf.find(r); }
  }
  const known = new Set(refs);
  for (const c of snap.connections) if (known.has(c.a) && known.has(c.b)) uf.union(c.a, c.b);

  const groundRoots = new Set<string>();
  for (const p of snap.parts) if (p.kind === 'ground') groundRoots.add(uf.find(pinRef(p.id, 0)));
  if (groundRoots.size === 0) {
    const battery = snap.parts.find((p) => p.kind === 'battery');
    if (battery) groundRoots.add(uf.find(pinRef(battery.id, 1)));
  }

  // Ids are handed out in part order then pin order, so the same circuit always
  // produces the same netlist and a test can assert on it.
  const assigned = new Map<string, number>();
  let next = 1;
  const nodeOf: Record<string, number> = {};
  for (const r of refs) {
    const root = uf.find(r);
    if (groundRoots.has(root)) { nodeOf[r] = 0; continue; }
    let id = assigned.get(root);
    if (id === undefined) { id = next++; assigned.set(root, id); }
    nodeOf[r] = id;
  }

  const byNode = new Map<number, string[]>();
  for (const r of refs) {
    const id = nodeOf[r];
    const list = byNode.get(id);
    if (list) list.push(r); else byNode.set(id, [r]);
  }
  const nodes: CircuitNode[] = [...byNode.entries()]
    .map(([id, pins]) => ({ id, pins, partIds: [...new Set(pins.map(pinOwner))] }))
    .sort((a, b) => a.id - b.id);

  const netlist: Comp[] = [];
  for (const p of snap.parts) {
    const n = (i: number) => nodeOf[pinRef(p.id, i)] ?? 0;
    switch (p.kind) {
      case 'battery': netlist.push({ kind: 'V', id: p.id, pos: n(0), neg: n(1), value: p.value }); break;
      case 'resistor': netlist.push({ kind: 'R', id: p.id, a: n(0), b: n(1), value: Math.max(0.001, p.value) }); break;
      case 'switch': netlist.push({ kind: 'R', id: p.id, a: n(0), b: n(1), value: p.closed ? SWITCH_ON_OHMS : SWITCH_OFF_OHMS }); break;
      case 'led': netlist.push({ kind: 'LED', id: p.id, anode: n(0), cathode: n(1) }); break;
      case 'diode': netlist.push({ kind: 'D', id: p.id, anode: n(0), cathode: n(1) }); break;
      case 'capacitor': netlist.push({ kind: 'C', id: p.id, a: n(0), b: n(1), value: p.value }); break;
      case 'npn': netlist.push({ kind: 'Q', id: p.id, base: n(0), collector: n(1), emitter: n(2), beta: p.value }); break;
      case 'ground': break;
    }
  }

  return { netlist, nodeOf, nodes, grounded: groundRoots.size > 0 };
}

// ── Findings ──

export type Severity = 'danger' | 'warn' | 'note' | 'ok';

export type FindingCode =
  | 'empty' | 'no-source' | 'shorted-source' | 'unsolvable'
  | 'floating' | 'dangling' | 'open-loop' | 'cap-blocks-dc'
  | 'source-overcurrent' | 'led-overcurrent' | 'led-reverse' | 'switch-open'
  | 'running';

export interface Finding {
  code: FindingCode;
  severity: Severity;
  title: string;
  detail: string;
  partIds: string[];
}

/** Absolute maximum for a 5mm LED. Past this it does not get brighter, it dies. */
export const LED_MAX_MA = 25;
/** The current a 5mm LED is rated at, and so the point brightness tops out. */
export const LED_FULL_MA = 20;
/** A hand built circuit pulling more than this is a fault, not a design. */
export const SHORT_AMPS = 1;

const SEVERITY_ORDER: Record<Severity, number> = { danger: 0, warn: 1, note: 2, ok: 3 };

// ── Readouts ──

export interface PartReadout {
  id: string;
  kind: PartKind;
  label: string;
  valueText: string;
  /** Through the part. For a battery, the current it is delivering. Null when the solve failed. */
  amps: number | null;
  /** Across the part. Null when the solve failed. */
  volts: number | null;
  watts: number | null;
  /** 0 to 1. LEDs only, driven by the solved current, never by anything scripted. */
  brightness: number;
  /** One short phrase for the inspector. Empty when there is nothing worth saying. */
  state: string;
  pinsWired: number;
  pinCount: number;
}

export interface Analysis {
  build: NetlistBuild;
  netlist: Comp[];
  dc: SolveResult;
  solved: boolean;
  readouts: PartReadout[];
  nodeVolts: Record<number, number | null>;
  findings: Finding[];
  /** The single most important true thing about this circuit. Never null. */
  verdict: Finding;
}

const finite = (x: number | undefined): number | null =>
  x === undefined || !Number.isFinite(x) ? null : x;

/**
 * The signed current at one pin, positive when it flows INTO the part.
 *
 * Used to point the flow animation along a wire. It is never shown as a number,
 * because at a node joining three or more pins one pin's current is only its
 * share, and printing that would be a lie dressed as a measurement.
 */
export function pinCurrent(part: Part, index: number, I: Record<string, number>): number {
  const i = I[part.id] ?? 0;
  switch (part.kind) {
    // The MNA branch variable for a source is negative while the source
    // delivers, so a battery handing out 30 mA reads as -0.03 here.
    case 'battery': return index === 0 ? i : -i;
    case 'npn': {
      const ib = I[`${part.id}/b`] ?? 0;
      return index === 0 ? ib : index === 1 ? i : -(i + ib);
    }
    case 'ground': return 0;
    default: return index === 0 ? i : -i;
  }
}

function npnState(vce: number, ic: number): string {
  if (Math.abs(ic) < 1e-6) return 'Off';
  return vce < 0.4 ? 'Saturated, fully on' : 'Active, amplifying';
}

/** Per part numbers, read off whichever solve frame the caller wants: DC or a transient step. */
export function readouts(snap: CircuitSnapshot, build: NetlistBuild, res: SolveResult): PartReadout[] {
  const ok = res.ok;
  const volts = (node: number) => (ok ? finite(res.V[node]) : null);
  const partIdsAt = new Map(build.nodes.map((n) => [n.id, n.partIds]));

  return snap.parts.map((p) => {
    const n = (i: number) => build.nodeOf[pinRef(p.id, i)] ?? 0;
    const count = pinCount(p.kind);
    let wired = 0;
    for (let i = 0; i < count; i++) {
      const others = partIdsAt.get(n(i)) ?? [];
      if (others.some((id) => id !== p.id)) wired++;
    }

    const across = count >= 2 ? (() => {
      const a = volts(n(0)); const b = volts(n(1));
      return a === null || b === null ? null : a - b;
    })() : null;

    let amps: number | null = ok ? finite(res.I[p.id]) : null;
    let state = '';
    let brightness = 0;

    switch (p.kind) {
      case 'battery': {
        amps = amps === null ? null : -amps;
        state = amps === null ? '' : `Delivering ${fmtAmps(amps)}`;
        break;
      }
      case 'led': {
        const ma = (amps ?? 0) * 1000;
        brightness = Math.min(1, Math.max(0, ma / LED_FULL_MA));
        state = ma > LED_MAX_MA ? 'Past its limit'
          : ma >= 8 ? 'Lit'
            : ma >= 0.5 ? 'Dim'
              : across !== null && across < -0.2 ? 'In backwards, so it blocks'
                : 'Dark';
        break;
      }
      case 'diode':
        state = (amps ?? 0) > 1e-6 ? 'Conducting' : across !== null && across < -0.2 ? 'Blocking, reverse biased' : 'Not conducting';
        break;
      case 'switch':
        state = p.closed ? 'Closed' : 'Open';
        break;
      case 'capacitor':
        state = across === null ? ''
          : `Charged to ${fmtVolts(across)}`;
        break;
      case 'npn': {
        const vce = (() => { const c = volts(n(1)); const e = volts(n(2)); return c === null || e === null ? 0 : c - e; })();
        state = ok ? npnState(vce, amps ?? 0) : '';
        break;
      }
      case 'ground':
        amps = null;
        state = 'The 0 V reference';
        break;
      case 'resistor':
        state = across === null ? '' : `Dropping ${fmtVolts(Math.abs(across))}`;
        break;
    }

    const watts = amps === null || across === null ? null
      : p.kind === 'battery' ? Math.abs(amps) * p.value
        : Math.abs(amps * across);

    return {
      id: p.id, kind: p.kind, label: p.id,
      valueText: valueText(p),
      amps, volts: across, watts, brightness, state,
      pinsWired: wired, pinCount: count,
    };
  });
}

// ── Diagnosis ──

class NumUnionFind {
  private parent = new Map<number, number>();
  find(x: number): number {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    return root;
  }
  union(a: number, b: number): void { this.parent.set(this.find(a), this.find(b)); }
  same(a: number, b: number): boolean { return this.find(a) === this.find(b); }
}

/**
 * Can current get from one node back to the other without passing through
 * `exclude`? Used to answer "is this battery in a closed loop at all".
 */
function conducts(netlist: Comp[], exclude: string, withCaps: boolean): NumUnionFind {
  const uf = new NumUnionFind();
  for (const c of netlist) {
    if (c.id === exclude) continue;
    switch (c.kind) {
      case 'R': uf.union(c.a, c.b); break;
      case 'V': uf.union(c.pos, c.neg); break;
      case 'LED': case 'D': uf.union(c.anode, c.cathode); break;
      case 'C': if (withCaps) uf.union(c.a, c.b); break;
      case 'Q': uf.union(c.collector, c.emitter); uf.union(c.base, c.emitter); break;
      default: break;
    }
  }
  return uf;
}

export function diagnose(snap: CircuitSnapshot, build: NetlistBuild, res: SolveResult, reads: PartReadout[]): Finding[] {
  const out: Finding[] = [];
  const push = (f: Finding) => { out.push(f); };
  const readOf = new Map(reads.map((r) => [r.id, r]));
  const real = snap.parts.filter((p) => p.kind !== 'ground');

  if (snap.parts.length === 0) {
    return [{
      code: 'empty', severity: 'note',
      title: 'An empty bench.',
      detail: 'Pick a part below and tap to drop it on the board. A battery, a resistor and an LED is a whole circuit.',
      partIds: [],
    }];
  }

  const batteries = snap.parts.filter((p) => p.kind === 'battery');

  // 1. Shorted source. Checked before anything else, because the two pins land
  // on the same node and the solver then has a row that says V - V = 9, which
  // has no answer. Reporting "unsolvable" for this would hide the real lesson.
  for (const b of batteries) {
    if (build.nodeOf[pinRef(b.id, 0)] === build.nodeOf[pinRef(b.id, 1)]) {
      push({
        code: 'shorted-source', severity: 'danger',
        title: `${b.id} is shorted out.`,
        detail: `Both ends of ${b.id} are joined together with nothing in between. A real ${fmtVoltsNominal(b.value)} cell would dump everything it has into that wire, get hot and be ruined. Put a resistor in the loop.`,
        partIds: [b.id],
      });
    }
  }

  if (batteries.length === 0 && real.length > 0) {
    push({
      code: 'no-source', severity: 'warn',
      title: 'Nothing is powering this.',
      detail: 'Every voltage on the board is zero because there is no source. Add a battery and wire it into the loop.',
      partIds: [],
    });
  }

  // 2. Structural: parts wired at no end, or at only some of their ends.
  for (const r of reads) {
    if (r.kind === 'ground') continue;
    if (r.pinsWired === 0) {
      push({
        code: 'floating', severity: 'warn',
        title: `${r.label} is not wired to anything.`,
        detail: `It is sitting on the board on its own, so no current can reach it. Tap one of its pins, then tap the pin you want to join it to.`,
        partIds: [r.id],
      });
    } else if (r.pinsWired < r.pinCount) {
      push({
        code: 'dangling', severity: 'warn',
        title: `${r.label} is only wired at ${r.pinsWired} of its ${r.pinCount} pins.`,
        detail: 'Current has to have a way in and a way out. A part joined at one end only is a dead end, so nothing flows through it.',
        partIds: [r.id],
      });
    }
  }

  // 3. The solve itself failed, and it was not the short we already named.
  if (!res.ok && !out.some((f) => f.code === 'shorted-source')) {
    push({
      code: 'unsolvable', severity: 'danger',
      title: 'These connections contradict each other.',
      detail: 'There is no single set of voltages that fits. Two batteries of different sizes wired directly across each other is the usual cause: both insist on the same pair of nodes, and they cannot both be right.',
      partIds: [],
    });
  }

  if (res.ok) {
    // 4. Is each battery in a loop at all?
    for (const b of batteries) {
      const pos = build.nodeOf[pinRef(b.id, 0)];
      const neg = build.nodeOf[pinRef(b.id, 1)];
      if (pos === neg) continue; // already reported as a short
      if (!conducts(build.netlist, b.id, false).same(pos, neg)) {
        const viaCap = conducts(build.netlist, b.id, true).same(pos, neg);
        push(viaCap
          ? {
            code: 'cap-blocks-dc', severity: 'note',
            title: 'A capacitor is the only way back.',
            detail: `A capacitor charges up and then stops. Once it reaches ${fmtVoltsNominal(b.value)} nothing more flows, which is exactly what "a capacitor blocks DC" means. Watch it fill, then settle.`,
            partIds: [b.id],
          }
          : {
            code: 'open-loop', severity: 'warn',
            title: `${b.id} has no way back.`,
            detail: 'Current can only flow round a complete loop. Trace from the positive pin through your parts and back to the negative pin: somewhere that path is broken.',
            partIds: [b.id],
          });
      }
    }

    // 5. Overcurrent at the source. Solvable, and still a destroyed battery.
    for (const b of batteries) {
      const amps = readOf.get(b.id)?.amps ?? 0;
      if (Math.abs(amps) > SHORT_AMPS) {
        push({
          code: 'source-overcurrent', severity: 'danger',
          title: `${b.id} is delivering ${fmtAmps(Math.abs(amps))}.`,
          detail: 'That is a short circuit. There is a path across the battery with almost no resistance in it, and a real cell would overheat within seconds. Add resistance to that path.',
          partIds: [b.id],
        });
      }
    }

    // 6. The LED rules, which are the ones a beginner meets first.
    for (const r of reads) {
      if (r.kind !== 'led' || r.amps === null) continue;
      const ma = r.amps * 1000;
      if (ma > LED_MAX_MA) {
        push({
          code: 'led-overcurrent', severity: 'warn',
          title: `${r.label} is drawing ${fmtAmps(r.amps)}.`,
          detail: `Above ${LED_MAX_MA} mA an LED does not glow brighter, it burns out. Put a resistor in series with it: 220 ohms on a 5 V supply, or 470 on 9 V.`,
          partIds: [r.id],
        });
      } else if (r.volts !== null && r.volts < -0.2 && r.pinsWired === r.pinCount) {
        push({
          code: 'led-reverse', severity: 'note',
          title: `${r.label} is in backwards.`,
          detail: 'An LED only passes current one way. Its cathode, the flat bar in the symbol, has to face the negative side. Rotate it or rewire the two pins the other way round.',
          partIds: [r.id],
        });
      }
    }

    // 7. An open switch, which is a deliberate act rather than a mistake.
    for (const p of snap.parts) {
      if (p.kind !== 'switch' || p.closed) continue;
      const r = readOf.get(p.id);
      if (r && r.pinsWired === r.pinCount) {
        push({
          code: 'switch-open', severity: 'note',
          title: `${p.id} is open.`,
          detail: 'The loop is broken at the switch, so almost nothing is flowing. Tap the switch in the panel below to close it.',
          partIds: [p.id],
        });
      }
    }
  }

  if (out.length === 0) {
    const supply = batteries.map((b) => readOf.get(b.id)).find((r) => r && r.amps !== null);
    const lit = reads.filter((r) => r.kind === 'led' && r.brightness > 0.05).map((r) => r.label);
    push({
      code: 'running', severity: 'ok',
      title: supply && supply.amps !== null
        ? `Solved. ${supply.label} is delivering ${fmtAmps(Math.abs(supply.amps))}.`
        : 'Solved.',
      detail: lit.length
        ? `${lit.join(' and ')} ${lit.length > 1 ? 'are' : 'is'} lit. Change a resistor below and watch the current move.`
        : 'Every voltage and current on the board came out of the solver. Change a value and it re-solves as you go.',
      partIds: [],
    });
  }

  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export function analyse(snap: CircuitSnapshot): Analysis {
  const build = buildNetlist(snap);
  const dc = solve(build.netlist);
  const reads = readouts(snap, build, dc);
  const findings = diagnose(snap, build, dc, reads);
  const nodeVolts: Record<number, number | null> = {};
  for (const n of build.nodes) nodeVolts[n.id] = dc.ok ? finite(dc.V[n.id]) : null;
  return {
    build, netlist: build.netlist, dc, solved: dc.ok,
    readouts: reads, nodeVolts, findings, verdict: findings[0],
  };
}

// ── Live run ──
//
// A capacitor contributes nothing to a DC solve, by definition: it blocks steady
// current. Showing a flat 0.00 mA through one would be technically true and
// pedagogically useless, so when a capacitor is on the board the builder steps
// the engine's transient solver in real time instead, and the learner watches
// the thing charge. Nothing about that is animated by hand; every frame is a
// solve.

/** Backward Euler is unconditionally stable, so this is chosen for accuracy against the smallest RC a learner can build. */
export const LIVE_DT = 0.005;

export const isReactive = (netlist: Comp[]): boolean => netlist.some((c) => c.kind === 'C');

export const startLive = (netlist: Comp[]): TransientState => initTransient(netlist);

/** Advance the transient by `seconds` of wall clock and return the last frame. */
export function advanceLive(netlist: Comp[], st: TransientState, seconds: number, dt = LIVE_DT): SolveResult {
  // Capped so a stalled JS thread does not try to catch up with thousands of
  // steps in one frame and stall it further.
  const steps = Math.max(1, Math.min(200, Math.round(Math.min(seconds, 0.2) / dt)));
  let frame = stepTransient(netlist, st, dt);
  for (let i = 1; i < steps; i++) frame = stepTransient(netlist, st, dt);
  return frame;
}

/** Changes whenever the circuit the solver sees changes, so the live run knows to restart. */
export const netlistKey = (netlist: Comp[]): string => JSON.stringify(netlist);

// ── Editing ──

export function nextId(parts: Part[], kind: PartKind): string {
  const used = new Set(parts.map((p) => p.id));
  const prefix = SPECS[kind].prefix;
  for (let i = 1; ; i++) { const id = `${prefix}${i}`; if (!used.has(id)) return id; }
}

export function addPart(snap: CircuitSnapshot, kind: PartKind, w: number, h: number): { snap: CircuitSnapshot; id: string } {
  const spec = SPECS[kind];
  // Horizontal by default, matching the circuit the builder opens on.
  //
  // Vertical packs into three columns rather than two, which is the better use
  // of a tall canvas, but it meant deleting a part and adding it back gave you
  // something that did not look like what you removed. Least surprise beats
  // tighter packing, and rotation is one tap away for anyone who wants it.
  const vertical = false;
  const at = freeSlot(snap.parts, kind, vertical, w, h);
  const id = nextId(snap.parts, kind);
  const part: Part = {
    id, kind, x: at.x, y: at.y, vertical,
    value: spec.defaultValue,
    ...(kind === 'switch' ? { closed: true } : {}),
  };
  return { snap: { parts: [...snap.parts, part], connections: snap.connections }, id };
}

export function removePart(snap: CircuitSnapshot, id: string): CircuitSnapshot {
  return {
    parts: snap.parts.filter((p) => p.id !== id),
    connections: snap.connections.filter((c) => pinOwner(c.a) !== id && pinOwner(c.b) !== id),
  };
}

/**
 * Join two pins. Returns null when there is nothing to do, so the caller can say
 * why instead of silently appearing to work.
 */
export function connect(snap: CircuitSnapshot, a: string, b: string): CircuitSnapshot | null {
  if (a === b) return null;
  const build = buildNetlist(snap);
  if (build.nodeOf[a] !== undefined && build.nodeOf[a] === build.nodeOf[b]) return null;
  const id = `w${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  return { parts: snap.parts, connections: [...snap.connections, { id, a, b }] };
}

export function disconnect(snap: CircuitSnapshot, connectionId: string): CircuitSnapshot {
  return { parts: snap.parts, connections: snap.connections.filter((c) => c.id !== connectionId) };
}

/** Every wire touching this pin. Used by the inspector's per pin unwire. */
export const wiresAtPart = (snap: CircuitSnapshot, partId: string): Connection[] =>
  snap.connections.filter((c) => pinOwner(c.a) === partId || pinOwner(c.b) === partId);

/**
 * Move a part. `snapToGrid` is off while a finger is down and on when it lifts:
 * snapping live makes the part stutter under the thumb, and snapping on release
 * still guarantees two parts can share an axis exactly so a wire runs straight.
 */
export function movePart(
  snap: CircuitSnapshot, id: string, x: number, y: number, w: number, h: number, snapToGrid = true,
): CircuitSnapshot {
  const at = snapToGrid
    ? { x: Math.round(x / SNAP) * SNAP, y: Math.round(y / SNAP) * SNAP }
    : { x: Math.round(x), y: Math.round(y) };
  return {
    parts: snap.parts.map((p) => {
      if (p.id !== id) return p;
      const clamped = clampToCanvas({ ...p, ...at }, w, h);
      if (!snapToGrid) return clamped;
      // Snap AFTER clamping, then clamp again.
      //
      // Clamping moves a part by whatever it takes to get its whole footprint
      // back on the canvas, which is almost never a multiple of the grid. So a
      // part dragged off an edge landed between grid lines and no longer aligned
      // with anything else on the board. Re-snapping can push it back off by at
      // most half a step, hence the second clamp.
      const snapped = {
        ...clamped,
        x: Math.round(clamped.x / SNAP) * SNAP,
        y: Math.round(clamped.y / SNAP) * SNAP,
      };
      return clampToCanvas(snapped, w, h);
    }),
    connections: snap.connections,
  };
}

export function setValue(snap: CircuitSnapshot, id: string, value: number): CircuitSnapshot {
  return { parts: snap.parts.map((p) => (p.id === id ? { ...p, value } : p)), connections: snap.connections };
}

export function toggleSwitch(snap: CircuitSnapshot, id: string): CircuitSnapshot {
  return { parts: snap.parts.map((p) => (p.id === id ? { ...p, closed: !p.closed } : p)), connections: snap.connections };
}

export function rotatePart(snap: CircuitSnapshot, id: string, w: number, h: number): CircuitSnapshot {
  return {
    parts: snap.parts.map((p) => (p.id === id && SPECS[p.kind].rotatable
      ? clampToCanvas({ ...p, vertical: !p.vertical }, w, h)
      : p)),
    connections: snap.connections,
  };
}

export const EMPTY: CircuitSnapshot = { parts: [], connections: [] };

/**
 * A working 5 V, 220 ohm, LED loop, laid out on the slot grid so it reads like
 * a schematic: source up the left, the resistor across the top, the LED down
 * the right, the return along the bottom.
 *
 * The builder opens on this rather than on an empty board because a learner who
 * sees real numbers first understands what the board is for, and clearing it is
 * one tap.
 */
export function exampleCircuit(w: number, h: number): CircuitSnapshot {
  const cols = slotColumns(w);
  const rows = slotRows(h);
  const left = cols[0];
  const right = cols[cols.length - 1];
  const midX = Math.round((left + right) / 2 / SNAP) * SNAP;
  const top = rows[0];
  const mid = rows[Math.min(1, rows.length - 1)];

  const parts: Part[] = [
    { id: 'BAT1', kind: 'battery', x: left, y: mid, vertical: true, value: 5 },
    { id: 'R1', kind: 'resistor', x: midX, y: top, vertical: false, value: 220 },
    { id: 'LED1', kind: 'led', x: right, y: mid, vertical: true, value: 0 },
  ].map((p) => clampToCanvas(p as Part, w, h));

  return {
    parts,
    connections: [
      { id: 'w-ex1', a: pinRef('BAT1', 0), b: pinRef('R1', 0) },
      { id: 'w-ex2', a: pinRef('R1', 1), b: pinRef('LED1', 0) },
      { id: 'w-ex3', a: pinRef('LED1', 1), b: pinRef('BAT1', 1) },
    ],
  };
}

// ── Formatting ──
//
// Units are written the way an instrument writes them, with a fixed number of
// significant figures rather than a fixed number of decimals, so the digits
// stop jittering as a value moves.

const trim = (x: number): string => (Number.isInteger(x) ? String(x) : String(Number(x.toFixed(2))));

export function fmtOhms(r: number): string {
  if (r >= 1e6) return `${trim(r / 1e6)} MΩ`;
  if (r >= 1000) return `${trim(r / 1000)} kΩ`;
  return `${Math.round(r)} Ω`;
}

export function fmtFarads(f: number): string {
  const micro = f * 1e6;
  return micro >= 1000 ? `${trim(micro / 1000)} mF` : `${trim(micro)} µF`;
}

/** A nominal, printed-on-the-part value. Measurements use fmtVolts. */
export const fmtVoltsNominal = (v: number): string => `${trim(v)} V`;

export function fmtVolts(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return 'unknown';
  const mag = Math.abs(v);
  if (mag < 5e-4) return '0 V';
  if (mag >= 10) return `${v.toFixed(1)} V`;
  return `${v.toFixed(2)} V`;
}

export function fmtAmps(a: number | null): string {
  if (a === null || !Number.isFinite(a)) return 'unknown';
  const mag = Math.abs(a);
  if (mag >= 1) return `${a.toFixed(2)} A`;
  if (mag >= 1e-3) return `${(a * 1e3).toFixed(mag >= 0.01 ? 1 : 2)} mA`;
  if (mag >= 1e-6) return `${(a * 1e6).toFixed(0)} µA`;
  return '0 A';
}

export function fmtWatts(w: number | null): string {
  if (w === null || !Number.isFinite(w)) return 'unknown';
  if (w >= 1) return `${w.toFixed(2)} W`;
  if (w >= 1e-3) return `${(w * 1e3).toFixed(0)} mW`;
  return '0 W';
}

export function valueText(p: Part): string {
  switch (p.kind) {
    case 'battery': return fmtVoltsNominal(p.value);
    case 'resistor': return fmtOhms(p.value);
    case 'capacitor': return fmtFarads(p.value);
    case 'npn': return `gain ${p.value}`;
    case 'switch': return p.closed ? 'closed' : 'open';
    default: return '';
  }
}

export function valueLabel(kind: PartKind): string {
  switch (kind) {
    case 'battery': return 'Voltage';
    case 'resistor': return 'Resistance';
    case 'capacitor': return 'Capacitance';
    case 'npn': return 'Current gain';
    default: return '';
  }
}

export function formatValue(kind: PartKind, value: number): string {
  switch (kind) {
    case 'battery': return fmtVoltsNominal(value);
    case 'resistor': return fmtOhms(value);
    case 'capacitor': return fmtFarads(value);
    default: return String(value);
  }
}
