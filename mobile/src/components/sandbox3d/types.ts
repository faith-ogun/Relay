// ── The public shape of the sandbox ──
//
// Everything the shell hands in and everything it gets back. Deliberately
// serialisable: a build a learner leaves half finished has to survive being
// written to Firestore and read back, so nothing in here is a class, a
// three.js object or a function.

import type { HoleId, NetKey } from './topology';

export type { HoleId, HoleInfo, NetKey } from './topology';

export type PartKind =
  | 'led'
  | 'resistor'
  | 'ldr'
  | 'thermistor'
  | 'capacitor'
  | 'pushbutton'
  | 'potentiometer'
  | 'buzzer'
  | 'transistor'
  | 'motor'
  | 'servo';

/** LED body colours, which are also their forward voltages. */
export type LedColor = 'red' | 'green' | 'blue' | 'yellow' | 'white';

/** The jumper colours in a starter kit's wire pack. */
export type WireColor = 'red' | 'black' | 'blue' | 'green' | 'yellow' | 'orange' | 'white';

/** Quarter turns clockwise, seen from above the board. */
export type Rotation = 0 | 1 | 2 | 3;

export interface PlacedPart {
  id: string;
  kind: PartKind;
  /** The hole the part's first pin sits in. Every other pin follows from it. */
  anchor: HoleId;
  rotation?: Rotation;
  /**
   * Ohms for a resistor or a pot, farads for a capacitor, unused elsewhere.
   * Absent means the catalogue default for the kind.
   */
  value?: number;
  color?: LedColor;
  /** A momentary switch that is currently held down. */
  pressed?: boolean;
  /** Potentiometer wiper, 0 at the first pin, 1 at the third. */
  wiper?: number;
}

export interface Wire {
  id: string;
  from: HoleId;
  to: HoleId;
  color?: WireColor;
}

/** What a tap on the board does. The shell owns the tool palette itself. */
export type SandboxTool = 'select' | 'place' | 'wire' | 'erase' | 'inspect';

export type CameraView = 'fit' | 'top' | 'front' | 'left' | 'detail';

/**
 * Rendering budget.
 *
 * 'auto' watches the real frame time and steps down on its own, which is the
 * only setting that behaves correctly on a phone nobody has tested on.
 */
export type Quality = 'auto' | 'high' | 'balanced' | 'low';

/** What the solver found for one part. */
export interface PartReading {
  /** Amps through the part, positive from its first pin to its last. */
  current: number;
  /** Volts across it. */
  voltage: number;
  /** Conducting enough to be doing something visible. */
  on: boolean;
  /**
   * 0 to 1, already including PWM duty. This is what the eye would see, not
   * the instantaneous current, which is why an LED on analogWrite(9, 64) reads
   * as a quarter lit rather than flickering.
   */
  brightness: number;
}

export interface SandboxSolution {
  /** False when the matrix was singular, which normally means nothing is connected. */
  ok: boolean;
  parts: Record<string, PartReading>;
  /** Net key to engine node number. Ground is node 0. */
  node: Record<NetKey, number>;
  /** Engine node number to volts. */
  volts: Record<number, number>;
  /** Total current out of the supply, in amps. */
  supplyCurrent: number;
  /** True when the supply is delivering more than a USB port would tolerate. */
  shorted: boolean;
}

export interface PerfSample {
  /** Exponential moving average of the frame time, milliseconds. */
  frameMs: number;
  /** What the renderer actually submitted on the last drawn frame. */
  drawCalls: number;
  triangles: number;
  /** The tier currently in force, after any automatic step down. */
  quality: Exclude<Quality, 'auto'>;
}

/** A hole the learner touched, with everything needed to act on it. */
export interface HoleTap {
  hole: HoleId;
  label: string;
  net: NetKey;
  /** Volts there on the last solve, when the circuit was running. */
  volts: number | null;
}
