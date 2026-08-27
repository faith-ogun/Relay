import React, { useCallback, useId, useMemo, useState } from 'react';

/**
 * ArduinoScene — the simulated bench for the code lab.
 *
 * An Arduino Uno R3 drawn to its real outline (68.6 x 53.4 mm of FR-4, the
 * notch by the analog header, the four mounting holes) with the parts a
 * learner actually wires to it: a red LED behind a 220 ohm resistor on pin 9,
 * a tactile button on pin 2, and a potentiometer on A0. Pin 13 is not an
 * invented lamp floating above the board, it is the on-board L LED, because
 * that is what lights when a sketch writes pin 13 HIGH on the real thing.
 *
 * Everything is authored in board millimetres so the geometry can be checked
 * against a real Uno: the headers sit on the 0.1 inch pitch, the two digital
 * runs are separated by the 0.16 inch jog that stops a shield going in
 * backwards, and the silkscreen carries the legends that a wiring instruction
 * refers to. The learner should be able to look from this drawing to the board
 * on their desk and find the same pin in the same place.
 */

// ── Scene geometry (millimetres) ──────────────────────────────────────────

const VIEW_W = 80;
const VIEW_H = 89;

/** Where the board's top-left corner sits in scene space. */
const BX = 5;
const BY = 15;

/** Real Uno R3 outline. */
const BOARD_W = 68.58;
const BOARD_H = 53.34;

/** 0.1 inch header pitch. */
const PITCH = 2.54;
/** Header rows, measured from the digital edge. The two are 1.9 inches apart. */
const ROW_TOP = 2.54;
const ROW_BOTTOM = 50.8;

/** The notch cut out of the corner by the analog header. */
const NOTCH_X = 63.5;
const NOTCH_Y = 48.2;

// ── Palette, matched to the 3D board so the two apps show one product ─────

const MASK = '#0b7f82';
const MASK_LIGHT = '#0d9295';
const MASK_DARK = '#086063';
const PCB_EDGE = '#04494b';
const SILK = '#cfe9e9';
const SILK_SOFT = '#8fc4c5';
const GOLD = '#c9a227';
const GOLD_LIGHT = '#e3bf51';
const IC_BLACK = '#17181b';
const HEADER_PLASTIC = '#16171a';
const CAN_METAL = '#c6cace';
const PLASTIC_WHITE = '#e7eaee';
const INK = '#14181f';
const INK_SOFT = '#474d57';

const FONT_SILK = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const FONT_UI = "'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif";

// ── Header pads ───────────────────────────────────────────────────────────

interface Pad {
  /** Silkscreen legend. The reserved pin on the power header carries none. */
  label: string;
  x: number;
  row: 'top' | 'bottom';
  /** Second line printed above the number on the two serial pins. */
  over?: string;
}

/**
 * Read left to right with the USB socket on the left, which is the orientation
 * of every photograph, kit instruction and tutorial. Mirroring it is invisible
 * in a screenshot and makes every wiring instruction point at the wrong pin.
 */
const TOP_LEFT_RUN = ['SCL', 'SDA', 'AREF', 'GND', '13', '12', '~11', '~10', '~9', '8'];
const TOP_RIGHT_RUN = ['7', '~6', '~5', '4', '~3', '2', '1', '0'];
const POWER_RUN = ['', 'IOREF', 'RESET', '3V3', '5V', 'GND', 'GND', 'VIN'];
const ANALOG_RUN = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];

/** x of the leftmost pin of each run, board-local. */
const X_TOP_LEFT = 21.34;
const X_TOP_RIGHT = 48.26;   // the 0.16 inch jog lands between pin 8 and pin 7
const X_POWER = 17.78;
const X_ANALOG = 49.53;

const PADS: Pad[] = [
  ...TOP_LEFT_RUN.map((label, i) => ({ label, x: X_TOP_LEFT + i * PITCH, row: 'top' as const })),
  ...TOP_RIGHT_RUN.map((label, i) => ({
    label,
    x: X_TOP_RIGHT + i * PITCH,
    row: 'top' as const,
    over: label === '1' ? 'TX' : label === '0' ? 'RX' : undefined,
  })),
  ...POWER_RUN.map((label, i) => ({ label, x: X_POWER + i * PITCH, row: 'bottom' as const })),
  ...ANALOG_RUN.map((label, i) => ({ label, x: X_ANALOG + i * PITCH, row: 'bottom' as const })),
];

/** Board-local x of a named pin. */
const padX = (label: string, row: 'top' | 'bottom', occurrence = 0): number => {
  const hits = PADS.filter((p) => p.label === label && p.row === row);
  return hits[occurrence]?.x ?? 0;
};

/** Scene position of a header pin. */
const pin = (label: string, row: 'top' | 'bottom', occurrence = 0): [number, number] => [
  BX + padX(label, row, occurrence),
  BY + (row === 'top' ? ROW_TOP : ROW_BOTTOM),
];

/** Black housings, one per run: [x, width] board-local. */
const HOUSINGS: Array<{ x: number; w: number; row: 'top' | 'bottom' }> = [
  { x: X_TOP_LEFT - 1.27, w: TOP_LEFT_RUN.length * PITCH, row: 'top' },
  { x: X_TOP_RIGHT - 1.27, w: TOP_RIGHT_RUN.length * PITCH, row: 'top' },
  { x: X_POWER - 1.27, w: POWER_RUN.length * PITCH, row: 'bottom' },
  { x: X_ANALOG - 1.27, w: ANALOG_RUN.length * PITCH, row: 'bottom' },
];

const MOUNT_HOLES: Array<[number, number]> = [
  [15.24, 2.54],
  [13.97, 50.8],
  [66.04, 17.78],
  [66.04, 45.72],
];

// ── Small drawing helpers ─────────────────────────────────────────────────

const n2 = (v: number) => Number(v.toFixed(2));

/**
 * An orthogonal wire route with rounded corners. Jumper wire does not turn a
 * square corner, and a square corner is the thing that makes a diagram read as
 * a schematic rather than as cable lying on a bench.
 */
function ortho(points: Array<[number, number]>, radius = 1.5): string {
  const pts = points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]);
  if (pts.length < 2) return '';
  let d = `M ${n2(pts[0][0])} ${n2(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const [ax, ay] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [bx, by] = pts[i + 1];
    const inLen = Math.hypot(cx - ax, cy - ay);
    const outLen = Math.hypot(bx - cx, by - cy);
    if (inLen === 0 || outLen === 0) continue;
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const ix = cx - ((cx - ax) / inLen) * r;
    const iy = cy - ((cy - ay) / inLen) * r;
    const ox = cx + ((bx - cx) / outLen) * r;
    const oy = cy + ((by - cy) / outLen) * r;
    d += ` L ${n2(ix)} ${n2(iy)} Q ${n2(cx)} ${n2(cy)} ${n2(ox)} ${n2(oy)}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  d += ` L ${n2(lx)} ${n2(ly)}`;
  return d;
}

/**
 * A jumper wire: dark casing, coloured core, and a highlight along the top so
 * it reads as a round cable lying over the board rather than a drawn line.
 * Where two jumpers cross, the casing is what tells you which one is on top.
 */
const Jumper: React.FC<{ d: string; color: string; width?: number }> = ({ d, color, width = 1.1 }) => (
  <g>
    <path d={d} fill="none" stroke="#05070a" strokeOpacity={0.55} strokeWidth={width + 0.9} strokeLinecap="round" strokeLinejoin="round" />
    <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    <path d={d} fill="none" stroke="#ffffff" strokeOpacity={0.28} strokeWidth={width * 0.26} strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

/** The plastic shell on the end of a jumper, where it plugs into a header. */
const Boot: React.FC<{ x: number; y: number; color: string }> = ({ x, y, color }) => (
  <g>
    <rect x={x - 1.15} y={y - 1.9} width={2.3} height={3.8} rx={0.5} fill="#0f1115" />
    <rect x={x - 0.72} y={y - 1.5} width={1.44} height={2.4} rx={0.35} fill={color} opacity={0.9} />
  </g>
);

interface SilkProps {
  x: number;
  y: number;
  size?: number;
  anchor?: 'start' | 'middle' | 'end';
  fill?: string;
  weight?: number;
  children: string;
}

const Silk: React.FC<SilkProps> = ({ x, y, size = 2, anchor = 'middle', fill = SILK, weight = 700, children }) => (
  <text
    x={n2(x)}
    y={n2(y)}
    fontSize={size}
    fontWeight={weight}
    fill={fill}
    textAnchor={anchor}
    dominantBaseline="middle"
    fontFamily={FONT_SILK}
  >
    {children}
  </text>
);

/** An annotation in the app's own voice, outside the board. */
const Callout: React.FC<{ x: number; y: number; anchor?: 'start' | 'middle' | 'end'; children: React.ReactNode }> = ({
  x, y, anchor = 'middle', children,
}) => (
  <text
    x={n2(x)}
    y={n2(y)}
    fontSize={2.35}
    fontWeight={900}
    fill={INK_SOFT}
    textAnchor={anchor}
    dominantBaseline="middle"
    fontFamily={FONT_UI}
    letterSpacing={0.22}
  >
    {children}
  </text>
);

// ── Public API ────────────────────────────────────────────────────────────

export interface ArduinoSceneProps {
  /** Pin 13, which drives the on-board L LED. */
  led13: boolean;
  /** Pin 9's duty cycle, 0 to 1, driving the external LED's brightness. */
  bright9: number;
  /** Whether the pin 2 button is being held. */
  pressed: boolean;
  onPress: (pressed: boolean) => void;
  /** The A0 potentiometer, 0 to 1023. */
  pot: number;
  /** Board has power. The green ON LED follows this. */
  powered?: boolean;
  /** Serial traffic, which blinks TX the way the real board does. */
  serialActive?: boolean;
  className?: string;
}

export const ArduinoScene: React.FC<ArduinoSceneProps> = ({
  led13,
  bright9,
  pressed,
  onPress,
  pot,
  powered = true,
  serialActive = false,
  className,
}) => {
  const rawId = useId();
  const uid = useMemo(() => rawId.replace(/[^a-zA-Z0-9]/g, ''), [rawId]);
  // The button is reachable by keyboard, so it needs a focus ring of its own:
  // a UA outline on an SVG group is unreliable across browsers.
  const [focused, setFocused] = useState(false);

  const duty = Math.max(0, Math.min(1, bright9));
  const knobAngle = (pot / 1023 - 0.5) * 1.5 * 180; // a real pot turns about 270 degrees

  const press = useCallback(() => onPress(true), [onPress]);
  const release = useCallback(() => onPress(false), [onPress]);
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onPress(true); }
    },
    [onPress],
  );
  const onKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onPress(false); }
    },
    [onPress],
  );
  const blur = useCallback(() => { setFocused(false); onPress(false); }, [onPress]);

  // Pin positions the jumpers run from.
  const [d9x, d9y] = pin('~9', 'top');
  const [gndTopX, gndTopY] = pin('GND', 'top');
  const [d2x, d2y] = pin('2', 'top');
  const [v5x, v5y] = pin('5V', 'bottom');
  // The power header carries two grounds. The inner one feeds the knob, the
  // outer one the button, so the two runs do not have to cross each other.
  const [gndPotX, gndPotY] = pin('GND', 'bottom', 0);
  const [gndBtnX, gndBtnY] = pin('GND', 'bottom', 1);
  const [a0x, a0y] = pin('A0', 'bottom');

  // Pin 9's LED sits above the board, exactly spanning GND to pin 9 so both
  // jumpers drop straight down into their sockets.
  const ledRowY = 11;
  const ledCx = gndTopX + 1.0 + 2.4;
  const resX1 = ledCx + 2.4 + 0.9;
  const resX2 = d9x;

  // The button on pin 2, off the right-hand end of the digital header.
  const btnCx = 66;
  const btnCy = 9.4;
  const btnHalf = 3.1;

  // The potentiometer on A0, below the board with its wiper under the A0 pin.
  const potCx = a0x;
  const potCy = 77.6;
  const potHalf = 5.5;
  const potLegY = 68.6;
  const potLegs = [potCx - 5, potCx, potCx + 5];

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className={className ?? 'block w-full'}
      role="group"
      aria-label="Simulated Arduino Uno with an LED on pin 9, a button on pin 2 and a knob on A0"
    >
      <title>Arduino Uno R3 with an LED, a button and a knob wired to it</title>
      <desc>
        The on-board L LED follows pin 13. The LED at the top runs from pin 9 through a 220 ohm
        resistor. The button connects pin 2 to ground, and the knob feeds A0 from the 5 volt pin.
      </desc>

      <defs>
        <linearGradient id={`${uid}-mask`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor={MASK_LIGHT} />
          <stop offset="55%" stopColor={MASK} />
          <stop offset="100%" stopColor={MASK_DARK} />
        </linearGradient>
        <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e6e9ec" />
          <stop offset="42%" stopColor={CAN_METAL} />
          <stop offset="100%" stopColor="#8b9199" />
        </linearGradient>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD_LIGHT} />
          <stop offset="100%" stopColor="#9b7c1c" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0%" stopColor="#ff8a5c" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#ff5a3c" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ff5a3c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-glow13`}>
          <stop offset="0%" stopColor="#ffd66b" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#f5b800" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#f5b800" stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-drop`} x="-12%" y="-12%" width="130%" height="135%">
          <feDropShadow dx="0" dy="1.1" stdDeviation="1.1" floodColor="#0b1a1c" floodOpacity="0.32" />
        </filter>
        <clipPath id={`${uid}-clip`}>
          <path d={boardOutline()} />
        </clipPath>
      </defs>

      {/* The bench: a faint grid so the board has something to sit on. */}
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#faf8f0" />
      <g opacity={0.5}>
        {Array.from({ length: Math.ceil(VIEW_W / 8) + 1 }).map((_, i) => (
          <line key={`gv${i}`} x1={i * 8} y1={0} x2={i * 8} y2={VIEW_H} stroke="#ece7db" strokeWidth={0.25} />
        ))}
        {Array.from({ length: Math.ceil(VIEW_H / 8) + 1 }).map((_, i) => (
          <line key={`gh${i}`} x1={0} y1={i * 8} x2={VIEW_W} y2={i * 8} stroke="#ece7db" strokeWidth={0.25} />
        ))}
      </g>

      {/* ── The board ── */}
      <g transform={`translate(${BX},${BY})`} filter={`url(#${uid}-drop)`}>
        {/* FR-4 edge, offset down so the 1.6 mm of substrate is visible. */}
        <path d={boardOutline()} fill={PCB_EDGE} transform="translate(0,0.95)" />
        <path d={boardOutline()} fill={`url(#${uid}-mask)`} />

        <g clipPath={`url(#${uid}-clip)`}>
          {/* Copper pour under the mask: the board is never a flat colour. */}
          <rect x={0} y={0} width={BOARD_W} height={BOARD_H / 2} fill={MASK_LIGHT} opacity={0.35} />
          <rect x={0} y={BOARD_H * 0.62} width={BOARD_W} height={BOARD_H * 0.38} fill={MASK_DARK} opacity={0.4} />

          {/* Trace hints. Not a routing, just the direction and density of the
              fan out from the headers, which is what the eye reads on a PCB. */}
          <g stroke="#064a4c" strokeOpacity={0.5} strokeWidth={0.14}>
            {PADS.filter((p) => p.row === 'top').map((p, i) => (
              <line key={`tt${i}`} x1={p.x} y1={ROW_TOP + 1.6} x2={p.x + (i % 3) - 1} y2={ROW_TOP + 7.5 + (i % 4)} />
            ))}
            {PADS.filter((p) => p.row === 'bottom').map((p, i) => (
              <line key={`tb${i}`} x1={p.x} y1={ROW_BOTTOM - 1.6} x2={p.x + (i % 3) - 1} y2={ROW_BOTTOM - 7 - (i % 4)} />
            ))}
          </g>

          <BoardSilkscreen />
          <BoardFurniture uid={uid} />
          <Indicators uid={uid} led13={led13} powered={powered} serialActive={serialActive} />

          {/* Mounting holes, plated the way they are on the R3. */}
          {MOUNT_HOLES.map(([hx, hy], i) => (
            <g key={`h${i}`}>
              <circle cx={hx} cy={hy} r={2.05} fill={GOLD} opacity={0.85} />
              <circle cx={hx} cy={hy} r={1.6} fill="#062f31" />
              <circle cx={hx} cy={hy} r={1.6} fill="none" stroke="#000" strokeOpacity={0.35} strokeWidth={0.3} />
            </g>
          ))}

          <Headers uid={uid} />

          {/* A single sheen across the whole mask ties the parts together. */}
          <rect x={0} y={0} width={BOARD_W} height={BOARD_H} fill={`url(#${uid}-sheen)`} pointerEvents="none" />
        </g>

        <path d={boardOutline()} fill="none" stroke="#02383a" strokeWidth={0.35} />
      </g>

      {/* ── Jumper wires ── */}
      {/* The digital header carries one ground pin and the LED has it, so the
          button's ground comes off the power header and runs round the right
          edge. That is the wire you end up running on a real bench too. */}
      <Jumper
        color={INK}
        d={ortho([
          [gndBtnX, gndBtnY],
          [gndBtnX, 66.4],
          [76.4, 66.4],
          [76.4, btnCy - 1.5],
          [btnCx + btnHalf + 1.2, btnCy - 1.5],
        ])}
      />
      <Jumper color="#f5b800" d={ortho([[d9x, d9y], [d9x, ledRowY]])} />
      <Jumper color={INK} d={ortho([[gndTopX, gndTopY], [gndTopX, ledRowY]])} />
      <Jumper
        color="#549cf0"
        d={ortho([[d2x, d2y], [d2x, 13.8], [btnCx - btnHalf - 1.2, 13.8], [btnCx - btnHalf - 1.2, btnCy + 1.5]])}
      />
      <Jumper color="#d64545" d={ortho([[v5x, v5y], [v5x, 67.9], [potLegs[0], 67.9], [potLegs[0], potLegY]])} />
      <Jumper color={INK} d={ortho([[gndPotX, gndPotY], [gndPotX, 67.0], [potLegs[2], 67.0], [potLegs[2], potLegY]])} />
      <Jumper color="#6fb519" d={ortho([[a0x, a0y], [a0x, potLegY]])} />

      {/* Boots, drawn after the wires so each cable visibly plugs in. */}
      <Boot x={d9x} y={d9y} color="#f5b800" />
      <Boot x={gndTopX} y={gndTopY} color={INK} />
      <Boot x={d2x} y={d2y} color="#549cf0" />
      <Boot x={v5x} y={v5y} color="#d64545" />
      <Boot x={gndBtnX} y={gndBtnY} color={INK} />
      <Boot x={gndPotX} y={gndPotY} color={INK} />
      <Boot x={a0x} y={a0y} color="#6fb519" />

      {/* ── Pin 9: a 220 ohm resistor and a 5 mm red LED ── */}
      <g>
        <circle cx={ledCx} cy={ledRowY} r={7.5} fill={`url(#${uid}-glow)`} opacity={n2(duty * 0.95)} />
        <Resistor x1={resX1} x2={resX2} y={ledRowY} />
        <Led5mm cx={ledCx} cy={ledRowY} duty={duty} />
      </g>
      <Callout x={ledCx - 3.4} y={4.8} anchor="start">PIN 9</Callout>
      <text
        x={n2(ledCx + 7)} y={4.8} fontSize={2.35} fontWeight={900} fill={duty > 0.02 ? '#c2410c' : INK_SOFT}
        textAnchor="start" dominantBaseline="middle" fontFamily={FONT_UI}
      >
        {Math.round(duty * 100)}%
      </text>

      {/* ── Pin 2: a tactile button, held with the pointer or the keyboard ── */}
      <g
        role="button"
        tabIndex={0}
        aria-pressed={pressed}
        aria-label="Hold the button on pin 2"
        className="cursor-pointer focus:outline-none"
        style={{ touchAction: 'none' }}
        onPointerDown={press}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onFocus={() => setFocused(true)}
        onBlur={blur}
      >
        {/* A halo while held, so a press reads even before the plunger moves. */}
        <circle
          cx={btnCx} cy={btnCy} r={6.4} fill="#f5b800"
          opacity={pressed ? 0.28 : 0} style={{ transition: 'opacity 90ms ease-out' }}
        />
        <Button6mm cx={btnCx} cy={btnCy} half={btnHalf} pressed={pressed} />
        {focused ? (
          <rect
            x={btnCx - btnHalf - 1.5} y={btnCy - btnHalf - 1.5}
            width={(btnHalf + 1.5) * 2} height={(btnHalf + 1.5) * 2}
            rx={1.4} fill="none" stroke={INK} strokeWidth={0.55}
          />
        ) : null}
        {/* The hit area, generous enough for a fingertip. */}
        <rect
          x={btnCx - btnHalf - 2.8} y={btnCy - btnHalf - 2.8}
          width={(btnHalf + 2.8) * 2} height={(btnHalf + 2.8) * 2}
          rx={1.8} fill="transparent"
        />
      </g>
      <Callout x={btnCx} y={2.9}>PIN 2</Callout>

      {/* ── A0: the knob ── */}
      <Potentiometer cx={potCx} cy={potCy} half={potHalf} legY={potLegY} legs={potLegs} angle={knobAngle} />
      <Callout x={potCx} y={potCy + potHalf + 3.6}>{`A0  ${pot}`}</Callout>

      {/* The one on-board annotation. The board already prints L next to this
          LED, but a learner meeting pin 13 for the first time needs the two
          names joined up before the silkscreen means anything to them. */}
      <g>
        <line
          x1={BX + 30.8} y1={BY + 20.5} x2={BX + 33.4} y2={BY + 20.5}
          stroke={INK} strokeWidth={0.3}
        />
        <circle cx={BX + 30.8} cy={BY + 20.5} r={0.65} fill={INK} />
        <rect
          x={BX + 33.4} y={BY + 18.7} width={13.4} height={3.6} rx={1.8}
          fill="#faf8f0" stroke={INK} strokeWidth={0.35}
        />
        <text
          x={BX + 40.1} y={BY + 20.6} fontSize={2.05} fontWeight={900} fill={INK}
          textAnchor="middle" dominantBaseline="middle" fontFamily={FONT_UI} letterSpacing={0.18}
        >
          PIN 13
        </text>
      </g>
    </svg>
  );
};

export default ArduinoScene;

// ── Board outline ─────────────────────────────────────────────────────────

/**
 * The real outline: rounded corners, and the notch by the analog header that
 * lets a stacked shield clear the connector below it. A plain rectangle is the
 * single clearest tell that a board drawing was never measured.
 */
function boardOutline(): string {
  const r = 3.2;
  const nr = 1.1;
  return [
    `M ${r} 0`,
    `L ${BOARD_W - r} 0`,
    `A ${r} ${r} 0 0 1 ${BOARD_W} ${r}`,
    `L ${BOARD_W} ${NOTCH_Y - nr}`,
    `A ${nr} ${nr} 0 0 1 ${BOARD_W - nr} ${NOTCH_Y}`,
    `L ${NOTCH_X + nr} ${NOTCH_Y}`,
    `A ${nr} ${nr} 0 0 0 ${NOTCH_X} ${NOTCH_Y + nr}`,
    `L ${NOTCH_X} ${BOARD_H - r}`,
    `A ${r} ${r} 0 0 1 ${NOTCH_X - r} ${BOARD_H}`,
    `L ${r} ${BOARD_H}`,
    `A ${r} ${r} 0 0 1 0 ${BOARD_H - r}`,
    `L 0 ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    'Z',
  ].join(' ');
}

// ── Board sub-drawings (all board-local) ──────────────────────────────────

/**
 * A header legend has 2.54 mm of room. A real Arduino solves that by printing
 * the longer names much smaller and condensed, which is why AREF and IOREF are
 * hard to read on the board in front of you. Setting every label at one size
 * runs them together until the whole header reads as one long word.
 */
const padLabelSize = (t: string) =>
  (t.length <= 2 ? 1.75 : t.length === 3 ? 1.2 : t.length === 4 ? 0.95 : 0.78);

/** Legends, pin labels and the logo. Everything a learner reads off the board. */
const BoardSilkscreen: React.FC = () => (
  <g pointerEvents="none">
    {PADS.map((p, i) => {
      if (!p.label) return null;
      const inboard = p.row === 'top' ? ROW_TOP + 2.5 : ROW_BOTTOM - 2.5;
      return (
        <g key={`l${i}`}>
          <Silk x={p.x} y={inboard} size={padLabelSize(p.label)}>{p.label}</Silk>
          {p.over ? (
            <Silk x={p.x} y={inboard + 1.9} size={1.05} fill={SILK_SOFT}>{p.over}</Silk>
          ) : null}
        </g>
      );
    })}

    <Silk x={40} y={9.1} size={2.05}>DIGITAL (PWM~)</Silk>
    <Silk x={26.7} y={45.9} size={2.05}>POWER</Silk>
    <Silk x={55.9} y={45.9} size={2.05}>ANALOG IN</Silk>
    <Silk x={45.5} y={42.4} size={5.4} weight={800}>UNO</Silk>
    <Silk x={17.5} y={29.4} size={2.4} weight={800}>ARDUINO</Silk>
    <Silk x={17.5} y={12.4} size={1.35} fill={SILK_SOFT}>RESET</Silk>
    <Silk x={64.2} y={35.4} size={1.35} fill={SILK_SOFT}>ICSP</Silk>

    {/* The infinity mark: two overlapping rings, a minus in one, a plus in the
        other. Drawn apart they read as two unrelated symbols, not as the logo. */}
    <g stroke={SILK} strokeWidth={0.5} fill="none">
      <circle cx={15.9} cy={24.6} r={1.95} />
      <circle cx={19.1} cy={24.6} r={1.95} />
      <line x1={14.7} y1={24.6} x2={17.1} y2={24.6} />
      <line x1={17.9} y1={24.6} x2={20.3} y2={24.6} />
      <line x1={19.1} y1={23.4} x2={19.1} y2={25.8} />
    </g>

    {/* Indicator legends. */}
    <Silk x={27.4} y={15.2} size={1.3} anchor="end" fill={SILK_SOFT}>TX</Silk>
    <Silk x={27.4} y={18} size={1.3} anchor="end" fill={SILK_SOFT}>RX</Silk>
    <Silk x={27.4} y={20.5} size={1.5} anchor="end">L</Silk>
    <Silk x={21.4} y={33.8} size={1.3} anchor="end" fill={SILK_SOFT}>ON</Silk>
  </g>
);

/** Everything with real height: connectors, chips, cans, buttons. */
const BoardFurniture: React.FC<{ uid: string }> = ({ uid }) => (
  <g pointerEvents="none">
    {/* USB-B socket. The tallest thing on the board and what fixes its
        orientation at a glance. It overhangs the edge, as it does in life. */}
    <g>
      <rect x={-1.6} y={6.5} width={16} height={12} rx={0.9} fill={`url(#${uid}-metal)`} />
      <rect x={-1.6} y={6.5} width={16} height={12} rx={0.9} fill="none" stroke="#6f757d" strokeWidth={0.3} />
      <rect x={0.4} y={8.6} width={9.4} height={7.8} rx={0.5} fill="#0e1114" />
      <rect x={2.1} y={10.4} width={6} height={4.2} rx={0.3} fill="#2a2f36" />
      <line x1={14.4} y1={7.6} x2={14.4} y2={17.4} stroke="#7d838b" strokeWidth={0.35} />
    </g>

    {/* Barrel jack. */}
    <g>
      <rect x={-1.6} y={39} width={13} height={9.5} rx={1.4} fill={IC_BLACK} />
      <rect x={-1.6} y={39} width={13} height={2.2} rx={1} fill="#2a2d33" />
      <circle cx={2.6} cy={43.7} r={2.9} fill="#08090b" />
      <circle cx={2.6} cy={43.7} r={1.05} fill={CAN_METAL} />
    </g>

    {/* Reset button. */}
    <g>
      <rect x={15.5} y={5.5} width={4.4} height={4.4} rx={0.6} fill={IC_BLACK} />
      <circle cx={17.7} cy={7.7} r={1.35} fill={PLASTIC_WHITE} />
      <circle cx={17.7} cy={7.7} r={1.35} fill="none" stroke="#9aa1a9" strokeWidth={0.22} />
    </g>

    {/* ICSP2, next to the USB serial chip. */}
    <IcspHeader uid={uid} x={21.8} y={6.6} />

    {/* ATmega16U2, the USB serial bridge. */}
    <Tqfp x={16} y={14} size={6.4} />

    {/* 16 MHz crystal. */}
    <g>
      <rect x={37} y={14.6} width={6} height={3.1} rx={1.5} fill={`url(#${uid}-metal)`} />
      <rect x={37} y={14.6} width={6} height={3.1} rx={1.5} fill="none" stroke="#7d838b" strokeWidth={0.22} />
    </g>

    {/* Voltage regulator with its heatsink tab. */}
    <g>
      <rect x={14} y={41} width={4.6} height={5} rx={0.4} fill={IC_BLACK} />
      <rect x={13.2} y={41.4} width={1} height={4.2} rx={0.2} fill={CAN_METAL} />
    </g>

    {/* Electrolytics, with the vent scored into the top. */}
    {[23, 30].map((cx) => (
      <g key={`e${cx}`}>
        <circle cx={cx} cy={41.5} r={3} fill="#0e1013" />
        <circle cx={cx} cy={41.5} r={2.45} fill="#1c1f25" />
        <path d={`M ${cx - 1.9} ${41.5} L ${cx + 1.9} ${41.5} M ${cx} ${39.6} L ${cx} ${43.4}`} stroke="#3b414a" strokeWidth={0.35} />
        <path d={`M ${cx - 3} ${41.5} a 3 3 0 0 1 1.4 -2.55`} stroke="#8f979f" strokeWidth={0.5} fill="none" />
      </g>
    ))}

    {/* ATmega328P in a DIP-28, with its pin 1 notch. */}
    <Dip28 x={26} y={28.5} w={34} h={7.6} />

    {/* ICSP for the 328P, hard against the right edge. */}
    <IcspHeader uid={uid} x={63.6} y={27.4} />

    {/* Surface mount furniture, so the board is not empty between the parts. */}
    <g fill="#101317">
      {([
        [35, 22.5, 1.7, 1], [38.5, 22.5, 1.7, 1], [42, 22.5, 1.7, 1],
        [48, 24, 1.3, 0.9], [52.5, 23.4, 1.3, 0.9], [57, 25, 1.7, 1],
        [21, 36.5, 1.7, 1], [24.5, 36.5, 1.3, 0.9], [36, 39.2, 1.7, 1],
        [55, 39, 1.3, 0.9], [59.5, 40.5, 1.7, 1], [62.5, 22, 1.3, 0.9],
      ] as Array<[number, number, number, number]>).map(([x, y, w, h], i) => (
        <rect key={`s${i}`} x={x} y={y} width={w} height={h} rx={0.16} />
      ))}
    </g>
  </g>
);

const Dip28: React.FC<{ x: number; y: number; w: number; h: number }> = ({ x, y, w, h }) => {
  const first = x + 0.84;
  return (
    <g>
      {Array.from({ length: 14 }).map((_, i) => {
        const lx = first + i * PITCH;
        return (
          <g key={`d${i}`} fill={GOLD}>
            <rect x={lx - 0.45} y={y - 1.15} width={0.9} height={1.3} rx={0.15} />
            <rect x={lx - 0.45} y={y + h - 0.15} width={0.9} height={1.3} rx={0.15} />
          </g>
        );
      })}
      <rect x={x} y={y} width={w} height={h} rx={0.5} fill={IC_BLACK} />
      <rect x={x} y={y} width={w} height={h * 0.42} rx={0.5} fill="#22252b" />
      <path d={`M ${x} ${y + h / 2 - 1.2} a 1.2 1.2 0 0 0 0 2.4 Z`} fill="#05060a" />
      <circle cx={x + 2.6} cy={y + h - 1.9} r={0.5} fill="#05060a" />
      <text
        x={x + w / 2} y={y + h / 2} fontSize={1.5} fontWeight={600} fill="#7f858d"
        textAnchor="middle" dominantBaseline="middle" fontFamily={FONT_SILK} letterSpacing={0.25}
      >
        ATMEGA328P
      </text>
    </g>
  );
};

const Tqfp: React.FC<{ x: number; y: number; size: number }> = ({ x, y, size }) => (
  <g>
    {Array.from({ length: 8 }).map((_, i) => {
      const o = x + 0.9 + i * ((size - 1.8) / 7);
      const p = y + 0.9 + i * ((size - 1.8) / 7);
      return (
        <g key={`q${i}`} fill={GOLD}>
          <rect x={o - 0.18} y={y - 0.85} width={0.36} height={1} />
          <rect x={o - 0.18} y={y + size - 0.15} width={0.36} height={1} />
          <rect x={x - 0.85} y={p - 0.18} width={1} height={0.36} />
          <rect x={x + size - 0.15} y={p - 0.18} width={1} height={0.36} />
        </g>
      );
    })}
    <rect x={x} y={y} width={size} height={size} rx={0.4} fill={IC_BLACK} />
    <circle cx={x + 1.2} cy={y + 1.2} r={0.5} fill="#3a3f46" />
  </g>
);

const IcspHeader: React.FC<{ uid: string; x: number; y: number }> = ({ uid, x, y }) => (
  <g>
    <rect x={x} y={y} width={2 * PITCH} height={3 * PITCH} rx={0.4} fill={HEADER_PLASTIC} />
    {Array.from({ length: 6 }).map((_, i) => {
      const cx = x + PITCH / 2 + (i % 2) * PITCH;
      const cy = y + PITCH / 2 + Math.floor(i / 2) * PITCH;
      return (
        <g key={`i${i}`}>
          <rect x={cx - 0.75} y={cy - 0.75} width={1.5} height={1.5} rx={0.18} fill={`url(#${uid}-gold)`} />
          <rect x={cx - 0.42} y={cy - 0.42} width={0.84} height={0.84} rx={0.1} fill="#08090c" />
        </g>
      );
    })}
  </g>
);

/** The four header runs: black housing, gold sockets, one per pin. */
const Headers: React.FC<{ uid: string }> = ({ uid }) => (
  <g pointerEvents="none">
    {HOUSINGS.map((h, i) => (
      <g key={`hh${i}`}>
        <rect
          x={h.x} y={(h.row === 'top' ? ROW_TOP : ROW_BOTTOM) - 1.27}
          width={h.w} height={2.54} rx={0.28} fill={HEADER_PLASTIC}
        />
        <rect
          x={h.x} y={(h.row === 'top' ? ROW_TOP : ROW_BOTTOM) - 1.27}
          width={h.w} height={0.7} fill="#2b2e34" opacity={0.7}
        />
      </g>
    ))}
    {PADS.map((p, i) => {
      const cy = p.row === 'top' ? ROW_TOP : ROW_BOTTOM;
      return (
        <g key={`p${i}`}>
          <rect x={p.x - 0.82} y={cy - 0.82} width={1.64} height={1.64} rx={0.2} fill={`url(#${uid}-gold)`} />
          <rect x={p.x - 0.45} y={cy - 0.45} width={0.9} height={0.9} rx={0.12} fill="#08090c" />
        </g>
      );
    })}
  </g>
);

/** The four indicator LEDs. These are the ones the sketch actually drives. */
const Indicators: React.FC<{ uid: string; led13: boolean; powered: boolean; serialActive: boolean }> = ({
  uid, led13, powered, serialActive,
}) => {
  const lamp = (cx: number, cy: number, lit: number, colour: string, glow?: string) => (
    <g>
      {glow ? (
        <circle
          cx={cx} cy={cy} r={4.2} fill={`url(#${uid}-${glow})`} opacity={n2(lit * 0.95)}
          style={{ transition: 'opacity 120ms linear' }}
        />
      ) : null}
      <rect x={cx - 1.05} y={cy - 0.65} width={2.1} height={1.3} rx={0.22} fill="#cdd3d8" />
      <rect
        x={cx - 0.8} y={cy - 0.45} width={1.6} height={0.9} rx={0.16}
        fill={lit > 0.04 ? colour : '#7c8b88'}
        style={{ transition: 'fill 120ms linear' }}
      />
    </g>
  );
  return (
    <g pointerEvents="none">
      {lamp(29.5, 15.2, serialActive ? 1 : 0, '#f5b800')}
      {lamp(29.5, 18, serialActive ? 0.55 : 0, '#f5b800')}
      {lamp(29.5, 20.5, led13 ? 1 : 0, '#ffd66b', 'glow13')}
      {lamp(23.5, 33.8, powered ? 1 : 0, '#7ce46a')}
    </g>
  );
};

// ── Bench parts ───────────────────────────────────────────────────────────

/** A quarter watt axial resistor. The bands read red, red, brown, gold: 220 ohms. */
const Resistor: React.FC<{ x1: number; x2: number; y: number }> = ({ x1, x2, y }) => {
  const bodyPad = 0.55;
  const bx = x1 + bodyPad;
  const bw = Math.max(3, x2 - x1 - bodyPad * 2);
  const bands = ['#b3261e', '#b3261e', '#6b3b1a', GOLD];
  return (
    <g>
      <line x1={x1 - 1.2} y1={y} x2={x2 + 1.2} y2={y} stroke="#8f959c" strokeWidth={0.55} strokeLinecap="round" />
      <rect x={bx} y={y - 1.35} width={bw} height={2.7} rx={1.25} fill="#d9c9a4" />
      <rect x={bx} y={y - 1.35} width={bw} height={1.1} rx={1.1} fill="#e8dcbe" opacity={0.75} />
      {/* Three value bands grouped at one end and the tolerance band set apart
          at the other, which is how you know which end to read from. */}
      {bands.map((c, i) => (
        <rect
          key={`b${i}`}
          x={bx + bw * (i === 3 ? 0.83 : 0.14 + i * 0.14)}
          y={y - 1.3} width={Math.max(0.4, bw * 0.09)} height={2.6} fill={c}
        />
      ))}
      <rect x={bx} y={y - 1.35} width={bw} height={2.7} rx={1.25} fill="none" stroke="#9b8c6b" strokeWidth={0.18} />
    </g>
  );
};

/** A 5 mm through-hole LED seen from above: domed lens, flat by the cathode. */
const Led5mm: React.FC<{ cx: number; cy: number; duty: number }> = ({ cx, cy, duty }) => {
  const r = 2.4;
  const lit = duty > 0.02;
  return (
    <g>
      <line x1={cx - r - 1.4} y1={cy} x2={cx - r + 0.4} y2={cy} stroke="#8f959c" strokeWidth={0.55} strokeLinecap="round" />
      <line x1={cx + r - 0.4} y1={cy} x2={cx + r + 1.4} y2={cy} stroke="#8f959c" strokeWidth={0.55} strokeLinecap="round" />
      <path
        d={`M ${cx - r} ${cy - 1.75} A ${r} ${r} 0 1 1 ${cx - r} ${cy + 1.75} Z`}
        fill={lit ? '#ff6a4a' : '#c4463a'}
        fillOpacity={lit ? 0.55 + duty * 0.45 : 0.75}
        stroke="#8d2c22"
        strokeWidth={0.25}
      />
      <circle cx={cx} cy={cy} r={1.25} fill="#ffd7c4" opacity={n2(0.12 + duty * 0.85)} />
      <circle cx={cx - 0.7} cy={cy - 0.8} r={0.55} fill="#ffffff" opacity={0.5} />
    </g>
  );
};

/** A 6 mm tactile switch. Two legs a side, the pairs joined inside the body. */
const Button6mm: React.FC<{ cx: number; cy: number; half: number; pressed: boolean }> = ({ cx, cy, half, pressed }) => (
  <g>
    {[-1, 1].map((sx) =>
      [-1, 1].map((sy) => (
        <rect
          key={`${sx}${sy}`}
          x={cx + sx * half - (sx < 0 ? 1.3 : -0.1)}
          y={cy + sy * 1.5 - 0.3}
          width={1.4} height={0.6} rx={0.15} fill="#9aa1a9"
        />
      )),
    )}
    <rect x={cx - half} y={cy - half} width={half * 2} height={half * 2} rx={0.7} fill={IC_BLACK} />
    <rect x={cx - half} y={cy - half} width={half * 2} height={half * 0.7} rx={0.6} fill="#2a2e34" opacity={0.8} />
    <circle
      cx={cx} cy={cy} r={pressed ? 1.45 : 1.75}
      fill={pressed ? '#c8a000' : PLASTIC_WHITE}
      stroke="#5a6068" strokeWidth={0.22}
      style={{ transition: 'r 90ms ease-out, fill 90ms ease-out' }}
    />
  </g>
);

/** A panel potentiometer: three legs, a metal shaft, a knob with a pointer. */
const Potentiometer: React.FC<{
  cx: number; cy: number; half: number; legY: number; legs: number[]; angle: number;
}> = ({ cx, cy, half, legY, legs, angle }) => (
  <g>
    {legs.map((lx, i) => (
      <rect key={`pl${i}`} x={lx - 0.35} y={legY} width={0.7} height={cy - half - legY + 0.6} fill="#9aa1a9" />
    ))}
    <rect x={cx - half} y={cy - half} width={half * 2} height={half * 2} rx={1} fill="#2a6fbd" />
    <rect x={cx - half} y={cy - half} width={half * 2} height={half * 0.8} rx={0.9} fill="#3f86d6" opacity={0.85} />
    <circle cx={cx} cy={cy} r={half - 0.9} fill="#1f5aa8" />
    <circle cx={cx} cy={cy} r={3.1} fill="#d7dbe0" />
    <circle cx={cx} cy={cy} r={3.1} fill="none" stroke="#8b9199" strokeWidth={0.25} />
    <g transform={`rotate(${n2(angle)} ${n2(cx)} ${n2(cy)})`} style={{ transition: 'transform 60ms linear' }}>
      <line x1={cx} y1={cy} x2={cx} y2={cy - 2.5} stroke={INK} strokeWidth={0.7} strokeLinecap="round" />
    </g>
    <circle cx={cx} cy={cy} r={0.5} fill={INK} />
  </g>
);
