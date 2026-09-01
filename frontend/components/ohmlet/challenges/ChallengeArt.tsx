import React, { useEffect, useReducer } from 'react';

// ── Live-challenge hero art (#63) ──
//
// Every challenge gets its own scene: the Ohmlet mascot actually DOING the thing
// the challenge asks for, staged on a themed ground. Two layers, both real art:
//
//   1. A painted PNG at /challenges/<scene>.png, when one has been generated.
//   2. Hand-drawn vector art, always present, used until that PNG exists.
//
// The PNG is a straight upgrade path, not a placeholder swap: drop the file into
// frontend/public/challenges/ and it takes over on the next load with no code
// change. Prompts for the painted set live in
// metadata/brand/2026-08-26_challenge-art-briefs.md
//
// Both layers sit on the same themed ground and are laid out with "contain", so
// the scene is never cropped. The card strip runs from about 2.6:1 (at the lg
// breakpoint, sidebar expanded) to about 10:1 (just under lg, where the sidebar
// is hidden and the grid is one column), and the join dialog is 2.8:1. A
// cover-fit would slice the mascot's head off at the wide end; a 3:1 scene laid
// out to fit sits centred with the themed ground showing either side.
//
// The `art` key on a Challenge selects the scene, the `theme` key selects the
// palette. SCENES may hold keys the server does not seed yet (see SCENE_BY_ID),
// but every key the server CAN seed must exist here: keep it a superset of
// _KNOWN_ART in backend/live-bridge/tests/test_community.py.

export interface ChallengePalette {
  /** Tailwind gradient (banner backgrounds). */
  gradient: string;
  c1: string;
  c2: string;
  glow: string;
  /** Soft tint for chips/labels in the dialog. */
  tint: string;
  /** Saturated colour for the lit thing in the scene: flame, LED, live trace. */
  accent: string;
}

const GOLD = '#facc2e';
const GOLD_DEEP = '#f5b800';
const RED = '#ff6f5e';
const WHITE = '#ffffff';
const INK = '#14181f';

export const CHALLENGE_THEME: Record<string, ChallengePalette> = {
  red: { gradient: 'from-ohmlet-red to-[#ff9472]', c1: '#ff6f5e', c2: '#ff9472', glow: '#ffd9d2', tint: '#fff1ef', accent: GOLD },
  blue: { gradient: 'from-ohmlet-blue to-[#7cc0ff]', c1: '#549cf0', c2: '#7cc0ff', glow: '#d4e8ff', tint: '#eef6ff', accent: GOLD },
  green: { gradient: 'from-ohmlet-green to-[#a8e063]', c1: '#84cc30', c2: '#a8e063', glow: '#e4f6c9', tint: '#f2fae4', accent: GOLD },
  gold: { gradient: 'from-ohmlet-gold to-[#f5b800]', c1: '#facc2e', c2: '#f5b800', glow: '#fff0c2', tint: '#fff8e2', accent: RED },
  violet: { gradient: 'from-[#7c5cff] to-[#b39cff]', c1: '#7c5cff', c2: '#b39cff', glow: '#e6dcff', tint: '#f3effe', accent: GOLD },
  indigo: { gradient: 'from-[#3b4cca] to-[#6c7bff]', c1: '#3b4cca', c2: '#6c7bff', glow: '#d7dcff', tint: '#eef0ff', accent: GOLD },
};

export const themeFor = (theme?: string): ChallengePalette => CHALLENGE_THEME[theme ?? ''] ?? CHALLENGE_THEME.gold;

// ── Ink language ──
// Chunky outlines, flat fills, no gradients inside the line-art: the same
// drawing language as the painted mascot set, so vector and painted scenes can
// sit side by side in the same list without reading as two products.
// `fill` is declared explicitly after each spread so it never inherits "none".

const ink = {
  stroke: INK,
  strokeWidth: 4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
};
const ink3 = { ...ink, strokeWidth: 3.2 };
const ink2 = { ...ink, strokeWidth: 2.4 };

// ── The mascot ──
// Drawn in a local 100 × 100 box with the feet on y=100, then placed with a
// translate/scale so scenes can position it in one line. Colours are fixed: the
// Ohmlet looks identical on every card, only its pose and its props change.

type ArmPose = 'down' | 'up' | 'out';
type Mood = 'happy' | 'wow';

/** Right-side arm shapes. The left arm is the same path, mirrored. */
const ARM: Record<ArmPose, string> = {
  down: 'M76 60c14 2 18 12 12 20-5 7-14 4-16-4-1-6-1-11 4-16Z',
  up: 'M76 58c14-8 20-22 12-28-6-5-14 3-16 15-1 6-1 9 4 13Z',
  out: 'M76 58c14-4 24 0 24 8s-12 10-24 6c-5-2-5-12 0-14Z',
};

/** Where each pose puts the hand, in the mascot's local box. */
const HAND: Record<ArmPose, readonly [number, number]> = {
  down: [86, 78],
  up: [86, 30],
  out: [98, 66],
};

interface MascotPlacement {
  x: number;
  y: number;
  s: number;
}

/** Scene coordinates of a hand, so a scene can hang a prop off it exactly. */
const hand = (m: MascotPlacement, pose: ArmPose, side: 'left' | 'right'): readonly [number, number] => {
  const [hx, hy] = HAND[pose];
  return [m.x + m.s * (side === 'right' ? hx : 100 - hx), m.y + m.s * hy];
};

interface MascotProps extends MascotPlacement {
  left?: ArmPose;
  right?: ArmPose;
  mood?: Mood;
}

const Mascot: React.FC<MascotProps> = ({ x, y, s, left = 'down', right = 'down', mood = 'happy' }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {/* legs and arms sit behind the body so the outline stays unbroken */}
    <path d="M36 86v8a6 6 0 0 0 12 0v-8Z" {...ink3} fill={WHITE} />
    <path d="M52 86v8a6 6 0 0 0 12 0v-8Z" {...ink3} fill={WHITE} />
    <path d={ARM[right]} {...ink3} fill={WHITE} />
    <g transform="translate(100 0) scale(-1 1)">
      <path d={ARM[left]} {...ink3} fill={WHITE} />
    </g>
    {/* comb: one chunky heart, tilted, its point buried in the head */}
    <g transform="rotate(-13 50 16)">
      <path d="M50 24C40 16 30 15 30 8c0-8 12-8 20 2 8-10 20-10 20-2 0 7-10 8-20 16Z" {...ink3} fill={RED} />
    </g>
    {/* body */}
    <path d="M50 12C31 12 19 31 19 55c0 22 13 35 31 35s31-13 31-35c0-24-12-43-31-43Z" {...ink} fill={WHITE} />
    {/* visor and face */}
    <rect x={31} y={24} width={38} height={27} rx={12} fill={INK} />
    <ellipse cx={41} cy={35} rx={3.2} ry={4.8} fill={GOLD} />
    <ellipse cx={59} cy={35} rx={3.2} ry={4.8} fill={GOLD} />
    {mood === 'wow' ? (
      <ellipse cx={50} cy={43} rx={4} ry={3.4} fill={GOLD} />
    ) : (
      <path d="M45 42c2 4 8 4 10 0" {...ink2} stroke={GOLD} strokeWidth={3} />
    )}
    {/* resistor bow-tie */}
    <path d="M49 63 34 57v13Z" {...ink2} fill={GOLD} />
    <path d="M51 63 66 57v13Z" {...ink2} fill={GOLD} />
    <rect x={45} y={58} width={10} height={9} rx={3} {...ink2} fill={GOLD_DEEP} />
    {/* tool pouch with the omega */}
    <path d="M20 70c3 17 57 17 60 0Z" {...ink3} fill={GOLD} />
    <path d="M45 82c-5-3-5-11 5-11s10 8 5 11" {...ink2} />
    <path d="M41 82h5m7 0h5" {...ink2} />
  </g>
);

// ── Shared staging ──
// One dashed bench line across the full width of the scene plus a contact shadow
// under the mascot. It is what makes the scenes read as one set. Note it spans
// the SCENE, not the card: at wide card sizes the whole scene is centred inside
// the strip with themed ground either side, so the bench line stops where the
// art does.

const Stage: React.FC<{ shadowX: number; shadowW?: number }> = ({ shadowX, shadowW = 46 }) => (
  <>
    <path d="M16 145h448" stroke="rgba(20,24,31,0.30)" strokeWidth={3} strokeLinecap="round" strokeDasharray="2 11" fill="none" />
    <ellipse cx={shadowX} cy={143} rx={shadowW} ry={7} fill="rgba(20,24,31,0.15)" />
  </>
);

// ── Scenes ── each draws inside a 480 × 160 viewBox, transparent, over the ground.

/** 7-Day Streak: the Ohmlet carries the flame along a week that is half banked. */
const Streak: React.FC<ChallengePalette> = (p) => {
  const m: MascotPlacement = { x: 62, y: 50, s: 0.92 };
  const [hx, hy] = hand(m, 'up', 'right');
  const fx = hx + 4;
  const fy = hy - 6;
  const tile = 28;
  const step = 37;
  const x0 = 206;
  const y0 = 100;
  return (
    <>
      <circle cx={fx} cy={fy - 26} r={46} fill={p.glow} opacity={0.6} />
      <Stage shadowX={m.x + 50 * m.s} />
      {/* torch: handle, outer flame, inner flame */}
      <path d={`M${hx} ${hy + 2}L${fx} ${fy}`} stroke={INK} strokeWidth={7} strokeLinecap="round" fill="none" />
      <path
        d={`M${fx} ${fy - 54}c10 13 18 21 18 32a18 18 0 1 1-36 0c0-7 3-12 8-15 1 6 4 10 9 10-6-10-3-19 1-27Z`}
        {...ink}
        fill={WHITE}
      />
      <path d={`M${fx} ${fy - 26}c5 7 8 11 8 16a8 8 0 1 1-16 0c0-5 3-9 8-16Z`} {...ink2} fill={p.accent} />
      <Mascot {...m} right="up" />
      {/* the week: four days banked, today burning, two still ahead */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const tx = x0 + i * step;
        if (i < 4) {
          return (
            <g key={i}>
              <rect x={tx} y={y0} width={tile} height={tile} rx={9} {...ink3} fill={WHITE} />
              <path d={`M${tx + 8} ${y0 + 15}l4 5 8-10`} {...ink3} stroke={p.accent} strokeWidth={3.6} />
            </g>
          );
        }
        if (i === 4) {
          return (
            <g key={i}>
              <rect x={tx} y={y0 - 3} width={tile} height={tile + 6} rx={10} {...ink} fill={p.accent} />
              <path d={`M${tx + 17} ${y0 + 4}l-7 12h5l-3 10 9-14h-5Z`} fill={INK} />
            </g>
          );
        }
        return (
          <rect
            key={i}
            x={tx}
            y={y0 + 3}
            width={tile}
            height={tile - 6}
            rx={7}
            fill="rgba(255,255,255,0.28)"
            stroke="rgba(20,24,31,0.38)"
            strokeWidth={3}
            strokeDasharray="6 6"
          />
        );
      })}
    </>
  );
};

/** No-Kit Hero: caped, holding a resistor aloft over a pile of loose parts. */
const NoKit: React.FC<ChallengePalette> = (p) => {
  const m: MascotPlacement = { x: 152, y: 47, s: 0.95 };
  const [hx, hy] = hand(m, 'up', 'right');
  return (
    <>
      <circle cx={252} cy={46} r={42} fill={p.glow} opacity={0.55} />
      <Stage shadowX={m.x + 50 * m.s} />
      {/* The starter kit: open on the bench, lid propped, every compartment bare.
          Drawn flat-on rather than tipped over, because a tipped tray reads as a
          slab of grey at card size and the whole point is that you can see it is
          empty. */}
      <g transform="rotate(-4 78 112)">
        {/* propped lid */}
        <path d="M34 106 46 78h72l6 28Z" {...ink3} fill={WHITE} />
        <path d="M50 82h64l3 20H46Z" fill="rgba(20,24,31,0.12)" />
        {/* tray body */}
        <rect x={24} y={104} width={108} height={36} rx={7} {...ink3} fill={WHITE} />
        {/* six bare compartments */}
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x={32 + i * 34} y={110} width={26} height={10} rx={3} fill="rgba(20,24,31,0.17)" />
            <rect x={32 + i * 34} y={124} width={26} height={10} rx={3} fill="rgba(20,24,31,0.17)" />
          </g>
        ))}
      </g>
      {/* cape */}
      <path
        d="M180 62c-30 14-46 48-42 80 14-10 30-10 42-2 14-10 30-8 42 2 6-32-6-66-16-80Z"
        {...ink3}
        fill={p.accent}
      />
      <path d="M168 82c-8 18-10 40-8 56" {...ink2} stroke="rgba(20,24,31,0.35)" />
      <Mascot {...m} right="up" />
      <path d="M176 58h40l-5 11h-30Z" {...ink2} fill={p.accent} />
      {/* the resistor, held up like a trophy */}
      <path d={`M${hx} ${hy}L242 54`} {...ink3} />
      {/* Barrel with square shoulders and long straight leads. A fully rounded
          body with two short stubs reads as a wrapped sweet, which is the one
          thing this mascot must never be holding. */}
      <g transform="rotate(-16 252 44)">
        <path d="M218 44h14m40 0h14" {...ink3} />
        <rect x={232} y={35} width={40} height={18} rx={4} {...ink3} fill={WHITE} />
        <rect x={239} y={35} width={5} height={18} fill={INK} />
        <rect x={248} y={35} width={5} height={18} fill={p.accent} />
        <rect x={257} y={35} width={5} height={18} fill={RED} />
      </g>
      <path d="M282 22l7-6m-4 22 9 1m-32-32 2-9" stroke={WHITE} strokeWidth={3.4} strokeLinecap="round" fill="none" />
      {/* loose parts, straight onto the bench */}
      <path d="M306 128a12 12 0 0 1 24 0v4h-24Z" {...ink3} fill={WHITE} />
      <path d="M304 132h28v4h-28Z" {...ink3} fill={WHITE} />
      <path d="M311 136v6m12-6v6" {...ink3} />
      <rect x={350} y={108} width={20} height={26} rx={9} {...ink3} fill={WHITE} />
      <path d="M355 134v8m10-8v8" {...ink3} />
      <path d="M390 142c2-26 36-26 38 0" stroke={p.accent} strokeWidth={5} strokeLinecap="round" fill="none" />
      <circle cx={390} cy={140} r={4} fill={INK} />
      <circle cx={428} cy={140} r={4} fill={INK} />
    </>
  );
};

/** Teach It Back: the Ohmlet at an easel, walking someone through the circuit. */
const TeachBack: React.FC<ChallengePalette> = (p) => {
  const m: MascotPlacement = { x: 74, y: 47, s: 0.95 };
  const [hx, hy] = hand(m, 'out', 'right');
  return (
    <>
      <circle cx={346} cy={70} r={60} fill={p.glow} opacity={0.55} />
      <Stage shadowX={m.x + 50 * m.s} shadowW={40} />
      {/* easel */}
      <path d="M272 112l-14 32m162-32 14 32" {...ink3} />
      <rect x={248} y={24} width={196} height={90} rx={12} {...ink} fill={WHITE} />
      {/* the circuit being explained: cell, resistor, LED, return path */}
      <path d="M290 52V92h32m30 0h40V68" {...ink3} />
      <path d="M290 52h12" {...ink3} />
      <path d="M302 52h6l4-11 7 22 7-22 7 22 4-11h6" stroke={p.accent} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M350 52h28" {...ink3} />
      <circle cx={392} cy={52} r={14} {...ink3} fill={p.accent} />
      <path d="M410 40l8-6m-4 20 10 1m-22 12 5 8" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
      {/* two-cell battery on the return leg */}
      <path d="M322 80v24m10-18v12m10-18v24m10-18v12" {...ink3} />
      {/* pointer, meeting the hand exactly */}
      <path d={`M${hx} ${hy}L246 86`} stroke={INK} strokeWidth={6} strokeLinecap="round" fill="none" />
      <circle cx={246} cy={86} r={5} {...ink2} fill={WHITE} />
      <Mascot {...m} right="out" />
      {/* what is being said, drawn rather than written */}
      <path
        d="M63 6h94a15 15 0 0 1 15 15v12a15 15 0 0 1-15 15h-52l-16 16 2-16H63a15 15 0 0 1-15-15V21A15 15 0 0 1 63 6Z"
        {...ink3}
        fill={WHITE}
      />
      <path d="M70 27h8l3-8 5 16 5-16 5 16 3-8h8" {...ink2} strokeWidth={3} />
      <path d="M107 27h11" {...ink2} strokeWidth={3} />
      <circle cx={128} cy={27} r={9} {...ink2} strokeWidth={3} fill={p.accent} />
      <path d="M141 18l6-5m-3 14 8 1" stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none" />
    </>
  );
};

/** Sensor Safari: three ways to feel the world, one of them held up to the light. */
const Sensors: React.FC<ChallengePalette> = (p) => {
  const m: MascotPlacement = { x: 140, y: 47, s: 0.95 };
  const [hx, hy] = hand(m, 'up', 'right');
  return (
    <>
      <circle cx={230} cy={46} r={42} fill={p.glow} opacity={0.55} />
      <Stage shadowX={m.x + 50 * m.s} />
      {/* the light source */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        return (
          <path
            key={a}
            d={`M${416 + Math.cos(r) * 24} ${40 + Math.sin(r) * 24}l${Math.cos(r) * 9} ${Math.sin(r) * 9}`}
            {...ink3}
          />
        );
      })}
      <circle cx={416} cy={40} r={19} {...ink} fill={WHITE} />
      <circle cx={416} cy={40} r={9} fill={p.accent} />
      {/* light travelling to the cell */}
      <path
        d="M392 34H256m126 12H252m120 12H258"
        stroke={WHITE}
        strokeWidth={3.6}
        strokeLinecap="round"
        strokeDasharray="11 10"
        opacity={0.85}
        fill="none"
      />
      {/* the light-dependent cell, held up into the beam */}
      <path d="M224 60v16m12-16v16" {...ink3} />
      <circle cx={230} cy={46} r={17} {...ink} fill={WHITE} />
      <path d="M219 50c4-12 7 12 11 0s7 10 11-2" stroke={p.accent} strokeWidth={4.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Mascot {...m} right="up" />
      {/* temperature */}
      <rect x={308} y={92} width={17} height={34} rx={8} {...ink3} fill={WHITE} />
      <circle cx={316} cy={130} r={12} {...ink3} fill={p.accent} />
      <path d="M316 102v22" stroke={p.accent} strokeWidth={5} strokeLinecap="round" fill="none" />
      {/* a momentary push button */}
      <rect x={366} y={112} width={50} height={30} rx={10} {...ink3} fill={WHITE} />
      <circle cx={391} cy={124} r={10} {...ink3} fill={p.accent} />
      <path d="M391 92v12m-6-4 6 6 6-6" {...ink2} stroke={INK} strokeWidth={3} />
    </>
  );
};

/** Debug Duel: magnifier on the fault, the broken trace found. */
const Debug: React.FC<ChallengePalette> = (p) => {
  const m: MascotPlacement = { x: 44, y: 47, s: 0.95 };
  const [hx, hy] = hand(m, 'out', 'right');
  return (
    <>
      <circle cx={288} cy={90} r={54} fill={p.glow} opacity={0.5} />
      <Stage shadowX={m.x + 50 * m.s} shadowW={40} />
      {/* the board under test */}
      <rect x={196} y={62} width={250} height={68} rx={12} {...ink} fill={WHITE} />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <circle key={i} cx={212 + i * 25} cy={120} r={2.8} fill="rgba(20,24,31,0.55)" />
      ))}
      <rect x={378} y={76} width={50} height={26} rx={5} fill={INK} />
      <path d="M386 102v6m14-6v6m14-6v6M386 70v6m14-6v6m14-6v6" {...ink2} strokeWidth={3} />
      {/* the trace, snapped clean through */}
      <path d="M212 90h50m52 0h60" stroke={p.accent} strokeWidth={6} strokeLinecap="round" fill="none" />
      <path d="M294 62l-18 26h11l-7 22 20-28h-11Z" {...ink3} fill={INK} />
      <path d="M312 60l8-8m-6 30 11 3m-58-25-9-7" stroke={p.accent} strokeWidth={4} strokeLinecap="round" fill="none" />
      {/* magnifier, handle running down to the hand */}
      <path d={`M258 120L${hx + 4} ${hy - 2}`} stroke={INK} strokeWidth={9} strokeLinecap="round" fill="none" />
      <circle cx={288} cy={88} r={42} fill="rgba(255,255,255,0.28)" stroke={INK} strokeWidth={5} />
      <circle cx={288} cy={88} r={34} stroke={WHITE} strokeWidth={2.6} opacity={0.7} fill="none" />
      <Mascot {...m} right="out" />
    </>
  );
};

/** First Light: the first LED lights, and the Ohmlet loses it. */
const FirstLight: React.FC<ChallengePalette> = (p) => {
  const m: MascotPlacement = { x: 70, y: 42, s: 1 };
  return (
    <>
      <circle cx={334} cy={64} r={58} fill={p.glow} opacity={0.75} />
      <Stage shadowX={m.x + 50 * m.s} shadowW={42} />
      {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((a) => {
        const r = (a * Math.PI) / 180;
        return (
          <path
            key={a}
            d={`M${334 + Math.cos(r) * 36} ${64 + Math.sin(r) * 36}l${Math.cos(r) * 14} ${Math.sin(r) * 14}`}
            stroke={WHITE}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
        );
      })}
      {/* breadboard */}
      <rect x={248} y={100} width={196} height={42} rx={9} {...ink} fill={WHITE} />
      <path d="M248 121h196" stroke="rgba(20,24,31,0.16)" strokeWidth={3} fill="none" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <g key={i}>
          <circle cx={264 + i * 21} cy={110} r={2.4} fill="rgba(20,24,31,0.55)" />
          <circle cx={264 + i * 21} cy={132} r={2.4} fill="rgba(20,24,31,0.55)" />
        </g>
      ))}
      {/* the LED, lit for the first time */}
      <path d="M326 84v18m16-18v18" {...ink3} />
      <circle cx={334} cy={64} r={21} {...ink} fill={p.accent} />
      <path d="M325 58c1-6 5-9 10-10" stroke={WHITE} strokeWidth={3.4} strokeLinecap="round" opacity={0.85} fill="none" />
      <Mascot {...m} left="up" right="up" mood="wow" />
      {/* the cheer */}
      <path d="M58 40l-6-8m32-4-2-10m38 12 7-8" stroke={WHITE} strokeWidth={3.6} strokeLinecap="round" fill="none" />
      <path d="M40 62l-9-3m146 6 9-4" stroke={p.accent} strokeWidth={3.6} strokeLinecap="round" fill="none" />
    </>
  );
};

/**
 * 30-Day Streak: the season track. Same torch as the weekly streak, because the
 * two are one family, but the ladder is a month of days rather than a row of
 * seven: `streak7` and `streak30` sit in the same list, and showing them the
 * identical picture makes the second one look like a rendering fault.
 */
const Streak30: React.FC<ChallengePalette> = (p) => {
  const m: MascotPlacement = { x: 44, y: 54, s: 0.9 };
  const [hx, hy] = hand(m, 'up', 'right');
  const fx = hx + 4;
  const fy = hy - 6;
  const cols = 10;
  const cw = 20;
  const chh = 16;
  const gx = 24.4;
  const gy = 21;
  const x0 = 208;
  const y0 = 73;
  const banked = 21; // days already logged; the 22nd is today, still burning
  return (
    <>
      <circle cx={fx} cy={fy - 24} r={40} fill={p.glow} opacity={0.6} />
      <Stage shadowX={m.x + 50 * m.s} shadowW={42} />
      {/* the same torch, carried a lot further */}
      <path d={`M${hx} ${hy + 2}L${fx} ${fy}`} stroke={INK} strokeWidth={7} strokeLinecap="round" fill="none" />
      <path
        d={`M${fx} ${fy - 50}c9 12 17 20 17 30a17 17 0 1 1-34 0c0-7 3-11 8-14 1 6 4 9 8 9-6-9-2-18 1-25Z`}
        {...ink}
        fill={WHITE}
      />
      <path d={`M${fx} ${fy - 24}c5 7 7 10 7 15a7 7 0 1 1-14 0c0-5 2-8 7-15Z`} {...ink2} fill={p.accent} />
      <Mascot {...m} right="up" />
      {/* the season sheet: thirty days, most of them already banked */}
      <rect x={192} y={44} width={272} height={96} rx={12} {...ink} fill={WHITE} />
      <path d="M192 64v-8a12 12 0 0 1 12-12h248a12 12 0 0 1 12 12v8Z" fill={p.accent} />
      <path d="M192 64h272" stroke={INK} strokeWidth={3.4} fill="none" />
      <path d="M232 46V32m96 14V32m96 14V32" {...ink3} />
      {Array.from({ length: 30 }, (_, i) => {
        const cx = x0 + (i % cols) * gx;
        const cy = y0 + Math.floor(i / cols) * gy;
        if (i < banked) {
          return <rect key={i} x={cx} y={cy} width={cw} height={chh} rx={5} {...ink2} fill={p.accent} />;
        }
        if (i === banked) {
          return (
            <g key={i}>
              <rect x={cx} y={cy} width={cw} height={chh} rx={5} {...ink3} fill={p.accent} />
              <path d={`M${cx + 13} ${cy + 2}l-8 8h4l-2 6 8-9h-4Z`} fill={INK} />
            </g>
          );
        }
        return (
          <rect
            key={i}
            x={cx}
            y={cy}
            width={cw}
            height={chh}
            rx={5}
            fill="rgba(255,255,255,0.30)"
            stroke="rgba(20,24,31,0.38)"
            strokeWidth={2.6}
            strokeDasharray="5 5"
          />
        );
      })}
    </>
  );
};

export type SceneKey = 'streak' | 'streak30' | 'nokit' | 'teachback' | 'sensors' | 'debug' | 'firstlight';

const SCENES: Record<SceneKey, React.FC<ChallengePalette>> = {
  streak: Streak,
  streak30: Streak30,
  nokit: NoKit,
  teachback: TeachBack,
  sensors: Sensors,
  debug: Debug,
  firstlight: FirstLight,
};

/**
 * Challenge id to scene. The `art` key wins where a challenge carries one, so
 * this only fires for a challenge that arrives without one AND is rendered by a
 * caller that passes `id`. Neither call site passes `id` today (CommunityView
 * and ChallengeDialogs pass `art` + `theme`), so treat this as the hook a future
 * challenge hangs its art on rather than as live resolution.
 *
 * `streak30` is the one seeded challenge whose art is not yet its own: the
 * server seeds it with `"art": "streak"`, so it currently draws the seven-day
 * scene. Point `DEFAULT_CHALLENGES["streak30"]["art"]` at `"streak30"` in
 * backend/live-bridge/app/community.py (and add `"streak30"` to `_KNOWN_ART` in
 * backend/live-bridge/tests/test_community.py) and it picks up the season scene
 * below, and `/challenges/streak30.png` after that.
 */
const SCENE_BY_ID: Record<string, SceneKey> = {
  streak7: 'streak',
  streak30: 'streak30',
  nokit: 'nokit',
  teachback: 'teachback',
  sensors: 'sensors',
  debug: 'debug',
  firstlight: 'firstlight',
};

const isSceneKey = (k: string): k is SceneKey => Object.prototype.hasOwnProperty.call(SCENES, k);

/** Resolve a challenge to its scene, preferring the explicit art key. */
export const sceneFor = (art?: string, id?: string): SceneKey => {
  const key = (art ?? '').trim();
  if (isSceneKey(key)) return key;
  return SCENE_BY_ID[(id ?? '').trim()] ?? 'firstlight';
};

/** Where a painted scene lives once it has been generated. */
export const challengeArtSrc = (scene: SceneKey): string => `/challenges/${scene}.png`;

// Whether each scene has a painted PNG behind it. Resolved once per page load
// and cached at module level, so scrolling the challenge list never re-probes
// and a later mount goes straight to the right layer with no flicker. The vector
// scene is what shows while a probe is in flight, so there is never a blank box.
type PaintedState = 'ready' | 'missing';
const PAINTED = new Map<SceneKey, PaintedState>();

interface ChallengeArtProps {
  /** Scene key from the challenge (`art`). */
  art?: string;
  /** Challenge id, used to resolve the scene when no art key is set. */
  id?: string;
  theme?: string;
  className?: string;
}

/**
 * The themed hero illustration for a challenge. Fills whatever box it is given:
 * the art is laid out to fit, never cropped, on a full-bleed themed ground.
 */
export const ChallengeArt: React.FC<ChallengeArtProps> = ({ art, id, theme, className }) => {
  const palette = themeFor(theme);
  const scene = sceneFor(art, id);
  const Scene = SCENES[scene];

  const [, redraw] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (PAINTED.has(scene)) return undefined;
    let live = true;
    const probe = new Image();
    const settle = (state: PaintedState) => {
      PAINTED.set(scene, state);
      if (live) redraw();
    };
    probe.onload = () => settle('ready');
    probe.onerror = () => settle('missing');
    probe.src = challengeArtSrc(scene);
    return () => {
      live = false;
    };
  }, [scene]);

  return (
    <span
      className={`block overflow-hidden ${className ?? ''}`}
      style={{
        background: `radial-gradient(115% 150% at 26% 10%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 58%), linear-gradient(135deg, ${palette.c1} 0%, ${palette.c2} 100%)`,
      }}
    >
      {PAINTED.get(scene) === 'ready' ? (
        <img
          src={challengeArtSrc(scene)}
          alt=""
          aria-hidden
          draggable={false}
          decoding="async"
          className="h-full w-full object-contain"
        />
      ) : (
        <svg viewBox="0 0 480 160" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden focusable="false">
          <Scene {...palette} />
        </svg>
      )}
    </span>
  );
};
