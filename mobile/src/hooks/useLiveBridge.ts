import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  AudioContext, AudioManager, AudioRecorder,
  type AudioBufferSourceNode, type PermissionStatus, type SessionOptions,
} from 'react-native-audio-api';
import { getIdToken } from '../services/firebase';
import { base64ToBytes } from '../services/pcm';

/**
 * The live tutor socket, mobile side. Same protocol as the web client, so it
 * talks to the deployed live-bridge unchanged:
 *
 *   -> {type:'auth', token}          first frame, always
 *   -> {type:'text', text, stage}
 *   -> {type:'image', data, mimeType}
 *   -> {type:'stage', stage}
 *   -> {type:'close'}
 *   -> raw binary frames of microphone PCM (see MICROPHONE below)
 *   <- {type:'error', code, message}          a refusal, sent before the close
 *   <- ADK Events, camelCase (the server dumps them by_alias)
 *
 * WHICH FIELD CARRIES THE TUTOR'S WORDS. Production runs a native-audio model
 * (`_build_run_config` in backend/live-bridge/app/main.py), whose reply arrives
 * as PCM in `content.parts[].inlineData` and as TEXT in `outputTranscription`.
 * `content.parts[].text` is empty for that model, so a client that reads only
 * parts shows an empty transcript however much the tutor says. The learner's own
 * spoken words come back on `inputTranscription`. Both transcription channels
 * stream fragments with `partial: true` and then repeat the settled turn once
 * with `partial: false`, so only the settled event is displayed.
 *
 * WHAT MUST NEVER BE SHOWN. The server injects stage context into the model as
 * user-role content: `[stage changed to wiring]` on a stage switch, and a
 * `[stage=wiring] ` prefix on every learner turn. That is plumbing addressed to
 * the model, not speech. It is filtered here, and user-role content is
 * attributed to the learner rather than the tutor.
 *
 * MICROPHONE. The learner's voice goes up as RAW BINARY WebSocket frames of
 * signed 16-bit little-endian mono PCM at 16 kHz, which is what the bridge
 * assumes when it wraps a binary frame as
 * `types.Blob(mime_type="audio/pcm;rate=16000")`. Nothing on the wire declares
 * the rate, so getting it wrong is silent: the tutor simply hears a voice at the
 * wrong speed and answers the wrong question. `scripts/check-live-audio.mjs`
 * drives the encoder below with synthetic input and asserts the rate, the depth,
 * the channel count and the byte order.
 *
 * Capture comes from react-native-audio-api's `AudioRecorder`, which hands over
 * float frames already converted to the requested rate and channel count. This
 * replaced expo-audio, whose recorder is an `AVAudioRecorder` writing a file
 * (see its `ios/AudioRecorder.swift`): it exposes no streaming tap and no PCM
 * callback at all, so there was never a cadence to tune, only a file to wait
 * for. That is the real reason `micSupported` shipped false, and it is why the
 * fix needed a different package rather than a different call.
 *
 * The tutor's own reply comes back as 24 kHz PCM and is scheduled against the
 * audio context clock exactly as the web client does, so consecutive chunks
 * abut rather than overlap or leave a gap.
 */

export type LiveState = 'idle' | 'connecting' | 'connected' | 'error';
export type TranscriptRole = 'agent' | 'user' | 'system';
export interface Transcript { id: string; role: TranscriptRole; text: string }
export type Stage = 'inventory' | 'wiring' | 'code' | 'test';

/** How many lines the on-screen transcript keeps. It is session UI, not a record. */
export const TRANSCRIPT_LIMIT = 200;

/** Child-safe session cap (#94). Mirrors the web hook's 30 minute limit. */
export const CHILD_SESSION_LIMIT_MS = 30 * 60 * 1000;

/** Reconnect attempts before the session gives up and says so. */
export const RECONNECT_ATTEMPTS = 5;

// ── The audio wire format ───────────────────────────────────────────────────
//
// These four numbers are the contract with backend/live-bridge/app/main.py.
// They are exported so the check script asserts against the values the encoder
// actually uses rather than against a copy of them.

/** Sample rate the bridge tells Gemini every binary frame is at. */
export const MIC_SAMPLE_RATE = 16000;
/** Mono. A stereo frame would be read as twice as many samples, at double speed. */
export const MIC_CHANNEL_COUNT = 1;
/** Signed 16-bit little-endian, which is what `audio/pcm` means here. */
export const MIC_BIT_DEPTH = 16;
/** The mime type the server builds from the two constants above. */
export const MIC_MIME_TYPE = `audio/pcm;rate=${MIC_SAMPLE_RATE}`;

/**
 * How much speech rides in one frame. 100ms is the balance the socket wants:
 * short enough that the tutor can start answering before the learner has
 * finished the sentence, long enough that a bench session is ten frames a
 * second rather than a hundred.
 */
export const MIC_FRAME_MS = 100;
export const MIC_FRAME_SAMPLES = (MIC_SAMPLE_RATE * MIC_FRAME_MS) / 1000;

/**
 * Exactly what the recorder is asked for. Exported rather than written inline at
 * the call site so `scripts/check-live-audio.mjs` asserts against the object the
 * recorder is actually handed, not against a second copy of the numbers that
 * could drift away from it.
 */
export const MIC_RECORDER_OPTIONS = {
  sampleRate: MIC_SAMPLE_RATE,
  bufferLength: MIC_FRAME_SAMPLES,
  channelCount: MIC_CHANNEL_COUNT,
} as const;

/** What the model speaks at. Fixed by the Live API, not by us. */
export const AGENT_SAMPLE_RATE = 24000;

/**
 * The cushion the first chunk of an utterance gets before it is due to play.
 * Chunks arrive over a mobile network in bursts, and scheduling the first one
 * at the current instant means the audio thread reaches it late and clips its
 * opening. Every chunk after it is scheduled flush against the previous one, so
 * this cost is paid once per utterance rather than once per chunk.
 */
export const PLAYBACK_LEAD_S = 0.28;

/**
 * The tutor's chunks abut on an INTEGER SAMPLE grid, not on floating seconds.
 *
 * Each chunk used to be scheduled at `previousStart + previousDuration`, a float
 * accumulated across hundreds of chunks. The engine converts that start time to
 * a frame with `timeToSampleFrame`, which ROUNDS, and it rounds each chunk
 * independently. So consecutive chunks could overlap by a sample or gap by a
 * sample, at every boundary, forever.
 *
 * Gemini Live sends roughly a chunk every 40ms, so that is a discontinuity
 * around 25 times a second. A single-sample step is a click; 25 of them a second
 * is a buzz sitting under the voice, which is what "grainy and sandpapery"
 * sounds like. Counting whole samples instead makes the arithmetic exact: chunk
 * N starts precisely where chunk N-1 ended, with nothing to round.
 */
const framesToSeconds = (frames: number, rate: number) => frames / rate;
const secondsToFrames = (seconds: number, rate: number) => Math.round(seconds * rate);

/**
 * How long the microphone has to produce its first frame before the session
 * calls the attempt failed.
 *
 * This is not belt and braces, it is the only proof there is.
 * react-native-audio-api 0.12.2's `AudioRecorder.start()` THROWS THE NATIVE
 * RESULT AWAY whenever file output is off, which is always here:
 *
 *     start(options) {
 *       if (!this.isFileOutputEnabled) {
 *         this.recorder.start();          // <- Result<> discarded
 *         return { status: 'success' };   // <- unconditional
 *       }
 *       ...
 *
 * So `start().status` is 'success' even when the native recorder returned
 * "Microphone permissions are not granted", "Failed to start native recorder"
 * or "Failed to start stream" — and none of those reach `onError` either,
 * because the error callback is only wired up further inside the native start
 * that just failed. Trusting the return value paints a gold, pulsing "the tutor
 * is listening" over a microphone that is doing nothing, for the whole session.
 *
 * A frame arriving is the one signal that cannot be faked. One frame is
 * MIC_FRAME_MS long and the device's own I/O buffer is a fraction of that, so
 * anything past this is not slow, it is not happening.
 */
export const MIC_START_TIMEOUT_MS = 2000;

/**
 * Whether this build can capture the learner's voice.
 *
 * True on the two phone platforms, where react-native-audio-api's recorder
 * delivers float frames and `encodeMicFrame` turns them into the PCM the bridge
 * expects. False on the web target of this same bundle: the library's web entry
 * point (`api.web.ts`) exports the Web Audio graph and no recorder at all, so
 * there is nothing there to capture with. Playback of the tutor's voice works
 * on every platform either way.
 */
export const micSupported: boolean = Platform.OS === 'ios' || Platform.OS === 'android';

/** Audio routing for a bench: out loud, hands free, and able to hear the room. */
const LIVE_AUDIO_SESSION: SessionOptions = {
  iosCategory: 'playAndRecord',
  // NOT videoChat, which is what this was and why the tutor sounded like a
  // phone call.
  //
  // videoChat is a TELEPHONY mode: it engages the system's voice processing and
  // pulls the session to a voice-optimised sample rate, throwing away most of
  // the band above a few kHz. Faith described the result exactly: "like a very
  // old telephone", "grainy and sandpapery", every word intelligible and all of
  // them ugly. The tutor's audio arrives at 24kHz and was being squeezed through
  // a configuration meant for a handset.
  //
  // It was set for the echo cancellation that comes with voice processing. That
  // cancellation never existed on this path: the recorder is miniaudio, which
  // hardcodes kAudioUnitSubType_RemoteIO, and Apple's canceller lives in
  // kAudioUnitSubType_VoiceProcessingIO. So the session was paying a telephony
  // mode's full price in fidelity and buying nothing at all with it. The echo is
  // handled in micGatedForEcho instead, by not listening while the tutor talks.
  iosMode: 'default',
  // defaultToSpeaker is what keeps the tutor off the earpiece. It only chooses
  // between the earpiece and the speaker on the built-in route, so it does not
  // fight a headset: plug one in and the system routes there, unplug it and
  // this is what puts the voice back on the speaker instead of the earpiece.
  iosOptions: ['defaultToSpeaker', 'allowBluetoothHFP', 'allowBluetoothA2DP'],
};

/** What the session leaves behind, so the app is not stuck holding the mic. */
const IDLE_AUDIO_SESSION: SessionOptions = {
  iosCategory: 'playback',
  iosMode: 'default',
  iosOptions: ['mixWithOthers'],
};

/** Exponential backoff, capped at 10s. Attempt 0 is the first retry. */
export function reconnectDelayMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 10000);
}

/**
 * How much of the session cap is left, in ms.
 *
 * The cap is spent by time actually CONNECTED, never by the wall clock. Two
 * things follow, and both matter: bouncing the socket cannot buy a minor more
 * time, because `spentMs` carries across a reconnect; and a gap after a dropped
 * connection cannot silently spend it, so a learner who comes back twenty
 * minutes later still has what they had. Measuring against the first connect
 * instead ends the next session the instant it opens.
 *
 * @param limitMs   the cap. 0 means no cap.
 * @param spentMs   connected time already used in this sitting.
 * @param spanStart when the current connected span began, or null if not connected.
 */
export function sessionTimeRemainingMs(
  limitMs: number,
  spentMs: number,
  spanStart: number | null,
  now: number,
): number {
  if (limitMs <= 0) return 0;
  const inThisSpan = spanStart === null ? 0 : Math.max(0, now - spanStart);
  return Math.max(0, limitMs - spentMs - inThisSpan);
}

// ── Audio encoding (pure, and tested by scripts/check-live-audio.mjs) ────────

/**
 * Fold however many channels the device gave us down to the one the bridge
 * expects. Sending an interleaved stereo frame as if it were mono is the
 * classic chipmunk bug: twice the samples read at the declared rate is speech
 * at double speed.
 */
export function mixDownToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0];
  const length = channels.reduce((min, c) => Math.min(min, c.length), channels[0].length);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (let c = 0; c < channels.length; c += 1) sum += channels[c][i];
    out[i] = sum / channels.length;
  }
  return out;
}

/**
 * One frame of microphone float samples to the bytes that go on the wire:
 * signed 16-bit little-endian mono at MIC_SAMPLE_RATE.
 *
 * The recorder is asked for 16 kHz and on both platforms converts to it before
 * handing the frame over, so the resampling branch below is a fallback rather
 * than the normal path. It stays because the library documents that the rate it
 * delivers may differ from the rate requested, and a frame that quietly arrives
 * at 48 kHz and is shipped as 16 kHz is a tutor listening to a voice three times
 * too fast with no error anywhere to explain it.
 *
 * Downsampling averages the source samples that fall inside each output sample
 * rather than picking one of them. Picking one folds everything above 8 kHz back
 * into the band the tutor hears, which is what makes cheap downsampled speech
 * sound thin and buzzy, and what makes a transcript worse.
 */
export function encodeMicFrame(frames: Float32Array, sourceSampleRate: number): ArrayBuffer {
  if (frames.length === 0) return new ArrayBuffer(0);
  const rate = sourceSampleRate > 0 ? sourceSampleRate : MIC_SAMPLE_RATE;
  const ratio = rate / MIC_SAMPLE_RATE;
  const outLength = ratio === 1 ? frames.length : Math.max(1, Math.floor(frames.length / ratio));
  const bytesPerSample = MIC_BIT_DEPTH / 8;
  const out = new ArrayBuffer(outLength * bytesPerSample);
  const view = new DataView(out);

  for (let i = 0; i < outLength; i += 1) {
    let sample: number;
    if (ratio === 1) {
      sample = frames[i];
    } else {
      const start = Math.min(frames.length - 1, Math.floor(i * ratio));
      const end = Math.min(frames.length, Math.floor((i + 1) * ratio));
      if (end > start) {
        let sum = 0;
        for (let j = start; j < end; j += 1) sum += frames[j];
        sample = sum / (end - start);
      } else {
        // Upsampling: hold the source sample this output sample lands on.
        sample = frames[start];
      }
    }
    const clamped = sample > 1 ? 1 : sample < -1 ? -1 : sample;
    view.setInt16(i * bytesPerSample, Math.round(clamped * 32767), true);
  }
  return out;
}

/**
 * The other direction: the tutor's 24 kHz PCM bytes back to float samples an
 * audio buffer will take. A trailing odd byte is half a sample and is dropped
 * rather than read as a whole one.
 */
export function decodeAgentPcm(bytes: Uint8Array): Float32Array {
  const count = bytes.length >> 1;
  const out = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const lo = bytes[i * 2];
    const hi = bytes[i * 2 + 1];
    // Sign-extend the high byte, then drop the low byte in underneath it.
    out[i] = (((hi << 24) >> 16) | lo) / 32768;
  }
  return out;
}

/**
 * When the next chunk of the tutor's voice should start.
 *
 * While a reply is still playing this is the instant the previous chunk ends,
 * which is what makes consecutive chunks abut: no gap to click across, no
 * overlap to turn two voices into noise. When the queue has drained the chunk
 * starts a beat from now rather than at this instant, so the audio thread has
 * time to pick it up before it is due.
 */
export function nextChunkStart(now: number, queuedUntil: number, lead = PLAYBACK_LEAD_S): number {
  return queuedUntil > now ? queuedUntil : now + lead;
}

/**
 * How long after the tutor stops talking the microphone stays shut.
 *
 * Covers the last buffer draining out of the speaker and the room's own tail.
 * Too short and the closing syllable comes back as the learner's input; too
 * long and a learner answering promptly gets clipped.
 */
export const ECHO_GATE_TAIL_S = 0.25;

/**
 * Is the microphone shut because the tutor is talking?
 *
 * THE PHONE HAS NO ECHO CANCELLATION. react-native-audio-api records through
 * miniaudio, which hardcodes kAudioUnitSubType_RemoteIO; Apple's canceller
 * lives in kAudioUnitSubType_VoiceProcessingIO, and nothing in the library's
 * SessionOptions can reach it. Setting the session to `videoChat` was worth
 * doing for routing but it cannot switch on a canceller that is not in the
 * capture path.
 *
 * So the loudspeaker's output went straight back into the microphone a few
 * inches away. Three things followed, and Faith saw all three: the model heard
 * itself and cut its own sentence off, which reads as the voice breaking up;
 * its speech was transcribed as the LEARNER's turn, so "I can see you" arrived
 * on her side of the transcript; and the transcriber kept revising a poor
 * recording of a loudspeaker, turning "your" into "her".
 *
 * Half duplex is the fix that does not depend on a canceller existing: while
 * the tutor is speaking, the microphone sends nothing. The cost is that
 * speaking over the tutor no longer interrupts it, so interrupting becomes a
 * deliberate press instead of an accident. On a bench, next to a loudspeaker,
 * that is the right trade.
 */
export function micGatedForEcho(
  queuedUntil: number,
  now: number,
  tail = ECHO_GATE_TAIL_S,
): boolean {
  return queuedUntil + tail > now;
}

// ── The microphone gate ─────────────────────────────────────────────────────

export type MicPermission = 'granted' | 'denied' | 'undetermined';

/** The library's permission words, in the ones this hook reasons about. */
export function toMicPermission(status: PermissionStatus | string): MicPermission {
  if (status === 'Granted') return 'granted';
  if (status === 'Denied') return 'denied';
  return 'undetermined';
}

export interface MicGate {
  /** Whether this platform can capture at all. */
  supported: boolean;
  /** The learner pressed the microphone control, and has not pressed it off. */
  intent: boolean;
  /** The socket is up. Frames sent while it is down are thrown away anyway. */
  connected: boolean;
  /** The app is in front of the learner. */
  foreground: boolean;
  permission: MicPermission;
  /** Something else has the audio session: a phone call, another app. */
  interrupted: boolean;
  /** Child-safe posture (#94), as `useChildSafe` resolves it. */
  childSafe: boolean;
  /** False while the learner's age is still being read. */
  childSafeResolved: boolean;
}

/**
 * Whether the microphone should be open right now.
 *
 * The child-safe rule is the one with a compliance answer behind it rather than
 * a product one: while `childSafeResolved` is false nobody knows yet whether a
 * minor is holding the phone, so nothing opens. That is why it fails closed and
 * why the check runs before every other condition.
 */
export function micShouldCapture(gate: MicGate): boolean {
  if (!gate.supported) return false;
  if (!gate.childSafeResolved) return false;
  if (gate.interrupted) return false;
  return gate.intent && gate.connected && gate.foreground && gate.permission === 'granted';
}

/**
 * Whether the learner's microphone intent survives the app leaving the
 * foreground.
 *
 * For a minor it does not. Child mode's rule is that a minor's microphone opens
 * only under the learner's own hand, and an app that comes back from the
 * background with the mic already live has opened it for them. Everyone else
 * keeps their intent, so picking the phone back up carries on the session they
 * were in the middle of.
 */
export function micIntentAfterBackground(intent: boolean, childSafe: boolean): boolean {
  return childSafe ? false : intent;
}

// ── Event interpretation (pure, and tested by scripts/check-live-transcript.mjs) ──

/**
 * What the client has learned about the session so far. `spoken` means the model
 * is answering with audio, so its text arrives on `outputTranscription` and any
 * text in `content.parts` is the same words a second time.
 */
export interface LiveEventState { spoken: boolean }

export const freshLiveEventState = (): LiveEventState => ({ spoken: false });

export type LiveAction =
  | { kind: 'transcript'; role: TranscriptRole; text: string; echo?: boolean }
  | { kind: 'audio'; data: string }
  | { kind: 'interrupt' }
  | { kind: 'refused'; code: string; message: string };

export interface LiveEventOutcome { state: LiveEventState; actions: LiveAction[] }

/** Leading `[stage...]` tag: `[stage changed to wiring]` or `[stage=wiring] `. */
const STAGE_TAG = /^\s*\[stage\b[^\]]*\]\s*/i;

/**
 * Strip the server's stage plumbing. Returns null when nothing is left, which is
 * the case for a bare `[stage changed to wiring]` injection: it is addressed to
 * the model and the learner should never see it.
 */
export function stripStagePlumbing(text: string): string | null {
  const rest = text.replace(STAGE_TAG, '').trim();
  return rest.length > 0 ? rest : null;
}

interface InlineData { data?: unknown; mimeType?: unknown; mime_type?: unknown }

function readInline(part: Record<string, unknown>): { data: string; mime: string } | null {
  const inline = (part.inlineData ?? part.inline_data) as InlineData | undefined;
  if (!inline || typeof inline.data !== 'string' || !inline.data) return null;
  const mime = String(inline.mimeType ?? inline.mime_type ?? '');
  return { data: inline.data, mime };
}

function readText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim() ? value : null;
}

/**
 * Turn one server event into the actions it should cause. Pure: no React, no
 * audio, no sockets, so the whole transcript contract can be driven from a
 * recorded event log in a check script.
 */
export function reduceLiveEvent(state: LiveEventState, raw: unknown): LiveEventOutcome {
  const actions: LiveAction[] = [];
  if (!raw || typeof raw !== 'object') return { state, actions };
  const event = raw as Record<string, unknown>;

  // Terminal errors the server sends before closing (consent, budget, auth).
  if (event.type === 'error') {
    return {
      state,
      actions: [{
        kind: 'refused',
        code: String(event.code ?? ''),
        message: String(event.message ?? 'The session could not start.'),
      }],
    };
  }

  let next = state;
  const partial = event.partial === true;
  const settled = event.partial === false;

  // Barge-in. Gemini raises this the moment its own voice-activity detection
  // hears the learner talking over the tutor, and it is the only signal in the
  // session that is not confused by the tutor's voice coming back in through
  // the microphone. Emitted before any audio in the same event, so the flush
  // cannot throw away a chunk that belongs to the reply after the interruption.
  if (event.interrupted === true) actions.push({ kind: 'interrupt' });

  const content = event.content as { role?: unknown; parts?: unknown } | undefined;
  const role = typeof content?.role === 'string' ? content.role.toLowerCase() : '';
  const parts = Array.isArray(content?.parts) ? (content?.parts as Array<Record<string, unknown>>) : [];

  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;

    const inline = readInline(part);
    if (inline) {
      if (inline.mime.includes('audio') || inline.mime.includes('pcm')) {
        next = next.spoken ? next : { ...next, spoken: true };
        actions.push({ kind: 'audio', data: inline.data });
      }
      continue;
    }

    // Tool traffic (functionCall / functionResponse) carries no `text` and is
    // deliberately not rendered: a tool result is not something the tutor said.
    const text = readText(part.text);
    if (!text) continue;

    if (role === 'user') {
      // The learner's own turn, echoed back with the stage plumbing attached.
      const visible = stripStagePlumbing(text);
      if (visible) actions.push({ kind: 'transcript', role: 'user', text: visible, echo: true });
      continue;
    }

    // Model text. In a native-audio session this repeats what
    // `outputTranscription` already said, so it is dropped. In a text-only
    // fallback session it is the only channel there is, and only the settled
    // (non-partial) event carries the whole turn rather than a fragment.
    if (next.spoken || partial) continue;
    actions.push({ kind: 'transcript', role: 'agent', text });
  }

  const output = readText((event.outputTranscription as { text?: unknown } | undefined)?.text);
  if (output) {
    next = next.spoken ? next : { ...next, spoken: true };
    if (settled) actions.push({ kind: 'transcript', role: 'agent', text: output });
  }

  const input = readText((event.inputTranscription as { text?: unknown } | undefined)?.text);
  if (input && settled) {
    const visible = stripStagePlumbing(input);
    if (visible) actions.push({ kind: 'transcript', role: 'user', text: visible });
  }

  return { state: next, actions };
}

/**
 * Add one line to the transcript. `echo` marks a line the server sent back that
 * the client may already have shown itself (a typed turn), so it is dropped if it
 * repeats the most recent line from the same speaker.
 */
export function appendTranscript(prev: Transcript[], entry: Transcript, echo = false): Transcript[] {
  const clean = entry.text.trim();
  if (!clean) return prev;
  if (echo) {
    for (let i = prev.length - 1; i >= 0; i -= 1) {
      if (prev[i].role !== entry.role) continue;
      if (prev[i].text === clean) return prev;
      break;
    }
  }
  const next = [...prev, { ...entry, text: clean }];
  return next.length > TRANSCRIPT_LIMIT ? next.slice(next.length - TRANSCRIPT_LIMIT) : next;
}

interface Options {
  wsUrl: string;
  userId: string;
  sessionId: string;
  /** Milliseconds between background frames. 0 disables the heartbeat. */
  visionIntervalMs?: number;
  /**
   * Child-safe posture (#94). True only for a verified minor while
   * EXPO_PUBLIC_OHMLET_CHILD_MODE is on, which is what `useChildSafe` resolves.
   * Applies the shorter session cap below and the microphone rules above.
   */
  childSafe?: boolean;
  /**
   * The second half of what `useChildSafe` returns. It defaults to false so the
   * microphone gate fails closed: a caller that has not said whether a minor is
   * holding the phone gets no microphone rather than an open one.
   */
  childSafeResolved?: boolean;
  /** Hard cap on continuous live time in ms. 0 = none. Defaults to the child cap. */
  sessionLimitMs?: number;
}

/** One chunk of the tutor's reply, and when it is done playing. */
interface ScheduledChunk { node: AudioBufferSourceNode; endsAt: number }

const MIC_DENIED_LINE =
  "Ohmlet can't hear you yet. Turn the microphone on for Ohmlet in your phone's settings, then tap the mic again.";
const MIC_REVOKED_LINE =
  'Microphone access was turned off, so the tutor stopped listening. You can still type.';
const MIC_FAILED_LINE =
  "Couldn't start listening. The tutor still sees your bench, and you can type instead.";

export function useLiveBridge({
  wsUrl,
  userId,
  sessionId,
  visionIntervalMs = 2500,
  childSafe = false,
  childSafeResolved = false,
  sessionLimitMs = 0,
}: Options) {
  const [state, setState] = useState<LiveState>('idle');
  const [reconnecting, setReconnecting] = useState(false);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [camOn, setCamOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [micIntent, setMicIntent] = useState(false);
  const [micPermission, setMicPermission] = useState<MicPermission>('undetermined');
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  // The AUDIO SESSION was taken away (a phone call, another app). Not to be
  // confused with the barge-in interruption above, which is the learner talking
  // over the tutor.
  const [audioInterrupted, setAudioInterrupted] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const frameTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Set by the screen: returns one base64 JPEG of the current preview.
  const grabFrameRef = useRef<null | (() => Promise<string | null>)>(null);
  const closedByUs = useRef(false);
  // A refusal is final. Reconnecting past one would hammer a door the server has
  // already shut (no consent, no budget, bad token).
  const refused = useRef(false);
  const attemptRef = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventStateRef = useRef<LiveEventState>(freshLiveEventState());
  const seqRef = useRef(0);
  // The stage the learner is on. Re-sent after a reconnect, because the server
  // releases the agent session when the socket closes and the new one starts
  // back at the default stage otherwise.
  const stageRef = useRef<Stage>('inventory');
  // Live time already used in this sitting, and when the current connected span
  // began. The session cap is spent by connected time, not by the wall clock, so
  // a reconnect cannot buy a minor more of it and a gap after a dropped socket
  // cannot silently consume it. Only ending the session deliberately resets it.
  const spentMsRef = useRef(0);
  const spanStartRef = useRef<number | null>(null);
  // Bumped when the learner ends the session or the screen goes away. An open
  // still awaiting its token compares the generation it began in against this
  // before it builds a socket: `getIdToken` can take seconds, and a socket that
  // opens after the learner has gone is one nobody holds a reference to, while
  // the server bills it until the idle watchdog notices.
  const generationRef = useRef(0);
  // True from the start of an open until its socket exists. `wsRef` cannot see
  // an open that has not created its socket yet, so without this a double tap
  // opens two and orphans the first.
  const openingRef = useRef(false);

  // ── Audio refs ──
  const recorderRef = useRef<AudioRecorder | null>(null);
  const micBusyRef = useRef(false);
  // True from the start of a capture attempt until its recorder exists.
  // `recorderRef` cannot see an attempt that is still awaiting the audio
  // session, so without this a second pass through the gate opens a second
  // recorder and orphans the first with the microphone still live.
  const capturingRef = useRef(false);
  // The gate effect reads intent from state; the AppState listener has to read
  // it from outside a render, so it reads this instead of a stale closure.
  const micIntentRef = useRef(false);
  // The WHOLE gate's latest answer, not just the learner's intent. `startCapture`
  // awaits the audio session, and everything the gate reads can change inside
  // that await: the app can go to the background, a call can arrive, the socket
  // can drop. Re-reading intent alone would let all three of those open a
  // microphone the gate has already shut — in the background case, out of sight.
  const gateOpenRef = useRef(false);
  // Whether this capture attempt has produced a single frame of audio yet. See
  // MIC_START_TIMEOUT_MS: the library reports success from a start that failed,
  // so nothing else in this hook can tell a live microphone from a dead one.
  const micFrameSeenRef = useRef(false);
  const micWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const queuedUntilRef = useRef(0);
  // The same mark in whole samples, which is what the scheduling uses.
  const queuedFramesRef = useRef(0);
  // Latched so a failing playback path reports once, not per chunk.
  const playbackFaultRef = useRef(false);
  const scheduledRef = useRef<ScheduledChunk[]>([]);

  const closeSpan = useCallback(() => {
    if (spanStartRef.current === null) return;
    spentMsRef.current += Math.max(0, Date.now() - spanStartRef.current);
    spanStartRef.current = null;
  }, []);

  const effectiveSessionLimitMs = sessionLimitMs || (childSafe ? CHILD_SESSION_LIMIT_MS : 0);

  const push = useCallback((role: TranscriptRole, text: string, echo = false) => {
    if (!text.trim()) return;
    const id = `t${(seqRef.current += 1)}`;
    setTranscripts((prev) => appendTranscript(prev, { id, role, text }, echo));
  }, []);

  const registerFrameGrabber = useCallback((fn: null | (() => Promise<string | null>)) => {
    grabFrameRef.current = fn;
  }, []);

  const applyMicIntent = useCallback((next: boolean) => {
    micIntentRef.current = next;
    setMicIntent(next);
  }, []);

  const applyBenchRouting = useCallback(() => {
    try {
      AudioManager.setAudioSessionOptions(LIVE_AUDIO_SESSION);
    } catch {
      // Routing is a preference, not a precondition. A session that cannot set
      // it still talks; it just may talk through the earpiece.
    }
  }, []);

  // ── The tutor's voice ──
  //
  // A direct port of the web client's scheduler: one buffer per chunk, started
  // against the context clock at the instant the previous chunk ends. The web
  // creates its context at 24000 for the same reason this does, which is that a
  // buffer whose rate matches its context is played rather than resampled.

  const stopSpeaking = useCallback(() => {
    const ctx = playbackCtxRef.current;
    const scheduled = scheduledRef.current;
    scheduledRef.current = [];
    queuedUntilRef.current = 0;
    queuedFramesRef.current = 0;
    if (!ctx) return;
    for (const chunk of scheduled) {
      try { chunk.node.stop(ctx.currentTime); } catch { /* already finished */ }
      try { chunk.node.disconnect(); } catch { /* already detached */ }
    }
  }, []);

  const playAudio = useCallback((b64: string) => {
    try {
      const samples = decodeAgentPcm(base64ToBytes(b64));
      if (samples.length === 0) return;

      let ctx = playbackCtxRef.current;
      if (!ctx) {
        ctx = new AudioContext({ sampleRate: AGENT_SAMPLE_RATE });
        playbackCtxRef.current = ctx;
        queuedUntilRef.current = 0;
        queuedFramesRef.current = 0;
        playbackFaultRef.current = false;
        // The rate we ASKED for is not necessarily the rate we got. iOS hands
        // back whatever the audio session settled on, and everything is then
        // resampled into it, which is audible as graininess rather than as an
        // error. Logged once per session because the alternative is guessing at
        // audio quality from a description, which has already cost a build.
        if (ctx.sampleRate !== AGENT_SAMPLE_RATE) {
          console.warn(
            `[ohmlet-audio] asked for ${AGENT_SAMPLE_RATE}Hz playback, got ${ctx.sampleRate}Hz. `
            + 'Everything the tutor says is being resampled into that.',
          );
        } else {
          console.log(`[ohmlet-audio] playback context running at ${ctx.sampleRate}Hz as requested.`);
        }
        // On the web target this is a `window.AudioContext`, which is born
        // SUSPENDED under every browser's autoplay policy: its clock stays at
        // zero and nothing it schedules is heard. The first chunk arrives from
        // the socket rather than from a press, so nothing else would ever
        // resume it, and the pre-flight's promise that the tutor "answers out
        // loud" in a browser would be false. The learner has already pressed
        // Start, so the page has the activation this needs. On the phone the
        // context starts itself when a source node does, and this is a no-op.
        void ctx.resume().catch(() => {});
      }

      const buffer = ctx.createBuffer(1, samples.length, AGENT_SAMPLE_RATE);
      buffer.copyToChannel(samples, 0);
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(ctx.destination);

      // Scheduled on the sample grid. queuedFramesRef counts WHOLE SAMPLES of
      // the tutor's voice already placed, so chunk N starts exactly where chunk
      // N-1 ended and there is no float to round at the boundary.
      const rate = AGENT_SAMPLE_RATE;
      const nowFrames = secondsToFrames(ctx.currentTime, rate);
      const queuedFrames = queuedFramesRef.current;
      // Behind the clock means the queue ran dry: rebuild the cushion rather
      // than starting in the past, which the engine would clamp to now anyway
      // and then immediately underrun again.
      const startFrames = queuedFrames > nowFrames
        ? queuedFrames
        : nowFrames + secondsToFrames(PLAYBACK_LEAD_S, rate);
      node.start(framesToSeconds(startFrames, rate));
      queuedFramesRef.current = startFrames + samples.length;
      queuedUntilRef.current = framesToSeconds(queuedFramesRef.current, rate);

      // Keep only what is still to play. Barge-in has to be able to silence
      // every chunk already queued, and nothing else needs the finished ones.
      const now = ctx.currentTime;
      scheduledRef.current = scheduledRef.current.filter((c) => c.endsAt > now);
      scheduledRef.current.push({ node, endsAt: queuedUntilRef.current });
    } catch (err) {
      // A dropped chunk IS better than a crashed session, and that stays true.
      // Swallowing it in silence is not: when the playback path was changed and
      // the first call threw, the result was a session with no sound at all and
      // nothing anywhere saying why. The learner heard silence and so did the
      // logs. Report the first one, then go quiet so a genuinely bad network
      // cannot flood the console.
      if (!playbackFaultRef.current) {
        playbackFaultRef.current = true;
        console.error('[ohmlet-audio] playback failed and the tutor will be silent:', err);
      }
    }
  }, []);

  const closePlayback = useCallback(() => {
    stopSpeaking();
    const ctx = playbackCtxRef.current;
    playbackCtxRef.current = null;
    if (ctx) void ctx.close().catch(() => {});
  }, [stopSpeaking]);

  // ── The learner's voice ──

  const stopCapture = useCallback(() => {
    // Every path that shuts the microphone comes through here — the gate, the
    // learner ending the session, unmount — so this is where an attempt still
    // inside its await learns it has been overtaken.
    gateOpenRef.current = false;
    if (micWatchdogRef.current) {
      clearTimeout(micWatchdogRef.current);
      micWatchdogRef.current = null;
    }
    micFrameSeenRef.current = false;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    capturingRef.current = false;
    setMicOn(false);
    if (!recorder) return;
    try { recorder.stop(); } catch { /* never started, or already stopped */ }
    try { recorder.clearOnAudioReady(); } catch { /* nothing registered */ }
    try { recorder.clearOnError(); } catch { /* nothing registered */ }
  }, []);

  const startCapture = useCallback(async () => {
    if (recorderRef.current || capturingRef.current) return;
    capturingRef.current = true;
    micFrameSeenRef.current = false;

    applyBenchRouting();
    try {
      await AudioManager.setAudioSessionActivity(true);
    } catch {
      // Some devices refuse while another app holds the session. The recorder
      // below reports the real failure, so this is not fatal on its own.
    }
    // The gate can have closed while the session was being activated, and for
    // any of its reasons. Reading intent alone here was the hole: the learner
    // still wants the microphone on after the app goes to the background, so an
    // intent-only re-check would open one behind the lock screen — precisely
    // what the app declares no background audio mode in order not to do.
    if (!gateOpenRef.current || recorderRef.current) {
      capturingRef.current = false;
      return;
    }

    let recorder: AudioRecorder;
    try {
      recorder = new AudioRecorder();
    } catch {
      capturingRef.current = false;
      applyMicIntent(false);
      push('system', MIC_FAILED_LINE);
      return;
    }
    recorderRef.current = recorder;

    recorder.onError(() => {
      // The input stopped being usable mid-recording. Narrower than it looks:
      // on the recorder path the library only raises this from its own format
      // conversion (`IOSRecorderCallback.mm`), and the Android recorder never
      // raises it at all. Permission taken away in Settings does NOT arrive
      // here — iOS restarts the app for that, and a background round trip is
      // re-checked by the AppState listener below. Whatever the cause, saying
      // so beats sitting there looking like it is listening.
      stopCapture();
      applyMicIntent(false);
      push('system', MIC_REVOKED_LINE);
    });

    const armed = recorder.onAudioReady(
      MIC_RECORDER_OPTIONS,
      (event) => {
        // First frame of this attempt: the microphone is demonstrably open.
        // Marked before the socket check, because this is a fact about the
        // microphone and a socket that dropped a moment ago is not evidence
        // against it.
        if (!micFrameSeenRef.current) {
          micFrameSeenRef.current = true;
          if (micWatchdogRef.current) {
            clearTimeout(micWatchdogRef.current);
            micWatchdogRef.current = null;
          }
          setMicOn(true);
        }
        const ws = wsRef.current;
        if (ws?.readyState !== WebSocket.OPEN) return;

        // Half duplex. See micGatedForEcho: there is no echo cancellation on
        // this path, so anything captured while the tutor is talking is the
        // tutor, and sending it makes the model interrupt itself and puts its
        // own words on the learner's side of the transcript.
        const pctx = playbackCtxRef.current;
        if (pctx && micGatedForEcho(queuedUntilRef.current, pctx.currentTime)) return;

        const buffer = event.buffer;
        const channels: Float32Array[] = [];
        for (let c = 0; c < buffer.numberOfChannels; c += 1) channels.push(buffer.getChannelData(c));
        const pcm = encodeMicFrame(mixDownToMono(channels), buffer.sampleRate);
        if (pcm.byteLength === 0) return;
        try {
          // A raw binary frame. The bridge reads exactly this as
          // `types.Blob(mime_type="audio/pcm;rate=16000")`.
          ws.send(pcm);
        } catch {
          /* the socket went away between the check and the send */
        }
      },
    );
    if (armed.status === 'error') {
      stopCapture();
      applyMicIntent(false);
      push('system', MIC_FAILED_LINE);
      return;
    }

    const started = recorder.start();
    if (started.status === 'error') {
      stopCapture();
      applyMicIntent(false);
      push('system', MIC_FAILED_LINE);
      return;
    }

    // And now the check that actually catches a failed start, because the one
    // above cannot: see MIC_START_TIMEOUT_MS for why `started.status` is
    // 'success' whatever the native recorder did. `micOn` stays false until a
    // frame arrives, so the control reads "on, waiting" rather than claiming
    // the tutor can hear a room it cannot.
    micWatchdogRef.current = setTimeout(() => {
      micWatchdogRef.current = null;
      if (micFrameSeenRef.current) return;
      stopCapture();
      applyMicIntent(false);
      push('system', MIC_FAILED_LINE);
    }, MIC_START_TIMEOUT_MS);
  }, [applyBenchRouting, applyMicIntent, push, stopCapture]);

  /**
   * Ask for the microphone and turn it on. Called straight out of a press, both
   * from the mic control and from the button that starts the session, because
   * iOS and Android only raise the permission sheet from inside the gesture that
   * asked for it.
   */
  const enableMic = useCallback(async (): Promise<boolean> => {
    if (!micSupported || micBusyRef.current) return false;
    // Nothing opens a microphone before the age question has an answer.
    if (!childSafeResolved) return false;
    micBusyRef.current = true;
    try {
      let permission = micPermission;
      if (permission !== 'granted') {
        const status = await AudioManager.checkRecordingPermissions().catch(() => 'Denied' as const);
        permission = toMicPermission(status);
        if (permission === 'undetermined') {
          const asked = await AudioManager.requestRecordingPermissions().catch(() => 'Denied' as const);
          permission = toMicPermission(asked);
        }
        setMicPermission(permission);
      }
      if (permission !== 'granted') {
        applyMicIntent(false);
        push('system', MIC_DENIED_LINE);
        return false;
      }
      setAudioInterrupted(false);
      applyMicIntent(true);
      return true;
    } finally {
      micBusyRef.current = false;
    }
  }, [applyMicIntent, childSafeResolved, micPermission, push]);

  const disableMic = useCallback(() => {
    applyMicIntent(false);
  }, [applyMicIntent]);

  const toggleMic = useCallback(async () => {
    if (micIntentRef.current) {
      disableMic();
      return;
    }
    await enableMic();
  }, [disableMic, enableMic]);

  const clearReconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  const handleEvent = useCallback((raw: string) => {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return; }

    const { state: nextEventState, actions } = reduceLiveEvent(eventStateRef.current, parsed);
    eventStateRef.current = nextEventState;

    for (const action of actions) {
      if (action.kind === 'audio') {
        playAudio(action.data);
        continue;
      }
      if (action.kind === 'interrupt') {
        // The learner talked over the tutor. Drop everything still queued so the
        // tutor stops mid-sentence the way a person would, rather than finishing
        // a paragraph nobody is listening to any more.
        stopSpeaking();
        continue;
      }
      if (action.kind === 'refused') {
        refused.current = true;
        clearReconnect();
        setError(action.message);
        setState('error');
        setReconnecting(false);
        push('system', action.message);
        if (action.code) console.warn('[ohmlet-live] refused:', action.code);
        continue;
      }
      push(action.role, action.text, action.echo === true);
    }
  }, [playAudio, push, clearReconnect, stopSpeaking]);

  // ── Connection ──
  //
  // `openSocket` is called both by the learner (retry=false) and by the backoff
  // timer (retry=true). It is held in a ref so the timer always calls the current
  // one rather than the closure captured when the socket that dropped was opened.
  const openSocketRef = useRef<(retry: boolean) => Promise<void>>(async () => {});

  const openSocket = useCallback(async (retry: boolean) => {
    if (wsRef.current || openingRef.current) return;
    const generation = generationRef.current;
    openingRef.current = true;
    try {
      clearReconnect();
      closedByUs.current = false;
      setState('connecting');
      setReconnecting(retry);
      if (!retry) setError(null);

      const token = await getIdToken();
      // The learner may have ended the session or left the screen while the
      // token was being fetched. Opening now would start a session they cannot
      // see and cannot close.
      if (generation !== generationRef.current) return;
      if (!token) {
        setError('Please sign in again to start a live session.');
        setState('error');
        setReconnecting(false);
        return;
      }

      // Out loud, through the speaker, even with the ringer switch off: a tutor
      // that talks is useless if a silent switch mutes it.
      applyBenchRouting();
      try {
        await AudioManager.setAudioSessionActivity(true);
      } catch {
        /* the playback context activates it too */
      }
      if (generation !== generationRef.current) return;

      // Each socket is a fresh agent session server-side, so what we know about the
      // model's modality is re-learned from its first events.
      eventStateRef.current = freshLiveEventState();

      const ws = new WebSocket(`${wsUrl}/ws/${encodeURIComponent(userId)}/${encodeURIComponent(sessionId)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', token }));   // must be the first frame
        if (retry) {
          // Put the tutor back on the step the learner is actually on.
          ws.send(JSON.stringify({ type: 'stage', stage: stageRef.current }));
          push('system', 'Back with the tutor. Carry on where you left off.');
        }
        attemptRef.current = 0;
        spanStartRef.current = Date.now();
        setState('connected');
        setReconnecting(false);
      };
      ws.onmessage = (e) => {
        if (typeof e.data === 'string') handleEvent(e.data);
      };
      ws.onerror = () => {
        // React Native dispatches close straight after error, and the reconnect is
        // decided there so both paths cannot fire it twice.
      };
      ws.onclose = () => {
        // A socket that is no longer the current one is a leftover: the session
        // was ended, or a second open replaced it. Its close must not reconnect
        // a session that is already running, nor drag the UI into "Reconnecting"
        // while the live socket is perfectly fine.
        if (wsRef.current !== ws) return;
        wsRef.current = null;
        closeSpan();
        // Whatever the tutor was part way through saying is about to be answered
        // by a different agent session. Letting it finish out of a dead socket
        // reads as the tutor talking to itself.
        stopSpeaking();

        if (closedByUs.current || refused.current) {
          setReconnecting(false);
          setState((prev) => (prev === 'error' ? prev : 'idle'));
          return;
        }

        const attempt = attemptRef.current;
        if (attempt >= RECONNECT_ATTEMPTS) {
          setReconnecting(false);
          setError('Lost the connection to the tutor.');
          setState('error');
          push('system', "Couldn't get back to the tutor. Check your connection, then start the session again.");
          return;
        }

        attemptRef.current = attempt + 1;
        if (attempt === 0) push('system', 'Connection dropped. Reconnecting…');
        setState('connecting');
        setReconnecting(true);
        reconnectTimer.current = setTimeout(() => {
          reconnectTimer.current = null;
          void openSocketRef.current(true);
        }, reconnectDelayMs(attempt));
      };
    } finally {
      // From here the socket itself is the guard, so the in-flight flag is only
      // needed until it exists.
      openingRef.current = false;
    }
  }, [wsUrl, userId, sessionId, handleEvent, push, clearReconnect, closeSpan, applyBenchRouting, stopSpeaking]);

  openSocketRef.current = openSocket;

  const connect = useCallback(async () => {
    attemptRef.current = 0;
    refused.current = false;
    await openSocket(false);
  }, [openSocket]);

  const disconnect = useCallback(() => {
    // Ending the session ends the sitting: the cap resets, and any open still
    // waiting on a token abandons itself rather than reviving what was just
    // ended.
    generationRef.current += 1;
    closedByUs.current = true;
    attemptRef.current = 0;
    spanStartRef.current = null;
    spentMsRef.current = 0;
    clearReconnect();
    if (frameTimer.current) { clearInterval(frameTimer.current); frameTimer.current = null; }
    try { wsRef.current?.send(JSON.stringify({ type: 'close' })); } catch { /* already gone */ }
    wsRef.current?.close();
    wsRef.current = null;
    applyMicIntent(false);
    stopCapture();
    closePlayback();
    // Hand the audio session back rather than leaving the app holding a
    // record-capable category with nothing recording.
    try { AudioManager.setAudioSessionOptions(IDLE_AUDIO_SESSION); } catch { /* best effort */ }
    void AudioManager.setAudioSessionActivity(false).catch(() => {});
    setCamOn(false);
    setReconnecting(false);
    setState('idle');
  }, [clearReconnect, applyMicIntent, stopCapture, closePlayback]);

  const sendText = useCallback((text: string, stage: Stage = 'inventory') => {
    const trimmed = text.trim();
    stageRef.current = stage;
    if (!trimmed || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'text', text: trimmed, stage }));
    push('user', trimmed);
  }, [push]);

  const sendStage = useCallback((stage: Stage) => {
    // Recorded even while the socket is down, so a stage chosen mid-reconnect is
    // the one the restored session resumes on.
    stageRef.current = stage;
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'stage', stage }));
  }, []);

  const sendFrame = useCallback(async () => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const b64 = await grabFrameRef.current?.();
    if (!b64) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;   // the grab takes time
    wsRef.current.send(JSON.stringify({ type: 'image', data: b64, mimeType: 'image/jpeg' }));
  }, []);

  // Background frame heartbeat while the camera is on.
  useEffect(() => {
    if (!camOn || state !== 'connected' || visionIntervalMs <= 0) return;
    frameTimer.current = setInterval(() => void sendFrame(), visionIntervalMs);
    return () => {
      if (frameTimer.current) { clearInterval(frameTimer.current); frameTimer.current = null; }
    };
  }, [camOn, state, visionIntervalMs, sendFrame]);

  // What the microphone permission is before anyone presses anything. Read once,
  // so the pre-flight can say plainly that access was refused instead of raising
  // a prompt the OS will never show again.
  useEffect(() => {
    if (!micSupported) return;
    let alive = true;
    void AudioManager.checkRecordingPermissions()
      .then((status) => { if (alive) setMicPermission(toMicPermission(status)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // The one place that decides whether the microphone is open. Every input it
  // reads is state, so a permission revoked, a phone call, the app going away or
  // a dropped socket all close it through the same door.
  useEffect(() => {
    const open = micShouldCapture({
      supported: micSupported,
      intent: micIntent,
      connected: state === 'connected',
      foreground,
      permission: micPermission,
      interrupted: audioInterrupted,
      childSafe,
      childSafeResolved,
    });
    // Recorded before either branch runs, so the awaited half of startCapture
    // re-reads this decision rather than the one input it happens to hold.
    gateOpenRef.current = open;
    if (open) void startCapture();
    else stopCapture();
  }, [
    micIntent, state, foreground, micPermission, audioInterrupted, childSafe, childSafeResolved,
    startCapture, stopCapture,
  ]);

  // Foreground and background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const active = next === 'active';
      setForeground(active);
      if (!active) {
        // Nothing records out of sight. The app declares no background audio
        // mode, and a microphone left open behind a lock screen is not something
        // a bench tutor should ever do.
        applyMicIntent(micIntentAfterBackground(micIntentRef.current, childSafe));
        return;
      }
      applyBenchRouting();
      if (!micSupported || !micIntentRef.current) return;
      // Access can be taken away in Settings while the app is in the background,
      // and nothing tells us. Ask again before the mic reopens on its own.
      void AudioManager.checkRecordingPermissions()
        .then((status) => {
          const permission = toMicPermission(status);
          setMicPermission(permission);
          if (permission === 'granted') return;
          applyMicIntent(false);
          push('system', MIC_REVOKED_LINE);
        })
        .catch(() => {});
    });
    return () => sub.remove();
  }, [applyBenchRouting, applyMicIntent, childSafe, push]);

  // Phone calls, other apps, and headsets coming and going.
  useEffect(() => {
    if (state !== 'connected') return;
    try {
      AudioManager.observeAudioInterruptions('gain');
    } catch {
      /* not every platform observes them */
    }
    const route = AudioManager.addSystemEventListener('routeChange', () => {
      // A headset went in or came out. Reassert the bench routing so unplugging
      // puts the tutor back on the speaker instead of the earpiece.
      applyBenchRouting();
    });
    const interruption = AudioManager.addSystemEventListener('interruption', (event) => {
      if (event.type === 'began') {
        setAudioInterrupted(true);
        stopSpeaking();
        return;
      }
      applyBenchRouting();
      // `shouldResume` is the system saying the interruption is over and it is
      // our turn again. Without it (a call still on hold, say) the mic stays
      // shut until the learner presses it.
      if (event.shouldResume) setAudioInterrupted(false);
    });
    return () => {
      route?.remove();
      interruption?.remove();
    };
  }, [state, applyBenchRouting, stopSpeaking]);

  // Child-safe session cap (#94): end a minor's session after the limit with a
  // gentle, kid-readable nudge to take a break. Measured on connected time, so
  // reconnecting does not buy more of it and a break does not spend it.
  useEffect(() => {
    if (state !== 'connected' || effectiveSessionLimitMs <= 0) return;
    const remaining = sessionTimeRemainingMs(
      effectiveSessionLimitMs, spentMsRef.current, spanStartRef.current, Date.now(),
    );
    const id = setTimeout(() => {
      push('system', "That's a good long session. Time for a break, ask a grown-up if you'd like to start again.");
      disconnect();
    }, remaining);
    return () => clearTimeout(id);
  }, [state, effectiveSessionLimitMs, disconnect, push]);

  // Tear everything down on unmount: an orphaned socket keeps a paid session
  // open, and an orphaned recorder keeps the microphone claimed.
  useEffect(() => () => {
    generationRef.current += 1;
    closedByUs.current = true;
    if (frameTimer.current) clearInterval(frameTimer.current);
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    micIntentRef.current = false;
    gateOpenRef.current = false;
    if (micWatchdogRef.current) clearTimeout(micWatchdogRef.current);
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      try { recorder.stop(); } catch { /* already stopped */ }
      try { recorder.clearOnAudioReady(); } catch { /* nothing registered */ }
      try { recorder.clearOnError(); } catch { /* nothing registered */ }
    }
    const ctx = playbackCtxRef.current;
    playbackCtxRef.current = null;
    scheduledRef.current = [];
    if (ctx) void ctx.close().catch(() => {});
    try { AudioManager.setAudioSessionOptions(IDLE_AUDIO_SESSION); } catch { /* best effort */ }
    void AudioManager.setAudioSessionActivity(false).catch(() => {});
  }, []);

  // Whether the tutor is talking, for the UI and for the interrupt control.
  // Polled rather than pushed: playback advances against the audio clock, not
  // against React, so there is no event to subscribe to. 100ms is well under
  // the shortest utterance and costs nothing.
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  useEffect(() => {
    if (state !== 'connected') { setAgentSpeaking(false); return; }
    const id = setInterval(() => {
      const ctx = playbackCtxRef.current;
      setAgentSpeaking(!!ctx && queuedUntilRef.current > ctx.currentTime);
    }, 100);
    return () => clearInterval(id);
  }, [state]);

  /**
   * Interrupt the tutor deliberately.
   *
   * Speaking over it stopped working the moment the microphone went half
   * duplex, and that was the trade for having no echo cancellation. This is
   * what gives the learner the interruption back, as a press rather than an
   * accident.
   */
  const interrupt = useCallback(() => { stopSpeaking(); }, [stopSpeaking]);

  return {
    state, reconnecting, transcripts, error, camOn, setCamOn,
    agentSpeaking, interrupt,
    connect, disconnect, sendText, sendStage, sendFrame,
    registerFrameGrabber,
    micSupported, micOn, micIntent, micPermission, enableMic, disableMic, toggleMic,
  };
}
