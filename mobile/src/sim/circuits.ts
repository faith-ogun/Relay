import type { Comp } from './engine';

/**
 * The circuits the Circuit tab can run.
 *
 * Each one is a real netlist the engine solves, not an illustration with numbers
 * written on it. `build` takes the value of the single control the learner can
 * turn, so changing the resistor genuinely changes the current, and the LED
 * genuinely dims, because the solver said so.
 *
 * One control per circuit on purpose. Two knobs on a phone screen is a
 * laboratory; one is a question, and a question is what teaches.
 */

export interface LiveControl {
  label: string;
  /** Displayed after the value. */
  unit: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  /** Formats the raw value for display, since 10000 should read as 10k. */
  format?: (v: number) => string;
}

export interface LiveCircuitDef {
  id: string;
  title: string;
  /** One line on what the circuit is for. */
  blurb: string;
  /** What to watch while turning the control. */
  prompt: string;
  control: LiveControl;
  build: (value: number) => Comp[];
  /** Component whose current drives the LED glow, if the circuit has one. */
  ledId?: string;
  /** Nodes worth reporting, in reading order. */
  probes: { node: number; label: string }[];
  /** Branch currents worth reporting. */
  currents: { id: string; label: string }[];
  /** True when the circuit has a capacitor and should be stepped in time. */
  transient?: boolean;
}

const ohms = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `${v}`);

export const LIVE_CIRCUITS: LiveCircuitDef[] = [
  {
    id: 'series-led',
    title: 'LED with a series resistor',
    blurb: 'One loop: a 9V battery, a resistor, an LED.',
    prompt: 'Turn the resistor up and watch the current fall. Below about 220 ohms the LED is being pushed past what it can take.',
    control: { label: 'Resistor', unit: 'Ω', min: 47, max: 4700, step: 1, initial: 220, format: ohms },
    build: (r) => [
      { kind: 'V', id: 'bat', pos: 1, neg: 0, value: 9 },
      { kind: 'R', id: 'r1', a: 1, b: 2, value: r },
      { kind: 'LED', id: 'led', anode: 2, cathode: 0 },
    ],
    ledId: 'led',
    probes: [
      { node: 1, label: 'Battery +' },
      { node: 2, label: 'Across the LED' },
    ],
    currents: [{ id: 'r1', label: 'Loop current' }],
  },
  {
    id: 'divider',
    title: 'Voltage divider',
    blurb: 'Two resistors across 5V. The midpoint is what a sensor pin reads.',
    prompt: 'This is how every analog sensor works. Move the lower resistor and watch the midpoint move with it.',
    control: { label: 'Lower resistor', unit: 'Ω', min: 500, max: 20000, step: 100, initial: 10000, format: ohms },
    build: (r2) => [
      { kind: 'V', id: 'src', pos: 1, neg: 0, value: 5 },
      { kind: 'R', id: 'r1', a: 1, b: 2, value: 10000 },
      { kind: 'R', id: 'r2', a: 2, b: 0, value: r2 },
    ],
    probes: [
      { node: 1, label: 'Supply' },
      { node: 2, label: 'Midpoint' },
    ],
    currents: [{ id: 'r1', label: 'Through the divider' }],
  },
  {
    id: 'parallel',
    title: 'Two branches in parallel',
    blurb: 'Same voltage across both. The smaller resistor takes the bigger share.',
    prompt: 'Change one branch and watch the other stay exactly where it was. That independence is what parallel means.',
    control: { label: 'Second branch', unit: 'Ω', min: 220, max: 2200, step: 10, initial: 1000, format: ohms },
    build: (r2) => [
      { kind: 'V', id: 'src', pos: 1, neg: 0, value: 9 },
      { kind: 'R', id: 'r1', a: 1, b: 0, value: 1000 },
      { kind: 'R', id: 'r2', a: 1, b: 0, value: r2 },
    ],
    probes: [{ node: 1, label: 'Both branches' }],
    currents: [
      { id: 'r1', label: 'Branch 1 (1k)' },
      { id: 'r2', label: 'Branch 2' },
    ],
  },
  {
    id: 'rc',
    title: 'RC charging',
    blurb: 'A capacitor filling through a resistor. This is where time comes from.',
    prompt: 'Watch the voltage climb, fast at first and then slower. Raise the resistor and the whole thing stretches out.',
    control: { label: 'Resistor', unit: 'Ω', min: 1000, max: 47000, step: 500, initial: 10000, format: ohms },
    build: (r) => [
      { kind: 'V', id: 'src', pos: 1, neg: 0, value: 5 },
      { kind: 'R', id: 'r', a: 1, b: 2, value: r },
      { kind: 'C', id: 'c', a: 2, b: 0, value: 1e-5 },
    ],
    probes: [
      { node: 1, label: 'Supply' },
      { node: 2, label: 'Across the capacitor' },
    ],
    currents: [{ id: 'r', label: 'Charging current' }],
    transient: true,
  },
  {
    id: 'npn',
    title: 'Transistor as a switch',
    blurb: 'A small base current lets a much larger one through the LED.',
    prompt: 'Raise the base resistor until the transistor stops saturating. The LED does not dim gently, it gives up.',
    control: { label: 'Base resistor', unit: 'Ω', min: 1000, max: 100000, step: 500, initial: 10000, format: ohms },
    build: (rb) => [
      { kind: 'V', id: 'vcc', pos: 1, neg: 0, value: 5 },
      { kind: 'V', id: 'sig', pos: 4, neg: 0, value: 5 },
      { kind: 'R', id: 'rb', a: 4, b: 3, value: rb },
      { kind: 'R', id: 'rc', a: 1, b: 2, value: 220 },
      { kind: 'LED', id: 'led', anode: 2, cathode: 5 },
      { kind: 'Q', id: 'q1', base: 3, collector: 5, emitter: 0 },
    ],
    ledId: 'led',
    probes: [
      { node: 3, label: 'Base' },
      { node: 5, label: 'Collector' },
    ],
    currents: [
      { id: 'q1/b', label: 'Base current' },
      { id: 'rc', label: 'LED current' },
    ],
  },
];
