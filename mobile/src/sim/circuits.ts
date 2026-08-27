import type { Comp, SolveResult } from './engine';

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
 *
 * Every circuit owns its control OUTRIGHT. There is no shared scale and no
 * mapping from one circuit onto another: each picks the range where its own
 * physics is interesting, its own step, its own labelled stops, and its own
 * derived readings. That matters because the quantity worth watching is
 * different in each one. A series resistor changes the current continuously, so
 * the current is the reading. A base resistor does nothing at all until the
 * transistor leaves saturation, so the reading is the STATE. A charging
 * resistor never changes the settled voltage at all, only how long it takes to
 * get there, so the reading is the time. Point a single readout at all three
 * and two of the three sliders look broken, because nothing on screen answers
 * to them.
 */

export interface ControlTick {
  /** Where on this control's own scale the mark sits. */
  at: number;
  label: string;
  /** A stop that means something physical, drawn heavier than a plain mark. */
  key?: boolean;
}

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
  /** This circuit's own marked stops. Nothing is shared between circuits. */
  ticks?: ControlTick[];
}

/** A reading this circuit alone reports, because it alone cares about it. */
export interface DerivedRow {
  label: string;
  value: string;
  /** Drawn as the headline reading rather than another row in the list. */
  lead?: boolean;
}

export interface CircuitState {
  tone: 'good' | 'warn' | 'bad';
  title: string;
  body: string;
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
  /**
   * Rows only this circuit reports. This is where a circuit answers for its own
   * knob: the divider reports its ratio, the parallel pair reports the combined
   * resistance, the transistor reports the gain it is actually using.
   */
  derive?: (value: number, result: SolveResult | null) => DerivedRow[];
  /**
   * The one-line verdict at the top of the readout. Circuits whose numbers go
   * flat over part of the travel say WHY here, so the flat part still reads as
   * the control doing something rather than the app having frozen.
   */
  state?: (value: number, result: SolveResult | null) => CircuitState | null;
}

const ohms = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `${v}`);
const mA = (a: number | undefined) => Math.abs(a ?? 0) * 1000;

/** The absolute maximum for a standard 5mm red LED. Not a round 30. */
export const LED_MAX_MA = 25;

/**
 * Where the transistor stops saturating, measured against the engine rather
 * than derived on paper: the base resistor at which the LED current has drooped
 * 1% off its saturated value. Checked by scripts/check-live-circuits.mjs so it
 * cannot drift away from the model it describes.
 */
export const NPN_SATURATION_EDGE = 35400;

/** The capacitor in the RC circuit. A real 100uF electrolytic. */
export const RC_FARADS = 1e-4;

export const LIVE_CIRCUITS: LiveCircuitDef[] = [
  {
    id: 'series-led',
    title: 'LED with a series resistor',
    blurb: 'One loop: a 9V battery, a resistor, an LED.',
    prompt: 'Turn the resistor up and watch the current fall. Below about 470 ohms the LED is being pushed past what it can take.',
    control: {
      label: 'Resistor',
      unit: 'Ω',
      min: 47,
      max: 4700,
      step: 1,
      initial: 220,
      format: ohms,
      ticks: [
        { at: 47, label: '47' },
        { at: 470, label: '470', key: true },
        { at: 1000, label: '1k' },
        { at: 2200, label: '2.2k' },
        { at: 4700, label: '4.7k' },
      ],
    },
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
    derive: (_v, r) => {
      if (!r) return [];
      const drop = (r.V[1] ?? 0) - (r.V[2] ?? 0);
      return [{ label: 'Dropped by the resistor', value: `${drop.toFixed(2)} V` }];
    },
    state: (_v, r) => {
      if (!r) return null;
      const i = mA(r.I.r1);
      if (i > LED_MAX_MA) {
        return {
          tone: 'bad',
          title: 'Too much current',
          body: `${i.toFixed(1)} mA is past the ${LED_MAX_MA} mA a 5mm red LED is rated for. Turn the resistor up.`,
        };
      }
      if (i < 1) {
        return { tone: 'warn', title: 'Barely conducting', body: 'Under a milliamp. The LED is on, but your eye cannot tell.' };
      }
      return { tone: 'good', title: 'Healthy', body: `${i.toFixed(1)} mA, comfortably inside what the LED can take.` };
    },
  },
  {
    id: 'divider',
    title: 'Voltage divider',
    blurb: 'Two resistors across 5V. The midpoint is what a sensor pin reads.',
    prompt: 'This is how every analog sensor works. Move the lower resistor and watch the midpoint move with it.',
    control: {
      label: 'Lower resistor',
      unit: 'Ω',
      min: 500,
      max: 20000,
      step: 50,
      initial: 10000,
      format: ohms,
      ticks: [
        { at: 500, label: '500' },
        { at: 5000, label: '5k' },
        { at: 10000, label: '10k', key: true },
        { at: 15000, label: '15k' },
        { at: 20000, label: '20k' },
      ],
    },
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
    derive: (v, r) => {
      const rows: DerivedRow[] = [
        { label: 'Ratio', value: `${v} / ${v + 10000}`, lead: false },
      ];
      if (r) {
        const mid = r.V[2] ?? 0;
        // The number a sketch would actually read on an analog pin, which is the
        // whole reason a divider is worth learning.
        rows.unshift({ label: 'analogRead() would return', value: String(Math.round((mid / 5) * 1023)), lead: true });
      }
      return rows;
    },
    state: (v, r) => {
      if (!r) return null;
      const mid = r.V[2] ?? 0;
      if (v === 10000) {
        return { tone: 'good', title: 'Matched pair', body: 'Both resistors equal, so the midpoint sits at exactly half the supply.' };
      }
      return {
        tone: 'good',
        title: mid > 2.5 ? 'Biased high' : 'Biased low',
        body: `The lower resistor takes ${((mid / 5) * 100).toFixed(0)}% of the supply because it is ${v > 10000 ? 'larger' : 'smaller'} than the fixed 10k above it.`,
      };
    },
  },
  {
    id: 'parallel',
    title: 'Two branches in parallel',
    blurb: 'Same voltage across both. The smaller resistor takes the bigger share.',
    prompt: 'Change one branch and watch the other stay exactly where it was. That independence is what parallel means.',
    control: {
      label: 'Second branch',
      unit: 'Ω',
      min: 220,
      max: 2200,
      step: 5,
      initial: 1000,
      format: ohms,
      ticks: [
        { at: 220, label: '220' },
        { at: 1000, label: '1k', key: true },
        { at: 1500, label: '1.5k' },
        { at: 2200, label: '2.2k' },
      ],
    },
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
    derive: (v, r) => {
      const req = (1000 * v) / (1000 + v);
      const rows: DerivedRow[] = [
        { label: 'The pair behaves as', value: `${req.toFixed(0)} Ω`, lead: true },
      ];
      if (r) rows.push({ label: 'Total out of the battery', value: `${(mA(r.I.r1) + mA(r.I.r2)).toFixed(1)} mA` });
      return rows;
    },
    state: (v) => ({
      tone: 'good',
      title: 'Branch 1 has not moved',
      body: `Whatever you do here, branch 1 stays at 9.0 mA. The pair together looks like ${((1000 * v) / (1000 + v)).toFixed(0)} Ω, which is less than either branch on its own.`,
    }),
  },
  {
    id: 'rc',
    title: 'RC charging',
    blurb: 'A capacitor filling through a resistor. This is where time comes from.',
    // The control does not change where this circuit ends up. It changes how
    // long it takes, so that is what the tab must show, and it is why this
    // circuit needs a time readout that none of the others have.
    prompt: 'The capacitor always reaches 5V. The resistor decides how long that takes. Move it and watch the fill slow down.',
    control: {
      label: 'Resistor',
      unit: 'Ω',
      min: 1000,
      max: 10000,
      step: 25,
      initial: 2200,
      format: ohms,
      ticks: [
        { at: 1000, label: '1k' },
        { at: 2200, label: '2.2k' },
        { at: 4700, label: '4.7k' },
        { at: 10000, label: '10k' },
      ],
    },
    build: (r) => [
      { kind: 'V', id: 'src', pos: 1, neg: 0, value: 5 },
      { kind: 'R', id: 'r', a: 1, b: 2, value: r },
      { kind: 'C', id: 'c', a: 2, b: 0, value: RC_FARADS },
    ],
    probes: [
      { node: 1, label: 'Supply' },
      { node: 2, label: 'Across the capacitor' },
    ],
    currents: [{ id: 'r', label: 'Charging current' }],
    transient: true,
    derive: (v) => {
      const tau = v * RC_FARADS;
      return [
        { label: 'Time constant, R times C', value: `${tau.toFixed(2)} s`, lead: true },
        { label: '63% charged after', value: `${tau.toFixed(2)} s` },
        { label: 'Fully charged after about', value: `${(tau * 5).toFixed(1)} s` },
      ];
    },
    state: (v) => {
      const tau = v * RC_FARADS;
      return {
        tone: 'good',
        title: `One time constant is ${tau.toFixed(2)} s`,
        body: `100 µF through ${ohms(v)} Ω. Double the resistor and you double the wait, which is how every timing circuit is tuned.`,
      };
    },
  },
  {
    id: 'npn',
    title: 'Transistor as a switch',
    blurb: 'A small base current lets a much larger one through the LED.',
    // Saturated is FLAT on purpose. Below the edge the LED current does not
    // move at all no matter where the knob sits, and that is the entire lesson,
    // so the readout has to say "saturated" rather than show a number standing
    // still and let the learner conclude the slider is broken.
    prompt: 'Nothing happens for the first third of this slider, and that is the point. Push past 35k and the transistor finally runs out of base current.',
    control: {
      label: 'Base resistor',
      unit: 'Ω',
      min: 1000,
      max: 100000,
      step: 250,
      initial: 10000,
      format: ohms,
      ticks: [
        { at: 1000, label: '1k' },
        { at: 35400, label: '35k', key: true },
        { at: 68000, label: '68k' },
        { at: 100000, label: '100k' },
      ],
    },
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
    derive: (_v, r) => {
      if (!r) return [];
      const ib = mA(r.I['q1/b']);
      const ic = mA(r.I.rc);
      const rows: DerivedRow[] = [
        { label: 'Base current', value: ib < 1 ? `${(ib * 1000).toFixed(0)} µA` : `${ib.toFixed(2)} mA`, lead: true },
      ];
      if (ib > 0) rows.push({ label: 'Collector current is this many times it', value: `${(ic / ib).toFixed(0)}x` });
      return rows;
    },
    state: (v, r) => {
      if (!r) return null;
      const ic = mA(r.I.rc);
      if (v < NPN_SATURATION_EDGE * 0.95) {
        return {
          tone: 'good',
          title: 'Saturated, and staying there',
          body: 'More base current than the transistor needs, so the LED sits at full brightness and the number below will not move. Keep going.',
        };
      }
      if (ic > 1) {
        return {
          tone: 'warn',
          title: 'Out of saturation',
          body: `Not enough base current now, so the collector current is whatever the gain allows. The LED is at ${ic.toFixed(1)} mA and falling.`,
        };
      }
      return { tone: 'bad', title: 'Starved', body: 'Almost no base current left. The transistor has effectively turned off.' };
    },
  },
];
