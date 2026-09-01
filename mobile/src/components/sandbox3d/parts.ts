// ── The parts catalogue ──
//
// Two things live here and they have to agree: the FOOTPRINT (which holes a
// part's legs land in) and the ELECTRICAL MODEL (what the solver is handed).
// Keeping them in one file is the point. A resistor whose geometry spans four
// columns but whose netlist joins two adjacent ones is a simulator that lies,
// and a learner cannot tell which half was wrong.
//
// Lead pitches below are the real ones. A 5 mm LED has 2.54 mm legs, so it goes
// into two adjacent columns and no bending is needed. A quarter watt axial
// resistor is bent to 0.4 inch, which is what everybody actually does. Those
// spacings are why a real board feels the way it does, and inventing them would
// quietly break every instruction the curriculum gives.

import type { LedColor, PartKind, PlacedPart, Rotation, Wire } from './types';
import { holeId, offsetHole, type HoleId } from './topology';

export interface PinSpec {
  /** Printed on the part or in the datasheet: 'A', 'K', 'B', 'C', 'E'. */
  name: string;
  /** Columns from the anchor. */
  dcol: number;
  /** Rows from the anchor. */
  drow: number;
}

export interface PartSpec {
  kind: PartKind;
  /** What the gallery calls it. */
  label: string;
  pins: PinSpec[];
  /** Catalogue default for `PlacedPart.value`. */
  value?: number;
  /**
   * How far the tallest point of the assembled part reaches above the board,
   * in inches, animated pieces included.
   *
   * Kept honest by check-breadboard.mjs, which measures the real geometry and
   * fails if this drifts. A number that quietly disagrees with the mesh is
   * worse than no number, because a shell laying out a parts gallery or
   * framing a camera would trust it.
   */
  height: number;
  /** Polarity matters, so the scene marks the first pin. */
  polarised?: boolean;
}

export const PART_SPECS: Record<PartKind, PartSpec> = {
  // A 5 mm through hole LED. Legs on the native 2.54 mm pitch, anode long.
  led: {
    kind: 'led', label: 'LED', height: 0.32, polarised: true,
    pins: [{ name: 'A', dcol: 0, drow: 0 }, { name: 'K', dcol: 1, drow: 0 }],
  },
  // Quarter watt carbon film, leads bent to 0.4 inch.
  resistor: {
    kind: 'resistor', label: 'Resistor', height: 0.11, value: 220,
    pins: [{ name: '1', dcol: 0, drow: 0 }, { name: '2', dcol: 4, drow: 0 }],
  },
  // GL5528 photocell. Datasheet pitch is 3.4 mm, and it is always spread to
  // 0.2 inch on a board because it will not stay put otherwise.
  ldr: {
    kind: 'ldr', label: 'Light sensor', height: 0.11,
    pins: [{ name: '1', dcol: 0, drow: 0 }, { name: '2', dcol: 2, drow: 0 }],
  },
  thermistor: {
    kind: 'thermistor', label: 'Thermistor', height: 0.16, value: 10_000,
    pins: [{ name: '1', dcol: 0, drow: 0 }, { name: '2', dcol: 2, drow: 0 }],
  },
  // Radial electrolytic, 100 uF, 2.5 mm lead pitch rounds to one column.
  capacitor: {
    kind: 'capacitor', label: 'Capacitor', height: 0.44, value: 100e-6, polarised: true,
    pins: [{ name: '+', dcol: 0, drow: 0 }, { name: '-', dcol: 1, drow: 0 }],
  },
  // 6 mm tactile switch. Its four legs straddle the ravine, which is the whole
  // reason it is usable: the pair on each side of the gap is internally joined,
  // and pressing bridges the two pairs.
  pushbutton: {
    kind: 'pushbutton', label: 'Button', height: 0.18,
    pins: [
      { name: 'A1', dcol: 0, drow: 0 }, { name: 'A2', dcol: 2, drow: 0 },
      { name: 'B1', dcol: 0, drow: 1 }, { name: 'B2', dcol: 2, drow: 1 },
    ],
  },
  // 10k trimmer, three legs on the 0.1 inch pitch, wiper in the middle.
  potentiometer: {
    kind: 'potentiometer', label: 'Potentiometer', height: 0.32, value: 10_000,
    pins: [
      { name: '1', dcol: 0, drow: 0 }, { name: 'W', dcol: 1, drow: 0 }, { name: '3', dcol: 2, drow: 0 },
    ],
  },
  // Active piezo buzzer, 12 mm, 0.2 inch pins, polarised.
  buzzer: {
    kind: 'buzzer', label: 'Buzzer', height: 0.35, polarised: true,
    pins: [{ name: '+', dcol: 0, drow: 0 }, { name: '-', dcol: 2, drow: 0 }],
  },
  // P2N2222A in a TO-92. Flat face towards you the order reads E, B, C, which
  // is the single most commonly mis-wired thing in the whole kit.
  transistor: {
    kind: 'transistor', label: 'Transistor', height: 0.22, value: 100,
    pins: [
      { name: 'E', dcol: 0, drow: 0 }, { name: 'B', dcol: 1, drow: 0 }, { name: 'C', dcol: 2, drow: 0 },
    ],
  },
  motor: {
    kind: 'motor', label: 'DC motor', height: 0.79, polarised: false,
    pins: [{ name: '1', dcol: 0, drow: 0 }, { name: '2', dcol: 2, drow: 0 }],
  },
  // A hobby servo's pigtail: brown ground, red power, orange signal.
  servo: {
    kind: 'servo', label: 'Servo', height: 0.77,
    pins: [
      { name: 'GND', dcol: 0, drow: 0 }, { name: 'V+', dcol: 1, drow: 0 }, { name: 'SIG', dcol: 2, drow: 0 },
    ],
  },
};

/** Rotate a footprint offset by quarter turns, clockwise from above. */
export function rotateOffset(dcol: number, drow: number, rotation: Rotation): [number, number] {
  switch (rotation) {
    case 1: return [-drow, dcol];
    case 2: return [-dcol, -drow];
    case 3: return [drow, -dcol];
    default: return [dcol, drow];
  }
}

/**
 * The holes a placed part's legs are in, in pin order.
 *
 * A null entry means that leg hangs off the edge of the board. That is a real
 * state, not an error to throw on: a learner dragging a part towards the edge
 * needs to see it refuse before they let go.
 */
export function partHoles(part: PlacedPart): (HoleId | null)[] {
  const spec = PART_SPECS[part.kind];
  const rot = part.rotation ?? 0;
  return spec.pins.map((pin) => {
    const [dcol, drow] = rotateOffset(pin.dcol, pin.drow, rot);
    return offsetHole(part.anchor, dcol, drow);
  });
}

/** True when every leg lands on the board. */
export function isPlaceable(part: PlacedPart): boolean {
  return partHoles(part).every((h) => h !== null);
}

/** Forward voltage of an LED, by colour. These are datasheet typicals. */
export const LED_VF: Record<LedColor, number> = {
  red: 1.9, yellow: 2.0, green: 2.1, blue: 3.1, white: 3.1,
};

/** Body colour of an LED, as it looks unlit. */
export const LED_TINT: Record<LedColor, number> = {
  red: 0xd94436, yellow: 0xd9b52a, green: 0x3fae4a, blue: 0x3d6fd4, white: 0xdfe4ea,
};

/** Emitted colour, which is not the body colour: a lit LED washes towards white. */
export const LED_EMIT: Record<LedColor, number> = {
  red: 0xff4436, yellow: 0xffd43a, green: 0x54ff62, blue: 0x5fa2ff, white: 0xffffff,
};

/**
 * Photocell resistance for an ambient light level of 0 (dark) to 1 (sunlight).
 *
 * A GL5528 is specified at 10 to 20 kOhm under 10 lux with a gamma near 0.7,
 * and about 1 MOhm in the dark. Modelling that curve rather than a linear fade
 * is what makes the light sensor lesson land: the learner discovers the
 * response is steep near darkness and almost flat in daylight, which is the
 * actual reason a threshold has to be tuned.
 */
export function ldrOhms(light: number): number {
  const l = Math.min(1, Math.max(0, light));
  const lux = Math.pow(10, l * 5 - 1);
  const r = 12_000 * Math.pow(10 / lux, 0.7);
  return Math.min(1_000_000, Math.max(90, r));
}

/**
 * NTC thermistor resistance at a temperature in Celsius.
 *
 * Beta model, B = 3950, 10 kOhm at 25 C: the part in the starter kit.
 */
export function thermistorOhms(celsius: number, nominal = 10_000): number {
  const t = celsius + 273.15;
  return nominal * Math.exp(3950 * (1 / t - 1 / 298.15));
}

/** Resistance a part presents when it is modelled as a plain load. */
export const LOAD_OHMS: Partial<Record<PartKind, number>> = {
  // An active buzzer draws about 30 mA at 5 V.
  buzzer: 160,
  // A small brushed motor, running rather than stalled.
  motor: 60,
  // A hobby servo idling. Its torque comes from elsewhere; the board only
  // has to know it is a load on the 5 V rail.
  servo: 100,
};

/** Which pin index carries the signal, for parts that are told what to do. */
export const SIGNAL_PIN: Partial<Record<PartKind, number>> = { servo: 2 };

/** Default value for a kind, when the placed part does not carry one. */
export function partValue(part: PlacedPart): number {
  return part.value ?? PART_SPECS[part.kind].value ?? 0;
}

/** A fresh id that will not collide with anything already on the board. */
export function newPartId(kind: PartKind, existing: ReadonlyArray<{ id: string }>): string {
  let n = 1;
  const taken = new Set(existing.map((p) => p.id));
  while (taken.has(`${kind}-${n}`)) n += 1;
  return `${kind}-${n}`;
}

/**
 * A first build for an empty board: the light activated alarm from the
 * curriculum, already wired. The shell can offer it rather than showing an
 * empty board, which is the difference between a sandbox and a blank page.
 */
export function starterBuild(): { parts: PlacedPart[]; wires: Wire[] } {
  // The divider: 5 V, photocell, junction at column 13, 10k to ground, A0 on
  // the junction. Then D9 through 220R into the LED and back to ground. Every
  // join below is two DIFFERENT holes of the SAME five hole strip, because two
  // legs cannot share one hole on a real board either.
  const parts: PlacedPart[] = [
    { id: 'ldr-1', kind: 'ldr', anchor: holeId.bb(10, 5) },
    { id: 'resistor-1', kind: 'resistor', anchor: holeId.bb(12, 6), value: 10_000 },
    { id: 'resistor-2', kind: 'resistor', anchor: holeId.bb(24, 5), value: 220 },
    { id: 'led-1', kind: 'led', anchor: holeId.bb(28, 6), color: 'red' },
  ];
  const wires: Wire[] = [
    { id: 'w-1', from: holeId.uno('5V'), to: holeId.rail(3, 5), color: 'red' },
    { id: 'w-2', from: holeId.uno('GND'), to: holeId.rail(2, 5), color: 'black' },
    { id: 'w-3', from: holeId.rail(3, 12), to: holeId.bb(10, 6), color: 'red' },
    { id: 'w-4', from: holeId.bb(16, 7), to: holeId.rail(2, 20), color: 'black' },
    { id: 'w-5', from: holeId.bb(12, 7), to: holeId.uno('A0'), color: 'blue' },
    { id: 'w-6', from: holeId.uno('D9'), to: holeId.bb(24, 6), color: 'orange' },
    { id: 'w-7', from: holeId.bb(29, 7), to: holeId.rail(2, 32), color: 'black' },
  ];
  return { parts, wires };
}
