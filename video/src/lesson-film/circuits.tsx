import React from 'react';
import { useCurrentFrame } from 'remotion';
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

interface Props {
  variant: CircuitVariant;
  flow?: boolean;
  broken?: 'right' | 'left';
  highlight?: string;
  portrait?: boolean;
}

export const Circuit: React.FC<Props> = (p) => {
  const body =
    p.variant === 'rc' ? <RcCircuit {...p} />
    : p.variant === 'pin-direct' ? <PinDirect {...p} />
    : p.variant === 'transistor' ? <TransistorRig {...p} />
    : <LoopCircuit {...p} />;
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
