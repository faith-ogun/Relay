// ── The breadboard, measured ──
//
// Every number here is a real dimension of a full size 830 tie point solderless
// breadboard (the MB-102 that ships in the Arduino Starter Kit), not a value
// picked to look right. That matters more than it sounds: a learner who is told
// "put the LED in e12" has to be able to count to twelve on this board and land
// on the same hole they would land on with the physical one in front of them.
// If the grid is invented, the instruction is wrong on the phone.
//
// UNITS. One world unit is one inch, so the 0.1 inch pitch of a breadboard is
// exactly 0.1 and every position below reads as the number an engineer would
// quote. The board top sits on the y = 0 plane and the body hangs below it,
// which means every part is authored with its seating plane at y = 0 and no
// part has to know how thick the board is.
//
// AXES. x runs along the long axis (the 63 numbered columns), z across the
// short axis (rows a to j and the four power rails), y is up.

/** 0.1 inch. The pitch of every hole on the board and of every DIP package. */
export const PITCH = 0.1;

/** Numbered tie point columns. A full size board has 63. */
export const COLS = 63;

/** Rows a to j. Five below the ravine, five above it. */
export const ROWS = 10;

/** Row index of the last row before the ravine (row e). */
export const RAVINE_ROW = 4;

/**
 * Holes per power rail. Fifty, laid out as ten groups of five: the groups are
 * why a real rail looks like a rail and not like a ruler, and why a rail hole
 * does not line up with the numbered column above it.
 */
export const RAIL_HOLES = 50;
const RAIL_GROUP = 5;
/** Pitches consumed by one group of five plus the gap that follows it. */
const RAIL_GROUP_STRIDE = 6;
/** Pitches the rail run is inset from the first numbered column. */
const RAIL_INSET = 2;

/**
 * The rails run the full length of the board with no break in the middle.
 *
 * This is a real fork in breadboard design and it has to be a deliberate
 * choice rather than an accident: some boards split each rail into two
 * electrically separate halves, and a learner who assumes continuity on one of
 * those spends an hour debugging a circuit that was never powered. The MB-102
 * in the starter kit is continuous, so this model is continuous, and the
 * curriculum can teach one rule.
 */
export const RAIL_SEGMENTS = 1;

export const BOARD = {
  /** 165.1 mm. */
  length: 6.5,
  /** 54.6 mm. */
  width: 2.15,
  /** 8.5 mm. */
  height: 0.34,
  /** The rounded corner of the moulding. */
  bevel: 0.035,
} as const;

/** The board top is the origin plane, so parts are authored from y = 0 up. */
export const BOARD_TOP = 0;
/** The table the board and the Arduino both sit on. */
export const TABLE_Y = -BOARD.height;

/** The groove down the middle: 0.2 inch wide, and deep enough to read as one. */
export const RAVINE = { halfWidth: 0.1, depth: 0.06 } as const;

/** x of numbered column `col`, 0 based. Column 0 is printed as "1". */
export function columnX(col: number): number {
  return -((COLS - 1) * PITCH) / 2 + col * PITCH;
}

/**
 * z of row `row`, 0 based, a to j.
 *
 * Rows a to e and f to j are each on a 0.1 inch pitch, but e to f is 0.3 inch:
 * that is the DIP standard, and it is the whole reason an IC straddles the
 * ravine with one row of legs on each side. Getting this wrong makes every
 * chip in the curriculum unplaceable.
 */
export function rowZ(row: number): number {
  // Rows e and f sit 0.15 either side of the centre line, so they are 0.3 apart.
  return row <= RAVINE_ROW
    ? -(0.15 + (RAVINE_ROW - row) * PITCH)
    : 0.15 + (row - RAVINE_ROW - 1) * PITCH;
}

/**
 * The four power rails, outermost first on each side.
 *
 * Index 0 and 1 are the far side (negative z), 2 and 3 the near side. Polarity
 * follows the printing on a real board: the positive line is always the outer
 * one, which is the convention that stops a learner reaching for the wrong row
 * when the board is turned around.
 */
export const RAILS = [
  { id: 0, z: -0.85, polarity: '+' as const, side: 'far' as const },
  { id: 1, z: -0.75, polarity: '-' as const, side: 'far' as const },
  { id: 2, z: 0.75, polarity: '-' as const, side: 'near' as const },
  { id: 3, z: 0.85, polarity: '+' as const, side: 'near' as const },
];

/**
 * z of the coloured stripe printed alongside rail `rail`.
 *
 * 0.06 inch out from the rail's holes, not 0.1. The two rails sit 0.2 inch
 * apart from the numbered grid, and a stripe parked halfway across that gap
 * leaves the column numbers nowhere to go: they end up printed straight
 * through the blue line, which is exactly where they were. A real MB-102 runs
 * its lines close against the rail holes and gives the numbers the rest of the
 * band, and so does this.
 */
const STRIPE_OFFSET = 0.06;

export function railStripeZ(rail: number): number {
  const r = RAILS[rail];
  const outward = r.polarity === '+' ? STRIPE_OFFSET : -STRIPE_OFFSET;
  return r.side === 'far' ? r.z - outward : r.z + outward;
}

/** Width of the printed rail line. Half a millimetre, as it is on the board. */
export const STRIPE_WIDTH = 0.02;

/** x of hole `i` (0 to 49) on any rail. */
export function railHoleX(i: number): number {
  const group = Math.floor(i / RAIL_GROUP);
  const within = i % RAIL_GROUP;
  return columnX(RAIL_INSET + group * RAIL_GROUP_STRIDE + within);
}

/**
 * Socket radius. A real MB-102 socket is 1.2 mm across at the surface, which
 * is 0.024 inch across the radius: a little under a quarter of the pitch.
 *
 * The ratio is the whole point. Draw the socket much fatter than this and
 * neighbouring holes stop having clear plastic between them, at which point
 * the grid reads as one grey field and there is no way to tell g29 from g30 by
 * eye. That is not a hypothetical: it is what the board did.
 */
export const HOLE_RADIUS = 0.024;

/**
 * The moulded lip around each socket.
 *
 * 0.064 inch across, so two neighbouring lips leave 0.036 inch of clear
 * plastic between them: better than a third of the pitch, which is what keeps
 * the holes reading as separate holes at a fitted camera on a phone.
 */
export const SOCKET_LIP_RADIUS = 0.032;

// There is deliberately no socket DEPTH here any more. The board's printed top
// is an opaque quad with no aperture in it, so anything modelled below that
// quad is occluded by it and draws nothing: 830 socket tubes used to be built
// that way and not one pixel of them was ever seen. The socket is drawn as a
// face sitting just above the printing instead, which is what the web scene
// does per hole. Reinstating real depth means punching 830 apertures in the
// top surface first, not lowering geometry back under it.

/** Every tie point on the board: 630 numbered plus 200 on the rails. */
export const TIE_POINTS = COLS * ROWS + RAILS.length * RAIL_HOLES;

/** Row letters, in board order. */
export const ROW_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const;

/**
 * The Arduino Uno, sitting alongside the breadboard.
 *
 * Real outline: 68.6 x 53.4 mm, 1.6 mm of FR-4. It is here rather than in its
 * own file because the sandbox needs one shared table coordinate space: the
 * jumper wire from the Uno's 5V pin to the positive rail is the first wire in
 * every build, and it can only exist if both boards agree where the table is.
 */
export const UNO = {
  length: 2.7,
  width: 2.1,
  pcb: 0.063,
  /** Placed behind the breadboard, header side facing the learner. */
  x: 0,
  z: -2.05,
} as const;

/** Top surface of the Uno's PCB, in table coordinates. */
export const UNO_TOP = TABLE_Y + UNO.pcb;

/**
 * Uno header pins that a jumper can reach.
 *
 * Positions are local to the Uno's centre and follow the real board: the
 * digital header runs along the far edge, power and analog along the near one,
 * both on the 0.1 inch pitch, with the notorious 0.16 inch jog between D7 and
 * D8 that stops a shield being plugged in backwards.
 */
export type UnoPinName =
  | `D${number}` | `A${number}`
  | '5V' | '3V3' | 'VIN' | 'GND' | 'RESET' | 'AREF' | 'IOREF';

export interface UnoPin {
  name: UnoPinName;
  /** Printed label. Three GND pins share one name but not one label position. */
  label: string;
  x: number;
  z: number;
}

function buildUnoPins(): UnoPin[] {
  const pins: UnoPin[] = [];
  const farZ = -0.78;   // digital header, far edge
  const nearZ = 0.78;   // power and analog headers, near edge

  // Left to right with the USB socket on the left, which is the orientation
  // every photo, every tutorial and every kit instruction uses: AREF, GND, 13
  // down to 8, the 0.16 inch jog that stops a shield going in backwards, then
  // 7 down to 0. Mirroring this is invisible in a screenshot and makes every
  // wiring instruction in the curriculum point at the wrong pin.
  const highBlock = ['AREF', 'GND', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8'];
  highBlock.forEach((name, i) => {
    pins.push({
      name: name as UnoPinName,
      label: name.startsWith('D') ? name.slice(1) : name,
      x: -0.62 + i * PITCH,
      z: farZ,
    });
  });
  const lowBlock = ['D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0'];
  lowBlock.forEach((name, i) => {
    pins.push({ name: name as UnoPinName, label: name.slice(1), x: 0.24 + i * PITCH, z: farZ });
  });

  // Power header. IOREF is the pin most people read as "REF" on the silkscreen;
  // AREF is a different pin entirely and lives on the digital side.
  const power: Array<[UnoPinName, string]> = [
    ['IOREF', 'REF'], ['RESET', 'RST'], ['3V3', '3V3'], ['5V', '5V'],
    ['GND', 'GND'], ['GND', 'GND'], ['VIN', 'VIN'],
  ];
  power.forEach(([name, label], i) => {
    pins.push({ name, label, x: -0.62 + i * PITCH, z: nearZ });
  });

  // Analog header.
  for (let i = 0; i < 6; i++) {
    pins.push({ name: `A${i}` as UnoPinName, label: `A${i}`, x: 0.32 + i * PITCH, z: nearZ });
  }
  return pins;
}

export const UNO_PINS: UnoPin[] = buildUnoPins();

/** Pin lookup by name. The three GND pins collapse to the first one. */
export const UNO_PIN_BY_NAME: Record<string, UnoPin> = UNO_PINS.reduce<Record<string, UnoPin>>(
  (acc, p) => { if (!acc[p.name]) acc[p.name] = p; return acc; },
  {},
);

/** Table position of an Uno pin, ready to be a wire endpoint. */
export function unoPinWorld(pin: UnoPin): [number, number, number] {
  return [UNO.x + pin.x, UNO_TOP + 0.09, UNO.z + pin.z];
}
