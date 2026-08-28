// Narration, one WAV per segment.
//
// Per segment rather than one long take, for a reason that decides whether the
// film works: the picture is laid out FROM the measured audio lengths. Synthesise
// the whole script in one go and you would have to guess where each sentence
// falls, and a guess that is 200ms out at the start is seconds out by the end.
// One file per segment means narration and picture cannot drift.
//
// WAV rather than MP3 on purpose too. MP3 frames are padded, so its duration is
// approximate; a LINEAR16 header gives an exact sample count, and exact is the
// whole point of measuring.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allLessons, ROOT } from './lessons.mjs';

const PROJECT = 'ohmlet-app';
const VOICE = 'en-GB-Chirp3-HD-Aoede';
const RATE = 24000;

const LESSONS = await allLessons();

const token = execFileSync('gcloud', ['auth', 'application-default', 'print-access-token'])
  .toString().trim();

async function synth(text) {
  const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-goog-user-project': PROJECT,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'en-GB', name: VOICE },
      audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: RATE },
    }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const { audioContent } = await res.json();
  return Buffer.from(audioContent, 'base64');
}

/** Exact length from the WAV header's data chunk, not from a decoder's estimate. */
function wavSeconds(buf) {
  let off = 12;
  while (off < buf.length - 8) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'data') return size / (RATE * 2);
    off += 8 + size + (size % 2);
  }
  throw new Error('no data chunk in WAV');
}

for (const lesson of LESSONS) {
  const dir = join(ROOT, 'public/audio', lesson.id);
  mkdirSync(dir, { recursive: true });
  const timings = [];
  let total = 0;

  for (let i = 0; i < lesson.segments.length; i++) {
    const file = `${String(i).padStart(2, '0')}.wav`;
    const path = join(dir, file);
    if (!existsSync(path)) {
      const buf = await synth(lesson.segments[i].text);
      writeFileSync(path, buf);
    }
    const seconds = wavSeconds(readFileSync(path));
    timings.push({ index: i, seconds, file: `audio/${lesson.id}/${file}` });
    total += seconds;
    process.stdout.write(`\r  ${lesson.id}: ${i + 1}/${lesson.segments.length}   `);
  }

  writeFileSync(join(ROOT, 'public/audio', `${lesson.id}.timings.json`), JSON.stringify(timings, null, 2));
  // The film is longer than the narration by one beat per segment, and it is the
  // FILM that has to stay under five minutes, so report that number and not the
  // flattering one.
  const film = total + lesson.segments.length * (11 / 30);
  const mins = Math.floor(film / 60), secs = Math.round(film % 60);
  const flag = film > 300 ? '  ** OVER 5 MINUTES, CUT IT **' : '';
  console.log(`\r  ${lesson.id}: ${lesson.segments.length} segments, ${mins}m ${String(secs).padStart(2, '0')}s of film${flag}   `);
}
