/** The visual for one narrated segment. Kept to a small vocabulary on purpose:
 *  a film that invents a new layout every ten seconds reads as a showreel, not
 *  a lesson. */
export type Scene =
  | { kind: 'title' }
  | { kind: 'statement'; lines: string[] }
  | { kind: 'circuit'; variant: CircuitVariant; flow?: boolean; broken?: 'right' | 'left';
      highlight?: string; label?: string }
  | { kind: 'compare'; left: string; right: string; caption: string }
  | { kind: 'formula'; expr: string; note?: string }
  | { kind: 'plot'; upTo: number; marker?: string; note?: string }
  | { kind: 'recap'; items: string[] }
  | { kind: 'outro' };

/** The drawings. Mostly schematics; `wave` and `bode` are signal pictures, and
 *  they live here rather than as new Scene kinds because they occupy the same
 *  slot in a film, a diagram under a line of narration, and adding a scene kind
 *  for each would grow the vocabulary the film is deliberately built on.
 *
 *  Several are parameterised through `highlight`, which new variants read as a
 *  SPACE SEPARATED TOKEN SET rather than a single name: "ldr r1" both draws the
 *  top element as a light dependent resistor and rings it. */
export type CircuitVariant =
  | 'loop' | 'switch' | 'trace' | 'rc' | 'pin-direct' | 'transistor'
  | 'divider' | 'led' | 'parallel' | 'breadboard' | 'pullup'
  | 'opamp' | 'gate' | 'regulator' | 'flyback' | 'board'
  | 'wave' | 'bode';

export interface Segment {
  /** What the narrator says. One or two sentences: each becomes its own shot. */
  text: string;
  scene: Scene;
}

export interface LessonScript {
  id: string;
  title: string;
  unitTitle: string;
  unitId: string;
  skillId: string;
  skillTitle: string;
  accent: string;
  segments: Segment[];
}

/** Per-segment audio length, measured after synthesis. The film is laid out from
 *  these rather than from guessed durations, so narration and picture cannot
 *  drift apart over four minutes. */
export interface Timing {
  index: number;
  seconds: number;
  file: string;
}
