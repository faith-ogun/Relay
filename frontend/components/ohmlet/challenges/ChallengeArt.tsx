import React from 'react';

// ── Live-challenge hero art (#63) ──
//
// Each challenge gets its own custom illustration, drawn in the chunky Ohmlet
// language: a soft themed gradient ground, a glow behind the focal object, and
// clean ink line-art on top. Vector, so it stays crisp at any size and needs no
// external asset. The `art` key on a Challenge selects the scene; the `theme`
// key selects the palette. Keep the art keys in sync with test_community.py.

export interface ChallengePalette {
  /** Tailwind gradient (banner backgrounds). */
  gradient: string;
  c1: string;
  c2: string;
  glow: string;
  /** Soft tint for chips/labels in the dialog. */
  tint: string;
}

export const CHALLENGE_THEME: Record<string, ChallengePalette> = {
  red: { gradient: 'from-ohmlet-red to-[#ff9472]', c1: '#ff6f5e', c2: '#ff9472', glow: '#ffd9d2', tint: '#fff1ef' },
  blue: { gradient: 'from-ohmlet-blue to-[#7cc0ff]', c1: '#549cf0', c2: '#7cc0ff', glow: '#d4e8ff', tint: '#eef6ff' },
  green: { gradient: 'from-ohmlet-green to-[#a8e063]', c1: '#84cc30', c2: '#a8e063', glow: '#e4f6c9', tint: '#f2fae4' },
  gold: { gradient: 'from-ohmlet-gold to-[#f5b800]', c1: '#facc2e', c2: '#f5b800', glow: '#fff0c2', tint: '#fff8e2' },
  violet: { gradient: 'from-[#7c5cff] to-[#b39cff]', c1: '#7c5cff', c2: '#b39cff', glow: '#e6dcff', tint: '#f3effe' },
  indigo: { gradient: 'from-[#3b4cca] to-[#6c7bff]', c1: '#3b4cca', c2: '#6c7bff', glow: '#d7dcff', tint: '#eef0ff' },
};

export const themeFor = (theme?: string): ChallengePalette => CHALLENGE_THEME[theme ?? ''] ?? CHALLENGE_THEME.gold;

const INK = '#14201e';

// Shared ink-stroke defaults for the line-art.
// Ink line-art defaults. `fill` is set explicitly per element (so it never
// clashes with the spread) — most strokes are unfilled, so default to "none".
const stroke = {
  stroke: INK,
  strokeWidth: 3.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

// ── Scenes ── each draws inside a 320×170 viewBox over the gradient ground.

const Streak: React.FC<ChallengePalette> = (p) => (
  <>
    <circle cx={160} cy={74} r={52} fill={p.glow} opacity={0.7} />
    {/* flame */}
    <path
      d="M160 28c14 18 26 28 26 46a26 26 0 1 1-52 0c0-8 4-15 9-19 1 8 6 12 11 12-7-12-2-27 6-39Z"
      fill="#fff"
      {...stroke}
    />
    <path d="M160 58c6 6 9 11 9 18a9 9 0 1 1-18 0c0-5 4-9 9-18Z" fill={p.c1} stroke={INK} strokeWidth={2.6} />
    {/* 7 day pips */}
    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
      <circle
        key={i}
        cx={88 + i * 24}
        cy={140}
        r={8}
        fill={i < 4 ? '#fff' : 'rgba(255,255,255,0.35)'}
        stroke={INK}
        strokeWidth={2.6}
      />
    ))}
    {[0, 1, 2, 3].map((i) => (
      <path key={i} d={`M${85 + i * 24} 140l3 3 5-6`} fill="none" {...stroke} strokeWidth={2.4} />
    ))}
  </>
);

const NoKit: React.FC<ChallengePalette> = (p) => (
  <>
    <circle cx={160} cy={86} r={58} fill={p.glow} opacity={0.7} />
    {/* breadboard */}
    <rect x={70} y={96} width={180} height={48} rx={8} fill="#fff" {...stroke} />
    {Array.from({ length: 9 }).map((_, c) => (
      <g key={c}>
        <circle cx={86 + c * 20} cy={110} r={2.4} fill={INK} />
        <circle cx={86 + c * 20} cy={130} r={2.4} fill={INK} />
      </g>
    ))}
    {/* loose resistor */}
    <path d="M96 70h14l5-10 8 20 8-20 5 10h14" fill="none" stroke={INK} strokeWidth={3} />
    {/* loose LED */}
    <circle cx={196} cy={66} r={12} fill={p.c1} stroke={INK} strokeWidth={3} />
    <path d="M196 78v10M190 86h12" fill="none" {...stroke} strokeWidth={2.6} />
    {/* hero star badge */}
    <path
      d="M232 44l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1Z"
      fill="#fff"
      stroke={INK}
      strokeWidth={2.8}
      strokeLinejoin="round"
    />
  </>
);

const TeachBack: React.FC<ChallengePalette> = (p) => (
  <>
    <circle cx={160} cy={80} r={56} fill={p.glow} opacity={0.7} />
    {/* board / speech bubble */}
    <rect x={84} y={38} width={152} height={86} rx={12} fill="#fff" {...stroke} />
    <path d="M126 124l-6 18 22-18" fill="#fff" {...stroke} />
    {/* tiny circuit drawn on the board */}
    <path d="M104 70h18l4-9 7 18 7-18 4 9h16" fill="none" stroke={p.c1} strokeWidth={3} strokeLinecap="round" />
    <circle cx={190} cy={70} r={9} fill={p.c2} stroke={INK} strokeWidth={2.6} />
    <path d="M104 70v22h86V79" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
    {/* pointer */}
    <path d="M214 104l20 16-7 2 4 8-5 2-4-8-5 4Z" fill="#fff" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
  </>
);

const Sensors: React.FC<ChallengePalette> = (p) => (
  <>
    <circle cx={160} cy={84} r={58} fill={p.glow} opacity={0.7} />
    {/* light sensor: sun + cell */}
    <circle cx={84} cy={70} r={13} fill={p.c1} stroke={INK} strokeWidth={3} />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
      const r = (a * Math.PI) / 180;
      return (
        <path
          key={a}
          d={`M${84 + Math.cos(r) * 18} ${70 + Math.sin(r) * 18}l${Math.cos(r) * 6} ${Math.sin(r) * 6}`}
          fill="none"
          {...stroke}
          strokeWidth={2.4}
        />
      );
    })}
    {/* thermometer */}
    <rect x={152} y={42} width={16} height={56} rx={8} fill="#fff" {...stroke} />
    <circle cx={160} cy={104} r={13} fill={p.c2} stroke={INK} strokeWidth={3} />
    <path d="M160 60v40" stroke={p.c1} strokeWidth={5} strokeLinecap="round" />
    {/* button */}
    <rect x={218} y={58} width={40} height={40} rx={8} fill="#fff" {...stroke} />
    <circle cx={238} cy={78} r={11} fill={p.c1} stroke={INK} strokeWidth={3} />
    {/* baseline */}
    <path d="M60 134h200" stroke="rgba(20,32,30,0.35)" strokeWidth={3} strokeLinecap="round" strokeDasharray="2 9" />
  </>
);

const Debug: React.FC<ChallengePalette> = (p) => (
  <>
    <circle cx={150} cy={82} r={56} fill={p.glow} opacity={0.7} />
    {/* board */}
    <rect x={70} y={56} width={150} height={70} rx={10} fill="#fff" {...stroke} />
    {/* broken trace with a spark gap */}
    <path d="M84 92h44" stroke={p.c1} strokeWidth={4} strokeLinecap="round" />
    <path d="M150 92h36" stroke={p.c1} strokeWidth={4} strokeLinecap="round" />
    <path d="M128 80l8 12-8 8 14-4" fill="none" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    {/* magnifier over the fault */}
    <circle cx={150} cy={92} r={30} fill="rgba(255,255,255,0.35)" stroke={INK} strokeWidth={3.4} />
    <path d="M172 114l22 22" stroke={INK} strokeWidth={6} strokeLinecap="round" />
    {/* wrench */}
    <path
      d="M214 44a14 14 0 0 0-18 16l-14 14 8 8 14-14a14 14 0 0 0 16-18l-9 9-6-6Z"
      fill="#fff"
      stroke={INK}
      strokeWidth={2.8}
      strokeLinejoin="round"
    />
  </>
);

const FirstLight: React.FC<ChallengePalette> = (p) => (
  <>
    <circle cx={160} cy={70} r={50} fill={p.glow} opacity={0.85} />
    {/* rays */}
    {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((a) => {
      const r = (a * Math.PI) / 180;
      return (
        <path
          key={a}
          d={`M${160 + Math.cos(r) * 40} ${70 + Math.sin(r) * 40}l${Math.cos(r) * 12} ${Math.sin(r) * 12}`}
          stroke="#fff"
          strokeWidth={3.2}
          strokeLinecap="round"
        />
      );
    })}
    {/* LED bulb */}
    <circle cx={160} cy={70} r={22} fill={p.c1} stroke={INK} strokeWidth={3.4} />
    <path d="M160 70c0-8 5-12 9-15" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.8} />
    {/* legs into a mini breadboard */}
    <path d="M152 90v18M168 90v18" fill="none" {...stroke} strokeWidth={3} />
    <rect x={120} y={108} width={80} height={32} rx={7} fill="#fff" {...stroke} />
    {[0, 1, 2, 3, 4].map((i) => (
      <circle key={i} cx={134 + i * 16} cy={124} r={2.4} fill={INK} />
    ))}
  </>
);

const SCENES: Record<string, React.FC<ChallengePalette>> = {
  streak: Streak,
  nokit: NoKit,
  teachback: TeachBack,
  sensors: Sensors,
  debug: Debug,
  firstlight: FirstLight,
};

interface ChallengeArtProps {
  art?: string;
  theme?: string;
  className?: string;
}

/** The themed hero illustration for a challenge. Fills its container (16:8.5). */
export const ChallengeArt: React.FC<ChallengeArtProps> = ({ art, theme, className }) => {
  const palette = themeFor(theme);
  const Scene = SCENES[art ?? ''] ?? FirstLight;
  const gid = `cg-${art}-${theme}`;
  return (
    <svg viewBox="0 0 320 170" className={className} role="img" aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette.c1} />
          <stop offset="100%" stopColor={palette.c2} />
        </linearGradient>
      </defs>
      <rect width="320" height="170" fill={`url(#${gid})`} />
      <Scene {...palette} />
    </svg>
  );
};
