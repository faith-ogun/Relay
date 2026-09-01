import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { NUNITO } from '../font';
import { C, type Frame } from './palette';
import { Circuit } from './circuits';
import type { Scene } from './types';

/** Entrances decelerate. One motion vocabulary across every scene, so the film
 *  reads as one thing rather than a reel of transitions. */
const rise = (frame: number, delay = 0, dur = 12) => ({
  opacity: interpolate(frame, [delay, delay + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  transform: `translateY(${interpolate(frame, [delay, delay + dur], [26, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
});

/** Sits directly under the drawing, NOT pinned to the bottom of the stage.
 *  Pinned, it dragged the visual weight down and left the circuit looking
 *  stranded in the top half of a portrait frame. */
const Label: React.FC<{ text?: string; f: Frame }> = ({ text, f }) => {
  const frame = useCurrentFrame();
  if (!text) return null;
  return (
    <div style={{
      ...rise(frame, 6), textAlign: 'center', fontFamily: NUNITO, fontWeight: 900,
      fontSize: 44 * f.k, color: C.inkSoft, letterSpacing: -0.4, marginTop: 18 * f.k,
    }}>{text}</div>
  );
};

export const SceneView: React.FC<{ scene: Scene; f: Frame; accent: string; title: string }> = ({
  scene, f, accent, title,
}) => {
  const frame = useCurrentFrame();
  const box: React.CSSProperties = {
    position: 'absolute', left: f.stage.x, top: f.stage.y, width: f.stage.w, height: f.stage.h,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  if (scene.kind === 'title') {
    return (
      <div style={{ ...box, flexDirection: 'column', gap: 30 * f.k }}>
        <div style={{ ...rise(frame, 0), width: 132 * f.k, height: 12 * f.k, background: accent, borderRadius: 8 }} />
        <div style={{
          ...rise(frame, 6), fontFamily: NUNITO, fontWeight: 900, textAlign: 'center',
          fontSize: 116 * f.k, lineHeight: 1.03, color: C.ink, letterSpacing: -3,
        }}>{title}</div>
      </div>
    );
  }

  if (scene.kind === 'statement') {
    return (
      <div style={{ ...box, flexDirection: 'column', gap: 6 * f.k }}>
        {scene.lines.map((l, i) => (
          <div key={i} style={{
            ...rise(frame, i * 7), fontFamily: NUNITO, fontWeight: 900, textAlign: 'center',
            fontSize: 104 * f.k, lineHeight: 1.08, color: i === scene.lines.length - 1 ? accent : C.ink,
            letterSpacing: -2.5,
          }}>{l}</div>
        ))}
      </div>
    );
  }

  if (scene.kind === 'circuit') {
    return (
      <div style={{ ...box, flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ ...rise(frame, 0, 9), width: '100%' }}>
          <Circuit variant={scene.variant} flow={scene.flow} broken={scene.broken}
                   highlight={scene.highlight} portrait={f.portrait} />
        </div>
        <Label text={scene.label} f={f} />
      </div>
    );
  }

  if (scene.kind === 'formula') {
    // Long expressions step down rather than wrapping to three lines. The
    // thresholds start ABOVE the longest expression in the films that already
    // shipped, so nothing already rendered changes size.
    const size = scene.expr.length <= 24 ? 96 : scene.expr.length <= 34 ? 76 : 62;
    return (
      <div style={{ ...box, flexDirection: 'column', gap: 26 * f.k }}>
        <div style={{
          ...rise(frame, 0), fontFamily: NUNITO, fontWeight: 900, textAlign: 'center',
          fontSize: size * f.k, color: C.ink, letterSpacing: -2,
          background: C.white, border: `${7 * f.k}px solid ${C.ink}`, borderRadius: 28 * f.k,
          padding: `${34 * f.k}px ${54 * f.k}px`, boxShadow: `0 ${10 * f.k}px 0 ${accent}`,
        }}>{scene.expr}</div>
        {scene.note && (
          <div style={{ ...rise(frame, 10), fontFamily: NUNITO, fontWeight: 800, fontSize: 42 * f.k, color: C.inkSoft }}>
            {scene.note}
          </div>
        )}
      </div>
    );
  }

  if (scene.kind === 'compare') {
    const Panel: React.FC<{ t: string; tone: string; d: number }> = ({ t, tone, d }) => (
      <div style={{
        ...rise(frame, d), flex: 1, background: C.white, border: `${7 * f.k}px solid ${C.ink}`,
        borderRadius: 28 * f.k, padding: `${44 * f.k}px ${28 * f.k}px`, textAlign: 'center',
        fontFamily: NUNITO, fontWeight: 900, fontSize: 60 * f.k, color: C.ink,
        boxShadow: `0 ${10 * f.k}px 0 ${tone}`, letterSpacing: -1,
      }}>{t}</div>
    );
    return (
      <div style={{ ...box, flexDirection: 'column', gap: 40 * f.k }}>
        <div style={{ display: 'flex', gap: 34 * f.k, width: '100%', alignItems: 'stretch' }}>
          <Panel t={scene.left} tone={C.greenDeep} d={0} />
          <Panel t={scene.right} tone={C.red} d={8} />
        </div>
        <div style={{ ...rise(frame, 16), fontFamily: NUNITO, fontWeight: 800, fontSize: 42 * f.k, color: C.inkSoft, textAlign: 'center' }}>
          {scene.caption}
        </div>
      </div>
    );
  }

  if (scene.kind === 'recap') {
    return (
      <div style={{ ...box, flexDirection: 'column', gap: 26 * f.k, alignItems: 'stretch', justifyContent: 'center' }}>
        {scene.items.map((it, i) => (
          <div key={it} style={{
            ...rise(frame, i === scene.items.length - 1 ? 0 : 0),
            display: 'flex', alignItems: 'center', gap: 26 * f.k,
            background: i === scene.items.length - 1 ? C.white : 'transparent',
            border: `${6 * f.k}px solid ${i === scene.items.length - 1 ? C.ink : C.line}`,
            borderRadius: 24 * f.k, padding: `${26 * f.k}px ${30 * f.k}px`,
            opacity: i === scene.items.length - 1 ? 1 : 0.55,
          }}>
            <div style={{
              width: 62 * f.k, height: 62 * f.k, borderRadius: 999, background: accent,
              border: `${5 * f.k}px solid ${C.ink}`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontFamily: NUNITO, fontWeight: 900, fontSize: 34 * f.k, flexShrink: 0,
            }}>{i + 1}</div>
            <div style={{ fontFamily: NUNITO, fontWeight: 900, fontSize: 50 * f.k, color: C.ink, letterSpacing: -1 }}>{it}</div>
          </div>
        ))}
      </div>
    );
  }

  if (scene.kind === 'plot') {
    return <Plot f={f} accent={accent} upTo={scene.upTo} marker={scene.marker} />;
  }

  return (
    <div style={{ ...box, flexDirection: 'column', gap: 24 * f.k }}>
      <div style={{ ...rise(frame, 0), fontFamily: NUNITO, fontWeight: 900, fontSize: 92 * f.k, color: C.ink, letterSpacing: -2 }}>
        OHMLET
      </div>
      <div style={{ ...rise(frame, 8), width: 160 * f.k, height: 12 * f.k, background: accent, borderRadius: 8 }} />
    </div>
  );
};

/** The charging curve, drawn to the voltage the narration has just named.
 *  `upTo` is a VOLTAGE fraction, and the time it corresponds to is derived from
 *  the curve itself, so "63%" lands on one tau because the maths says so rather
 *  than because a value was hand-placed. */
const Plot: React.FC<{ f: Frame; accent: string; upTo: number; marker?: string }> = ({ f, accent, upTo, marker }) => {
  const frame = useCurrentFrame();
  const W = 1000, H = 560, L = 110, B = 460, R = 930, T = 70;
  const TAU_MAX = 5;
  const tFor = (v: number) => Math.min(TAU_MAX, v >= 1 ? TAU_MAX : -Math.log(1 - v));
  const target = tFor(upTo);
  const drawn = interpolate(frame, [4, 34], [0, target], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const x = (t: number) => L + (t / TAU_MAX) * (R - L);
  const y = (v: number) => B - v * (B - T);
  const pts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const t = (drawn * i) / 120;
    pts.push(`${x(t)},${y(1 - Math.exp(-t))}`);
  }
  const vNow = 1 - Math.exp(-drawn);

  return (
    <div style={{ position: 'absolute', left: f.stage.x, top: f.stage.y, width: f.stage.w, height: f.stage.h,
                  display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }}>
        {[0.63, 0.86, 0.95].map((v) => (
          <line key={v} x1={L} y1={y(v)} x2={R} y2={y(v)} stroke={C.line} strokeWidth={3} />
        ))}
        {[1, 2, 3, 4, 5].map((t) => (
          <line key={t} x1={x(t)} y1={T} x2={x(t)} y2={B} stroke={C.line} strokeWidth={3} />
        ))}
        <line x1={L} y1={T - 12} x2={L} y2={B} stroke={C.ink} strokeWidth={7} strokeLinecap="round" />
        <line x1={L} y1={B} x2={R + 14} y2={B} stroke={C.ink} strokeWidth={7} strokeLinecap="round" />
        <line x1={L} y1={y(1)} x2={R} y2={y(1)} stroke={C.inkMute} strokeWidth={4} strokeDasharray="12 10" />

        {drawn > 0.01 && <polyline points={pts.join(' ')} fill="none" stroke={accent} strokeWidth={11}
                                   strokeLinecap="round" strokeLinejoin="round" />}
        {drawn > 0.01 && <circle cx={x(drawn)} cy={y(vNow)} r={16} fill={accent} stroke={C.ink} strokeWidth={6} />}

        <text x={L - 24} y={y(1) + 12} textAnchor="end" fontFamily={NUNITO} fontWeight={900} fontSize={34} fill={C.inkMute}>V</text>
        {[1, 2, 3, 5].map((t) => (
          <text key={t} x={x(t)} y={B + 48} textAnchor="middle" fontFamily={NUNITO} fontWeight={900} fontSize={32} fill={C.inkMute}>
            {t}T
          </text>
        ))}
        {drawn > 0.05 && (
          <text x={x(drawn)} y={y(vNow) - 34} textAnchor="middle" fontFamily={NUNITO} fontWeight={900} fontSize={44} fill={C.ink}>
            {Math.round(vNow * 100)}%
          </text>
        )}
      </svg>
      {marker && (
        <div style={{ ...rise(frame, 14), textAlign: 'center', fontFamily: NUNITO, fontWeight: 900,
                      fontSize: 46 * f.k, color: C.inkSoft, marginTop: 12 * f.k }}>{marker}</div>
      )}
    </div>
  );
};
