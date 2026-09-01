import { hasRegions } from '../components/circuits/CircuitDiagram';
import type { MeterSpec } from './meterScale';

// Lesson step shapes, mirroring frontend/components/ohmlet/data/lessons.ts.
// Every authored step type is now represented: the eight core types, the
// drawing family (draw_circuit, draw_fix, draw_connection), and the four
// circuit-interaction types (spot_error, fix_the_circuit, trace_current,
// build_to_spec) that ask the learner to work on the schematic itself.

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
  /** Present on 155 of the 208 predict_reading steps. See StepPredictReading. */
  meter?: MeterSpec;
  /** Present on 45 of the 49 choose_resistor steps. See StepChooseResistor. */
  bands?: BandSpec;
}

/**
 * A predict_reading step that carries an instrument.
 *
 * These are NOT choice questions, whatever their `options` array says. The
 * author asks the learner to dial a value, and the single-entry `options` array
 * on 154 of them holds the answer as plain text, so rendering them as a list
 * puts the answer on a button. `meter` is what the step is really made of, and
 * MeterStep is the renderer for it.
 */
export type StepPredictReading = StepChoice & { type: 'predict_reading'; meter: MeterSpec };

/**
 * A choose_resistor step that carries a target value to encode in colour bands.
 * Same story: 44 of the 45 have a single option holding the answer.
 */
export type StepChooseResistor = StepChoice & { type: 'choose_resistor'; bands: BandSpec };

/** The target ohms a resistor's colour bands must encode. */
export interface BandSpec { targetOhms: number }

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

export interface StepConnect {
  type: 'draw_connection';
  instruction: string;
  terminals: Array<{ x: number; y: number; label: string; id: string }>;
  expectedConnections: Array<[string, string]>;
  explanation: string;
}

export interface StepDraw {
  // draw_circuit is freeform; draw_fix starts from a broken diagram. Both are
  // graded by the vision model rather than by string comparison.
  type: 'draw_circuit' | 'draw_fix';
  instruction: string;
  expected: string[];
  hint: string;
  explanation: string;
  circuitDiagram?: string;
}

export interface StepSpotError {
  type: 'spot_error';
  question: string;
  circuitDiagram: string;
  correctRegion: string;
  explanation: string;
  hint?: string;
}

/**
 * Tap the named component on a circuit diagram.
 *
 * Note there are no `options`: this is a diagram interaction, not a choice list.
 * It was routed to the choice renderer, which mapped over the absent array and
 * threw — taking down 42 of the 142 lessons.
 */
export interface StepIdentify {
  type: 'identify_component';
  question: string;
  circuitDiagram: string;
  correctComponent: string;
  explanation: string;
  hint?: string;
}

export interface StepFixCircuit {
  type: 'fix_the_circuit';
  question: string;
  circuitDiagram: string;
  faultRegion: string;
  fixes: string[];
  correctFix: number;
  explanation: string;
  hint?: string;
}

export interface StepTraceCurrent {
  type: 'trace_current';
  question: string;
  circuitDiagram: string;
  /** Regions in the order current passes through them. */
  correctPath: string[];
  explanation: string;
  hint?: string;
}

export interface StepBuildToSpec {
  type: 'build_to_spec';
  instruction: string;
  /** Parts on offer; more than there are slots, so choosing matters. */
  palette: string[];
  slots: number;
  /** Palette indices, in the order they belong. */
  correct: number[];
  explanation: string;
  hint?: string;
  circuitDiagram?: string;
}

export type LessonStep =
  | StepTeach | StepChoice | StepTrueFalse | StepFill | StepMatch | StepDragOrder
  | StepConnect | StepDraw
  | StepSpotError | StepIdentify | StepFixCircuit | StepTraceCurrent | StepBuildToSpec
  | { type: string; [k: string]: unknown };   // authored types not yet on mobile

/**
 * What every step renderer receives from the run shell.
 *
 * Lives here rather than inside StepView so a renderer in its own file can take
 * the same contract without importing the router that renders it.
 */
export interface StepProps {
  step: LessonStep;
  checked: boolean;
  correct: boolean | null;
  /** Report whether the learner's current answer is correct. */
  onSubmit: (isCorrect: boolean) => void;
  /**
   * The grader could not be reached, so this step goes by without a verdict.
   * Distinct from onSubmit(true), which claims the learner was right.
   */
  onUnassessed: () => void;
  /** Lets the shell enable/disable its Check button. */
  onCanCheck: (can: boolean) => void;
  /** Set by the shell: pressing Check calls this step's grader. */
  registerGrader: (grade: (() => void) | null) => void;
  /** Raised while a finger owns a gesture (a drawn stroke, a dragged dial), so
   *  the shell can stop its ScrollView competing for the same movement. */
  onDrawingChange?: (drawing: boolean) => void;
}

export interface Lesson {
  steps: LessonStep[];
  xpReward: number;
  [k: string]: unknown;
}

/** Types the mobile runner can present today. */
export const SUPPORTED = new Set([
  'teach', 'multiple_choice', 'true_false', 'fill_blank', 'match', 'drag_order',
  'predict_reading', 'predict_behavior', 'choose_resistor', 'identify_component',
  'draw_connection', 'draw_circuit', 'draw_fix',
  'spot_error', 'fix_the_circuit', 'trace_current', 'build_to_spec',
]);

export const isTeach = (s: LessonStep): boolean => s.type === 'teach';

/**
 * True when the runner can present this step for real. Beyond the type being
 * implemented, the circuit-interaction steps need every region they name to
 * exist on their diagram: a step asking the learner to tap a part that has no
 * hit area would be unanswerable, so it is dropped from the run rather than
 * shown as an exercise that cannot be completed.
 */
export function canRender(step: LessonStep): boolean {
  if (!SUPPORTED.has(step.type)) return false;
  const circuit = (step as { circuitDiagram?: string }).circuitDiagram;
  switch (step.type) {
    case 'spot_error':
      return hasRegions(circuit, [(step as StepSpotError).correctRegion]);
    case 'identify_component':
      // Needs a hit area for the component it asks about. Without one the step
      // is unanswerable, so it is dropped rather than shown as a diagram that
      // ignores every tap.
      return hasRegions(circuit, [(step as StepIdentify).correctComponent]);
    case 'fix_the_circuit':
      return hasRegions(circuit, [(step as StepFixCircuit).faultRegion]);
    case 'trace_current':
      return hasRegions(circuit, (step as StepTraceCurrent).correctPath);
    default:
      return true;
  }
}
