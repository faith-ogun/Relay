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

export type CircuitVariant = 'loop' | 'switch' | 'trace' | 'rc' | 'pin-direct' | 'transistor';

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
