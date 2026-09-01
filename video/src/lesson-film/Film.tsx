import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig, interpolate, useCurrentFrame } from 'remotion';
import { NUNITO } from '../font';
import { C, FPS, GAP_FRAMES, frameFor } from './palette';
import { SceneView } from './scenes';
import type { LessonScript, Timing } from './types';

/**
 * A lesson film.
 *
 * Laid out from the MEASURED audio, not from designed durations: each segment
 * occupies exactly as many frames as its narration takes, plus a fixed beat.
 * The consequence is that the picture cannot drift from the voice, and rewriting
 * one sentence reflows the film instead of breaking every cue after it.
 */

export const framesFor = (t: Timing) => Math.round(t.seconds * FPS) + GAP_FRAMES;
export const totalFrames = (timings: Timing[]) => timings.reduce((n, t) => n + framesFor(t), 0);

const Header: React.FC<{ lesson: LessonScript; k: number; portrait: boolean }> = ({ lesson, k, portrait }) => (
  <div style={{
    position: 'absolute', top: portrait ? 74 : 46, left: portrait ? 80 : 150, right: portrait ? 80 : 150,
    display: 'flex', alignItems: 'baseline', gap: 20 * k,
  }}>
    <div style={{
      fontFamily: NUNITO, fontWeight: 900, fontSize: 30 * k, letterSpacing: 3,
      color: C.inkMute, textTransform: 'uppercase',
    }}>{lesson.unitTitle}</div>
    <div style={{ flex: 1, height: 4, background: C.line, borderRadius: 2 }} />
    <div style={{
      fontFamily: NUNITO, fontWeight: 900, fontSize: 30 * k, letterSpacing: 1,
      color: lesson.accent,
    }}>{lesson.skillTitle}</div>
  </div>
);

/** Burned-in captions.
 *
 *  Not an accessibility afterthought: most of these will be watched on a phone
 *  with the sound off, so the words have to be on the screen. A .vtt sidecar
 *  ships alongside for players that want real subtitles. */
const Caption: React.FC<{ text: string; f: ReturnType<typeof frameFor> }> = ({ text, f }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{
      position: 'absolute', top: f.captionTop, left: 0, right: 0, height: f.captionH,
      borderTop: `${5}px solid ${C.line}`, background: C.white,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: `0 ${f.portrait ? 84 : 190}px`,
    }}>
      <div style={{
        opacity: o, fontFamily: NUNITO, fontWeight: 800, textAlign: 'center',
        fontSize: (f.portrait ? 50 : 44) * 1, lineHeight: 1.32, color: C.inkSoft,
      }}>{text}</div>
    </div>
  );
};

export const Film: React.FC<{ lesson: LessonScript; timings: Timing[] }> = ({ lesson, timings }) => {
  const { width, height } = useVideoConfig();
  const f = frameFor(width, height);

  let from = 0;
  return (
    <AbsoluteFill style={{ background: C.cream }}>
      {/* A single soft wash behind everything rather than a flat fill, so the
          frame has some depth without competing with the diagram. */}
      <AbsoluteFill style={{
        background: `radial-gradient(120% 80% at 50% 0%, ${lesson.accent}22 0%, transparent 60%)`,
      }} />
      <Header lesson={lesson} k={f.k} portrait={f.portrait} />

      {lesson.segments.map((seg, i) => {
        const dur = framesFor(timings[i]);
        const node = (
          <Sequence key={i} from={from} durationInFrames={dur} name={`${i}: ${seg.text.slice(0, 34)}`}>
            <Audio src={staticFile(timings[i].file)} />
            <SceneView scene={seg.scene} f={f} accent={lesson.accent} title={lesson.title} />
            <Caption text={seg.text} f={f} />
          </Sequence>
        );
        from += dur;
        return node;
      })}
    </AbsoluteFill>
  );
};
