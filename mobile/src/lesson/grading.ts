/**
 * How the phone grades a learner's answer, as pure functions.
 *
 * Both surfaces run the SAME corpus, so a step authored to be solvable has to be
 * solvable on the phone. Two rules had drifted from the web runner
 * (frontend/components/ohmlet/views/LessonRunner.tsx) and took 20 authored steps
 * out of reach here while they stayed answerable in a browser:
 *
 *   fill_blank + tiles   The bank was keyed by VALUE, so a bank holding two
 *                        copies of the same token still only ever placed one of
 *                        them, and an answer needing it twice could not be
 *                        typed at all. The web keys by INDEX: two copies are two
 *                        independent tiles. 14 steps, among them "The RC
 *                        Low-Pass Filter" and "Boolean Rules and De Morgan",
 *                        need the multiplication sign twice.
 *   drag_order           Grading compared item INDICES. Blink's loop legitimately
 *                        holds two `delay(1000);` rows, and which of the two
 *                        identical rows a learner happened to drag is not part of
 *                        the question, so a visually perfect answer was marked
 *                        wrong about half the time, at random, and came back
 *                        round the requeue forever. The web grades what the rows
 *                        SAY. 6 steps, among them "Blink" and "Unit 4
 *                        Checkpoint".
 *
 * A third rule of the same family was found while comparing the surfaces: the
 * match bank consumed right-hand chips by VALUE, so a categorisation step whose
 * answers repeat ("Series | Parallel | Series | Parallel | Series") could never
 * be completed once one "Series" chip was spent. The web consumes chips by index
 * and pairs by value. 11 steps in the served corpus repeat a right-hand value.
 *
 * The rules live here rather than inside the renderers so
 * scripts/check-step-renderers.mjs can drive the REAL grading logic over the
 * real corpus and prove, per step, that a legal arrangement grades correct and a
 * wrong one does not. Same reasoning as meterScale.ts. Nothing in this file may
 * import from React Native: the checker executes it.
 */

/** Whitespace collapsed, case folded. The web runner's `norm`, unchanged. */
export const normaliseAnswer = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The sentence a tile placement reads as. Tiles are joined with single spaces
 * and compared after normalising, so a tile may carry several words.
 */
export const tileAnswer = (tiles: readonly string[], placed: readonly number[]): string =>
  placed.map((index) => tiles[index] ?? '').join(' ');

/** True when this BANK SLOT has been placed. Never "a tile reading this word". */
export const isTilePlaced = (placed: readonly number[], index: number): boolean =>
  placed.includes(index);

/**
 * Place a bank slot, or take that exact copy back if it is already placed. The
 * rest of the answer keeps its order, so taking back a tile from the middle does
 * not rebuild the sentence around it.
 */
export const toggleTile = (placed: readonly number[], index: number): number[] =>
  isTilePlaced(placed, index)
    ? placed.filter((slot) => slot !== index)
    : [...placed, index];

/** A tiled fill_blank: what the assembled tiles say, against the answer. */
export const gradeFillTiles = (
  tiles: readonly string[],
  answer: string,
  placed: readonly number[],
): boolean => normaliseAnswer(tileAnswer(tiles, placed)) === normaliseAnswer(answer);

/** A typed fill_blank: what the learner wrote, against the answer. */
export const gradeFillTyped = (answer: string, typed: string): boolean =>
  normaliseAnswer(typed) === normaliseAnswer(answer);

/**
 * Is the row sitting in `slot` the row that belongs there?
 *
 * By TEXT, because that is what the learner can see and therefore what the
 * question asks. Grading and painting share this one function so a row can never
 * be painted red under a "Correct" banner, or green under a wrong one.
 */
export const orderRowCorrect = (
  items: readonly string[],
  correctOrder: readonly number[],
  itemIndex: number,
  slot: number,
): boolean => {
  const want = items[correctOrder[slot]];
  const got = items[itemIndex];
  return want !== undefined && got !== undefined && want === got;
};

/**
 * A drag_order answer: the learner's sequence of row TEXTS must equal the
 * correct sequence of row texts, position by position. Interchangeable rows are
 * interchangeable; a genuinely wrong order still reads differently and is still
 * wrong.
 */
export const gradeOrder = (
  items: readonly string[],
  correctOrder: readonly number[],
  order: readonly number[],
): boolean =>
  order.length === correctOrder.length
  && order.every((itemIndex, slot) => orderRowCorrect(items, correctOrder, itemIndex, slot));

/**
 * Put a part in the next free slot of a build.
 *
 * Parts are NOT consumed: one part may fill several slots, which is the web's
 * rule (LessonRunner.tsx, BuildStep.addPart, which has no used check) and the
 * only way a build whose answer needs the same part twice, two 220 ohm
 * resistors, say, could ever be entered. Retiring a part once it was placed made
 * that authored answer impossible to give on the phone, the same failure the
 * tile bank had. No step in the corpus needs it today; the rule is the surfaces
 * agreeing before one does.
 */
export const placePart = (placed: readonly number[], slots: number, part: number): number[] =>
  placed.length >= slots ? [...placed] : [...placed, part];

/** Take the part out of one slot, closing the gap the way the web does. */
export const clearSlot = (placed: readonly number[], slot: number): number[] =>
  placed.filter((_, index) => index !== slot);

/** Is the part in this slot the part that belongs there? Palette indices. */
export const buildSlotCorrect = (
  correct: readonly number[],
  placed: readonly number[],
  slot: number,
): boolean => placed[slot] !== undefined && placed[slot] === correct[slot];

/** A build answer: every slot filled, each with the part the author named. */
export const gradeBuild = (
  correct: readonly number[],
  slots: number,
  placed: readonly number[],
): boolean => placed.length === slots && placed.every((part, slot) => part === correct[slot]);

/**
 * The chips a match step offers: one per pair, rotated by one place so the
 * answers never sit in a straight line beside the rows. Rotated rather than
 * shuffled so the same question never renders in an order that happens to give
 * the answer away.
 */
export const matchChips = (pairs: ReadonlyArray<readonly [string, string]>): string[] => {
  const rights = pairs.map((pair) => pair[1]);
  return rights.length > 1 ? [...rights.slice(1), rights[0]] : rights;
};

/** Which right-hand chip each left-hand row is linked to, by chip index. */
export type MatchLinks = Readonly<Record<number, number>>;

/**
 * True when a chip has already been spent. By INDEX: a categorisation step
 * offers one chip per pair, so five rows answered "Series, Parallel, Series,
 * Parallel, Series" have three separate Series chips to spend.
 */
export const isChipTaken = (links: MatchLinks, chip: number): boolean =>
  Object.values(links).includes(chip);

/**
 * Take a row's chip back, returning it to the bank.
 *
 * The phone needs this and the web does not. The web rejects a wrong pairing on
 * the spot (MatchStep.select flashes red and keeps both sides free), so a web
 * match is correct by construction and there is nothing to undo. The phone
 * accepts the link and grades at Check, and one chip is spent per row, so once
 * every row is answered every chip is spent. Without a way back, a learner who
 * sees their own mistake at that point cannot touch it: every chip is disabled,
 * and the only move left is to submit an answer they know is wrong and pay a
 * heart for it.
 */
export const unlinkRow = (links: MatchLinks, row: number): MatchLinks => {
  const next: Record<number, number> = {};
  for (const [key, chip] of Object.entries(links)) {
    if (Number(key) !== row) next[Number(key)] = chip;
  }
  return next;
};

/**
 * A match answer: every row must hold a chip, and that chip must READ what the
 * row's answer says. Chips are consumed by index and graded by value, which is
 * the web runner's rule (MatchStep.select) and what lets one value serve several
 * rows.
 */
export const gradeMatch = (
  pairs: ReadonlyArray<readonly [string, string]>,
  rights: readonly string[],
  links: MatchLinks,
): boolean =>
  pairs.every((pair, row) => {
    const chip = links[row];
    return chip !== undefined && rights[chip] === pair[1];
  });
