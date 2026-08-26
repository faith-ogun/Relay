// ── From a board to a netlist ──
//
// This is the seam that decides whether the sandbox is a simulator or a
// diorama. Everything the learner has placed is turned into components for the
// real MNA solver in src/sim/engine.ts, the same solver the web app runs, and
// the LED on screen is lit by the current the matrix actually produced.
//
// The method is the one a person uses reading a board: walk every strip, every
// rail and every jumper, merge whatever is electrically the same into one node,
// then write down what sits between the nodes. Union-find does the merging.
//
// Pure TypeScript, no three.js, so scripts/check-breadboard.mjs can run a whole
// circuit through it in Node and assert the current.

import {
  initTransient, solve, stepTransient,
  type Comp, type SolveResult, type TransientState,
} from '../../sim/engine';
import {
  LED_VF, LOAD_OHMS, ldrOhms, partHoles, partValue, thermistorOhms,
} from './parts';
import { holeId, netOfHole, type HoleId, type NetKey } from './topology';
import type { PartReading, PlacedPart, SandboxSolution, Wire } from './types';

/** What an ATmega328P output pin looks like from outside: about 25 ohms. */
const PIN_OUTPUT_OHMS = 25;
/** Source impedance of a USB powered 5 V rail, so a dead short reads finite. */
const SUPPLY_OHMS = 0.35;
/** Above this the supply is being asked for more than a USB port will give. */
const SHORT_AMPS = 0.5;
/** An LED below this is not visibly doing anything. */
const LED_ON_AMPS = 0.0005;
/** Current at which an LED is at full brightness to the eye. */
const LED_FULL_AMPS = 0.018;

export interface NetlistInput {
  parts: PlacedPart[];
  wires: Wire[];
  /** Ambient light on any photocell, 0 dark to 1 direct sun. */
  light?: number;
  /** Degrees Celsius at any thermistor. */
  temperature?: number;
  /**
   * Uno pin drive, keyed by pin name, 0 to 1.
   *
   * A pin PRESENT with value 0 is driven low, which is a real connection to
   * ground through the output transistor. A pin ABSENT is an input, floating,
   * and gets no stamp at all. Collapsing those two into one would make every
   * pinMode mistake invisible, and pinMode mistakes are most of them.
   */
  pinDrive?: Record<string, number>;
  /** False models the USB lead being unplugged. */
  powered?: boolean;
  supplyVolts?: number;
}

export interface NetlistResult {
  netlist: Comp[];
  /** Net key to engine node number. Ground is 0. */
  node: Record<NetKey, number>;
  /** Part id to the ids of the components it produced. */
  emitted: Record<string, string[]>;
  /** Part id to its legs' holes, in pin order. */
  pinHoles: Record<string, (HoleId | null)[]>;
  /** Every net that ended up carrying something, for the shell's net highlighting. */
  nets: NetKey[];
}

/** Union-find over net keys. */
class Merge {
  private parent = new Map<NetKey, NetKey>();

  find(k: NetKey): NetKey {
    let root = this.parent.get(k);
    if (root === undefined) { this.parent.set(k, k); return k; }
    while (root !== this.parent.get(root)) root = this.parent.get(root)!;
    // Path compression, so a rail wired at fifty points stays O(1) to look up.
    let cur = k;
    while (cur !== root) { const next = this.parent.get(cur)!; this.parent.set(cur, root); cur = next; }
    return root;
  }

  union(a: NetKey, b: NetKey): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/** Build a netlist for the engine from what is on the board. */
export function buildNetlist(input: NetlistInput): NetlistResult {
  const { parts, wires } = input;
  const supply = input.supplyVolts ?? 5;
  const powered = input.powered ?? true;
  const light = input.light ?? 0.5;
  const temperature = input.temperature ?? 22;

  const merge = new Merge();
  const pinHoles: Record<string, (HoleId | null)[]> = {};
  const touched = new Set<NetKey>();

  const use = (net: NetKey): NetKey => { touched.add(net); return net; };

  // A jumper is a piece of wire. It merges nets rather than becoming a
  // component, which keeps the matrix small and, more importantly, means a
  // learner who wires a rail to itself gets nothing rather than a zero ohm
  // source the solver cannot handle.
  for (const w of wires) {
    const a = netOfHole(w.from);
    const b = netOfHole(w.to);
    merge.union(use(a), use(b));
  }

  // Parts: resolve legs, and merge for the things that really are conductors.
  for (const part of parts) {
    const holes = partHoles(part);
    pinHoles[part.id] = holes;
    const nets = holes.map((h) => (h ? use(netOfHole(h)) : null));

    if (part.kind === 'pushbutton') {
      // The two legs on each side of the ravine are joined inside the switch
      // whether or not anybody presses it. This is exactly why a button laid
      // out along one half of the board shorts a strip and does nothing.
      if (nets[0] && nets[1]) merge.union(nets[0], nets[1]);
      if (nets[2] && nets[3]) merge.union(nets[2], nets[3]);
      if (part.pressed && nets[0] && nets[2]) merge.union(nets[0], nets[2]);
    }
  }

  // Ground is the Uno's GND net. Everything else is numbered after it.
  const groundNet = merge.find(netOfHole(holeId.uno('GND')));
  touched.add(netOfHole(holeId.uno('GND')));

  const node: Record<NetKey, number> = {};
  const rootNumber = new Map<NetKey, number>();
  rootNumber.set(groundNet, 0);
  let next = 1;
  const numberOf = (net: NetKey): number => {
    const root = merge.find(net);
    let n = rootNumber.get(root);
    if (n === undefined) { n = next++; rootNumber.set(root, n); }
    node[net] = n;
    return n;
  };
  for (const net of touched) numberOf(net);

  const netlist: Comp[] = [];
  const emitted: Record<string, string[]> = {};
  const record = (id: string, comp: Comp) => {
    netlist.push(comp);
    (emitted[id] ??= []).push(comp.id);
  };

  // The supply. A real source impedance rather than an ideal 5 V, so a short
  // reads as a large but finite current the shell can warn about instead of a
  // singular matrix the learner sees as a crash.
  if (powered) {
    const rail = numberOf(netOfHole(holeId.uno('5V')));
    const inner = next++;
    netlist.push({ kind: 'V', id: 'usb', pos: inner, neg: 0, value: supply });
    netlist.push({ kind: 'R', id: 'usb/z', a: inner, b: rail, value: SUPPLY_OHMS });
    const v33 = numberOf(netOfHole(holeId.uno('3V3')));
    const inner33 = next++;
    netlist.push({ kind: 'V', id: 'reg33', pos: inner33, neg: 0, value: 3.3 });
    netlist.push({ kind: 'R', id: 'reg33/z', a: inner33, b: v33, value: 1 });
  }

  // Driven pins. An output high is a source through the pin's own resistance;
  // an output low is that same resistance to ground.
  if (powered && input.pinDrive) {
    for (const [pin, duty] of Object.entries(input.pinDrive)) {
      const net = netOfHole(holeId.uno(pin));
      const n = numberOf(net);
      if (duty > 0) {
        // PWM is a square wave, and this is a DC solver. Driving the pin at the
        // full rail and scaling the LED's BRIGHTNESS by duty is the honest
        // reading of both: the peak current through the series resistor is the
        // number Ohm's law gives at 5 V, and the eye integrates the duty.
        const inner = next++;
        netlist.push({ kind: 'V', id: `drv:${pin}`, pos: inner, neg: 0, value: supply });
        netlist.push({ kind: 'R', id: `drv:${pin}/z`, a: inner, b: n, value: PIN_OUTPUT_OHMS });
      } else {
        netlist.push({ kind: 'R', id: `drv:${pin}/z`, a: n, b: 0, value: PIN_OUTPUT_OHMS });
      }
    }
  }

  for (const part of parts) {
    const holes = pinHoles[part.id];
    const n = holes.map((h) => (h ? numberOf(netOfHole(h)) : null));
    if (n.some((v) => v === null)) continue; // a leg off the board conducts nothing

    switch (part.kind) {
      case 'led':
        record(part.id, {
          kind: 'LED', id: part.id, anode: n[0]!, cathode: n[1]!,
          vf: LED_VF[part.color ?? 'red'],
        });
        break;
      case 'resistor':
        record(part.id, { kind: 'R', id: part.id, a: n[0]!, b: n[1]!, value: partValue(part) });
        break;
      case 'ldr':
        record(part.id, { kind: 'R', id: part.id, a: n[0]!, b: n[1]!, value: ldrOhms(light) });
        break;
      case 'thermistor':
        record(part.id, {
          kind: 'R', id: part.id, a: n[0]!, b: n[1]!,
          value: thermistorOhms(temperature, partValue(part) || 10_000),
        });
        break;
      case 'capacitor':
        record(part.id, { kind: 'C', id: part.id, a: n[0]!, b: n[1]!, value: partValue(part) });
        break;
      case 'potentiometer': {
        // One track, tapped: the wiper splits the total resistance in two. A
        // wiper hard against an end would be a zero ohm branch, so both halves
        // keep a floor of one ohm, which is also what a real track does.
        const total = partValue(part) || 10_000;
        const w = Math.min(1, Math.max(0, part.wiper ?? 0.5));
        record(part.id, { kind: 'R', id: `${part.id}/a`, a: n[0]!, b: n[1]!, value: Math.max(1, total * w) });
        record(part.id, { kind: 'R', id: `${part.id}/b`, a: n[1]!, b: n[2]!, value: Math.max(1, total * (1 - w)) });
        break;
      }
      case 'transistor':
        record(part.id, {
          kind: 'Q', id: part.id, emitter: n[0]!, base: n[1]!, collector: n[2]!,
          beta: partValue(part) || 100,
        });
        break;
      case 'buzzer':
      case 'motor':
        record(part.id, {
          kind: 'R', id: part.id, a: n[0]!, b: n[1]!, value: LOAD_OHMS[part.kind]!,
        });
        break;
      case 'servo':
        // Its power comes off pins GND and V+; the signal pin is read, not loaded.
        record(part.id, { kind: 'R', id: part.id, a: n[1]!, b: n[0]!, value: LOAD_OHMS.servo! });
        break;
      case 'pushbutton':
        // Already handled by merging. Nothing to stamp.
        break;
      default: {
        // Exhaustiveness: a new kind added to the catalogue lands here at
        // compile time rather than silently contributing nothing.
        const unhandled: never = part.kind;
        void unhandled;
      }
    }
  }

  return { netlist, node, emitted, pinHoles, nets: [...touched] };
}

/** Turn a raw solve into the per part readings the scene animates. */
export function readSolution(
  input: NetlistInput,
  built: NetlistResult,
  result: SolveResult,
): SandboxSolution {
  const parts: Record<string, PartReading> = {};
  // Worked out once for the whole board rather than per part: it is a graph
  // walk, and a board with twenty parts on it would otherwise do twenty.
  const duties = propagateDuty(input, built);
  const dutyAt = (hole: HoleId | null | undefined): number => {
    if (!hole) return 0;
    const node = built.node[netOfHole(hole)];
    if (node === undefined) return 1;
    // No driven pin reaches here, so whatever is powering it is not switching:
    // a part wired straight to the 5 V rail is fully on, not off.
    return duties.get(node) ?? 1;
  };

  for (const part of input.parts) {
    const holes = built.pinHoles[part.id] ?? [];
    const nets = holes.map((h) => (h ? built.node[netOfHole(h)] : undefined));
    const va = nets[0] !== undefined ? (result.V[nets[0]] ?? 0) : 0;
    const vb = nets[nets.length - 1] !== undefined ? (result.V[nets[nets.length - 1]!] ?? 0) : 0;

    let current = result.I[part.id] ?? 0;
    if (part.kind === 'potentiometer') current = result.I[`${part.id}/a`] ?? 0;

    let brightness = 0;
    let on = false;

    if (part.kind === 'led') {
      // Duty of whichever pin is upstream cannot be known from the matrix, so
      // the scene is told the duty of every driven pin and the brightest one
      // feeding this LED's anode net wins. In practice that is the pin the
      // learner wired to it.
      const duty = dutyAt(holes[0]);
      const lit = Math.min(1, Math.max(0, current / LED_FULL_AMPS));
      on = current > LED_ON_AMPS && duty > 0;
      // Perceived brightness is not linear in current. The square root is the
      // cheap standard approximation and it is the difference between a fade
      // that looks like a fade and one that jumps at the end.
      brightness = on ? Math.sqrt(lit) * duty : 0;
    } else if (part.kind === 'buzzer' || part.kind === 'motor' || part.kind === 'servo') {
      const duty = dutyAt(holes[0]);
      on = Math.abs(current) > 0.002;
      brightness = on ? Math.min(1, Math.abs(current) / 0.04) * (duty > 0 ? duty : 1) : 0;
    } else {
      on = Math.abs(current) > 1e-6;
      brightness = 0;
    }

    parts[part.id] = { current, voltage: va - vb, on, brightness };
  }

  const supplyCurrent = Math.abs(result.I.usb ?? 0);
  return {
    ok: result.ok,
    parts,
    node: built.node,
    volts: result.V,
    supplyCurrent,
    shorted: supplyCurrent > SHORT_AMPS,
  };
}

/**
 * Which nodes a driven pin is actually switching.
 *
 * The naive version, "is this hole on the same net as a PWM pin", is wrong the
 * moment there is a series resistor, which is every LED circuit in the
 * curriculum: the LED sits one component downstream of the pin and shares no
 * net with it. So the netlist is walked as a graph from each driven pin
 * outward, stopping at ground and at the hard supplies, and every node it can
 * reach is being switched by that pin.
 *
 * Stopping at the supplies matters. A pin that reaches the 5 V rail through a
 * pull up is not switching the rail, and letting the duty cross it would dim
 * every other LED on the board.
 */
function propagateDuty(input: NetlistInput, built: NetlistResult): Map<number, number> {
  const out = new Map<number, number>();
  const drive = input.pinDrive;
  if (!drive) return out;

  const barrier = new Set<number>([0]);
  for (const rail of ['5V', '3V3', 'VIN']) {
    const n = built.node[netOfHole(holeId.uno(rail))];
    if (n !== undefined) barrier.add(n);
  }

  const adjacency = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    if (a === b) return;
    (adjacency.get(a) ?? adjacency.set(a, []).get(a)!).push(b);
    (adjacency.get(b) ?? adjacency.set(b, []).get(b)!).push(a);
  };
  for (const c of built.netlist) {
    if (c.kind === 'R' || c.kind === 'C') link(c.a, c.b);
    else if (c.kind === 'LED' || c.kind === 'D') link(c.anode, c.cathode);
    else if (c.kind === 'Q') link(c.collector, c.emitter);
    else if (c.kind === 'OP') link(c.vp, c.out);
  }

  for (const [pin, duty] of Object.entries(drive)) {
    const start = built.node[netOfHole(holeId.uno(pin))];
    if (start === undefined) continue;
    const queue = [start];
    const seen = new Set<number>([start]);
    while (queue.length) {
      const node = queue.shift()!;
      const prior = out.get(node);
      // Max, not min: two pins feeding one node means whichever is driving
      // hardest is the one the eye sees.
      out.set(node, prior === undefined ? duty : Math.max(prior, duty));
      for (const next of adjacency.get(node) ?? []) {
        if (seen.has(next) || barrier.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return out;
}

/**
 * Volts at any hole, after a solve. Null when that hole is in no circuit at
 * all, which is a different answer from zero volts and reads differently on a
 * probe.
 */
export function voltageAtHole(solution: SandboxSolution, hole: HoleId): number | null {
  const n = solution.node[netOfHole(hole)];
  if (n === undefined) return null;
  return solution.volts[n] ?? 0;
}

/** Build and solve in one step: the DC operating point of the board. */
export function solveBoard(input: NetlistInput): { built: NetlistResult; solution: SandboxSolution } {
  const built = buildNetlist(input);
  const solution = readSolution(input, built, solve(built.netlist));
  return { built, solution };
}

/**
 * A transient run, for boards with a capacitor on them.
 *
 * RC charging is the one thing a DC operating point cannot show, and it is the
 * whole of the timing unit in the curriculum, so the scene steps real time
 * whenever the board has a capacitor and falls back to the cheaper DC solve
 * when it does not.
 */
export class BoardTransient {
  private state: TransientState;

  constructor(private built: NetlistResult, private input: NetlistInput) {
    this.state = initTransient(built.netlist);
  }

  /** True when stepping is worth the cost. */
  static needed(built: NetlistResult): boolean {
    return built.netlist.some((c) => c.kind === 'C' || c.kind === 'NE555');
  }

  step(dt: number): SandboxSolution {
    const result = stepTransient(this.built.netlist, this.state, dt);
    return readSolution(this.input, this.built, result);
  }

  get elapsed(): number { return this.state.t; }
}
