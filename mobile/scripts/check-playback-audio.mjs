// Render the tutor's playback path offline and MEASURE it.
//
// Five builds were shipped to a phone on the strength of a hypothesis and a
// description of a sound. That was the wrong loop. This one runs the real
// decode, resample and scheduling code over synthesised chunks, reconstructs
// what the speaker would produce, and checks the two things a person can hear:
// is it the right LENGTH (wrong length is wrong pitch, "talking at 2x"), and is
// it CONTINUOUS at the chunk boundaries (discontinuities are the graininess).
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'ohmlet-playback-'));
const src = readFileSync(resolve(here, '../src/hooks/useLiveBridge.ts'), 'utf8');

// Only the pure audio maths is needed, and it must be taken from the real file
// rather than restated here, or this checks a copy that cannot drift wrong.
const wanted = ['decodeAgentPcm', 'resampleTo', 'AGENT_SAMPLE_RATE', 'ECHO_GATE_TAIL_S', 'micGatedForEcho'];
const picked = [];
for (const name of wanted) {
  const re = new RegExp(`export (?:function|const) ${name}\\b`);
  const at = src.search(re);
  assert.ok(at > 0, `${name} is gone from useLiveBridge.ts`);
  const rest = src.slice(at);
  const nextTop = rest.slice(1).search(/\nexport (?:function|const|interface|type) /);
  picked.push(nextTop >= 0 ? rest.slice(0, nextTop + 1) : rest.slice(0, 4000));
}
const js = ts.transpileModule(picked.join('\n\n'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const f = join(dir, 'audio.mjs');
writeFileSync(f, js);
const A = await import(`file://${f}`);

const problems = [];
const check = (name, fn) => { try { fn(); } catch (e) { problems.push(`${name}: ${e.message}`); } };

/** A 440Hz tone at the tutor's rate, as 16-bit LE PCM, in ~40ms chunks. */
function toneChunks(seconds, rate, chunkMs, freq = 440) {
  const total = Math.round(seconds * rate);
  const per = Math.round((chunkMs / 1000) * rate);
  const chunks = [];
  for (let start = 0; start < total; start += per) {
    const n = Math.min(per, total - start);
    const bytes = new Uint8Array(n * 2);
    for (let i = 0; i < n; i += 1) {
      const v = Math.sin(2 * Math.PI * freq * ((start + i) / rate));
      const s = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
      bytes[i * 2] = s & 0xff;
      bytes[i * 2 + 1] = (s >> 8) & 0xff;
    }
    chunks.push(bytes);
  }
  return chunks;
}

// ── Length: wrong length is wrong pitch ─────────────────────────────────────
for (const outRate of [24000, 44100, 48000]) {
  check(`one second of speech is one second at ${outRate}Hz out`, () => {
    const chunks = toneChunks(1.0, A.AGENT_SAMPLE_RATE, 40);
    let frames = 0;
    for (const c of chunks) frames += A.resampleTo(A.decodeAgentPcm(c), A.AGENT_SAMPLE_RATE, outRate).length;
    const seconds = frames / outRate;
    // A device running at 48000 reading a 24000 buffer at the context rate is
    // exactly the "talking at 2x speed" Faith heard: half a second for one.
    assert.ok(
      Math.abs(seconds - 1.0) < 0.01,
      `a one second utterance came out ${seconds.toFixed(3)}s, so it plays at ${(1 / seconds).toFixed(2)}x speed`,
    );
  });
}

// ── Continuity: a step at a boundary is the grain ───────────────────────────
for (const outRate of [44100, 48000]) {
  check(`chunk boundaries are continuous at ${outRate}Hz`, () => {
    const chunks = toneChunks(0.5, A.AGENT_SAMPLE_RATE, 40);
    const parts = chunks.map((c) => A.resampleTo(A.decodeAgentPcm(c), A.AGENT_SAMPLE_RATE, outRate));
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Float32Array(total);
    let at = 0;
    const seams = [];
    for (const p of parts) { if (at > 0) seams.push(at); out.set(p, at); at += p.length; }

    // The largest step anywhere, and the largest step at a seam. A seam that is
    // much worse than the signal's own slope is an audible click.
    let worstNormal = 0;
    for (let i = 1; i < out.length; i += 1) {
      if (seams.includes(i)) continue;
      worstNormal = Math.max(worstNormal, Math.abs(out[i] - out[i - 1]));
    }
    let worstSeam = 0;
    for (const s of seams) worstSeam = Math.max(worstSeam, Math.abs(out[s] - out[s - 1]));
    assert.ok(
      worstSeam <= worstNormal * 3 + 0.02,
      `a chunk boundary steps by ${worstSeam.toFixed(4)} where the waveform's own biggest step is `
      + `${worstNormal.toFixed(4)}. That discontinuity, ${seams.length} times in half a second, is the graininess.`,
    );
  });
}

// ── The decode itself ───────────────────────────────────────────────────────
check('16-bit little-endian decodes to the right values', () => {
  const b = new Uint8Array([0x00, 0x00, 0xff, 0x7f, 0x00, 0x80, 0x01, 0x00, 0xff, 0xff]);
  const got = Array.from(A.decodeAgentPcm(b)).map((v) => Math.round(v * 32768));
  assert.deepEqual(got, [0, 32767, -32768, 1, -1]);
});

check('resampling preserves the waveform, not just the sample count', () => {
  // A 440Hz tone upsampled must still be 440Hz. Count zero crossings.
  const chunk = toneChunks(0.25, A.AGENT_SAMPLE_RATE, 250)[0];
  const at48 = A.resampleTo(A.decodeAgentPcm(chunk), A.AGENT_SAMPLE_RATE, 48000);
  let crossings = 0;
  for (let i = 1; i < at48.length; i += 1) if ((at48[i - 1] < 0) !== (at48[i] < 0)) crossings += 1;
  const hz = crossings / 2 / (at48.length / 48000);
  assert.ok(Math.abs(hz - 440) < 12, `a 440Hz tone came out at ${hz.toFixed(0)}Hz after resampling`);
});

if (problems.length) {
  console.error('Playback problems:\n');
  problems.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}
console.log('OK: the tutor plays at the right speed at 24k, 44.1k and 48k out, chunk boundaries are continuous, and a 440Hz tone survives the resample.');
