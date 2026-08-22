// Lesson step shapes, mirroring frontend/components/ohmlet/data/lessons.ts.
// The eight implemented here cover 88% of all 2,355 authored steps; the
// drawing family (draw_circuit, draw_fix, draw_connection) needs a canvas and
// lands separately rather than being faked.

export interface StepTeach {
  type: 'teach';
  title: string;
  body: string;
  diagram?: string;
  circuitDiagram?: string;
  hotspots?: Array<{ region: string; label: string; detail: string }>;
}

export interface StepChoice {
  // predict_reading and predict_behavior are choice questions with a framing
  // that asks the learner to commit before the answer is revealed.
  type: 'multiple_choice' | 'predict_reading' | 'predict_behavior' | 'choose_resistor' | 'identify_component';
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  circuitDiagram?: string;
  meter?: { unit: string; min: number; max: number; step?: number; target: number; tolerance: number };
}

export interface StepTrueFalse {
  type: 'true_false';
  statement: string;
  correct: boolean;
  explanation: string;
  circuitDiagram?: string;
}

export interface StepFill {
  type: 'fill_blank';
  prompt: string;
  blank: string;
  answer: string;
  hint: string;
  tiles?: string[];
  circuitDiagram?: string;
}

export interface StepMatch {
  type: 'match';
  instruction: string;
  pairs: Array<[string, string]>;
}

export interface StepDragOrder {
  type: 'drag_order';
  instruction: string;
  items: string[];
  correctOrder: number[];
}

export type LessonStep =
  | StepTeach | StepChoice | StepTrueFalse | StepFill | StepMatch | StepDragOrder
  | { type: string; [k: string]: unknown };   // authored types not yet on mobile

export interface Lesson {
  steps: LessonStep[];
  xpReward: number;
  [k: string]: unknown;
}

/** Types the mobile runner can present today. */
export const SUPPORTED = new Set([
  'teach', 'multiple_choice', 'true_false', 'fill_blank', 'match', 'drag_order',
  'predict_reading', 'predict_behavior', 'choose_resistor', 'identify_component',
]);

export const isTeach = (s: LessonStep): boolean => s.type === 'teach';
