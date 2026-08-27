// ── Reading the board without touching it ──
//
// A real breadboard prints its row letters and its column numbers at the two
// ENDS of a 6.5 inch board. On a desk that is fine, because the whole board is
// in front of you. On a phone it is useless: the fitted camera frames about
// four inches of the middle, so at four of the five camera presets this app
// ships with, not one row letter is anywhere in the view. Ray casting the real
// camera says so, and so did the report that started this: "I can't even see
// the lanes like a3 or whatever or even gnd."
//
// More printing is not the answer. Columns 1 to 63 fill the board's length and
// the four rails fill its width, so there is no free lane between them: a mid
// board letter would land on a tie point.
//
// So the letters and the numbers come OFF the board and into the view. This
// module is the geometry of that. Given the live camera and the size of the
// view it works out where every row line, rail line and column line leaves the
// frame, and puts that band's name there. Two behaviours fall out of one rule:
//
//   WHOLE BOARD IN FRAME. The line ends inside the view, so the name sits just
//   past column 63 and just outside row a, which is exactly where a real board
//   prints it. It reads as silkscreen.
//
//   ZOOMED IN. The line runs off the edge, so the name is pinned to the frame
//   edge instead and stays there. It reads as a ruler.
//
// It follows an orbit, a pinch and a preset flight for free, because it is
// computed from the camera rather than baked anywhere, and it survives the
// board being turned so the rows run vertically, because every decision below
// is made in screen space after projection rather than in board space before
// it.
//
// Nothing here touches React and nothing here touches three.js beyond reading
// one camera matrix, so scripts/check-breadboard.mjs drives it with the real
// OrbitRig and measures the answer in the same points the view lays out in.

import type * as THREE from 'three';
import {
  BOARD, BOARD_TOP, COLS, RAILS, RAIL_HOLES, ROWS, ROW_LETTERS,
  columnX, railHoleX, rowZ,
} from './boardSpec';

/** A row of tie points, or one of the four power rails. */
export type RulerBandKind = 'row' | 'rail';

export interface RulerLabel {
  /** Stable across frames, so React reconciles rather than remounts. */
  key: string;
  /** What is drawn: 'G', '29', '+'. */
  text: string;
  /** Centre of the box, in view points. */
  x: number;
  y: number;
  /**
   * The box the label occupies, in view points.
   *
   * The view draws exactly this size rather than letting the text size itself,
   * which is what lets the collision arithmetic here be the truth about what
   * ends up on the glass instead of a guess at it.
   */
  w: number;
  h: number;
}

export interface RulerBand extends RulerLabel {
  kind: RulerBandKind;
  /** Row index 0 to 9 for a row, rail index 0 to 3 for a rail. */
  index: number;
  polarity?: '+' | '-';
}

export interface RulerColumn extends RulerLabel {
  /** Column index, 0 based. `text` is the printed number, which is 1 based. */
  index: number;
}

export interface RulerLayout {
  /** Rows and rails, across the board. */
  bands: RulerBand[];
  /** Numbered columns, along the board. */
  columns: RulerColumn[];
  /** Rows with at least one tie point in frame, 0 based. */
  visibleRows: number[];
  /** Columns with at least one tie point in frame, 0 based. */
  visibleCols: number[];
  /**
   * Columns whose tie points are far enough apart on screen to be told from
   * their neighbours, 0 based.
   *
   * The subset that matters. Seen almost edge on, the far half of the board
   * puts adjacent holes a point and a half apart, and no label can make a hole
   * identifiable that the eye cannot separate in the first place. The ruler
   * spends its numbers on the half a learner can actually read.
   */
  resolvableCols: number[];
  /**
   * The bands a learner could pick out from the one beside them, and which
   * therefore have to be named. Same idea as `resolvableCols`, on the other
   * axis.
   */
  resolvableBands: { kind: RulerBandKind; index: number }[];
  /** Columns between one printed number and the next. 1 names every column. */
  stride: number;
  /** How deep the labels had to stack to stay clear of each other. */
  lanes: number;
  /** Holes a learner has to count from the nearest number, at worst. */
  reach: number;
}

/**
 * Every number the ruler's look and its arithmetic share.
 *
 * Exported because the headless check asserts against these rather than
 * against a second copy that could drift away from the one the view uses.
 */
export const RULER = {
  /** Cap height is what carries at arm's length; 10 point Black is legible. */
  fontSize: 10,
  /** Nunito Black advance width, in ems. Deliberately on the generous side. */
  advance: 0.66,
  tracking: 0.6,
  padX: 4,
  /** Box height. 10 point type in a 15 point box is a chip, not a bar. */
  height: 15,
  /** Clear space every label keeps from every other label. */
  gap: 3,
  /** How far past the end of its line a label sits when there is room for it. */
  lead: 13,
  /** Clear space every label keeps from the edge of the view. */
  inset: 5,
  /**
   * Column strides tried, in order.
   *
   * Every step from 1 up, because the ladder is climbed until the numbers fit
   * and the first rung that does is the densest scale the camera can hold. 1
   * is what the detail camera has room for and is the whole reason the stride
   * is read off the live camera rather than fixed at the board's printed 5.
   */
  strides: [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20],
  /**
   * Holes a learner may ever have to count from the nearest printed number.
   *
   * Four, because that is what a real board asks of them: it prints 1, 5, 10
   * and so on, so a leg going into column 29 is already counted from 25 or 30.
   * The ruler is not allowed to be worse than the board it is standing in for.
   */
  reach: 4,
  /**
   * Points between two neighbouring tie points below which the pair cannot be
   * told apart at all.
   *
   * Six, which is eighteen device pixels on a three times display: about the
   * point at which two dark circles on beige plastic stop being two.
   */
  resolve: 6,
  /**
   * Step of the fine placement search, in points.
   *
   * The lane ladder steps a whole box at a time, which is too coarse for two
   * labels that would interleave; below that, a required band gets combed
   * along its own axis at this step. Exported because the check asserts the
   * layout against it: see FINE.
   */
  comb: 4,
  /**
   * Points between two neighbouring BANDS below which the band is not named at
   * all, however much room there is for a chip.
   *
   * Three, and deliberately lower than `resolve`. A whole row of fifty holes
   * is a far stronger line than one hole is a dot: two rows three points apart
   * still read as two rows, which is why the `left` preset, where they are 4.3
   * points apart, keeps all ten letters. Below three they are one smear, and a
   * name for one of them is a name for none of them.
   *
   * This is the gate that stops the ruler burying the board. Pinched all the
   * way out with the lens near the table, the ten rows land under a point
   * apart and every letter lanes out along the board, because its own axis is
   * the only line it may slide on. Without this, fourteen chips are drawn on
   * top of the sliver of board they are naming.
   */
  visible: 3,
  /**
   * Tie points of a band that have to be in frame before it counts as present,
   * and has to be named.
   *
   * Twelve, which is well over an inch of board. Fewer than that and the band
   * is clipping a corner of the frame rather than being looked at, and there is
   * nowhere on its axis inside the view to put a chip anyway. The press and
   * hold label still names any hole in that corner.
   */
  present: 12,
  /** The same, for a column. A column has only ten tie points to show. */
  presentCol: 2,
} as const;

/** Width of the box a label of this text needs. */
export function labelWidth(text: string): number {
  return Math.round(text.length * (RULER.fontSize * RULER.advance + RULER.tracking) + RULER.padX * 2);
}

// ── Scratch ──
//
// Hoisted, because this runs whenever the camera moves and a phone that
// allocates a vector per row per frame is a phone collecting garbage while the
// learner is dragging.

/** Clip space w at or below this is at or behind the lens. */
const NEAR_W = 1e-4;

const _e = new Float64Array(16);
const _clip = new Float64Array(4);
const _p = new Float64Array(4);
const _q = new Float64Array(4);
/** Screen position of every numbered tie point, and whether it is in frame. */
const _holeX = new Float64Array(ROWS * COLS);
const _holeY = new Float64Array(ROWS * COLS);
const _holeOn = new Uint8Array(ROWS * COLS);
/** How many of each rail's fifty holes are in frame. */
const _railOn = new Int32Array(4);

interface Segment {
  /** The clipped ends, in view points. */
  x0: number; y0: number; x1: number; y1: number;
  /** Unit vector from end 0 towards end 1. */
  dx: number; dy: number;
  /**
   * Whether each end is where the FRAME cut the line, rather than where the
   * board's own line stops.
   *
   * This is the difference between the ruler's two behaviours, and the layout
   * has to know which one it is in. At an end the board owns, past the end is
   * off the board and a label may go there but must not come back inward: that
   * is the silkscreen, and a chip that steps inward is a chip on top of the
   * tie points. At an end the frame cut, there is no "past the end" at all,
   * the label is pinned against the inset, and inward along the line is the
   * only direction left: that is the ruler.
   */
  cut0: boolean; cut1: boolean;
}

const _seg: Segment = { x0: 0, y0: 0, x1: 0, y1: 0, dx: 0, dy: 0, cut0: false, cut1: false };

/** Load the camera's view projection matrix. Called once per layout. */
function loadCamera(camera: THREE.Camera): void {
  camera.updateMatrixWorld();
  const m = camera.projectionMatrix.elements;
  const v = camera.matrixWorldInverse.elements;
  // Column major, both. Written out rather than built with Matrix4 so nothing
  // is allocated and the hot loop below reads plain numbers.
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      _e[c * 4 + r] =
        m[r] * v[c * 4] + m[4 + r] * v[c * 4 + 1] + m[8 + r] * v[c * 4 + 2] + m[12 + r] * v[c * 4 + 3];
    }
  }
}

/** Clip space position of a point on the board's top surface. */
function toClip(x: number, z: number, out: Float64Array): void {
  const y = BOARD_TOP;
  out[0] = _e[0] * x + _e[4] * y + _e[8] * z + _e[12];
  out[1] = _e[1] * x + _e[5] * y + _e[9] * z + _e[13];
  out[2] = _e[2] * x + _e[6] * y + _e[10] * z + _e[14];
  out[3] = _e[3] * x + _e[7] * y + _e[11] * z + _e[15];
}

/**
 * Project every numbered tie point once, and remember where it landed.
 *
 * Asked of the sockets themselves rather than inferred from the clipped row
 * line, because perspective makes the clip parameter non linear along the line
 * and "row a is on screen" has to mean row a's sockets are. The positions are
 * kept because the next question after "is it in frame" is "is it far enough
 * from its neighbour to be a different hole", and that one cannot be answered
 * from the board's own geometry at all.
 */
function projectHoles(width: number, height: number): void {
  for (let row = 0; row < ROWS; row++) {
    const z = rowZ(row);
    for (let col = 0; col < COLS; col++) {
      const i = row * COLS + col;
      toClip(columnX(col), z, _p);
      if (_p[3] < NEAR_W) { _holeOn[i] = 0; _holeX[i] = NaN; _holeY[i] = NaN; continue; }
      const sx = (_p[0] / _p[3] * 0.5 + 0.5) * width;
      const sy = (-_p[1] / _p[3] * 0.5 + 0.5) * height;
      _holeX[i] = sx;
      _holeY[i] = sy;
      _holeOn[i] = sx >= 0 && sx <= width && sy >= 0 && sy <= height ? 1 : 0;
    }
  }
  for (const rail of RAILS) {
    let seen = 0;
    for (let i = 0; i < RAIL_HOLES; i++) {
      toClip(railHoleX(i), rail.z, _p);
      if (_p[3] < NEAR_W) continue;
      const sx = (_p[0] / _p[3] * 0.5 + 0.5) * width;
      if (sx < 0 || sx > width) continue;
      const sy = (-_p[1] / _p[3] * 0.5 + 0.5) * height;
      if (sy >= 0 && sy <= height) seen += 1;
    }
    _railOn[rail.id] = seen;
  }
}

/**
 * The part of a board line that is inside the view, in view points.
 *
 * Two clips, in this order and for two different reasons. The near plane clip
 * is in clip space and is not optional: a line with one end behind the lens
 * projects to a point on the far side of the screen, and dividing by a
 * negative w silently mirrors it, which is how a label ends up naming a row on
 * the opposite edge of the board. The frame clip is then a plain 2D one.
 */
function clipLine(
  ax: number, az: number, bx: number, bz: number, width: number, height: number,
): Segment | null {
  toClip(ax, az, _p);
  toClip(bx, bz, _q);
  if (_p[3] < NEAR_W && _q[3] < NEAR_W) return null;

  // An end taken by the near plane is no more the board's own end than one
  // taken by the frame: the rest of that line is behind the lens, so there is
  // no "past the end" to write in.
  let cut0 = false;
  let cut1 = false;
  if (_p[3] < NEAR_W) {
    const t = (NEAR_W - _p[3]) / (_q[3] - _p[3]);
    for (let i = 0; i < 4; i++) _p[i] += (_q[i] - _p[i]) * t;
    cut0 = true;
  } else if (_q[3] < NEAR_W) {
    const t = (NEAR_W - _q[3]) / (_p[3] - _q[3]);
    for (let i = 0; i < 4; i++) _q[i] += (_p[i] - _q[i]) * t;
    cut1 = true;
  }

  _clip[0] = (_p[0] / _p[3] * 0.5 + 0.5) * width;
  _clip[1] = (-_p[1] / _p[3] * 0.5 + 0.5) * height;
  _clip[2] = (_q[0] / _q[3] * 0.5 + 0.5) * width;
  _clip[3] = (-_q[1] / _q[3] * 0.5 + 0.5) * height;

  const x0 = _clip[0];
  const y0 = _clip[1];
  const dx = _clip[2] - x0;
  const dy = _clip[3] - y0;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;

  // Liang-Barsky against the view rectangle.
  let t0 = 0;
  let t1 = 1;
  const edge = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  if (!edge(-dx, x0)) return null;
  if (!edge(dx, width - x0)) return null;
  if (!edge(-dy, y0)) return null;
  if (!edge(dy, height - y0)) return null;

  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  _seg.x0 = x0 + dx * t0;
  _seg.y0 = y0 + dy * t0;
  _seg.x1 = x0 + dx * t1;
  _seg.y1 = y0 + dy * t1;
  _seg.dx = dx / len;
  _seg.dy = dy / len;
  _seg.cut0 = cut0 || t0 > 0;
  _seg.cut1 = cut1 || t1 < 1;
  return _seg;
}

/**
 * Where a board point lands on screen, whether or not it is inside the frame.
 *
 * Used to ask how far apart two neighbouring bands are, which is a different
 * question from whether either of them is visible.
 */
function screenAt(x: number, z: number, width: number, height: number, out: Float64Array): boolean {
  toClip(x, z, _p);
  if (_p[3] < NEAR_W) return false;
  out[0] = (_p[0] / _p[3] * 0.5 + 0.5) * width;
  out[1] = (-_p[1] / _p[3] * 0.5 + 0.5) * height;
  return true;
}

const _b0 = new Float64Array(2);
const _b1 = new Float64Array(2);
/** How far along its line the last `place` call was allowed to slide. */
const _range = new Float64Array(2);

/** A line's name, and the two places on screen it could be written. */
interface Candidate {
  key: string;
  text: string;
  w: number;
  index: number;
  kind: RulerBandKind | 'col';
  polarity?: '+' | '-';
  /**
   * Whether this label has to be drawn even if there is no room for it.
   *
   * True for a band a learner could actually tell apart from the one beside
   * it. False for the rest, and for every number: a row seen so nearly edge on
   * that it is two points from its neighbour cannot be picked out whatever is
   * printed next to it, and stacking a chip there costs the ones that can.
   */
  required: boolean;
  /** End 0 and end 1 of the clipped line. */
  ax: number; ay: number; bx: number; by: number;
  /** Unit vector from end 0 towards end 1. */
  dx: number; dy: number;
  /** Whether each end is a frame cut rather than the board's own end. */
  cutA: boolean; cutB: boolean;
}

/**
 * Where a label goes, given the end of the line it is anchored to.
 *
 * The label slides ALONG its own line and never across it. That is the whole
 * trick: however far out it is pushed, it is still standing on row G's axis,
 * so it reads as row G's name rather than as a caption floating near it.
 *
 * `want` is how far past the end of the line it would like to be. It gives
 * that up only as far as it must to keep its whole box inside the view, which
 * is what turns the silkscreen behaviour into the ruler behaviour the moment
 * the board runs off the edge of the frame.
 *
 * A ROW OR RAIL gives up nothing at all in the other direction at an end the
 * BOARD owns. Past that end is off the board; back from it is on top of the
 * tie points, and a chip there hides the very holes it was drawn to name. This
 * is the rule that keeps the silkscreen behaviour honest when the frame is
 * roomier than the board: crowded rows lane out along their own axis, and
 * without this the lane that has run out of room outside the board turns round
 * and marches back across it. At an end the FRAME cut there is no
 * past-the-end to have, so the whole line is fair game and the label slides
 * along it: see `Segment.cut0`.
 *
 * A NUMBER is not held to it. A row letter is the only name its row will ever
 * have, so one that cannot go outward is worth dropping; a number that cannot
 * go outward takes the whole scale down with it, because the stride above it
 * is chosen from what landed and one lost number at the end of a run leaves a
 * third of the board counting from the next one in. Measured over the whole
 * camera envelope, holding the numbers to it costs 38 more poses where a hole
 * is further than `RULER.reach` from a number and saves 521 covered holes out
 * of a hundred thousand. The numbers keep the freedom.
 */
function place(
  c: Candidate, end: 0 | 1, want: number, width: number, height: number, out: RulerLabel,
): number {
  const px = end === 1 ? c.bx : c.ax;
  const py = end === 1 ? c.by : c.ay;
  const ox = end === 1 ? c.dx : -c.dx;
  const oy = end === 1 ? c.dy : -c.dy;
  const owned = c.kind !== 'col' && !(end === 1 ? c.cutB : c.cutA);
  const floor = owned ? 0 : -Infinity;

  const halfW = c.w / 2;
  const halfH = RULER.height / 2;
  const xLo = RULER.inset + halfW;
  const xHi = width - RULER.inset - halfW;
  const yLo = RULER.inset + halfH;
  const yHi = height - RULER.inset - halfH;

  let lo = floor;
  let hi = Infinity;
  let free = true;
  if (ox > 1e-9) { lo = Math.max(lo, (xLo - px) / ox); hi = Math.min(hi, (xHi - px) / ox); }
  else if (ox < -1e-9) { lo = Math.max(lo, (xHi - px) / ox); hi = Math.min(hi, (xLo - px) / ox); }
  else if (px < xLo || px > xHi) free = false;
  if (oy > 1e-9) { lo = Math.max(lo, (yLo - py) / oy); hi = Math.min(hi, (yHi - py) / oy); }
  else if (oy < -1e-9) { lo = Math.max(lo, (yHi - py) / oy); hi = Math.min(hi, (yLo - py) / oy); }
  else if (py < yLo || py > yHi) free = false;

  out.key = c.key;
  out.text = c.text;
  out.w = c.w;
  out.h = RULER.height;
  _range[0] = lo;
  _range[1] = hi;
  if (!free || lo > hi) {
    // The line leaves the view through a corner too tight to hold the box on
    // its axis. Rare, and the honest answer is the nearest legal point: still
    // beside the right row, no longer exactly on it.
    out.x = Math.min(Math.max(px, xLo), xHi);
    out.y = Math.min(Math.max(py, yLo), yHi);
    return NaN;
  }
  const t = Math.min(Math.max(want, lo), hi);
  out.x = px + ox * t;
  out.y = py + oy * t;
  return t;
}

/** Points of clear space between two boxes. Negative means they overlap. */
function separation(a: RulerLabel, b: RulerLabel): number {
  return Math.max(
    Math.abs(a.x - b.x) - (a.w + b.w) / 2,
    Math.abs(a.y - b.y) - (a.h + b.h) / 2,
  );
}

/** True when this box clears every box in the list. */
function fits(box: RulerLabel, list: readonly RulerLabel[]): boolean {
  for (let i = 0; i < list.length; i++) if (separation(box, list[i]) < RULER.gap) return false;
  return true;
}

const blank = (): RulerLabel => ({ key: '', text: '', x: 0, y: 0, w: 0, h: 0 });

/**
 * One box that every trial placement is written into.
 *
 * A track tries a label at a handful of positions before it settles on one, so
 * a fresh object per trial is a few hundred objects per layout and this layout
 * runs whenever the camera moves. Only the position that is actually taken is
 * copied out.
 */
const _probe = blank();

const taken = (box: RulerLabel): RulerLabel => ({
  key: box.key, text: box.text, x: box.x, y: box.y, w: box.w, h: box.h,
});

interface Track {
  boxes: RulerLabel[];
  /** Which of the candidates handed in actually got a label. */
  kept: number[];
  /** How many rows deep the labels had to stack. 0 is a single clean line. */
  lanes: number;
  /** Required labels this attempt could not fit. Zero is the goal. */
  missing: number;
}

/**
 * Lay one track out.
 *
 * Three things happen here, in this order of preference, and between them they
 * are what makes a label per row possible at all. At the fitted camera the ten
 * rows are about nine points apart on screen and the smallest legible chip is
 * fifteen wide, so a single line of them cannot exist: the board is denser than
 * the type.
 *
 *   1. The label goes at the near end of its line.
 *   2. If that is taken, it goes at the FAR end of the same line. Alternating
 *      ends halves the crowding and costs nothing, because the opposite edge
 *      of the frame is empty.
 *   3. If both are taken, it steps further out along its own axis into a
 *      second lane, the way a dimensioned drawing lengthens a leader in a
 *      crowded chain.
 *
 * No step moves a label off the line it names, which is the whole point: a
 * chip standing on row G's axis reads as row G's name however far out it is.
 *
 * A label that will not fit anywhere is kept only if it is `required`. A row a
 * learner can pick out is: a missing row letter is the bug this file exists to
 * fix, and one crowded letter is better than none. A number is not, because
 * the stride above it can widen instead and a scale that stops short of a
 * corner is what every scale does.
 */
function layTrack(
  lines: readonly Candidate[], primary: 0 | 1, step: number, maxLane: number,
  width: number, height: number, against: readonly RulerLabel[],
): Track | null {
  const boxes: RulerLabel[] = [];
  const kept: number[] = [];
  const ends: [0 | 1, 0 | 1] = primary === 1 ? [1, 0] : [0, 1];
  let deepest = 0;
  let missing = 0;

  for (let i = 0; i < lines.length; i++) {
    const c = lines[i];
    // Where this label lands at each end of its line when nothing is in the
    // way. Lanes are then counted from THERE, not from where it asked to be:
    // a line already cut by the frame has its label pinned against the inset,
    // so every outward lane clamps back onto the same point, and four lanes
    // measured from the ask are four copies of one position.
    //
    // A NaN back means the line only clips a corner of the frame too tight to
    // hold the box anywhere on its axis, and there is nothing to search.
    const base: [number, number] = [0, 0];
    base[0] = place(c, ends[0], RULER.lead, width, height, _probe);
    base[1] = place(c, ends[1], RULER.lead, width, height, _probe);
    if (!Number.isFinite(base[0]) && !Number.isFinite(base[1])) {
      if (c.required) missing += 1;
      continue;
    }

    let chosen: RulerLabel | null = null;
    let lane = 0;
    // Every offset already tried at each end, so a clamped lane is skipped
    // rather than tested again. Against a frame edge, outward lanes all clamp
    // back onto the same pinned point: remembering only the previous one lets
    // the search bounce between two positions and spend its whole budget
    // without ever reaching the far side of the feasible range.
    _tried[0] = 0;
    _tried[1] = 0;
    for (let k = 0; k <= maxLane && !chosen; k++) {
      // The far end of the same line before a second lane on the near one.
      // Two ends one lane deep is the same information in half the screen, and
      // it leaves the middle of the frame, which is where the board is, alone.
      for (let e = 0; e < 2 && !chosen; e++) {
        if (!Number.isFinite(base[e])) continue;
        // Outward first, so the board stays clear while there is room beside
        // it. Inward is the fallback for a line the frame has already cut,
        // where outward has nowhere left to go.
        for (const sign of k === 0 ? NONE : BOTH) {
          const t = place(c, ends[e], base[e] + sign * k * step, width, height, _probe);
          if (!Number.isFinite(t) || seen(e, t)) continue;
          if (!fits(_probe, boxes) || !fits(_probe, against)) continue;
          chosen = taken(_probe);
          lane = k;
          break;
        }
      }
    }

    if (!chosen && c.required) {
      // The lane ladder is a coarse comb: it steps a whole box at a time, so
      // two labels that would interleave at eight points apart never get the
      // chance. A row letter that has run out of lanes is worth the finer
      // search, because it is the one thing here that cannot simply be thinned
      // out instead. It stays on its own axis either way.
      for (let e = 0; e < 2 && !chosen; e++) {
        if (!Number.isFinite(base[e])) continue;
        place(c, ends[e], RULER.lead, width, height, _probe);
        const lo = _range[0];
        const hi = _range[1];
        if (!(hi > lo)) continue;
        const span = hi - lo;
        for (let d = FINE; d <= span && !chosen; d += FINE) {
          for (const sign of BOTH) {
            const t = base[e] + sign * d;
            if (t < lo || t > hi || seen(e, t)) continue;
            place(c, ends[e], t, width, height, _probe);
            if (!fits(_probe, boxes) || !fits(_probe, against)) continue;
            chosen = taken(_probe);
            lane = maxLane + 1;
            break;
          }
        }
      }
    }

    if (!chosen) {
      // Nowhere on this label's own axis is both inside the frame and clear of
      // everything already drawn. It is dropped, and the caller is told: a
      // wider lane budget usually fixes it, and where it does not, the camera
      // has been pushed somewhere the board is a few points across and the
      // only alternative is printing one letter on top of another. An overlap
      // is not a label, it is two smudges.
      if (c.required) missing += 1;
      continue;
    }
    boxes.push(chosen);
    kept.push(i);
    deepest = Math.max(deepest, lane);
  }
  return boxes.length ? { boxes, kept, lanes: deepest, missing } : null;
}

const NONE = [0] as const;
const BOTH = [1, -1] as const;

/** Offsets remembered per end. Two per lane, plus the one at the line's end. */
const TRIED_MAX = 64;

/**
 * Step of the fine search, in points. Small enough to interleave two chips.
 *
 * Taken from `RULER` so the headless check can hold the layout to it: probes
 * sit on a grid this far apart across the whole feasible range, so any free
 * window WIDER than this contains one, and the check asserts that a band is
 * only ever dropped when every window left on its axis is narrower than a step.
 * A one point slot eighty points out along a leader is not a placement anybody
 * wanted found.
 */
const FINE = RULER.comb;

/**
 * Offsets already tried at each end of the line under consideration.
 *
 * Two fixed buffers rather than a pair of arrays, because this is inside the
 * layout that runs whenever the camera moves and a Set per label per frame is
 * garbage the collector has to come back for while a finger is on the glass.
 */
const _seen = [new Float64Array(TRIED_MAX), new Float64Array(TRIED_MAX)];
const _tried = new Int32Array(2);

/** True when this end has already been tried at this offset. Records it if not. */
function seen(end: number, t: number): boolean {
  const list = _seen[end];
  const n = _tried[end];
  for (let i = 0; i < n; i++) if (Math.abs(list[i] - t) < 0.5) return true;
  if (n < TRIED_MAX) { list[n] = t; _tried[end] = n + 1; }
  return false;
}

/**
 * Lay a track out, starting from whichever end of its lines works out better.
 *
 * One comparison covers every case that would otherwise need a rule of its
 * own: the near end of a board in perspective has the wider gaps, a board
 * turned end for end swaps which end that is, and a board panned half out of
 * frame has only one end left to write on.
 */
function layBestEnd(
  lines: readonly Candidate[], step: number, maxLane: number,
  width: number, height: number, against: readonly RulerLabel[],
): Track | null {
  let best: Track | null = null;
  for (const end of BOTH_ENDS) {
    const track = layTrack(lines, end, step, maxLane, width, height, against);
    if (!track) continue;
    if (!best || better(track, best)) best = track;
  }
  return best;
}

/** More labels beats fewer, then fewer lanes, then more room between them. */
function better(a: Track, b: Track): boolean {
  if (a.missing !== b.missing) return a.missing < b.missing;
  if (a.kept.length !== b.kept.length) return a.kept.length > b.kept.length;
  if (a.lanes !== b.lanes) return a.lanes < b.lanes;
  return worstGap(a.boxes) > worstGap(b.boxes);
}

const BOTH_ENDS = [1, 0] as const;
const NEIGHBOURS = [-1, 1] as const;

/** The tightest pair in a list, for choosing between two equally deep tracks. */
function worstGap(list: readonly RulerLabel[]): number {
  let worst = Infinity;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) worst = Math.min(worst, separation(list[i], list[j]));
  }
  return worst;
}

/**
 * How far along its line a label steps to get out of its neighbour's way.
 *
 * Two gaps of slack, not one. A step of exactly box plus gap is a knife edge:
 * the lines are rarely axis aligned, so a step of 18 along an 89 degree line
 * separates two boxes by 17.996 points and the label falls through to the next
 * lane on a rounding error. The track then stacks a lane deeper than it needs
 * to for no reason a reader could see.
 */
function laneStep(lines: readonly Candidate[]): number {
  let widest: number = RULER.height;
  for (const c of lines) widest = Math.max(widest, c.w);
  return widest + RULER.gap * 2;
}

/**
 * Lay both tracks out for the camera as it is right now.
 *
 * `width` and `height` are the view's size in POINTS, the same units the
 * gesture responder reports and `SandboxScene.projectHole` returns, not the
 * device pixels the drawing buffer is sized in.
 */
export function measureRuler(camera: THREE.Camera, width: number, height: number): RulerLayout {
  const empty: RulerLayout = {
    bands: [], columns: [], visibleRows: [], visibleCols: [], resolvableCols: [],
    resolvableBands: [], stride: RULER.strides[0], lanes: 0, reach: 0,
  };
  if (!(width > 1) || !(height > 1)) return empty;
  loadCamera(camera);

  // ── Which tie points are in frame, and which of those can be told apart ──
  projectHoles(width, height);
  const visibleRows: number[] = [];
  const visibleCols: number[] = [];
  const resolvableCols: number[] = [];
  const colSeen = new Int32Array(COLS);
  const colClear = new Uint8Array(COLS);
  for (let row = 0; row < ROWS; row++) {
    let seen = false;
    for (let col = 0; col < COLS; col++) {
      const i = row * COLS + col;
      if (!_holeOn[i]) continue;
      seen = true;
      colSeen[col] += 1;
      // Against either neighbour: at the edge of the frame one of the two is
      // off screen, and a column at the edge is still one a learner is
      // reading.
      for (const step of NEIGHBOURS) {
        const n = col + step;
        if (n < 0 || n >= COLS) continue;
        const j = row * COLS + n;
        if (!_holeOn[j]) continue;
        if (Math.hypot(_holeX[i] - _holeX[j], _holeY[i] - _holeY[j]) >= RULER.resolve) colClear[col] = 1;
      }
    }
    if (seen) visibleRows.push(row);
  }
  for (let col = 0; col < COLS; col++) {
    if (colSeen[col]) visibleCols.push(col);
    if (colSeen[col] >= RULER.presentCol && colClear[col]) resolvableCols.push(col);
  }

  // ── Candidates ──
  //
  // In board order across the width, rails included: a learner who cannot tell
  // row a from row b cannot tell the ground rail from the supply rail either,
  // and both halves of that were in the same report.
  //
  // A band is named unconditionally only if it can be told apart from the band
  // beside it. Measured at the middle column in frame, so the answer is about
  // the part of the board being looked at rather than about an end of it that
  // perspective has crushed.
  const refCol = visibleCols.length
    ? visibleCols[Math.floor(visibleCols.length / 2)]
    : Math.floor(COLS / 2);
  const refX = columnX(refCol);
  const zOf = (band: { kind: 'row' | 'rail'; index: number }): number =>
    band.kind === 'row' ? rowZ(band.index) : RAILS[band.index].z;
  const order: { kind: 'row' | 'rail'; index: number }[] = [];
  for (const rail of RAILS) if (rail.z < rowZ(0)) order.push({ kind: 'rail', index: rail.id });
  for (let row = 0; row < ROWS; row++) order.push({ kind: 'row', index: row });
  for (const rail of RAILS) if (rail.z > rowZ(ROWS - 1)) order.push({ kind: 'rail', index: rail.id });
  order.sort((a, b) => zOf(a) - zOf(b));
  // How far this band is from the band beside it, on screen, at the middle
  // column in frame. Two separate thresholds are read off it below, and the
  // difference between them matters:
  //
  //   RULER.resolve  a band far enough from its neighbour to be picked out
  //                  with confidence. Above this the name is OWED.
  //   RULER.visible  a band that is still a line of its own rather than part
  //                  of the smear beside it. Below this it gets NO name.
  //
  // Between the two the name is drawn if there is room for it and dropped if
  // there is not, which is what it was before.
  //
  // The lower gate is the one that keeps the ruler off the board. Pinched out
  // and laid nearly level with the table, ten rows share a couple of points of
  // screen; every letter then lanes out ALONG the board, because its own axis
  // is the only line it is allowed to slide on, and fourteen chips end up
  // sitting on the board they are naming. Measured 367 of the board's own
  // holes covered at one such camera before this gate existed. A name for a
  // line nobody can pick out is not worth one hole, let alone half of them.
  const present = (band: { kind: 'row' | 'rail'; index: number }): number => {
    if (band.kind === 'rail') return _railOn[band.index];
    let n = 0;
    for (let col = 0; col < COLS; col++) if (_holeOn[band.index * COLS + col]) n += 1;
    return n;
  };
  const spread: number[] = order.map((band, i) => {
    if (!screenAt(refX, zOf(band), width, height, _b0)) return 0;
    let widest = 0;
    for (const step of NEIGHBOURS) {
      const n = i + step;
      if (n < 0 || n >= order.length) continue;
      if (!screenAt(refX, zOf(order[n]), width, height, _b1)) continue;
      widest = Math.max(widest, Math.hypot(_b0[0] - _b1[0], _b0[1] - _b1[1]));
    }
    return widest;
  });
  const apart: boolean[] = order.map((band, i) =>
    present(band) >= RULER.present && spread[i] >= RULER.resolve);

  const bandLines: Candidate[] = [];
  const firstX = columnX(0);
  const lastX = columnX(COLS - 1);
  order.forEach((band, i) => {
    // A band that has stopped being a line of its own gets no chip, whether or
    // not one would fit. See `spread` above: this is the line that keeps the
    // ruler off a board it can no longer say anything useful about.
    if (spread[i] < RULER.visible) return;
    if (band.kind === 'rail') {
      const rail = RAILS[band.index];
      const seg = clipLine(railHoleX(0), rail.z, railHoleX(RAIL_HOLES - 1), rail.z, width, height);
      if (!seg) return;
      const text = rail.polarity === '+' ? '+' : '-';
      bandLines.push({
        key: `rail:${rail.id}`, text, w: labelWidth(text), index: rail.id, kind: 'rail',
        polarity: rail.polarity, required: apart[i],
        ax: seg.x0, ay: seg.y0, bx: seg.x1, by: seg.y1, dx: seg.dx, dy: seg.dy,
        cutA: seg.cut0, cutB: seg.cut1,
      });
      return;
    }
    if (!visibleRows.includes(band.index)) return;
    const z = rowZ(band.index);
    const seg = clipLine(firstX, z, lastX, z, width, height);
    if (!seg) return;
    const text = ROW_LETTERS[band.index].toUpperCase();
    bandLines.push({
      key: `row:${band.index}`, text, w: labelWidth(text), index: band.index, kind: 'row',
      required: apart[i],
      ax: seg.x0, ay: seg.y0, bx: seg.x1, by: seg.y1, dx: seg.dx, dy: seg.dy,
        cutA: seg.cut0, cutB: seg.cut1,
    });
  });

  // A column's line is run out to the board's own two edges rather than only
  // between row a and row j. Both are the same infinite line, so a label on
  // one is a label on the other, but the longer one puts the number a whole
  // rail clear of the grid when the board fits in frame instead of parking a
  // dark chip on top of the power rail. Zoomed in the frame clips it back to
  // the edge either way.
  const colLines: Candidate[] = [];
  const nearZ = -BOARD.width / 2;
  const farZ = BOARD.width / 2;
  for (const col of visibleCols) {
    const x = columnX(col);
    const seg = clipLine(x, nearZ, x, farZ, width, height);
    if (!seg) continue;
    const text = String(col + 1);
    colLines.push({
      key: `col:${col}`, text, w: labelWidth(text), index: col, kind: 'col', required: false,
      ax: seg.x0, ay: seg.y0, bx: seg.x1, by: seg.y1, dx: seg.dx, dy: seg.dy,
        cutA: seg.cut0, cutB: seg.cut1,
    });
  }

  // ── Both tracks together, because they meet at a corner ──
  //
  // Laying the rows out first and the numbers around them is the obvious order
  // and it is the wrong one. The two tracks are perpendicular, so they only
  // ever fight over one corner of the frame, and whichever end the row letters
  // take, the numbers arriving at that corner have nowhere to go and are
  // dropped. The scale then stops short by a third of the board.
  //
  // So the row letters try both ends of their lines and the numbers are laid
  // out inside each attempt. What is compared is the thing the learner cares
  // about: how far they would ever have to count from a printed number. Two
  // layouts, and the corner sorts itself out.
  const bandStep = laneStep(bandLines);
  const colStep = laneStep(colLines);
  let bands: RulerBand[] = [];
  let columns: RulerColumn[] = [];
  let stride = 0;
  let lanes = 0;
  let reach = Infinity;
  /**
   * Whether either attempt has been taken yet.
   *
   * Not the same as a finite reach. A camera can be pointed somewhere the
   * numbers cannot go at all, and the row letters still have to be drawn:
   * comparing on reach alone dropped the letters too, and losing them is the
   * one outcome this file exists to prevent.
   */
  let settled = false;

  for (const bandEnd of BOTH_ENDS) {
    // The lane budget is raised until every band a learner can pick out has a
    // place of its own. It is nearly always the first rung: the wide ones are
    // for a camera pushed right up against the board and tipped almost level
    // with it, where ten rows share a couple of points of screen and the only
    // honest layout is a long chain of leaders.
    let track: Track | null = null;
    for (const budget of BAND_LANES) {
      const attempt = layTrack(bandLines, bandEnd, bandStep, budget, width, height, NOTHING);
      if (attempt && (!track || better(attempt, track))) track = attempt;
      if (track && track.missing === 0) break;
    }
    const bandTrack = track;
    // A camera with no band worth naming still has columns worth numbering.
    // Giving up on the whole layout here left the ruler completely blank at a
    // board seen edge on: the rows collapse under `RULER.visible` and take the
    // fifty numbers along the board down with them, which is the one camera
    // where the numbers are all a learner has left.
    const bandBoxes: readonly RulerLabel[] = bandTrack ? bandTrack.boxes : NOTHING;

    // The stride is a property of the CAMERA, not of the board. Pulled back
    // there is room for one number in four or five, which is roughly what a
    // real board prints; moved in there is room for every one, and a learner
    // lining a leg up on column 29 needs every one. The ladder is climbed
    // until the numbers land, so the ruler densifies as the learner moves in.
    //
    // A number with nowhere legal to go is dropped rather than nudged out of
    // line. Where the two tracks cross, the scale therefore skips a number
    // instead of stacking one on top of a row letter, which is what a
    // dimensioned drawing does at the same crossing.
    let bestCols: RulerColumn[] = [];
    let bestStride = 0;
    let bestReach = Infinity;
    let bestLanes = 0;
    // Two passes. The first insists on a regular scale, which is what should
    // happen and nearly always does. The second drops that insistence, for the
    // poses where the board is so nearly edge on, or so far off the side of
    // the frame, that no regular scale exists: an uneven row of numbers there
    // is still an answer, and nothing at all is not.
    for (const tidy of [true, false]) {
    if (bestStride) break;
    const ladder = DESCENDING;
    for (const trial of ladder) {
      const picked: Candidate[] = [];
      for (const c of colLines) if ((c.index + 1) % trial === 0) picked.push(c);
      if (picked.length < MIN_NUMBERS) continue;
      // The two ends of the run carry the whole span of the scale, and losing
      // one is not the same as losing a number out of the middle. A number
      // missing from the middle costs a learner nothing, because the numbers
      // either side of the gap still bracket it; a number missing from an END
      // leaves every column beyond it counting inward from the next one, which
      // is how a scale that reads as regular still leaves a third of the board
      // ten columns from a number. So the ends are marked required: they get
      // the fine comb, and a track that keeps them beats one that does not.
      picked[0] = { ...picked[0], required: true };
      picked[picked.length - 1] = { ...picked[picked.length - 1], required: true };
      const track = layBestEnd(picked, colStep, COLUMN_LANES, width, height, bandBoxes);
      if (!track) continue;
      if (track.kept.length < MIN_NUMBERS) continue;
      // A scale is regular or it is not a scale. Dropping whatever will not
      // fit and keeping the rest would produce the densest set of numbers that
      // can be drawn, and it would read as numbers scattered along an edge:
      // 12, 15, 17, 18, 20, 23. So a stride counts as landed only if no two
      // numbers in a row were lost, which leaves room for the odd one hidden
      // where the row letters cross and rejects the strides that are really a
      // thinning in disguise.
      if (tidy && !regular(track.kept)) continue;
      const numbers: RulerColumn[] = track.boxes.map((box, i) => ({
        ...box, index: picked[track.kept[i]].index,
      }));
      const gap = furthestFromANumber(resolvableCols, numbers);
      if (gap < bestReach) {
        bestReach = gap;
        bestStride = trial;
        bestCols = numbers;
        bestLanes = track.lanes;
      }
      // Widest first, and stop at the first one that meets the promise. The
      // densest scale the camera could hold is not the best scale: printing a
      // number against every column when every fourth one already answers the
      // question is how a ruler turns into a wall of digits.
      if (gap <= RULER.reach) break;
    }
    }

    const deep = Math.max(bandTrack ? bandTrack.lanes : 0, bestLanes);
    if (!settled || bestReach < reach || (bestReach === reach && deep < lanes)) {
      settled = true;
      reach = bestReach;
      stride = bestStride;
      columns = bestCols;
      lanes = deep;
      bands = bandTrack
        ? bandTrack.boxes.map((box, i) => {
          const line = bandLines[bandTrack.kept[i]];
          return {
            ...box,
            kind: line.kind as RulerBandKind,
            index: line.index,
            ...(line.polarity ? { polarity: line.polarity } : {}),
          };
        })
        : [];
    }
  }

  return {
    bands, columns, visibleRows, visibleCols, resolvableCols,
    resolvableBands: bandLines.filter((c) => c.required).map((c) => ({
      kind: c.kind as RulerBandKind, index: c.index,
    })),
    stride, lanes,
    reach: Number.isFinite(reach) ? reach : 0,
  };
}

/** Columns a learner would have to count from the nearest printed number. */
function furthestFromANumber(visible: readonly number[], numbers: readonly RulerColumn[]): number {
  if (!numbers.length) return Infinity;
  let worst = 0;
  for (const col of visible) {
    let near = Infinity;
    for (const n of numbers) near = Math.min(near, Math.abs(n.index - col));
    worst = Math.max(worst, near);
  }
  return worst;
}

/**
 * How deep each track may stack.
 *
 * The rows get a ladder rather than a number, climbed only as far as it takes
 * to give every band a learner can pick out a place of its own. Three covers
 * every camera the app offers a button for; the wider rungs exist because a
 * pinch can put the lens an inch from the board at table level, and there ten
 * rows really do share a few points of screen.
 *
 * The numbers get one lane, because a scale two deep has stopped being a
 * scale, and thinning them costs nothing: the stride widens instead.
 */
const BAND_LANES: readonly number[] = [3, 6, 12, 24];
const COLUMN_LANES = 1;

/** The stride ladder, widest first. */
const DESCENDING: readonly number[] = [...RULER.strides].reverse();

/** Fewer numbers than this is not a scale, it is a stray label. */
const MIN_NUMBERS = 3;

/** True when no two numbers in a row were lost from a stride's run. */
function regular(kept: readonly number[]): boolean {
  for (let i = 1; i < kept.length; i++) if (kept[i] - kept[i - 1] > 2) return false;
  return true;
}

const NOTHING: readonly RulerLabel[] = [];
