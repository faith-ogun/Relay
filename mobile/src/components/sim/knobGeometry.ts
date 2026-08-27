/**
 * The slider's arithmetic, kept out of the component so it can be proved.
 *
 * Every slider defect so far has been arithmetic, not rendering: a thumb
 * positioned at `left: frac%` with a negative margin hung half outside the
 * control at both ends, and a touch read through `locationX` re-based itself
 * whenever the finger crossed a child view. Both were invisible in review and
 * obvious on a phone. Pure functions with a check script behind them mean the
 * next regression fails in CI instead of in Faith's hand.
 *
 * The invariant these exist to hold: for every fraction from 0 to 1, the thumb
 * lies ENTIRELY within the track, and the value the touch maps to is the value
 * the thumb is drawn at.
 */

/** How far the thumb's left edge can travel, given the track's width. */
export const travelFor = (width: number, thumb: number): number => Math.max(0, width - thumb);

/** Where to draw the thumb's LEFT edge for a fraction along the control. */
export const thumbLeft = (frac: number, width: number, thumb: number): number =>
  clamp01(frac) * travelFor(width, thumb);

/** The fraction a touch at this absolute x means, through the same inset. */
export const fracFromPageX = (
  pageX: number, originX: number, width: number, thumb: number,
): number => {
  const travel = travelFor(width, thumb);
  if (travel <= 0) return 0;
  return clamp01((pageX - originX - thumb / 2) / travel);
};

/** Snap a fraction to the control's own step, then hold it inside its own range. */
export const valueFor = (frac: number, min: number, max: number, step: number): number => {
  const raw = min + clamp01(frac) * (max - min);
  const snapped = Math.round(raw / step) * step;
  // Floating point: 0.1 steps accumulate error, so round to the step's own
  // precision rather than leaving 2199.9999999999995 on screen.
  const dp = decimals(step);
  const tidy = Number(snapped.toFixed(dp));
  return Math.min(max, Math.max(min, tidy));
};

/** Where a labelled stop sits, measured to the thumb's centre so they line up. */
export const tickCentre = (
  at: number, min: number, max: number, width: number, thumb: number,
): number => thumb / 2 + clamp01(max > min ? (at - min) / (max - min) : 0) * travelFor(width, thumb);

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

const decimals = (step: number) => {
  const s = String(step);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
};
