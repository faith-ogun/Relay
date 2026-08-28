// WebVTT sidecars.
//
// The films burn captions in as well, because most of these get watched on a
// phone with the sound off and the words have to be on the screen either way.
// This is the other half: a real track a player can style, translate, or feed to
// a screen reader, and something a search index can read.
//
// Cues come from the same measured timings the picture is laid out from, so the
// subtitle and the shot change on the same frame by construction.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GAP = 11 / 30;

const stamp = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sec.toFixed(3).padStart(6, '0')}`;
};

const { closedLoop } = await import(join(ROOT, 'src/lesson-film/lessons/closed-loop.ts'));
const { timeConstant } = await import(join(ROOT, 'src/lesson-film/lessons/time-constant.ts'));
const { drivingLoads } = await import(join(ROOT, 'src/lesson-film/lessons/driving-loads.ts'));

mkdirSync(join(ROOT, 'out'), { recursive: true });
for (const lesson of [closedLoop, timeConstant, drivingLoads]) {
  const timings = JSON.parse(readFileSync(join(ROOT, `src/lesson-film/timings/${lesson.id}.json`), 'utf8'));
  const lines = ['WEBVTT', ''];
  let t = 0;
  lesson.segments.forEach((seg, i) => {
    const dur = timings[i].seconds + GAP;
    // The cue ends when the narration does, not when the shot does: leaving it
    // up through the gap makes a finished sentence look like it is still being
    // spoken.
    lines.push(`${i + 1}`, `${stamp(t)} --> ${stamp(t + timings[i].seconds)}`, seg.text, '');
    t += dur;
  });
  writeFileSync(join(ROOT, `out/${lesson.id}.vtt`), lines.join('\n'));
  console.log(`  ${lesson.id}.vtt  ${lesson.segments.length} cues, ${Math.floor(t / 60)}m ${Math.round(t % 60)}s`);
}
