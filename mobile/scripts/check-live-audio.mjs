// The audio wire format of the live session, driven through the real encoder.
//
// This exists because `micSupported` shipped as a hardcoded `false` and the
// learner could not speak to the tutor at all. Turning it on is only half the
// job: nothing on the wire declares what the bytes are. The bridge wraps every
// binary frame as `types.Blob(mime_type="audio/pcm;rate=16000")`
// (backend/live-bridge/app/main.py), so a client that sends 48kHz frames, or
// stereo frames, or big-endian samples, produces no error anywhere. It produces
// a tutor that hears a chipmunk and answers a question nobody asked, and that is
// invisible in code review.
//
// So every assertion below runs synthetic audio through the encoder the hook
// actually calls and measures what comes out, rather than comparing constants to
// other constants. The frequency assertions are the ones that matter: a 440Hz
// tone has to still be 440Hz after the trip, whatever rate the device recorded
// it at.
//
// Each family of assertion is also run against the broken implementation it
// exists to catch, through `mustReject`: the chipmunk that ships every frame at
// whatever rate it arrived, the big-endian encoder, interleaved stereo sent as
// mono, and playback that starts every chunk at once. Each MUST be rejected. A
// check that cannot fail on the bug it was written for is decoration.
//
//   node scripts/check-live-audio.mjs

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ts = require('typescript');

// ── Load the real modules ───────────────────────────────────────────────────
//
// The encoding, the scheduling and the microphone gate are pure and exported, so
// they can be driven directly. React, react-native, react-native-audio-api and
// the app's own firebase service are stubbed: nothing below constructs the hook,
// so none of them is ever called. `services/pcm` is loaded for real, because the
// base64 decode is part of the path being tested.

function transpile(url) {
  const src = readFileSync(url, 'utf8');
  return ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
}

function evaluate(js, stub) {
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', js)(stub, mod, mod.exports);
  return mod.exports;
}

const pcm = evaluate(transpile(new URL('../src/services/pcm.ts', import.meta.url)), (id) => {
  throw new Error(`pcm.ts imported something the harness does not stub: ${id}`);
});

/** Load the hook as it would resolve on one platform. */
function loadHook(platformOS) {
  const js = transpile(new URL('../src/hooks/useLiveBridge.ts', import.meta.url));
  const stub = (id) => {
    if (id === 'react') {
      const noop = () => {};
      return { useCallback: noop, useEffect: noop, useRef: noop, useState: noop };
    }
    if (id === 'react-native') {
      return {
        Platform: { OS: platformOS },
        AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
      };
    }
    if (id === 'react-native-audio-api') {
      const unused = () => { throw new Error('the harness never runs the hook body'); };
      return { AudioContext: unused, AudioRecorder: unused, AudioManager: {} };
    }
    if (id === '../services/firebase') return { getIdToken: async () => 'test-token' };
    if (id === '../services/pcm') return pcm;
    throw new Error(`useLiveBridge.ts imported something the harness does not stub: ${id}`);
  };
  return evaluate(js, stub);
}

const hook = loadHook('ios');
const {
  MIC_SAMPLE_RATE, MIC_CHANNEL_COUNT, MIC_BIT_DEPTH, MIC_MIME_TYPE,
  MIC_FRAME_MS, MIC_FRAME_SAMPLES, MIC_RECORDER_OPTIONS,
  AGENT_SAMPLE_RATE, PLAYBACK_LEAD_S, MIC_START_TIMEOUT_MS,
  encodeMicFrame, decodeAgentPcm, mixDownToMono, nextChunkStart,
  micShouldCapture, micIntentAfterBackground, toMicPermission,
  reduceLiveEvent, freshLiveEventState,
  micSupported,
  ECHO_GATE_TAIL_S, micGatedForEcho,
} = hook;

const problems = [];
function check(name, fn) {
  try {
    fn();
  } catch (err) {
    problems.push(`${name}: ${err.message}`);
  }
}

/** Assert that a deliberately broken implementation is REJECTED. */
function mustReject(name, fn) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) problems.push(`${name}: the broken implementation passed. This check does not bite.`);
}

// ── Synthetic input ─────────────────────────────────────────────────────────

/** `seconds` of a sine at `hz`, sampled at `rate`. */
function tone(hz, rate, seconds) {
  const out = new Float32Array(Math.round(rate * seconds));
  for (let i = 0; i < out.length; i += 1) out[i] = Math.sin((2 * Math.PI * hz * i) / rate) * 0.8;
  return out;
}

/**
 * Frequency of a decoded frame, from its zero crossings. Crude on purpose: it
 * measures the property that actually breaks (speed), and it cannot be satisfied
 * by an encoder that merely relabels the rate.
 */
function estimateHz(samples, rate) {
  let crossings = 0;
  for (let i = 1; i < samples.length; i += 1) {
    if ((samples[i - 1] < 0 && samples[i] >= 0) || (samples[i - 1] >= 0 && samples[i] < 0)) crossings += 1;
  }
  const seconds = samples.length / rate;
  return crossings / (2 * seconds);
}

const bytesOf = (arrayBuffer) => new Uint8Array(arrayBuffer);
/** What the tutor's side would make of what we sent: bytes back to samples. */
const asHeard = (arrayBuffer) => decodeAgentPcm(bytesOf(arrayBuffer));

// ── Broken encoders, to prove the assertions bite ───────────────────────────

/** Ships the frame at whatever rate it arrived, labelled 16kHz. The chipmunk. */
function chipmunk(frames) {
  const out = new ArrayBuffer(frames.length * 2);
  const view = new DataView(out);
  for (let i = 0; i < frames.length; i += 1) view.setInt16(i * 2, Math.round(frames[i] * 32767), true);
  return out;
}

/** Correct rate, wrong byte order. Sounds like white noise. */
function bigEndian(frames, rate) {
  const correct = encodeMicFrame(frames, rate);
  const src = new DataView(correct);
  const out = new ArrayBuffer(correct.byteLength);
  const dst = new DataView(out);
  for (let i = 0; i < correct.byteLength; i += 2) dst.setInt16(i, src.getInt16(i, true), false);
  return out;
}

// ── 1. The wire format ──────────────────────────────────────────────────────

check('sample rate is what the bridge assumes', () => {
  assert.equal(MIC_SAMPLE_RATE, 16000);
  const declared = /audio\/pcm;rate=(\d+)/.exec(MIC_MIME_TYPE);
  assert.ok(declared, `MIC_MIME_TYPE is not a pcm mime type: ${MIC_MIME_TYPE}`);
  assert.equal(Number(declared[1]), MIC_SAMPLE_RATE);
});

check('the bridge still declares the same rate', () => {
  // The one number in this file that lives in another language, in another
  // service, with nothing but this line joining them.
  const server = readFileSync(new URL('../../backend/live-bridge/app/main.py', import.meta.url), 'utf8');
  const declared = /audio\/pcm;rate=(\d+)/.exec(server);
  assert.ok(declared, 'backend/live-bridge/app/main.py no longer declares a pcm rate for binary frames.');
  assert.equal(
    Number(declared[1]), MIC_SAMPLE_RATE,
    `the bridge tells Gemini ${declared[1]}Hz and the phone sends ${MIC_SAMPLE_RATE}Hz.`,
  );
});

check('mono, 16-bit, and one frame is one hundred milliseconds', () => {
  assert.equal(MIC_CHANNEL_COUNT, 1);
  assert.equal(MIC_BIT_DEPTH, 16);
  assert.equal(MIC_FRAME_MS, 100);
  assert.equal(MIC_FRAME_SAMPLES, (MIC_SAMPLE_RATE * MIC_FRAME_MS) / 1000);

  // The framing, measured rather than asserted: one frame's worth of 16kHz
  // audio has to come out as exactly one frame's worth of bytes.
  const frame = tone(440, MIC_SAMPLE_RATE, MIC_FRAME_MS / 1000);
  assert.equal(frame.length, MIC_FRAME_SAMPLES);
  const encoded = encodeMicFrame(frame, MIC_SAMPLE_RATE);
  assert.equal(encoded.byteLength, MIC_FRAME_SAMPLES * (MIC_BIT_DEPTH / 8));

  // Which is the whole wire format in one line: bytes per second.
  const bytesPerSecond = (encoded.byteLength * 1000) / MIC_FRAME_MS;
  assert.equal(bytesPerSecond, MIC_SAMPLE_RATE * MIC_CHANNEL_COUNT * (MIC_BIT_DEPTH / 8));
});

check('the recorder is asked for exactly that format', () => {
  // The object the hook hands to AudioRecorder.onAudioReady, not a copy of it.
  assert.deepEqual({ ...MIC_RECORDER_OPTIONS }, {
    sampleRate: MIC_SAMPLE_RATE,
    bufferLength: MIC_FRAME_SAMPLES,
    channelCount: MIC_CHANNEL_COUNT,
  });
});

check('samples are little-endian signed 16-bit', () => {
  // 0.5 -> 16384 -> 0x4000 -> low byte first.
  const bytes = bytesOf(encodeMicFrame(Float32Array.from([0.5]), MIC_SAMPLE_RATE));
  assert.deepEqual(Array.from(bytes), [0x00, 0x40]);

  // A negative sample keeps its sign bit in the HIGH byte, which is the second
  // one on the wire. Read the other way round it is a large positive number.
  const negative = bytesOf(encodeMicFrame(Float32Array.from([-0.5]), MIC_SAMPLE_RATE));
  assert.equal(negative[1] & 0x80, 0x80, `the sign bit is not in the second byte: ${Array.from(negative)}`);
  const value = new DataView(negative.buffer, negative.byteOffset).getInt16(0, true);
  assert.ok(Math.abs(value - -16384) <= 1, `-0.5 encoded as ${value}, expected about -16384.`);
});

mustReject('little-endian assertion', () => {
  const bytes = bytesOf(bigEndian(Float32Array.from([0.5]), MIC_SAMPLE_RATE));
  assert.deepEqual(Array.from(bytes), [0x00, 0x40]);
});

check('samples past full scale clamp instead of wrapping', () => {
  // A wrapped sample is not a loud sample, it is the opposite sample: the
  // loudest moment of a sentence turns into a crack.
  const heard = asHeard(encodeMicFrame(Float32Array.from([2, -2, 1, -1]), MIC_SAMPLE_RATE));
  assert.ok(heard[0] > 0.99, `positive overload wrapped: ${heard[0]}`);
  assert.ok(heard[1] < -0.99, `negative overload wrapped: ${heard[1]}`);
  assert.ok(heard[2] > 0.99 && heard[3] < -0.99);
});

// ── 2. The rate, measured ───────────────────────────────────────────────────
//
// The assertion the whole file is for. One second of a 440Hz tone, recorded at
// whatever the device gives us, has to arrive as one second of a 440Hz tone at
// 16kHz. Anything else and the tutor hears the wrong voice at the wrong speed.

for (const deviceRate of [16000, 44100, 48000, 8000]) {
  check(`a 440Hz second recorded at ${deviceRate}Hz stays a 440Hz second`, () => {
    const encoded = encodeMicFrame(tone(440, deviceRate, 1), deviceRate);
    const heard = asHeard(encoded);

    // Duration: one second at 16kHz is 16000 samples, whatever came in.
    assert.equal(
      heard.length, MIC_SAMPLE_RATE,
      `one second at ${deviceRate}Hz became ${(heard.length / MIC_SAMPLE_RATE).toFixed(3)}s of wire audio.`,
    );

    const hz = estimateHz(heard, MIC_SAMPLE_RATE);
    assert.ok(
      Math.abs(hz - 440) < 9,
      `440Hz came out at ${hz.toFixed(1)}Hz, a factor of ${(hz / 440).toFixed(2)}.`,
    );
  });
}

mustReject('the chipmunk assertion (duration)', () => {
  const heard = asHeard(chipmunk(tone(440, 48000, 1)));
  assert.equal(heard.length, MIC_SAMPLE_RATE);
});

mustReject('the chipmunk assertion (pitch)', () => {
  const heard = asHeard(chipmunk(tone(440, 48000, 1)));
  const hz = estimateHz(heard, MIC_SAMPLE_RATE);
  assert.ok(Math.abs(hz - 440) < 9, `440Hz came out at ${hz.toFixed(1)}Hz.`);
});

// ── 3. Channels ─────────────────────────────────────────────────────────────

check('two channels fold to one rather than doubling the samples', () => {
  const left = tone(440, MIC_SAMPLE_RATE, 0.5);
  const right = tone(440, MIC_SAMPLE_RATE, 0.5);
  const mono = mixDownToMono([left, right]);
  assert.equal(mono.length, left.length);

  const heard = asHeard(encodeMicFrame(mono, MIC_SAMPLE_RATE));
  assert.equal(heard.length, MIC_SAMPLE_RATE * 0.5);
  assert.ok(Math.abs(estimateHz(heard, MIC_SAMPLE_RATE) - 440) < 9);
});

check('mixing averages rather than sums, so a loud stereo frame does not clip', () => {
  const mono = mixDownToMono([Float32Array.from([0.8, -0.8]), Float32Array.from([0.8, -0.8])]);
  assert.equal(mono.length, 2);
  assert.ok(Math.abs(mono[0] - 0.8) < 1e-6, `two 0.8 channels mixed to ${mono[0]}, which would clip.`);
  assert.ok(Math.abs(mono[1] - -0.8) < 1e-6, `two -0.8 channels mixed to ${mono[1]}, which would clip.`);
});

mustReject('the stereo assertion', () => {
  // Interleaving stereo instead of mixing it: twice the samples, double speed.
  const left = tone(440, MIC_SAMPLE_RATE, 0.5);
  const interleaved = new Float32Array(left.length * 2);
  for (let i = 0; i < left.length; i += 1) { interleaved[i * 2] = left[i]; interleaved[i * 2 + 1] = left[i]; }
  const heard = asHeard(encodeMicFrame(interleaved, MIC_SAMPLE_RATE));
  assert.equal(heard.length, MIC_SAMPLE_RATE * 0.5);
});

// ── 4. The tutor's voice, coming back ───────────────────────────────────────

check('the tutor is decoded at the rate the Live API speaks at', () => {
  assert.equal(AGENT_SAMPLE_RATE, 24000);
  // Round trip a tone the model might have sent: encode it as the API does
  // (16-bit little-endian at 24kHz) and check the decoder hands back the tone.
  const source = tone(300, AGENT_SAMPLE_RATE, 0.5);
  const raw = new Uint8Array(source.length * 2);
  const view = new DataView(raw.buffer);
  for (let i = 0; i < source.length; i += 1) view.setInt16(i * 2, Math.round(source[i] * 32767), true);

  const decoded = decodeAgentPcm(raw);
  assert.equal(decoded.length, source.length);
  assert.ok(Math.abs(estimateHz(decoded, AGENT_SAMPLE_RATE) - 300) < 6);
  for (let i = 0; i < decoded.length; i += 1) {
    assert.ok(Math.abs(decoded[i] - source[i]) < 1 / 1000, `sample ${i} drifted: ${decoded[i]} vs ${source[i]}`);
  }
});

check('a truncated chunk drops the half sample rather than reading it whole', () => {
  const decoded = decodeAgentPcm(Uint8Array.from([0x00, 0x40, 0x11]));
  assert.equal(decoded.length, 1);
  assert.ok(Math.abs(decoded[0] - 0.5) < 1 / 1000);
});

check('a base64 chunk off the wire decodes to the same bytes', () => {
  const bytes = Uint8Array.from([0x00, 0x40, 0x00, 0xc0]);
  const decoded = decodeAgentPcm(pcm.base64ToBytes(pcm.bytesToBase64(bytes)));
  assert.equal(decoded.length, 2);
  assert.ok(decoded[0] > 0.49 && decoded[0] < 0.51);
  assert.ok(decoded[1] < -0.49 && decoded[1] > -0.51);
});

// ── 5. Playback scheduling ──────────────────────────────────────────────────
//
// Chunks arrive in bursts and have to be laid end to end against the audio
// clock. A gap is a click; an overlap is two voices at once.

check('consecutive chunks abut exactly', () => {
  const chunkSeconds = 0.2;
  let clock = 0;              // the audio context clock
  let queuedUntil = 0;
  const starts = [];
  for (let i = 0; i < 8; i += 1) {
    clock += 0.03;            // chunks arrive faster than they play
    const startAt = nextChunkStart(clock, queuedUntil);
    starts.push({ startAt, endsAt: startAt + chunkSeconds });
    queuedUntil = startAt + chunkSeconds;
  }
  assert.ok(starts[0].startAt >= 0.03 + PLAYBACK_LEAD_S - 1e-9, 'the first chunk got no cushion.');
  for (let i = 1; i < starts.length; i += 1) {
    assert.equal(
      starts[i].startAt, starts[i - 1].endsAt,
      `chunk ${i} starts at ${starts[i].startAt} but chunk ${i - 1} ends at ${starts[i - 1].endsAt}.`,
    );
  }
});

check('a chunk is never scheduled in the past', () => {
  // The queue drained while nothing was arriving. Scheduling at the clock's
  // current instant means the audio thread reaches it late and clips the
  // opening consonant, so it gets the lead instead.
  assert.ok(nextChunkStart(12.5, 0) > 12.5);
  assert.ok(nextChunkStart(12.5, 11.0) > 12.5);
  // Still playing: pick up exactly where the last chunk ends.
  assert.equal(nextChunkStart(12.5, 13.2), 13.2);
});

mustReject('the scheduling assertion', () => {
  // What "just play it now" does: every chunk starts at the current instant, so
  // they all pile on top of each other.
  const naive = (now) => now;
  let clock = 0;
  let queuedUntil = 0;
  const starts = [];
  for (let i = 0; i < 4; i += 1) {
    clock += 0.03;
    const startAt = naive(clock, queuedUntil);
    starts.push({ startAt, endsAt: startAt + 0.2 });
    queuedUntil = startAt + 0.2;
  }
  for (let i = 1; i < starts.length; i += 1) assert.equal(starts[i].startAt, starts[i - 1].endsAt);
});

// ── 6. Barge-in ─────────────────────────────────────────────────────────────

check('an interruption stops the tutor', () => {
  const { actions } = reduceLiveEvent(freshLiveEventState(), { interrupted: true, partial: false });
  assert.ok(
    actions.some((a) => a.kind === 'interrupt'),
    'the server said the learner talked over the tutor and nothing stopped it.',
  );
});

check('an interruption is flushed before any audio in the same event', () => {
  const { actions } = reduceLiveEvent(freshLiveEventState(), {
    interrupted: true,
    content: { role: 'model', parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'AAA=' } }] },
  });
  const interrupt = actions.findIndex((a) => a.kind === 'interrupt');
  const audio = actions.findIndex((a) => a.kind === 'audio');
  assert.ok(interrupt >= 0 && audio >= 0, 'expected both an interrupt and an audio action.');
  assert.ok(interrupt < audio, 'the flush would have thrown away the chunk it was meant to precede.');
});

check('an ordinary event does not stop the tutor', () => {
  const { actions } = reduceLiveEvent(freshLiveEventState(), {
    partial: false,
    outputTranscription: { text: 'Put the long leg in row twelve.' },
  });
  assert.ok(!actions.some((a) => a.kind === 'interrupt'));
});

// ── 7. The microphone gate ──────────────────────────────────────────────────

const openGate = {
  supported: true,
  intent: true,
  connected: true,
  foreground: true,
  permission: 'granted',
  interrupted: false,
  childSafe: false,
  childSafeResolved: true,
};

check('the microphone opens when everything is in place', () => {
  assert.equal(micShouldCapture(openGate), true);
});

check('nothing opens a microphone before the age question is answered', () => {
  // The compliance rule, and the reason it is first: while this is false nobody
  // knows whether a minor is holding the phone.
  assert.equal(micShouldCapture({ ...openGate, childSafeResolved: false }), false);
  assert.equal(micShouldCapture({ ...openGate, childSafe: true, childSafeResolved: false }), false);
});

check('a minor coming back from the background has to press again', () => {
  assert.equal(micIntentAfterBackground(true, true), false);
  assert.equal(micIntentAfterBackground(true, false), true);
  assert.equal(micIntentAfterBackground(false, false), false);
});

check('every other way the microphone has to shut', () => {
  assert.equal(micShouldCapture({ ...openGate, supported: false }), false, 'unsupported platform');
  assert.equal(micShouldCapture({ ...openGate, intent: false }), false, 'learner turned it off');
  assert.equal(micShouldCapture({ ...openGate, connected: false }), false, 'socket down');
  assert.equal(micShouldCapture({ ...openGate, foreground: false }), false, 'app backgrounded');
  assert.equal(micShouldCapture({ ...openGate, permission: 'denied' }), false, 'permission refused');
  assert.equal(micShouldCapture({ ...openGate, permission: 'undetermined' }), false, 'never asked');
  assert.equal(micShouldCapture({ ...openGate, interrupted: true }), false, 'phone call');
});

check('permission words map to the three states the gate reasons about', () => {
  assert.equal(toMicPermission('Granted'), 'granted');
  assert.equal(toMicPermission('Denied'), 'denied');
  assert.equal(toMicPermission('Undetermined'), 'undetermined');
  assert.equal(toMicPermission('anything else'), 'undetermined');
});

// ── 8. micSupported says what is true, per platform ─────────────────────────

check('micSupported is true exactly where capture exists', () => {
  assert.equal(micSupported, true, 'iOS can capture and this build says it cannot.');
  assert.equal(loadHook('android').micSupported, true, 'Android can capture and this build says it cannot.');
  // react-native-audio-api's web entry point (api.web.ts) exports the Web Audio
  // graph and no AudioRecorder, so there is nothing to capture with there.
  // Claiming otherwise would put a dead microphone button on the screen.
  assert.equal(loadHook('web').micSupported, false, 'the web target has no recorder and claims one.');
});

// ── 9. What the live screen does with all of it ─────────────────────────────
//
// Source level, and it says so: it cannot prove the screen behaves, only that
// the one path which opens a microphone without a press is still fenced. The
// behaviour itself is `micShouldCapture` above.

const screen = readFileSync(new URL('../src/app/live.tsx', import.meta.url), 'utf8');

check('only one path opens the microphone without a press, and a minor is not on it', () => {
  const calls = [...screen.matchAll(/live\.enableMic\(/g)];
  assert.equal(
    calls.length, 1,
    `${calls.length} places arm the microphone without the learner pressing anything. There should be one: the session start.`,
  );
  const guard = screen.slice(Math.max(0, calls[0].index - 500), calls[0].index);
  assert.match(guard, /childSafeResolved/, 'the session start arms the mic before the age question is answered.');
  assert.match(guard, /!childSafe/, "the session start arms a minor's microphone for them.");
  assert.match(guard, /live\.micSupported/, 'the session start arms a microphone on a platform that has none.');
});

check('the learner has a control, and only where there is a microphone behind it', () => {
  assert.match(screen, /<MicControl/, 'the live session has no microphone control.');
  assert.match(
    screen, /live\.micSupported && \(\s*<MicControl/,
    'the microphone control is drawn on platforms that cannot capture, which is a dead button.',
  );
  assert.match(screen, /live\.toggleMic\(\)/, 'the control does not toggle anything.');
});

check('the preview-build notice is gone', () => {
  // It said voice was not on in this build. It is now, and a notice that
  // contradicts the screen it sits on is worse than no notice.
  assert.ok(
    !/preview build/i.test(screen),
    'the "voice isn\'t on in this preview build" notice is still on the pre-flight.',
  );
  assert.ok(!/Expo Go/.test(screen), 'the pre-flight still blames Expo Go for the microphone.');
});

// ── 10. Opening the microphone, and knowing whether it opened ───────────────
//
// Source level, like section 9, and for the same reason: `startCapture` touches
// the recorder and the audio session, neither of which exists here. What can be
// asserted is that the two ways this path lies to the learner are still fenced.

const hookSource = readFileSync(new URL('../src/hooks/useLiveBridge.ts', import.meta.url), 'utf8');
const captureFrom = hookSource.indexOf('const startCapture = useCallback');
const captureTo = hookSource.indexOf('const enableMic = useCallback');
const capture = hookSource.slice(captureFrom, captureTo);

check('startCapture is where this check thinks it is', () => {
  assert.ok(captureFrom >= 0 && captureTo > captureFrom, 'startCapture has moved or been renamed.');
});

check('an attempt overtaken mid-await does not open the microphone anyway', () => {
  // startCapture awaits the audio session. Everything the gate reads can change
  // inside that await, and the gate effect has already run its stopCapture by
  // the time the attempt resumes — so whatever it re-reads there IS the gate.
  // Re-reading the learner's intent alone was the hole: intent survives the app
  // going to the background for everyone but a minor, so an intent-only guard
  // opens a microphone behind the lock screen and nothing runs afterwards to
  // shut it.
  assert.ok(/await /.test(capture), 'startCapture no longer awaits anything; this check needs revisiting.');
  assert.match(
    capture, /if \(!gateOpenRef\.current/,
    'the post-await guard does not re-read the whole gate.',
  );
  assert.ok(
    !/if \(!micIntentRef\.current \|\|/.test(capture),
    'the post-await guard reads intent alone, so backgrounding or a phone call during the await opens the microphone anyway.',
  );
});

check('the microphone is not called open until a frame proves it is', () => {
  // react-native-audio-api 0.12.2 returns {status:'success'} from start()
  // whatever the native recorder did, whenever file output is off (which is
  // always, here). Believing it paints a pulsing "listening" over a dead
  // microphone for the whole session, with no error anywhere.
  const started = capture.indexOf('recorder.start()');
  const reported = capture.indexOf('setMicOn(true)');
  assert.ok(started >= 0, 'startCapture no longer starts a recorder.');
  assert.ok(reported >= 0, 'nothing ever reports the microphone as open.');
  assert.ok(
    reported < started,
    'setMicOn(true) sits after recorder.start(), which trusts a status the library hardcodes to success.',
  );
  assert.ok(
    capture.indexOf('MIC_START_TIMEOUT_MS') > started,
    'nothing checks that the microphone actually produced audio, so a failed start looks identical to a working one.',
  );
  assert.ok(
    MIC_START_TIMEOUT_MS > MIC_FRAME_MS * 2 && MIC_START_TIMEOUT_MS <= 5000,
    `the first-frame deadline is ${MIC_START_TIMEOUT_MS}ms, which is not a sane window for a ${MIC_FRAME_MS}ms frame.`,
  );
});

// ── Half duplex, because there is no echo canceller ─────────────────────────
//
// react-native-audio-api records through miniaudio, which hardcodes
// kAudioUnitSubType_RemoteIO. Apple's canceller lives in
// kAudioUnitSubType_VoiceProcessingIO and no SessionOptions value reaches it,
// so the loudspeaker goes straight back into the microphone. On a real device
// that made the model hear itself, cut its own sentence off, and put its own
// words on the learner's side of the transcript.
check('the microphone is shut exactly while the tutor can be heard', () => {
  const T = ECHO_GATE_TAIL_S;
  assert.ok(T > 0.05 && T < 1, `echo tail of ${T}s is not a plausible room tail`);
  assert.equal(micGatedForEcho(10, 9.5), true, 'open while the tutor was still talking');
  assert.equal(micGatedForEcho(10, 10.1), true, 'opened before the speaker had drained');
  assert.equal(micGatedForEcho(10, 10 + T - 0.01), true, 'opened inside the tail');
  assert.equal(micGatedForEcho(10, 10 + T + 0.01), false, 'never reopened, so the learner cannot speak');
  assert.equal(micGatedForEcho(0, 5), false, 'shut with nothing queued to echo');
});

check('the send path actually consults the gate', () => {
  const hook = readFileSync(new URL('../src/hooks/useLiveBridge.ts', import.meta.url), 'utf8');
  const from = hook.indexOf('onAudioReady(');
  assert.ok(from > 0, 'onAudioReady is gone, so this check can no longer find the send path');
  const send = hook.slice(from, hook.indexOf('ws.send(pcm)', from));
  assert.ok(/micGatedForEcho\(/.test(send),
    'frames captured while the tutor is speaking are sent again, so it talks into its own microphone');
});

check('the learner can still interrupt, by pressing rather than talking over it', () => {
  const hook = readFileSync(new URL('../src/hooks/useLiveBridge.ts', import.meta.url), 'utf8');
  assert.ok(/interrupt[,:]/.test(hook), 'the hook no longer exposes a deliberate interrupt');
  assert.ok(/live\.interrupt\(\)/.test(screen),
    'the microphone control no longer interrupts, so with a half-duplex mic a learner cannot cut in at all');
});


check('the audio session is not a telephony mode', () => {
  const hook = readFileSync(new URL('../src/hooks/useLiveBridge.ts', import.meta.url), 'utf8');
  const live = hook.slice(hook.indexOf('LIVE_AUDIO_SESSION'), hook.indexOf('IDLE_AUDIO_SESSION'));
  const mode = live.match(/iosMode:\s*'([a-zA-Z]+)'/)?.[1];
  assert.ok(mode, 'LIVE_AUDIO_SESSION no longer names an iosMode');
  // These engage the system's voice processing and pull the session to a
  // voice-optimised rate. The tutor arrives at 24kHz and gets squeezed into a
  // handset's band: intelligible, and unpleasant. videoChat was set here for the
  // echo cancellation that comes with voice processing, which never existed on
  // this capture path (miniaudio uses RemoteIO, not VoiceProcessingIO), so it
  // cost fidelity and bought nothing. Echo is handled by micGatedForEcho.
  const TELEPHONY = ['voiceChat', 'videoChat', 'gameChat', 'voicePrompt'];
  assert.ok(
    !TELEPHONY.includes(mode),
    `the live session is in '${mode}', a telephony mode: the tutor will sound like a phone call, `
    + 'and it does not buy echo cancellation on this recorder.',
  );
});

check('chunks abut on the sample grid, with no float to round', () => {
  const hook = readFileSync(new URL('../src/hooks/useLiveBridge.ts', import.meta.url), 'utf8');
  const play = hook.slice(hook.indexOf('const playAudio'), hook.indexOf('const closePlayback'));

  // Gemini sends a chunk about every 40ms. Scheduling each one at an accumulated
  // FLOAT time means the engine rounds every boundary independently, so
  // consecutive chunks overlap or gap by a sample around 25 times a second. One
  // sample is a click; 25 a second is the buzz under the voice.
  assert.ok(/queuedFramesRef/.test(play), 'playback no longer counts whole samples, so boundaries round again');
  // Advanced by the RESAMPLED length, which is the number of frames actually
  // handed to the output. Using the incoming 24kHz count here would put the mark
  // in the wrong units and space the chunks wrongly all over again.
  assert.ok(
    /queuedFramesRef\.current = startFrames \+ voice\.length/.test(play),
    'the sample mark is not advanced by the RESAMPLED chunk length, so chunk N will not start where N-1 ended',
  );
  assert.ok(
    !/startFrames \+ samples\.length/.test(play),
    'the mark counts incoming 24kHz samples while the clock runs at the output rate',
  );
  assert.ok(
    !/startAt \+ buffer\.duration/.test(play),
    'the float accumulation is back',
  );

  // Prove the arithmetic: a hundred chunks of an awkward length must land
  // exactly end to end, with zero drift.
  const rate = AGENT_SAMPLE_RATE;
  let frames = 1000;
  const CHUNK = 967;                     // deliberately not a round number of ms
  for (let i = 0; i < 100; i += 1) {
    const startFrames = frames;          // always ahead of the clock in this test
    const startSeconds = startFrames / rate;
    // What the engine will convert that back to.
    assert.equal(Math.round(startSeconds * rate), startFrames, `boundary ${i} does not land on a sample`);
    frames = startFrames + CHUNK;
  }
  assert.equal(frames, 1000 + 100 * CHUNK, 'a hundred chunks drifted');
});

check('the cushion is big enough to ride out arrival jitter', () => {
  // 40ms chunks consumed as fast as they arrive means any hiccup underruns, and
  // an underrun inserts a whole lead of silence. The cushion has to be worth
  // several chunks without being a noticeable delay before the tutor speaks.
  assert.ok(PLAYBACK_LEAD_S >= 0.2, `a ${PLAYBACK_LEAD_S}s cushion is under five 40ms chunks; it will underrun`);
  assert.ok(PLAYBACK_LEAD_S <= 0.4, `a ${PLAYBACK_LEAD_S}s cushion is an audible delay before the tutor answers`);
});

check('a playback failure is reported rather than swallowed', () => {
  const hook = readFileSync(new URL('../src/hooks/useLiveBridge.ts', import.meta.url), 'utf8');
  const play = hook.slice(hook.indexOf('const playAudio'), hook.indexOf('const closePlayback'));
  const tail = play.slice(play.lastIndexOf('} catch'));
  assert.ok(
    /console\.(error|warn)/.test(tail),
    'playAudio swallows its errors again: a broken playback path is silence with nothing in the logs, which is exactly how one shipped',
  );
});

// ── Report ──────────────────────────────────────────────────────────────────

if (problems.length) {

  console.error('Live audio problems:\n');
  problems.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}
console.log(
  `OK: mic frames are ${MIC_SAMPLE_RATE}Hz ${MIC_BIT_DEPTH}-bit mono, ` +
  `${MIC_FRAME_SAMPLES} samples per ${MIC_FRAME_MS}ms frame, little-endian; ` +
  `the tutor plays back at ${AGENT_SAMPLE_RATE}Hz with chunks laid end to end; ` +
  'barge-in and the child-safe microphone gate both hold.',
);
