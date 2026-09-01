// WebVTT sidecars.
//
// The films burn captions in as well, because most of these get watched on a
// phone with the sound off and the words have to be on the screen either way.
// This is the other half: a real track a player can style, translate, or feed to
// a screen reader, and something a search index can read.
//
// Cues come from the same measured timings the picture is laid out from, so the
// subtitle and the shot change on the same frame by construction.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { allLessons, ROOT } from './lessons.mjs';

const GAP = 11 / 30;

const stamp = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sec.toFixed(3).padStart(6, '0')}`;
};

mkdirSync(join(ROOT, 'out'), { recursive: true });
for (const lesson of await allLessons()) {
  // A script can exist before its narration does, mid-batch. Skip it rather
  // than failing the whole run: the cues cannot be written until the audio has
  // been measured anyway.
  const tPath = join(ROOT, `src/lesson-film/timings/${lesson.id}.json`);
  if (!existsSync(tPath)) {
    console.log(`  ${lesson.id}: no timings yet, skipped`);
    continue;
  }
  const timings = JSON.parse(readFileSync(tPath, 'utf8'));
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
