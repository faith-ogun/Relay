/**
 * The meter's arithmetic, as pure functions.
 *
 * 155 steps in the corpus are `predict_reading` with a `meter` spec: a range, a
 * granularity, a target and a tolerance. They were rendering as one button
 * printing the target, so a question that says "dial the voltage at the
 * midpoint" offered "2.5 V" and nothing else.
 *
 * The grading rule is the web's, unchanged: correct when the dialled reading is
 * within `tolerance` of `target`. It lives here rather than in the component so
 * scripts/check-step-renderers.mjs can run it over every meter in the corpus and
 * prove, per step, that a reachable value grades right and that not every
 * reachable value does.
 *
 * Reference: frontend/components/ohmlet/views/LessonRunner.tsx, MeterStep.
 */

export interface MeterSpec {
  /** V, mA, Hz, counts, and so on. Shown beside the reading, never converted. */
  unit: string;
  min: number;
  max: number;
  /** The dial's granularity. Optional in the schema, present on all 155 today. */
  step?: number;
  target: number;
  tolerance: number;
}

/**
 * The dial's granularity. The authored step is used as-is: it is the precision
 * the question is asking for, and a finer dial would let a learner submit a
 * reading the lesson never intended to accept.
 */
export const meterStep = (m: MeterSpec): number =>
  m.step && m.step > 0 ? m.step : Math.max((m.max - m.min) / 100, 0.0001);

/** Decimal places the dial can actually produce, so the readout never lies. */
export function meterDecimals(m: MeterSpec): number {
  const s = String(meterStep(m));
  const dot = s.indexOf('.');
  if (dot === -1) return 0;
  return Math.min(3, s.length - dot - 1);
}

/** The reading, at exactly the precision the dial can reach. */
export const fmtReading = (v: number, m: MeterSpec): string => v.toFixed(meterDecimals(m));

/**
 * A number written plainly, with no invented precision. Used for the tolerance,
 * which is not a dial reading and must not be rounded to the dial's step: a
 * tolerance of 0.05 shown at one decimal place would read as 0.1 and promise
 * twice the leeway the grader gives.
 */
export const fmtPlain = (v: number): string => String(Number(v.toFixed(4)));

/** The grading rule. The web's, character for character. */
export const withinTolerance = (v: number, m: MeterSpec): boolean =>
  Math.abs(v - m.target) <= m.tolerance;

/** Where a reading sits along the scale, 0 at min and 1 at max. */
export const meterFraction = (v: number, m: MeterSpec): number => {
  if (!(m.max > m.min)) return 0;
  const f = (v - m.min) / (m.max - m.min);
  return Number.isFinite(f) ? Math.min(1, Math.max(0, f)) : 0;
};

/**
 * A usable meter needs a target inside its own scale, a tolerance that admits
 * at least one dial position, and enough positions to be worth dialling. An
 * authored meter that fails any of these is unanswerable or grades itself
 * correct, so the check script refuses the corpus rather than shipping it.
 */
export const meterPositions = (m: MeterSpec): number =>
  Math.max(0, Math.round((m.max - m.min) / meterStep(m)));
