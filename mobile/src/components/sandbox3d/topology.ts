// ── Which holes are the same wire ──
//
// A breadboard is not a grid of independent holes, it is a grid of five hole
// strips with a spring clip inside each one. Everything a learner gets wrong on
// their first board comes from that: the LED spanning a5 and a6 that never
// lights because both legs landed in the same strip, the resistor laid flat
// along a row that shorts itself out.
//
// So the topology lives here, in plain TypeScript, with no three.js anywhere
// near it. It is the part that has to be RIGHT, and keeping it pure means it
// can be asserted in a Node script (scripts/check-breadboard.mjs) rather than
// eyeballed on a phone.
//
// Two vocabularies, deliberately separate:
//   HOLE  a physical socket a leg can go into.        'bb:11:e'
//   NET   the copper those holes share before any     'strip:11:lower'
//         part or wire is placed.
// Many holes, one net. `netOfHole` is the whole of breadboard theory.

import {
  BOARD, COLS, HOLE_RADIUS, PITCH, RAILS, RAIL_HOLES, RAVINE_ROW, ROWS,
  ROW_LETTERS, UNO, UNO_PINS, UNO_PIN_BY_NAME, UNO_TOP, BOARD_TOP,
  columnX, railHoleX, rowZ, unoPinWorld,
} from './boardSpec';

/**
 * A hole address, as a string.
 *
 * A string rather than a struct because these are used as object keys in the
 * netlist, are compared for equality constantly, and have to survive being
 * persisted by the shell and read back. A discriminated union would be prettier
 * in the type system and worse everywhere else.
 *
 *   'bb:<col>:<row>'   col 0..62 (printed 1..63), row 0..9 (printed a..j)
 *   'rail:<rail>:<i>'  rail 0..3, i 0..49
 *   'uno:<pin>'        an Arduino header pin, by name
 */
export type HoleId = string;

/** An electrically common group of holes, before anything is plugged in. */
export type NetKey = string;

export type HoleKind = 'terminal' | 'rail' | 'uno';

export interface HoleInfo {
  id: HoleId;
  kind: HoleKind;
  /** What the board prints beside it: 'e12', '+', 'D9'. */
  label: string;
  /** Where a leg in this hole meets the world. */
  world: [number, number, number];
  net: NetKey;
  /** Terminal holes only. */
  col?: number;
  row?: number;
  /** Rail holes only. */
  rail?: number;
  polarity?: '+' | '-';
}

export const holeId = {
  bb: (col: number, row: number): HoleId => `bb:${col}:${row}`,
  rail: (rail: number, i: number): HoleId => `rail:${rail}:${i}`,
  uno: (pin: string): HoleId => `uno:${pin}`,
};

/**
 * The net a hole belongs to.
 *
 * Rows a to e of a column are one strip and f to j are another: the ravine is
 * not decoration, it is the break that lets a DIP chip have two independent
 * sides. Each rail is one net for its whole length on this board (see
 * RAIL_SEGMENTS). The Uno's three GND pins are one net, because they are.
 */
export function netOfHole(id: HoleId): NetKey {
  const p = id.split(':');
  if (p[0] === 'bb') {
    const col = Number(p[1]);
    const row = Number(p[2]);
    return `strip:${col}:${row <= RAVINE_ROW ? 'lower' : 'upper'}`;
  }
  if (p[0] === 'rail') return `rail:${p[1]}`;
  if (p[0] === 'uno') return `uno:${p[1]}`;
  return `?:${id}`;
}

/** Parse a hole id into everything the scene and the shell need to know. */
export function holeInfo(id: HoleId): HoleInfo | null {
  const p = id.split(':');
  if (p[0] === 'bb') {
    const col = Number(p[1]);
    const row = Number(p[2]);
    if (!Number.isInteger(col) || !Number.isInteger(row)) return null;
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return {
      id, kind: 'terminal', col, row,
      label: `${ROW_LETTERS[row]}${col + 1}`,
      world: [columnX(col), BOARD_TOP, rowZ(row)],
      net: netOfHole(id),
    };
  }
  if (p[0] === 'rail') {
    const rail = Number(p[1]);
    const i = Number(p[2]);
    if (!Number.isInteger(rail) || !Number.isInteger(i)) return null;
    if (rail < 0 || rail >= RAILS.length || i < 0 || i >= RAIL_HOLES) return null;
    const r = RAILS[rail];
    return {
      id, kind: 'rail', rail, polarity: r.polarity,
      label: `${r.polarity} rail`,
      world: [railHoleX(i), BOARD_TOP, r.z],
      net: netOfHole(id),
    };
  }
  if (p[0] === 'uno') {
    const pin = UNO_PIN_BY_NAME[p[1]];
    if (!pin) return null;
    return { id, kind: 'uno', label: pin.name, world: unoPinWorld(pin), net: netOfHole(id) };
  }
  return null;
}

/** Where a leg plugged into this hole meets the board surface. */
export function holeWorld(id: HoleId): [number, number, number] {
  return holeInfo(id)?.world ?? [0, 0, 0];
}

/** True when two holes are the same copper before anything is wired. */
export function sameNet(a: HoleId, b: HoleId): boolean {
  return netOfHole(a) === netOfHole(b);
}

/** Every hole in the same strip or rail as this one, itself included. */
export function holesInNet(net: NetKey): HoleId[] {
  const p = net.split(':');
  if (p[0] === 'strip') {
    const col = Number(p[1]);
    const base = p[2] === 'lower' ? 0 : RAVINE_ROW + 1;
    return Array.from({ length: 5 }, (_, i) => holeId.bb(col, base + i));
  }
  if (p[0] === 'rail') {
    const rail = Number(p[1]);
    return Array.from({ length: RAIL_HOLES }, (_, i) => holeId.rail(rail, i));
  }
  if (p[0] === 'uno') {
    return UNO_PINS.filter((pin) => pin.name === p[1]).map((pin) => holeId.uno(pin.name));
  }
  return [];
}

/** Every hole on the board, in a stable order. Used to build the instanced sockets. */
export function allHoles(): HoleId[] {
  const out: HoleId[] = [];
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) out.push(holeId.bb(col, row));
  }
  for (const r of RAILS) {
    for (let i = 0; i < RAIL_HOLES; i++) out.push(holeId.rail(r.id, i));
  }
  return out;
}

/**
 * Move `dcol` columns and `drow` rows from a hole. Returns null off the board.
 *
 * Rail holes have no grid to move in, which is correct: a part cannot be
 * "two rows up" from a rail hole, only a wire can reach one.
 */
export function offsetHole(id: HoleId, dcol: number, drow: number): HoleId | null {
  const p = id.split(':');
  if (p[0] !== 'bb') return dcol === 0 && drow === 0 ? id : null;
  const col = Number(p[1]) + dcol;
  const row = Number(p[2]) + drow;
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  return holeId.bb(col, row);
}

/**
 * Nearest hole to a point on the board surface, or null if the tap missed.
 *
 * `slack` is generous on purpose. A hole is 1.2 mm across and a fingertip is
 * about 10 mm, so requiring a hit inside the actual socket would make the board
 * untappable. Snapping to the nearest hole within about half a pitch is the
 * behaviour that feels accurate even though it is forgiving.
 */
export function holeAtPoint(x: number, z: number, slack = PITCH * 0.62): HoleId | null {
  if (Math.abs(x) > BOARD.length / 2 + slack) return null;
  if (Math.abs(z) > BOARD.width / 2 + slack) return null;

  let best: HoleId | null = null;
  let bestDist = slack * slack;

  // Numbered columns: the column is a direct index, the row needs a search
  // because the ravine breaks the arithmetic between e and f.
  const col = Math.round((x - columnX(0)) / PITCH);
  if (col >= 0 && col < COLS) {
    const dx = x - columnX(col);
    for (let row = 0; row < ROWS; row++) {
      const dz = z - rowZ(row);
      const d = dx * dx + dz * dz;
      if (d < bestDist) { bestDist = d; best = holeId.bb(col, row); }
    }
  }

  // Rails: their holes are grouped in fives, so the index is not a plain
  // division either.
  for (const r of RAILS) {
    const dz = z - r.z;
    if (dz * dz > bestDist) continue;
    for (let i = 0; i < RAIL_HOLES; i++) {
      const dx = x - railHoleX(i);
      const d = dx * dx + dz * dz;
      if (d < bestDist) { bestDist = d; best = holeId.rail(r.id, i); }
    }
  }

  return best;
}

/** Nearest Uno header pin to a point on the Uno's surface, or null. */
export function unoPinAtPoint(x: number, z: number, slack = PITCH * 0.7): HoleId | null {
  const lx = x - UNO.x;
  const lz = z - UNO.z;
  if (Math.abs(lx) > UNO.length / 2 + slack || Math.abs(lz) > UNO.width / 2 + slack) return null;
  let best: HoleId | null = null;
  let bestDist = slack * slack;
  for (const pin of UNO_PINS) {
    const dx = lx - pin.x;
    const dz = lz - pin.z;
    const d = dx * dx + dz * dz;
    if (d < bestDist) { bestDist = d; best = holeId.uno(pin.name); }
  }
  return best;
}

/** The y plane a tap is projected onto, per surface. */
export const SURFACE_Y = { board: BOARD_TOP, uno: UNO_TOP } as const;

/**
 * Outer radius of the ring drawn around the hole a finger is over.
 *
 * 2.6 socket radii, which is 0.125 inch across: a quarter wider than the pitch,
 * so the ring is thick enough to see at a fitted camera on a phone and still
 * unambiguous about which of two neighbouring holes it is naming.
 */
export const HOLE_HIGHLIGHT_RADIUS = HOLE_RADIUS * 2.6;
