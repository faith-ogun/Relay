import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { NUNITO } from '../font';
import { C } from './palette';
import type { CircuitVariant } from './types';

/**
 * The schematics, and the current moving through them.
 *
 * Current is drawn as dots walking a polyline, positioned in JS from the frame
 * number rather than with SMIL <animateMotion>. Remotion renders by seeking to a
 * frame and screenshotting, and a declarative SMIL timeline does not reliably
 * land on the same position when you do that. Frame in, position out, every
 * time.
 */

type P = [number, number];

const len = (a: P, b: P) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Point at fraction u (0..1) along a polyline, and the total length. */
function walk(points: P[], u: number): P {
  const segs = points.slice(1).map((p, i) => len(points[i], p));
  const total = segs.reduce((a, b) => a + b, 0);
  let d = ((u % 1) + 1) % 1 * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i]) {
      const t = segs[i] === 0 ? 0 : d / segs[i];
      return [
        points[i][0] + (points[i + 1][0] - points[i][0]) * t,
        points[i][1] + (points[i + 1][1] - points[i][1]) * t,
      ];
    }
    d -= segs[i];
  }
  return points[points.length - 1];
}

const poly = (pts: P[]) => pts.map((p) => p.join(',')).join(' ');

const Wire: React.FC<{ pts: P[]; color?: string; w?: number }> = ({ pts, color = C.ink, w = 7 }) => (
  <polyline points={poly(pts)} fill="none" stroke={color} strokeWidth={w}
            strokeLinecap="round" strokeLinejoin="round" />
);

/** The dots. Count scales with path length so density looks even in every circuit. */
const Current: React.FC<{ path: P[]; on: boolean; speed?: number; color?: string }> = ({
  path, on, speed = 0.16, color = C.gold,
}) => {
  const frame = useCurrentFrame();
  if (!on) return null;
  const segs = path.slice(1).map((p, i) => len(path[i], p));
  const total = segs.reduce((a, b) => a + b, 0);
  const n = Math.max(6, Math.round(total / 150));
  const u0 = (frame / 30) * speed;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = walk(path, u0 + i / n);
        return <circle key={i} cx={x} cy={y} r={11} fill={color} stroke={C.ink} strokeWidth={3} />;
      })}
    </>
  );
};

const Glow: React.FC<{ x: number; y: number; on: boolean }> = ({ x, y, on }) => {
  const frame = useCurrentFrame();
  if (!on) return null;
  const pulse = 1 + Math.sin(frame / 7) * 0.05;
  return (
    <>
      <circle cx={x} cy={y} r={78 * pulse} fill={C.gold} opacity={0.22} />
      <circle cx={x} cy={y} r={56 * pulse} fill={C.gold} opacity={0.32} />
    </>
  );
};

const Halo: React.FC<{ x: number; y: number; r?: number; show: boolean }> = ({ x, y, r = 74, show }) => {
  const frame = useCurrentFrame();
  if (!show) return null;
  return (
    <circle cx={x} cy={y} r={r + Math.sin(frame / 9) * 3} fill="none"
            stroke={C.red} strokeWidth={5} strokeDasharray="14 10" opacity={0.9} />
  );
};

// ── Loop: battery, two wires, a lamp ────────────────────────────────────────
const LOOP: P[] = [[500, 545], [790, 545], [790, 150], [500, 150], [210, 150], [210, 545], [500, 545]];
const LOOP_BROKEN: P[] = [[500, 545], [790, 545], [790, 400]];

const LoopCircuit: React.FC<Props> = ({ flow, broken, highlight, variant }) => {
  const isSwitch = variant === 'switch';
  const gapY = 348;
  return (
    <>
      {broken ? (
        <>
          <Wire pts={[[500, 545], [790, 545], [790, gapY + 34]]} />
          <Wire pts={[[790, gapY - 34], [790, 150], [500, 150]]} />
          <Wire pts={[[500, 150], [210, 150], [210, 545], [500, 545]]} />
          <circle cx={790} cy={gapY + 34} r={9} fill={C.ink} />
          <circle cx={790} cy={gapY - 34} r={9} fill={C.ink} />
          <Halo x={790} y={gapY} r={58} show={highlight === 'gap'} />
        </>
      ) : isSwitch && !flow ? (
        <>
          <Wire pts={[[500, 545], [790, 545], [790, gapY + 30]]} />
          <Wire pts={[[790, gapY - 30], [790, 150], [500, 150]]} />
          <Wire pts={[[500, 150], [210, 150], [210, 545], [500, 545]]} />
          <Wire pts={[[790, gapY + 30], [852, gapY - 40]]} color={C.copper} w={9} />
          <circle cx={790} cy={gapY + 30} r={10} fill={C.ink} />
          <circle cx={790} cy={gapY - 30} r={10} fill={C.ink} />
        </>
      ) : (
        <>
          <Wire pts={LOOP} />
          {isSwitch && <Wire pts={[[790, gapY + 30], [790, gapY - 30]]} color={C.copper} w={9} />}
        </>
      )}

      {/* Current is drawn BEFORE the parts so the parts occlude it. Drawn after,
          the dots tracked straight across the battery body and read as a glyph
          in its label. */}
      <Current path={broken ? LOOP_BROKEN : LOOP} on={!!flow} />

      {/* Battery, sitting on the bottom rail */}
      <rect x={430} y={512} width={140} height={66} rx={10} fill={C.gold} stroke={C.ink} strokeWidth={6} />
      <rect x={556} y={526} width={16} height={38} rx={4} fill={C.ink} />
      <text fontFamily={NUNITO} x={500} y={558} textAnchor="middle" fontSize={38} fontWeight={900} fill={C.ink}>9V</text>
      <Halo x={500} y={545} r={96} show={highlight === 'battery'} />

      {/* Lamp on the top rail */}
      <Glow x={500} y={150} on={!!flow} />
      <circle cx={500} cy={150} r={46} fill={flow ? C.gold : C.white} stroke={C.ink} strokeWidth={6} />
      <path d="M478 168 L478 186 L522 186 L522 168" fill="none" stroke={C.ink} strokeWidth={6} strokeLinejoin="round" />

      <Halo x={210} y={348} r={64} show={highlight === 'wire'} />
    </>
  );
};

// ── RC: supply, resistor, capacitor to ground ───────────────────────────────
const RC: P[] = [[190, 150], [400, 150], [620, 150], [800, 150], [800, 300], [800, 470], [190, 470], [190, 150]];

const RcCircuit: React.FC<Props> = ({ flow, highlight }) => (
  <>
    <Wire pts={[[190, 150], [400, 150]]} />
    <Wire pts={[[620, 150], [800, 150], [800, 292]]} />
    <Wire pts={[[800, 372], [800, 470], [190, 470], [190, 150]]} />

    <Current path={RC} on={!!flow} />

    {/* Resistor */}
    <rect x={400} y={118} width={220} height={64} rx={10} fill={C.white} stroke={C.ink} strokeWidth={6} />
    {[440, 480, 520].map((x, i) => (
      <rect key={x} x={x} y={118} width={22} height={64}
            fill={[C.copper, C.ink, C.gold][i]} />
    ))}
    <Halo x={510} y={150} r={128} show={highlight === 'resistor'} />

    {/* Capacitor plates */}
    <Wire pts={[[736, 292], [864, 292]]} w={11} />
    <Wire pts={[[736, 372], [864, 372]]} w={11} />

    {/* Ground */}
    <Wire pts={[[150, 470], [230, 470]]} />
    <Wire pts={[[160, 500], [220, 500]]} w={6} />
    <Wire pts={[[176, 524], [204, 524]]} w={6} />

  </>
);

// ── A pin driving a load directly, and the same load behind a transistor ────
const PIN_DIRECT: P[] = [[250, 200], [560, 200], [560, 300], [560, 470], [250, 470], [250, 200]];

const PinDirect: React.FC<Props> = ({ flow, highlight }) => (
  <>
    {/* Wires, then current, then the parts on top. Any other order and the dots
        track across a component label and read as part of it. */}
    <Wire pts={[[260, 260], [560, 260], [560, 320]]} />
    <Wire pts={[[560, 420], [560, 470], [260, 470], [260, 410]]} />
    <Current path={[[260, 260], [560, 260], [560, 320], [560, 420], [560, 470], [260, 470], [260, 410], [260, 260]]}
             on={!!flow} color={highlight === 'load' ? C.red : C.gold} />

    <rect x={130} y={230} width={130} height={210} rx={14} fill={C.blue} stroke={C.ink} strokeWidth={6} />
    <text fontFamily={NUNITO} x={195} y={318} textAnchor="middle" fontSize={30} fontWeight={900} fill={C.white}>PIN</text>
    <text fontFamily={NUNITO} x={195} y={360} textAnchor="middle" fontSize={26} fontWeight={800} fill={C.white}>20mA</text>

    <circle cx={560} cy={370} r={54} fill={C.white} stroke={C.ink} strokeWidth={6} />
    <text fontFamily={NUNITO} x={560} y={384} textAnchor="middle" fontSize={38} fontWeight={900} fill={C.ink}>M</text>
    <Halo x={560} y={370} r={78} show={highlight === 'load'} />
  </>
);

const TransistorRig: React.FC<Props> = ({ flow, highlight }) => (
  <>
    {/* Rails and wires */}
    <Wire pts={[[210, 96], [700, 96]]} />
    <Wire pts={[[640, 96], [640, 168]]} />
    <Wire pts={[[640, 276], [640, 340]]} />
    <Wire pts={[[640, 340], [640, 470]]} w={11} />
    <Wire pts={[[560, 405], [636, 405]]} />
    <Wire pts={[[640, 356], [700, 320]]} />
    <Wire pts={[[640, 452], [700, 490]]} />
    <Wire pts={[[700, 320], [700, 300]]} />
    <Wire pts={[[700, 490], [700, 530], [230, 530]]} />
    <Wire pts={[[340, 405], [400, 405]]} />

    {/* The instruction from the pin, and the load current it commands. Two
        speeds and two colours, because the whole lesson is that they are not
        the same current. */}
    <Current path={[[340, 405], [400, 405], [550, 405], [636, 405]]} on={!!flow} speed={0.5} color={C.blue} />
    <Current path={[[210, 96], [640, 96], [640, 168], [640, 276], [640, 470], [700, 490], [700, 530], [230, 530]]}
             on={!!flow} speed={0.22} color={C.gold} />

    {/* Parts, drawn last so they occlude the dots */}
    <text fontFamily={NUNITO} x={180} y={108} textAnchor="end" fontSize={30} fontWeight={900} fill={C.inkSoft}>+9V</text>

    <circle cx={640} cy={222} r={54} fill={C.white} stroke={C.ink} strokeWidth={6} />
    <text fontFamily={NUNITO} x={640} y={236} textAnchor="middle" fontSize={38} fontWeight={900} fill={C.ink}>M</text>
    <Halo x={640} y={222} r={78} show={highlight === 'load'} />

    <path d="M700 490 l-26 -6 l6 24 z" fill={C.ink} />
    <Halo x={700} y={505} r={62} show={highlight === 'emitter'} />

    <rect x={400} y={375} width={150} height={58} rx={9} fill={C.white} stroke={C.ink} strokeWidth={6} />
    <text fontFamily={NUNITO} x={475} y={414} textAnchor="middle" fontSize={26} fontWeight={900} fill={C.ink}>1k</text>
    <Halo x={475} y={404} r={104} show={highlight === 'baseresistor' || highlight === 'base'} />

    <rect x={190} y={330} width={150} height={150} rx={14} fill={C.blue} stroke={C.ink} strokeWidth={6} />
    <text fontFamily={NUNITO} x={265} y={398} textAnchor="middle" fontSize={28} fontWeight={900} fill={C.white}>PIN</text>
    <text fontFamily={NUNITO} x={265} y={438} textAnchor="middle" fontSize={24} fontWeight={800} fill={C.white}>2mA</text>
  </>
);

// ── Shared part bodies ──────────────────────────────────────────────────────
//
// Everything below draws inside the same 1000x640 box as the originals, and
// nothing strays outside x 60..940, y 40..600, because the portrait crop trims
// exactly that margin.

const BANDS = [C.copper, C.ink, C.gold];

/** New variants read `highlight` as a set of words, so one prop can both pick a
 *  component and ring it: "ldr r1". */
const tok = (h?: string) => new Set((h ?? '').split(/\s+/).filter(Boolean));

const ResistorH: React.FC<{ x: number; y: number; w?: number; h?: number; text?: string }> = ({
  x, y, w = 220, h = 64, text,
}) => (
  <>
    <rect x={x} y={y - h / 2} width={w} height={h} rx={10} fill={C.white} stroke={C.ink} strokeWidth={6} />
    {BANDS.map((c, i) => (
      <rect key={i} x={x + w * 0.26 + i * w * 0.17} y={y - h / 2 + 4} width={20} height={h - 8} fill={c} />
    ))}
    {text && (
      <text fontFamily={NUNITO} x={x + w / 2} y={y + h / 2 + 44} textAnchor="middle"
            fontSize={34} fontWeight={900} fill={C.inkSoft}>{text}</text>
    )}
  </>
);

const ResistorV: React.FC<{ x: number; y: number; h: number; w?: number; text?: string }> = ({
  x, y, h, w = 140, text,
}) => (
  <>
    <rect x={x - w / 2} y={y} width={w} height={h} rx={10} fill={C.white} stroke={C.ink} strokeWidth={6} />
    {BANDS.map((c, i) => (
      <rect key={i} x={x - w / 2 + 4} y={y + h / 2 - 37 + i * 28} width={w - 8} height={18} fill={c} />
    ))}
    {text && (
      <text fontFamily={NUNITO} x={x - w / 2 - 22} y={y + h / 2 + 12} textAnchor="end"
            fontSize={34} fontWeight={900} fill={C.inkSoft}>{text}</text>
    )}
  </>
);

const Ground: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <>
    <Wire pts={[[x - 58, y], [x + 58, y]]} />
    <Wire pts={[[x - 36, y + 24], [x + 36, y + 24]]} w={6} />
    <Wire pts={[[x - 16, y + 46], [x + 16, y + 46]]} w={6} />
  </>
);

const Arrow: React.FC<{ x1: number; y1: number; x2: number; y2: number; color?: string }> = ({
  x1, y1, x2, y2, color = C.ink,
}) => {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const s = 20;
  return (
    <>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={6} strokeLinecap="round" />
      <path d={`M${x2} ${y2} L${x2 - s * Math.cos(a - 0.42)} ${y2 - s * Math.sin(a - 0.42)} ` +
               `L${x2 - s * Math.cos(a + 0.42)} ${y2 - s * Math.sin(a + 0.42)} Z`} fill={color} />
    </>
  );
};

const Node: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <circle cx={x} cy={y} r={11} fill={C.ink} />
);

/** A light dependent resistor: the body, plus the two arrows that mean "light
 *  falls on this" in every schematic a learner will ever meet. */
const Ldr: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <>
    <circle cx={x} cy={y} r={58} fill={C.white} stroke={C.ink} strokeWidth={6} />
    <polyline points={`${x - 32},${y + 22} ${x - 16},${y - 18} ${x},${y + 22} ${x + 16},${y - 18} ${x + 32},${y + 22}`}
              fill="none" stroke={C.ink} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
    <Arrow x1={x - 140} y1={y - 110} x2={x - 66} y2={y - 48} />
    <Arrow x1={x - 96} y1={y - 148} x2={x - 22} y2={y - 86} />
  </>
);

// ── Divider: the two resistor chain the whole sensor unit runs on ───────────
const DIVIDER_PATH: P[] = [[500, 104], [500, 500]];

const DividerCircuit: React.FC<Props> = ({ flow, highlight }) => {
  const t = tok(highlight);
  const pot = t.has('pot');
  return (
    <>
      <Wire pts={[[500, 104], [500, 170]]} />
      {!pot && <Wire pts={[[500, 280], [500, 340]]} />}
      <Wire pts={[[500, 450], [500, 500]]} />
      <Wire pts={[[500, 310], [pot ? 700 : 800, 310]]} />

      <Current path={DIVIDER_PATH} on={!!flow} />

      {pot ? (
        <>
          <ResistorV x={500} y={170} h={280} />
          <Arrow x1={700} y1={310} x2={584} y2={310} color={C.copper} />
        </>
      ) : t.has('ldr') ? (
        <Ldr x={500} y={225} />
      ) : (
        <ResistorV x={500} y={170} h={110} text="R1" />
      )}
      {!pot && <ResistorV x={500} y={340} h={110} text="R2" />}

      <Node x={500} y={310} />
      <Ground x={500} y={500} />
      <text fontFamily={NUNITO} x={500} y={88} textAnchor="middle" fontSize={36} fontWeight={900} fill={C.inkSoft}>+5V</text>
      <text fontFamily={NUNITO} x={pot ? 730 : 830} y={292} textAnchor="start" fontSize={36} fontWeight={900} fill={C.ink}>Vout</text>

      <Halo x={500} y={225} r={104} show={t.has('r1') || t.has('ldr')} />
      <Halo x={500} y={395} r={104} show={t.has('r2')} />
      <Halo x={650} y={310} r={72} show={t.has('tap')} />
    </>
  );
};

// ── LED with its series resistor ───────────────────────────────────────────
const LED_PATH: P[] = [[200, 140], [800, 140], [800, 500], [200, 500], [200, 140]];

const LedCircuit: React.FC<Props> = ({ flow, broken, highlight }) => {
  const t = tok(highlight);
  const reversed = t.has('reversed');
  const lit = !!flow && !reversed;
  return (
    <>
      <Wire pts={[[200, 140], [400, 140]]} />
      <Wire pts={[[620, 140], [800, 140], [800, 268]]} />
      <Wire pts={[[800, 356], [800, 500], [200, 500], [200, 344]]} />
      <Wire pts={[[200, 296], [200, 140]]} />

      <Current path={LED_PATH} on={lit} />

      {t.has('nores')
        ? <Wire pts={[[400, 140], [620, 140]]} />
        : <ResistorH x={400} y={140} text="220Ω" />}

      {/* The LED, drawn the way it is on a schematic: a triangle that only lets
          current through the way it points. */}
      <Glow x={800} y={310} on={lit} />
      {reversed ? (
        <>
          <path d="M760 356 L840 356 L800 276 Z" fill={C.white} stroke={C.ink} strokeWidth={6} strokeLinejoin="round" />
          <Wire pts={[[758, 268], [842, 268]]} w={10} />
        </>
      ) : (
        <>
          <path d="M760 276 L840 276 L800 348 Z" fill={lit ? C.gold : C.white} stroke={C.ink} strokeWidth={6} strokeLinejoin="round" />
          <Wire pts={[[758, 356], [842, 356]]} w={10} />
        </>
      )}
      <text fontFamily={NUNITO} x={716} y={324} textAnchor="end" fontSize={34} fontWeight={900} fill={C.inkSoft}>LED</text>

      {/* Supply, on the left rail */}
      <Wire pts={[[142, 296], [258, 296]]} w={11} />
      <Wire pts={[[172, 344], [228, 344]]} w={11} />
      <text fontFamily={NUNITO} x={128} y={332} textAnchor="end" fontSize={36} fontWeight={900} fill={C.inkSoft}>5V</text>

      <Halo x={510} y={140} r={132} show={t.has('resistor')} />
      <Halo x={800} y={312} r={92} show={t.has('led') || reversed} />
    </>
  );
};

// ── Two branches in parallel off one supply ────────────────────────────────
const PAR_A: P[] = [[200, 140], [420, 140], [420, 500], [200, 500], [200, 140]];
const PAR_B: P[] = [[200, 140], [700, 140], [700, 500], [200, 500], [200, 140]];

const ParallelCircuit: React.FC<Props> = ({ flow, highlight }) => {
  const t = tok(highlight);
  return (
    <>
      <Wire pts={[[200, 140], [700, 140]]} />
      <Wire pts={[[200, 500], [700, 500]]} />
      <Wire pts={[[420, 140], [420, 250]]} />
      <Wire pts={[[420, 370], [420, 500]]} />
      <Wire pts={[[700, 140], [700, 250]]} />
      <Wire pts={[[700, 370], [700, 500]]} />
      <Wire pts={[[200, 140], [200, 296]]} />
      <Wire pts={[[200, 344], [200, 500]]} />

      <Current path={PAR_A} on={!!flow} />
      <Current path={PAR_B} on={!!flow} />

      <ResistorV x={420} y={250} h={120} />
      <ResistorV x={700} y={250} h={120} />
      <Node x={420} y={140} />
      <Node x={420} y={500} />

      <Wire pts={[[142, 296], [258, 296]]} w={11} />
      <Wire pts={[[172, 344], [228, 344]]} w={11} />
      <text fontFamily={NUNITO} x={128} y={332} textAnchor="end" fontSize={36} fontWeight={900} fill={C.inkSoft}>9V</text>
      <text fontFamily={NUNITO} x={338} y={322} textAnchor="end" fontSize={34} fontWeight={900} fill={C.inkSoft}>R1</text>
      <text fontFamily={NUNITO} x={618} y={322} textAnchor="end" fontSize={34} fontWeight={900} fill={C.inkSoft}>R2</text>

      <Halo x={420} y={310} r={100} show={t.has('r1')} />
      <Halo x={700} y={310} r={100} show={t.has('r2')} />
      <Halo x={300} y={140} r={70} show={t.has('node')} />
    </>
  );
};

// ── The breadboard itself ──────────────────────────────────────────────────
const COLS = Array.from({ length: 29 }, (_, i) => 130 + i * 26);
const ROWS_TOP = [177, 202, 227, 252, 277];
const ROWS_BOT = [347, 372, 397, 422, 447];

const Breadboard: React.FC<Props> = ({ flow, highlight }) => {
  const t = tok(highlight);
  const hole = (x: number, y: number) => <rect key={`${x}-${y}`} x={x - 6} y={y - 6} width={12} height={12} rx={3} fill={C.line} />;
  return (
    <>
      <rect x={90} y={92} width={820} height={460} rx={20} fill={C.white} stroke={C.ink} strokeWidth={6} />

      {/* Power rails, top and bottom, with the stripe that names them */}
      {t.has('rails') && (
        <>
          <rect x={104} y={104} width={792} height={30} rx={8} fill={C.red} opacity={8.24} />
          <rect x={104} y={134} width={792} height={30} rx={8} fill={C.blue} opacity={8.24} />
        </>
      )}
      <Wire pts={[[112, 104], [888, 104]]} color={C.red} w={5} />
      <Wire pts={[[112, 164], [888, 164]]} color={C.blue} w={5} />
      <Wire pts={[[112, 480], [888, 480]]} color={C.red} w={5} />
      <Wire pts={[[112, 540], [888, 540]]} color={C.blue} w={5} />
      {COLS.map((x) => [119, 149, 495, 525].map((y) => hole(x, y)))}

      {/* The ravine. Every row is cut in half here, and that is the whole point. */}
      <rect x={104} y={294} width={792} height={36} rx={6} fill={C.inkFaint} />

      {t.has('row') && <rect x={378} y={164} width={26} height={126} rx={8} fill={C.gold} opacity={8.55} />}
      {t.has('deadrow') && <rect x={378} y={334} width={26} height={126} rx={8} fill={C.red} opacity={8.35} />}

      {COLS.map((x) => ROWS_TOP.map((y) => hole(x, y)))}
      {COLS.map((x) => ROWS_BOT.map((y) => hole(x, y)))}

      <Current path={[[112, 104], [888, 104]]} on={!!flow} speed={0.3} />

      <text fontFamily={NUNITO} x={104} y={80} textAnchor="start" fontSize={30} fontWeight={900} fill={C.red}>+</text>
      <text fontFamily={NUNITO} x={134} y={80} textAnchor="start" fontSize={30} fontWeight={900} fill={C.blue}>−</text>
      <text fontFamily={NUNITO} x={898} y={322} textAnchor="end" fontSize={28} fontWeight={900} fill={C.inkMute}>ravine</text>

      <Halo x={500} y={312} r={70} show={t.has('ravine')} />
      <Halo x={391} y={227} r={80} show={t.has('row')} />
    </>
  );
};

// ── Pull-up resistor, button, input pin ────────────────────────────────────
const PULLUP_PATH: P[] = [[500, 104], [500, 170], [500, 280], [500, 410], [500, 470], [500, 500]];

const Pullup: React.FC<Props> = ({ flow, broken, highlight }) => {
  const t = tok(highlight);
  return (
    <>
      {!broken && <Wire pts={[[500, 104], [500, 170]]} />}
      <Wire pts={[[500, 280], [500, 410]]} />
      <Wire pts={[[500, 320], [770, 320]]} />
      {flow ? <Wire pts={[[500, 410], [500, 470]]} /> : <Wire pts={[[500, 410], [566, 366]]} color={C.copper} w={9} />}
      <Wire pts={[[500, 470], [500, 500]]} />

      <Current path={PULLUP_PATH} on={!!flow && !broken} />

      {!broken && <ResistorV x={500} y={170} h={110} text="10kΩ" />}
      <circle cx={500} cy={410} r={10} fill={C.ink} />
      <circle cx={500} cy={470} r={10} fill={C.ink} />
      <Node x={500} y={320} />
      <Ground x={500} y={500} />

      <rect x={770} y={272} width={150} height={96} rx={16} fill={C.blue} stroke={C.ink} strokeWidth={6} />
      <text fontFamily={NUNITO} x={845} y={332} textAnchor="middle" fontSize={40} fontWeight={900} fill={C.white}>D2</text>
      {!broken && <text fontFamily={NUNITO} x={500} y={88} textAnchor="middle" fontSize={36} fontWeight={900} fill={C.inkSoft}>+5V</text>}
      <text fontFamily={NUNITO} x={430} y={452} textAnchor="end" fontSize={32} fontWeight={900} fill={C.inkSoft}>button</text>

      <Halo x={500} y={225} r={104} show={t.has('resistor')} />
      <Halo x={845} y={320} r={104} show={t.has('pin')} />
      <Halo x={500} y={440} r={84} show={t.has('button')} />
      <Halo x={500} y={195} r={90} show={!!broken && t.has('float')} />
    </>
  );
};

// ── Op-amp, with or without its feedback ───────────────────────────────────
const Opamp: React.FC<Props> = ({ flow, highlight }) => {
  const t = tok(highlight);
  const open = t.has('openloop');
  return (
    <>
      <Wire pts={[[130, 240], [200, 240]]} />
      <Wire pts={[[320, 240], [380, 240]]} />
      <Wire pts={[[284, 400], [380, 400]]} />
      <Wire pts={[[700, 320], [880, 320]]} />
      {!open && (
        <>
          <Wire pts={[[790, 320], [790, 130], [560, 130]]} />
          <Wire pts={[[440, 130], [340, 130], [340, 240]]} />
          <Node x={790} y={320} />
          <Node x={340} y={240} />
        </>
      )}
      {!open && <Wire pts={[[200, 400], [200, 470]]} />}

      <Current path={[[130, 240], [340, 240], [380, 240]]} on={!!flow} speed={0.4} color={C.blue} />
      <Current path={[[700, 320], [880, 320]]} on={!!flow} speed={0.24} />

      <path d="M380 180 L380 460 L700 320 Z" fill={C.white} stroke={C.ink} strokeWidth={7} strokeLinejoin="round" />
      <text fontFamily={NUNITO} x={424} y={256} textAnchor="middle" fontSize={52} fontWeight={900} fill={C.ink}>−</text>
      <text fontFamily={NUNITO} x={424} y={416} textAnchor="middle" fontSize={46} fontWeight={900} fill={C.ink}>+</text>

      <ResistorH x={200} y={240} w={120} h={58} />
      {!open && <ResistorH x={440} y={130} w={120} h={58} />}

      {open ? (
        <>
          <rect x={116} y={366} width={168} height={70} rx={14} fill={C.white} stroke={C.ink} strokeWidth={6} />
          <text fontFamily={NUNITO} x={200} y={418} textAnchor="middle" fontSize={38} fontWeight={900} fill={C.ink}>2.5V</text>
          <text fontFamily={NUNITO} x={200} y={488} textAnchor="middle" fontSize={30} fontWeight={900} fill={C.inkSoft}>threshold</text>
        </>
      ) : (
        <Ground x={200} y={470} />
      )}

      <text fontFamily={NUNITO} x={148} y={206} textAnchor="middle" fontSize={32} fontWeight={900} fill={C.inkSoft}>in</text>
      <text fontFamily={NUNITO} x={856} y={286} textAnchor="middle" fontSize={32} fontWeight={900} fill={C.inkSoft}>out</text>

      <Halo x={400} y={240} r={62} show={t.has('minus')} />
      <Halo x={400} y={400} r={62} show={t.has('plus')} />
      <Halo x={500} y={130} r={110} show={t.has('feedback')} />
      <Halo x={260} y={240} r={104} show={t.has('rin')} />
      <Halo x={800} y={320} r={74} show={t.has('out')} />
    </>
  );
};

// ── Logic: a gate, or a flip-flop block ────────────────────────────────────
const GATE_BODIES: Record<string, { d: string; right: number; bubble: boolean }> = {
  and: { d: 'M400 190 L520 190 A110 110 0 0 1 520 410 L400 410 Z', right: 630, bubble: false },
  nand: { d: 'M400 190 L520 190 A110 110 0 0 1 520 410 L400 410 Z', right: 630, bubble: true },
  or: { d: 'M392 190 Q470 300 392 410 Q580 410 656 300 Q580 190 392 190 Z', right: 656, bubble: false },
  nor: { d: 'M392 190 Q470 300 392 410 Q580 410 656 300 Q580 190 392 190 Z', right: 656, bubble: true },
  xor: { d: 'M420 190 Q498 300 420 410 Q608 410 684 300 Q608 190 420 190 Z', right: 684, bubble: false },
  not: { d: 'M400 200 L400 400 L610 300 Z', right: 610, bubble: true },
};

const evalGate = (kind: string, a: number, b: number): number => {
  switch (kind) {
    case 'and': return a && b ? 1 : 0;
    case 'nand': return a && b ? 0 : 1;
    case 'or': return a || b ? 1 : 0;
    case 'nor': return a || b ? 0 : 1;
    case 'xor': return a !== b ? 1 : 0;
    case 'not': return a ? 0 : 1;
    default: return 0;
  }
};

const Chip: React.FC<{ x: number; y: number; v: number; muted?: boolean }> = ({ x, y, v, muted }) => (
  <>
    <rect x={x} y={y} width={104} height={72} rx={16}
          fill={muted ? C.white : v ? C.gold : C.white} stroke={C.ink} strokeWidth={6} />
    <text fontFamily={NUNITO} x={x + 52} y={y + 54} textAnchor="middle" fontSize={44} fontWeight={900} fill={C.ink}>{v}</text>
  </>
);

/** `highlight` carries the gate and its inputs: "and 1 0". A flip-flop is
 *  "ff <D> <Q>", drawn as a block because that is how it appears on a datasheet
 *  and a learner will never see it as a shape. */
const GateCircuit: React.FC<Props> = ({ flow, highlight }) => {
  const parts = (highlight ?? 'and 1 1').split(/\s+/).filter(Boolean);
  const kind = parts[0] ?? 'and';
  const a = Number(parts[1] ?? 1) ? 1 : 0;
  const b = Number(parts[2] ?? 1) ? 1 : 0;

  if (kind === 'ff') {
    const q = a;
    return (
      <>
        <Wire pts={[[240, 240], [400, 240]]} />
        <Wire pts={[[240, 400], [400, 400]]} />
        <Wire pts={[[640, 240], [760, 240]]} />
        <Current path={[[240, 240], [400, 240]]} on={!!flow} speed={0.45} color={C.blue} />
        <rect x={400} y={170} width={240} height={300} rx={18} fill={C.white} stroke={C.ink} strokeWidth={7} />
        <text fontFamily={NUNITO} x={430} y={254} textAnchor="start" fontSize={40} fontWeight={900} fill={C.ink}>D</text>
        <text fontFamily={NUNITO} x={430} y={414} textAnchor="start" fontSize={34} fontWeight={900} fill={C.ink}>CLK</text>
        <text fontFamily={NUNITO} x={610} y={254} textAnchor="end" fontSize={40} fontWeight={900} fill={C.ink}>Q</text>
        <text fontFamily={NUNITO} x={520} y={330} textAnchor="middle" fontSize={32} fontWeight={900} fill={C.inkMute}>D TYPE</text>
        <path d="M600 386 L620 400 L600 414 Z" fill={C.ink} />
        <Chip x={130} y={204} v={a} />
        <Chip x={760} y={204} v={q} />
        <text fontFamily={NUNITO} x={520} y={130} textAnchor="middle" fontSize={44} fontWeight={900} fill={C.inkSoft}>FLIP-FLOP</text>
      </>
    );
  }

  const body = GATE_BODIES[kind] ?? GATE_BODIES.and;
  const out = evalGate(kind, a, b);
  const outX = body.right + (body.bubble ? 34 : 0);
  const single = kind === 'not';
  return (
    <>
      <Wire pts={[[250, single ? 300 : 240], [412, single ? 300 : 240]]} />
      {!single && <Wire pts={[[250, 360], [412, 360]]} />}
      <Wire pts={[[outX, 300], [760, 300]]} />

      <Current path={[[250, single ? 300 : 240], [412, single ? 300 : 240]]} on={!!flow} speed={0.45} color={C.blue} />
      <Current path={[[outX, 300], [760, 300]]} on={!!flow} speed={0.45} />

      <path d={body.d} fill={C.white} stroke={C.ink} strokeWidth={7} strokeLinejoin="round" />
      {body.bubble && <circle cx={body.right + 17} cy={300} r={17} fill={C.white} stroke={C.ink} strokeWidth={6} />}

      <Chip x={140} y={single ? 264 : 204} v={a} />
      {!single && <Chip x={140} y={324} v={b} />}
      <Chip x={760} y={264} v={out} />
      <text fontFamily={NUNITO} x={520} y={132} textAnchor="middle" fontSize={50} fontWeight={900} fill={C.inkSoft}>
        {kind.toUpperCase()}
      </text>
    </>
  );
};

// ── A three terminal regulator, with the caps that make it behave ──────────
const REG_PATH: P[] = [[130, 180], [880, 180], [880, 480], [130, 480], [130, 180]];

const Regulator: React.FC<Props> = ({ flow, highlight }) => {
  const t = tok(highlight);
  return (
    <>
      <Wire pts={[[130, 180], [380, 180]]} />
      <Wire pts={[[620, 180], [880, 180]]} />
      <Wire pts={[[130, 480], [880, 480]]} />
      <Wire pts={[[260, 180], [260, 300]]} />
      <Wire pts={[[260, 340], [260, 480]]} />
      <Wire pts={[[720, 180], [720, 300]]} />
      <Wire pts={[[720, 340], [720, 480]]} />
      <Wire pts={[[500, 280], [500, 480]]} />
      <Wire pts={[[880, 180], [880, 270]]} />
      <Wire pts={[[880, 380], [880, 480]]} />
      <Wire pts={[[130, 180], [130, 480]]} />

      <Current path={REG_PATH} on={!!flow} />

      <rect x={380} y={110} width={240} height={170} rx={16} fill={C.white} stroke={C.ink} strokeWidth={7} />
      <text fontFamily={NUNITO} x={500} y={212} textAnchor="middle" fontSize={54} fontWeight={900} fill={C.ink}>
        {t.has('buck') ? 'BUCK' : '7805'}
      </text>

      <Wire pts={[[206, 300], [314, 300]]} w={11} />
      <Wire pts={[[206, 340], [314, 340]]} w={11} />
      <Wire pts={[[666, 300], [774, 300]]} w={11} />
      <Wire pts={[[666, 340], [774, 340]]} w={11} />
      <ResistorV x={880} y={270} h={110} />

      <Node x={260} y={180} />
      <Node x={720} y={180} />
      <Ground x={500} y={480} />

      <text fontFamily={NUNITO} x={186} y={148} textAnchor="middle" fontSize={34} fontWeight={900} fill={C.inkSoft}>9V in</text>
      <text fontFamily={NUNITO} x={818} y={148} textAnchor="middle" fontSize={34} fontWeight={900} fill={C.inkSoft}>5V out</text>
      <text fontFamily={NUNITO} x={260} y={392} textAnchor="middle" fontSize={30} fontWeight={900} fill={C.inkMute}>Cin</text>
      <text fontFamily={NUNITO} x={720} y={392} textAnchor="middle" fontSize={30} fontWeight={900} fill={C.inkMute}>Cout</text>
      <text fontFamily={NUNITO} x={880} y={244} textAnchor="middle" fontSize={30} fontWeight={900} fill={C.inkMute}>load</text>

      <Halo x={500} y={195} r={140} show={t.has('reg') || t.has('heat')} />
      <Halo x={260} y={320} r={90} show={t.has('cin')} />
      <Halo x={720} y={320} r={90} show={t.has('cout')} />
      <Halo x={880} y={325} r={90} show={t.has('load')} />
    </>
  );
};

// ── The transistor rig again, this time with the flyback diode ─────────────
const FlybackRig: React.FC<Props> = ({ flow, broken, highlight }) => {
  const t = tok(highlight);
  return (
    <>
      <Wire pts={[[210, 96], [800, 96]]} />
      <Wire pts={[[640, 96], [640, 168]]} />
      <Wire pts={[[640, 276], [640, 340]]} />
      <Wire pts={[[640, 340], [640, 470]]} w={11} />
      <Wire pts={[[560, 405], [636, 405]]} />
      <Wire pts={[[640, 356], [700, 320]]} />
      <Wire pts={[[640, 452], [700, 490]]} />
      <Wire pts={[[700, 320], [700, 300]]} />
      <Wire pts={[[700, 490], [700, 530], [230, 530]]} />
      <Wire pts={[[340, 405], [400, 405]]} />
      {!broken && (
        <>
          <Wire pts={[[800, 96], [800, 190]]} />
          <Wire pts={[[800, 254], [800, 340], [640, 340]]} />
        </>
      )}

      <Current path={[[340, 405], [400, 405], [550, 405], [636, 405]]} on={!!flow} speed={0.5} color={C.blue} />
      <Current path={[[210, 96], [640, 96], [640, 168], [640, 276], [640, 470], [700, 490], [700, 530], [230, 530]]}
               on={!!flow} speed={0.22} />
      {/* With the diode fitted and the switch just opened, the stored energy
          circulates HERE and nowhere else. That short private loop is the whole
          lesson, so it gets its own dots. */}
      {!broken && !flow && t.has('recirculate') && (
        <Current path={[[640, 340], [800, 340], [800, 190], [800, 96], [640, 96], [640, 168], [640, 276], [640, 340]]}
                 on speed={0.35} color={C.blue} />
      )}

      <text fontFamily={NUNITO} x={180} y={108} textAnchor="end" fontSize={30} fontWeight={900} fill={C.inkSoft}>+9V</text>

      <circle cx={640} cy={222} r={54} fill={C.white} stroke={C.ink} strokeWidth={6} />
      <text fontFamily={NUNITO} x={640} y={236} textAnchor="middle" fontSize={38} fontWeight={900} fill={C.ink}>M</text>

      {!broken && (
        <>
          <path d="M766 254 L834 254 L800 192 Z" fill={C.white} stroke={C.ink} strokeWidth={6} strokeLinejoin="round" />
          <Wire pts={[[764, 188], [836, 188]]} w={10} />
          <text fontFamily={NUNITO} x={800} y={412} textAnchor="middle" fontSize={30} fontWeight={900} fill={C.inkSoft}>1N4001</text>
        </>
      )}

      {broken && t.has('spike') && (
        <>
          <path d="M700 300 L672 356 L698 356 L668 420" fill="none" stroke={C.red} strokeWidth={9}
                strokeLinecap="round" strokeLinejoin="round" />
          <text fontFamily={NUNITO} x={760} y={330} textAnchor="start" fontSize={40} fontWeight={900} fill={C.red}>300V</text>
        </>
      )}

      <path d="M700 490 l-26 -6 l6 24 z" fill={C.ink} />
      <rect x={400} y={375} width={150} height={58} rx={9} fill={C.white} stroke={C.ink} strokeWidth={6} />
      <text fontFamily={NUNITO} x={475} y={414} textAnchor="middle" fontSize={26} fontWeight={900} fill={C.ink}>1k</text>
      <rect x={190} y={330} width={150} height={150} rx={14} fill={C.blue} stroke={C.ink} strokeWidth={6} />
      <text fontFamily={NUNITO} x={265} y={398} textAnchor="middle" fontSize={28} fontWeight={900} fill={C.white}>PIN</text>
      <text fontFamily={NUNITO} x={265} y={438} textAnchor="middle" fontSize={24} fontWeight={800} fill={C.white}>2mA</text>

      <Halo x={800} y={222} r={86} show={t.has('diode')} />
      <Halo x={640} y={222} r={78} show={t.has('coil')} />
      <Halo x={640} y={400} r={80} show={t.has('transistor')} />
    </>
  );
};

// ── The board ──────────────────────────────────────────────────────────────
const PIN_XS = Array.from({ length: 14 }, (_, i) => 254 + i * 42);

const BoardCircuit: React.FC<Props> = ({ flow, highlight }) => {
  const t = tok(highlight);
  return (
    <>
      <rect x={200} y={130} width={640} height={380} rx={22} fill={C.blue} stroke={C.ink} strokeWidth={7} />
      <rect x={122} y={196} width={82} height={92} rx={10} fill={C.inkFaint} stroke={C.ink} strokeWidth={6} />
      <rect x={122} y={378} width={82} height={78} rx={12} fill={C.inkFaint} stroke={C.ink} strokeWidth={6} />

      {PIN_XS.map((x) => (
        <rect key={`t${x}`} x={x - 14} y={152} width={28} height={28} rx={5} fill={C.ink} />
      ))}
      {PIN_XS.map((x) => (
        <rect key={`b${x}`} x={x - 14} y={462} width={28} height={28} rx={5} fill={C.ink} />
      ))}

      <rect x={440} y={264} width={220} height={122} rx={10} fill={C.ink} />
      <text fontFamily={NUNITO} x={550} y={338} textAnchor="middle" fontSize={44} fontWeight={900} fill={C.white}>MCU</text>
      <text fontFamily={NUNITO} x={310} y={420} textAnchor="middle" fontSize={52} fontWeight={900} fill={C.white}>UNO</text>

      <Current path={[[440, 300], [254, 300], [254, 190]]} on={!!flow} speed={0.4} />

      <text fontFamily={NUNITO} x={530} y={112} textAnchor="middle" fontSize={30} fontWeight={900} fill={C.inkSoft}>DIGITAL PINS</text>
      <text fontFamily={NUNITO} x={530} y={546} textAnchor="middle" fontSize={30} fontWeight={900} fill={C.inkSoft}>ANALOG IN</text>
      <text fontFamily={NUNITO} x={163} y={178} textAnchor="middle" fontSize={28} fontWeight={900} fill={C.inkSoft}>USB</text>
      <text fontFamily={NUNITO} x={163} y={498} textAnchor="middle" fontSize={28} fontWeight={900} fill={C.inkSoft}>DC</text>

      <Halo x={163} y={242} r={78} show={t.has('usb')} />
      <Halo x={163} y={417} r={74} show={t.has('power')} />
      <Halo x={550} y={325} r={132} show={t.has('mcu')} />
      <Halo x={800} y={166} r={66} show={t.has('pin13')} />
      <Halo x={530} y={476} r={120} show={t.has('analog')} />
      <Halo x={530} y={166} r={120} show={t.has('digital')} />
    </>
  );
};

// ── Signals, drawn rather than described ───────────────────────────────────
const WL = 150, WR = 900, WT = 126, WB = 480;

const hash = (i: number) => {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
};

const SHAPES: Record<string, { f: (u: number) => number; unipolar: boolean; name: string }> = {
  dc: { f: () => 0.8, unipolar: true, name: 'DC' },
  sine: { f: (u) => Math.sin(u * Math.PI * 6), unipolar: false, name: 'SINE' },
  square: { f: (u) => (Math.sin(u * Math.PI * 6) >= 0 ? 1 : -1), unipolar: false, name: 'SQUARE' },
  pwm25: { f: (u) => ((u * 5) % 1 < 0.25 ? 1 : 0), unipolar: true, name: '25% DUTY' },
  pwm50: { f: (u) => ((u * 5) % 1 < 0.5 ? 1 : 0), unipolar: true, name: '50% DUTY' },
  pwm75: { f: (u) => ((u * 5) % 1 < 0.75 ? 1 : 0), unipolar: true, name: '75% DUTY' },
  halfwave: { f: (u) => Math.max(0, Math.sin(u * Math.PI * 6)), unipolar: true, name: 'HALF WAVE' },
  fullwave: { f: (u) => Math.abs(Math.sin(u * Math.PI * 6)), unipolar: true, name: 'FULL WAVE' },
  ripple: { f: (u) => 0.62 + 0.2 * (1 - ((u * 6) % 1)), unipolar: true, name: 'RIPPLE' },
  smooth: { f: (u) => 0.8 + 0.04 * (1 - ((u * 6) % 1)), unipolar: true, name: 'SMOOTHED' },
  noise: { f: (u) => Math.sin(u * Math.PI * 4) * 0.7 + hash(Math.round(u * 240)) * 0.22, unipolar: false, name: 'NOISY' },
  clip: { f: (u) => Math.max(-0.62, Math.min(0.62, Math.sin(u * Math.PI * 4) * 1.6)), unipolar: false, name: 'CLIPPED' },
  // A real button, at the timescale a microcontroller works on. The edges are
  // placed rather than generated: bounce is not periodic, and a tidy waveform
  // would misrepresent the one thing this picture exists to show.
  bounce: {
    f: (u) => {
      let v = 1;
      for (const e of [0.30, 0.345, 0.375, 0.415, 0.44, 0.475, 0.50]) if (u >= e) v = 1 - v;
      return v;
    },
    unipolar: true, name: 'CONTACT BOUNCE',
  },
};

const WaveCircuit: React.FC<Props> = ({ highlight }) => {
  const frame = useCurrentFrame();
  const t = tok(highlight);
  const key = [...t].find((k) => k in SHAPES) ?? 'sine';
  const shape = SHAPES[key];
  const zero = shape.unipolar ? WB : (WT + WB) / 2;
  const span = shape.unipolar ? WB - WT : (WB - WT) / 2;
  const y = (v: number) => zero - v * span * 0.9;

  const sweep = interpolate(frame, [4, 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const N = 300;
  const pts: string[] = [];
  let sum = 0;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    sum += shape.f(u);
    if (u <= sweep) pts.push(`${WL + u * (WR - WL)},${y(shape.f(u))}`);
  }
  const avg = sum / (N + 1);

  return (
    <>
      <line x1={WL} y1={WT - 20} x2={WL} y2={WB + 10} stroke={C.ink} strokeWidth={7} strokeLinecap="round" />
      <line x1={WL} y1={zero} x2={WR + 16} y2={zero} stroke={C.ink} strokeWidth={7} strokeLinecap="round" />
      {pts.length > 1 && (
        <polyline points={pts.join(' ')} fill="none" stroke={C.gold} strokeWidth={10}
                  strokeLinecap="round" strokeLinejoin="round" />
      )}
      {/* Drawn OVER the trace, on its own ground, because a red dashed line and
          a red caption both disappear against the yellow waveform. */}
      {t.has('avg') && (
        <>
          <line x1={WL} y1={y(avg)} x2={WR} y2={y(avg)} stroke={C.red} strokeWidth={6} strokeDasharray="14 12" />
          <text fontFamily={NUNITO} x={WR} y={WT - 46} textAnchor="end" fontSize={36} fontWeight={900} fill={C.red}>
            average
          </text>
        </>
      )}
      <text fontFamily={NUNITO} x={WL - 22} y={WT - 4} textAnchor="end" fontSize={34} fontWeight={900} fill={C.inkMute}>V</text>
      <text fontFamily={NUNITO} x={WR} y={WB + 54} textAnchor="end" fontSize={32} fontWeight={900} fill={C.inkMute}>time</text>
      <text fontFamily={NUNITO} x={WL + 8} y={WT - 46} textAnchor="start" fontSize={40} fontWeight={900} fill={C.inkSoft}>
        {shape.name}
      </text>
    </>
  );
};

// ── Frequency response ─────────────────────────────────────────────────────
const BL = 170, BR = 900, BT = 150, BB = 460;

const BodeCircuit: React.FC<Props> = ({ highlight }) => {
  const frame = useCurrentFrame();
  const t = tok(highlight);
  const kind = t.has('highpass') ? 'highpass' : t.has('bandpass') ? 'bandpass' : 'lowpass';
  const gain = (r: number) =>
    kind === 'lowpass' ? 1 / Math.sqrt(1 + r * r)
    : kind === 'highpass' ? r / Math.sqrt(1 + r * r)
    : 1 / Math.sqrt(1 + 9 * (r - 1 / r) * (r - 1 / r));

  const x = (d: number) => BL + ((d + 2) / 4) * (BR - BL);
  const y = (g: number) => BB - g * (BB - BT) * 0.92;
  const sweep = interpolate(frame, [4, 36], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pts: string[] = [];
  for (let i = 0; i <= 200; i++) {
    const u = i / 200;
    if (u > sweep) break;
    const d = -2 + u * 4;
    pts.push(`${x(d)},${y(gain(Math.pow(10, d)))}`);
  }

  return (
    <>
      <line x1={x(0)} y1={BT - 26} x2={x(0)} y2={BB} stroke={C.line} strokeWidth={5} strokeDasharray="12 10" />
      <line x1={BL} y1={y(0.707)} x2={BR} y2={y(0.707)} stroke={C.line} strokeWidth={5} strokeDasharray="12 10" />
      <line x1={BL} y1={BT - 26} x2={BL} y2={BB} stroke={C.ink} strokeWidth={7} strokeLinecap="round" />
      <line x1={BL} y1={BB} x2={BR + 16} y2={BB} stroke={C.ink} strokeWidth={7} strokeLinecap="round" />
      {pts.length > 1 && (
        <polyline points={pts.join(' ')} fill="none" stroke={C.gold} strokeWidth={11}
                  strokeLinecap="round" strokeLinejoin="round" />
      )}
      {sweep > 0.55 && <circle cx={x(0)} cy={y(0.707)} r={16} fill={C.gold} stroke={C.ink} strokeWidth={6} />}
      <text fontFamily={NUNITO} x={x(0)} y={BB + 54} textAnchor="middle" fontSize={36} fontWeight={900} fill={C.ink}>fc</text>
      <text fontFamily={NUNITO} x={BL - 20} y={y(0.707) + 12} textAnchor="end" fontSize={30} fontWeight={900} fill={C.inkMute}>-3dB</text>
      <text fontFamily={NUNITO} x={BL - 20} y={y(1) + 12} textAnchor="end" fontSize={30} fontWeight={900} fill={C.inkMute}>1x</text>
      <text fontFamily={NUNITO} x={BR} y={BB + 54} textAnchor="end" fontSize={32} fontWeight={900} fill={C.inkMute}>frequency</text>
      <text fontFamily={NUNITO} x={BL + 10} y={BT - 52} textAnchor="start" fontSize={40} fontWeight={900} fill={C.inkSoft}>
        {kind === 'lowpass' ? 'LOW PASS' : kind === 'highpass' ? 'HIGH PASS' : 'BAND PASS'}
      </text>
    </>
  );
};

interface Props {
  variant: CircuitVariant;
  flow?: boolean;
  broken?: 'right' | 'left';
  highlight?: string;
  portrait?: boolean;
}

export const Circuit: React.FC<Props> = (p) => {
  const V: Partial<Record<CircuitVariant, React.FC<Props>>> = {
    rc: RcCircuit,
    'pin-direct': PinDirect,
    transistor: TransistorRig,
    divider: DividerCircuit,
    led: LedCircuit,
    parallel: ParallelCircuit,
    breadboard: Breadboard,
    pullup: Pullup,
    opamp: Opamp,
    gate: GateCircuit,
    regulator: Regulator,
    flyback: FlybackRig,
    board: BoardCircuit,
    wave: WaveCircuit,
    bode: BodeCircuit,
  };
  const Body = V[p.variant] ?? LoopCircuit;
  const body = <Body {...p} />;
  // Cropped tighter in portrait. Nothing is drawn outside 60..940 by 40..600, so
  // trimming the margin scales the drawing up by about a fifth in the frame that
  // has width to spare, without a second set of coordinates to keep in step.
  return (
    <svg viewBox={p.portrait ? '60 40 880 560' : '0 0 1000 640'}
         style={{ width: '100%', height: 'auto', display: 'block' }}>
      {body}
    </svg>
  );
};
