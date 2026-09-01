/**
 * The resistor colour code, as pure functions.
 *
 * 45 steps in the corpus are `choose_resistor` with a `bands` spec, and every
 * one of them was rendering as a single button printing its own answer. The
 * interaction they were authored for is setting the colours and watching the
 * value change, so the decode has to be real: this module is the decode, kept
 * out of the component so scripts/check-step-renderers.mjs can prove it against
 * the web's formula for all 700 reachable combinations.
 *
 * Reference: frontend/components/ohmlet/views/LessonRunner.tsx, ResistorBandStep.
 * The value is (digit1 * 10 + digit2) * 10^multiplier, and grading is exact
 * equality with the step's targetOhms.
 */

export interface BandColour {
  /** What a learner would call it out loud. */
  name: string;
  /** The band as painted on the resistor. */
  hex: string;
  /** Text drawn on top of that band, chosen to stay readable. */
  ink: string;
}

/**
 * The ten digit colours, in value order: the array index IS the digit.
 *
 * This is the real electronics colour code, not a palette choice, so the order
 * is fixed and the check script asserts it. The hex values match the web's
 * DIGIT_COLORS so a learner who saw the lesson on a laptop sees the same
 * resistor on the phone.
 */
export const BAND_COLOURS: readonly BandColour[] = [
  { name: 'black', hex: '#1a1a1a', ink: '#ffffff' },
  { name: 'brown', hex: '#7c3f00', ink: '#ffffff' },
  { name: 'red', hex: '#ef4444', ink: '#ffffff' },
  { name: 'orange', hex: '#f97316', ink: '#14181f' },
  { name: 'yellow', hex: '#facc15', ink: '#14181f' },
  { name: 'green', hex: '#22c55e', ink: '#14181f' },
  { name: 'blue', hex: '#3b82f6', ink: '#ffffff' },
  { name: 'violet', hex: '#8b5cf6', ink: '#ffffff' },
  { name: 'grey', hex: '#9ca3af', ink: '#14181f' },
  { name: 'white', hex: '#f8fafc', ink: '#14181f' },
];

/**
 * Highest multiplier the third band can carry, matching the web, which cycles
 * that band modulo 7 while the digit bands cycle modulo 10.
 */
export const MULTIPLIER_MAX = 6;

/** What each multiplier band actually multiplies by, for the picker. */
export const MULTIPLIER_LABELS: readonly string[] = [
  '×1', '×10', '×100', '×1k', '×10k', '×100k', '×1M',
];

/**
 * The fourth band. The web draws a fixed gold band and does not let the learner
 * set it, so neither does this; gold means the part is guaranteed to 5 percent.
 */
export const TOLERANCE_BAND = { name: 'gold', hex: '#d4af37', label: '±5%' } as const;

/** [first digit, second digit, multiplier], as colour indices. */
export type Bands = [number, number, number];

/** What the learner has built, in ohms. The web's formula, unchanged. */
export const decodeBands = (b: readonly number[]): number =>
  ((b[0] ?? 0) * 10 + (b[1] ?? 0)) * 10 ** (b[2] ?? 0);

/**
 * The bands that encode a value, or null when a two-digit-plus-multiplier
 * resistor cannot express it.
 *
 * Multipliers are tried smallest first and a leading digit is preferred, so
 * 1000 comes back as brown-black-red (10 x 100) the way a real part is marked,
 * rather than black-brown-orange (1 x 1000), which is the same number and the
 * wrong answer to give a learner.
 */
export function encodeOhms(ohms: number): Bands | null {
  if (!Number.isFinite(ohms) || ohms < 0) return null;
  for (const leadingOnly of [true, false]) {
    for (let m = 0; m <= MULTIPLIER_MAX; m += 1) {
      const scale = 10 ** m;
      const digits = Math.round(ohms / scale);
      if (leadingOnly && digits < 10) continue;
      if (digits < 0 || digits > 99) continue;
      if (digits * scale !== ohms) continue;
      return [Math.floor(digits / 10), digits % 10, m];
    }
  }
  return null;
}

/** An ohm value in the units a learner reads off a part. The web's formatter. */
export const fmtOhms = (v: number): string =>
  v >= 1e6
    ? `${+(v / 1e6).toFixed(2)} MΩ`
    : v >= 1e3
      ? `${+(v / 1e3).toFixed(2)} kΩ`
      : `${v} Ω`;

/** How many colours the band at this position can take. */
export const bandChoices = (index: number): number => (index === 2 ? MULTIPLIER_MAX + 1 : 10);

/** What this band contributes, said in words, for the readout and for a screen reader. */
export const bandMeaning = (index: number, value: number): string =>
  index === 2 ? `multiplier ${MULTIPLIER_LABELS[value] ?? ''}` : `digit ${value}`;
