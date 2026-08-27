// What the learner reads during a live session, driven from recorded server events.
//
// This exists because the mobile hook shipped reading only `content.parts[].text`
// and pushing every one of them as the tutor. Against the model production runs
// (a native-audio model with output_audio_transcription on, see
// backend/live-bridge/app/main.py `_build_run_config`) those parts carry audio and
// no text at all, so the mobile transcript stayed empty however much the tutor
// said, while the web client read the same session fine off `outputTranscription`.
// The same handler had no `content.role` check, so anything the server addressed
// to the model in the learner's voice, including its own `[stage=wiring]` and
// `[stage changed to wiring]` plumbing, would have been printed as tutor speech.
//
// The event shapes below are the wire format, not an approximation: the bridge
// relays ADK events as `event.model_dump_json(exclude_none=True, by_alias=True)`,
// which is why the fields are camelCase, why absent fields are missing rather than
// null, and why every transcription turn arrives as `partial: true` fragments
// followed by one settled `partial: false` repeat of the whole turn
// (google/adk/models/gemini_llm_connection.py).
//
// Each scenario is also run through `legacy`, the handler as it shipped, and any
// scenario marked `bites` MUST come out wrong there. A check that cannot fail on
// the bug it was written for is decoration.
//
//   node scripts/check-live-transcript.mjs

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ts = require('typescript');

// ── Load the real hook module ───────────────────────────────────────────────
//
// The event handling is pure and exported, so it can be driven directly. React,
// react-native, react-native-audio-api and the app's own services are stubbed:
// nothing below constructs the hook, so they are never called.

function loadHook() {
  const src = readFileSync(new URL('../src/hooks/useLiveBridge.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;

  const stub = (id) => {
    if (id === 'react') {
      const noop = () => {};
      return { useCallback: noop, useEffect: noop, useRef: noop, useState: noop };
    }
    if (id === 'react-native') {
      return {
        Platform: { OS: 'ios' },
        AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
      };
    }
    if (id === 'react-native-audio-api') {
      const unused = () => { throw new Error('the harness never runs the hook body'); };
      return { AudioContext: unused, AudioRecorder: unused, AudioManager: {} };
    }
    if (id === '../services/firebase') return { getIdToken: async () => 'test-token' };
    if (id === '../services/pcm') return { base64ToBytes: () => new Uint8Array() };
    throw new Error(`useLiveBridge.ts imported something the harness does not stub: ${id}`);
  };

  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', js)(stub, mod, mod.exports);
  return mod.exports;
}

const {
  reduceLiveEvent, freshLiveEventState, appendTranscript, stripStagePlumbing,
  reconnectDelayMs, sessionTimeRemainingMs,
  RECONNECT_ATTEMPTS, CHILD_SESSION_LIMIT_MS, TRANSCRIPT_LIMIT,
} = loadHook();

// ── Recorded event shapes ───────────────────────────────────────────────────

const AGENT = 'ohmlet_live_agent';
let clock = 1756200000;

/** The envelope every ADK event carries once the bridge has serialised it. */
const envelope = (author = AGENT) => ({
  id: `e${(clock += 1)}`,
  invocationId: 'e-8f0c1a',
  author,
  actions: { stateDelta: {}, artifactDelta: {}, requestedAuthConfigs: {} },
  timestamp: clock,
});

/** Native-audio reply: 24kHz PCM in an inline blob, no text anywhere. */
const audioChunk = (data) => ({
  ...envelope(),
  content: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data } }], role: 'model' },
});

/** A fragment of the tutor's speech as it is transcribed. */
const outPartial = (text) => ({
  ...envelope(),
  partial: true,
  outputTranscription: { text, finished: false },
});

/** The whole tutor turn, repeated once the turn settles. */
const outFinal = (text) => ({
  ...envelope(),
  partial: false,
  outputTranscription: { text, finished: true },
});

const inPartial = (text) => ({
  ...envelope(),
  partial: true,
  inputTranscription: { text, finished: false },
});

const inFinal = (text) => ({
  ...envelope(),
  partial: false,
  inputTranscription: { text, finished: true },
});

const turnComplete = () => ({ ...envelope(), turnComplete: true });
const interrupted = () => ({ ...envelope(), interrupted: true });

/**
 * User-role content. The bridge sends the learner's turn to the model as
 * `[stage=wiring] <text>` and a stage switch as `[stage changed to wiring]`
 * (backend/live-bridge/app/main.py). ADK does not echo those back today, so this
 * is the shape a client must survive rather than one it sees every session.
 */
const userContent = (text) => ({
  ...envelope('user'),
  content: { parts: [{ text }], role: 'user' },
});

/** Text-only fallback model: response_modalities ["TEXT"], streamed in fragments. */
const modelTextFragment = (text) => ({
  ...envelope(),
  partial: true,
  content: { parts: [{ text }], role: 'model' },
});

/** The merged full-text response ADK yields at the end of a text turn. */
const modelTextFull = (text) => ({
  ...envelope(),
  content: { parts: [{ text }], role: 'model' },
});

const functionCall = (name, args) => ({
  ...envelope(),
  content: { parts: [{ functionCall: { id: 'fc-1', name, args } }], role: 'model' },
});

/** ADK builds tool results as user-role content. They are not learner speech. */
const functionResponse = (name, response) => ({
  ...envelope('user'),
  content: { parts: [{ functionResponse: { id: 'fc-1', name, response } }], role: 'user' },
});

const usage = () => ({ ...envelope(), usageMetadata: { totalTokenCount: 812 } });

const refusal = (code, message) => ({ type: 'error', code, message });

// ── Drivers ─────────────────────────────────────────────────────────────────

/** The shipped behaviour: reduce each event, apply each action, exactly as the hook does. */
function drive(events, seed = []) {
  let state = freshLiveEventState();
  let transcript = seed.map((t, i) => ({ id: `s${i}`, ...t }));
  let audioChunks = 0;
  let interrupts = 0;
  let refused = null;
  let seq = 0;

  for (const event of events) {
    const out = reduceLiveEvent(state, event);
    state = out.state;
    for (const action of out.actions) {
      if (action.kind === 'audio') { audioChunks += 1; continue; }
      // Barge-in: the learner talked over the tutor and everything still queued
      // is dropped. It changes no line of the transcript, so it is counted
      // rather than rendered.
      if (action.kind === 'interrupt') { interrupts += 1; continue; }
      if (action.kind === 'refused') {
        refused = action;
        seq += 1;
        transcript = appendTranscript(transcript, { id: `t${seq}`, role: 'system', text: action.message });
        continue;
      }
      seq += 1;
      transcript = appendTranscript(
        transcript,
        { id: `t${seq}`, role: action.role, text: action.text },
        action.echo === true,
      );
    }
  }
  return { lines: transcript.map(({ role, text }) => ({ role, text })), audioChunks, interrupts, refused };
}

/**
 * The handler as it shipped in mobile/src/hooks/useLiveBridge.ts before this fix:
 * content.parts only, every text part attributed to the tutor, no role check.
 */
function legacy(events, seed = []) {
  const lines = seed.map((t) => ({ ...t }));
  for (const event of events) {
    if (event.type === 'error') { lines.push({ role: 'system', text: String(event.message) }); continue; }
    const parts = event.content?.parts;
    if (!parts) continue;
    for (const part of parts) {
      if (typeof part.text === 'string' && part.text.trim()) lines.push({ role: 'agent', text: part.text });
    }
  }
  return { lines };
}

// ── Scenarios ───────────────────────────────────────────────────────────────

const failures = [];
let vacuous = 0;

/**
 * @param name        what a learner should see
 * @param events      the recorded sequence
 * @param expected    the transcript, in order
 * @param opts.seed   lines already on screen (a typed turn shown optimistically)
 * @param opts.bites  true when the pre-fix handler must get this wrong
 * @param opts.also   extra assertions on the drive result
 */
function scenario(name, events, expected, opts = {}) {
  const { seed = [], bites = false, also } = opts;
  try {
    const got = drive(events, seed);
    assert.deepEqual(got.lines, expected);
    if (also) also(got);

    if (bites) {
      const before = legacy(events, seed);
      if (JSON.stringify(before.lines) === JSON.stringify(expected)) {
        vacuous += 1;
        failures.push(`${name}: marked as biting, but the pre-fix handler passes it too`);
        console.log(`  VACUOUS  ${name}`);
        return;
      }
    }
    console.log(`  ok   ${name}${bites ? '   (pre-fix handler fails this)' : ''}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`  FAIL ${name}`);
    console.log(`       ${String(err.message).split('\n').slice(0, 6).join('\n       ')}`);
  }
}

console.log('live transcript');

scenario(
  'the tutor speaks: audio plays and the words appear once, whole',
  [
    audioChunk('AAAA'), outPartial('Take the '), audioChunk('BBBB'), outPartial('red jumper '),
    audioChunk('CCCC'), outPartial('to row twelve.'),
    outFinal('Take the red jumper to row twelve.'),
    turnComplete(), usage(),
  ],
  [{ role: 'agent', text: 'Take the red jumper to row twelve.' }],
  { bites: true, also: (got) => assert.equal(got.audioChunks, 3, 'every audio chunk must still reach the player') },
);

scenario(
  'a stage switch is plumbing, not something the tutor said',
  [userContent('[stage changed to wiring]')],
  [],
  { bites: true },
);

scenario(
  "the learner's own turn stays the learner's, without the stage prefix",
  [userContent('[stage=wiring] the LED is in backwards')],
  [{ role: 'user', text: 'the LED is in backwards' }],
  { bites: true },
);

scenario(
  'a typed turn already on screen is not doubled by the server echo',
  [userContent('[stage=wiring] the LED is in backwards')],
  [{ role: 'user', text: 'the LED is in backwards' }],
  { seed: [{ role: 'user', text: 'the LED is in backwards' }], bites: true },
);

scenario(
  'spoken learner words arrive on inputTranscription and are attributed to the learner',
  [inPartial('is this '), inPartial('the right resistor'), inFinal('is this the right resistor')],
  [{ role: 'user', text: 'is this the right resistor' }],
  { bites: true },
);

scenario(
  'tool traffic is never rendered as speech',
  [
    functionCall('generate_arduino_code', { goal: 'blink an LED on pin 9' }),
    functionResponse('generate_arduino_code', { sketch: 'void setup() {}' }),
    outPartial('Here is the sketch.'), outFinal('Here is the sketch.'),
  ],
  [{ role: 'agent', text: 'Here is the sketch.' }],
);

scenario(
  'text-only fallback model: one line for the turn, not one per fragment',
  [
    modelTextFragment('Check '), modelTextFragment('the ground rail'),
    modelTextFull('Check the ground rail.'), turnComplete(),
  ],
  [{ role: 'agent', text: 'Check the ground rail.' }],
  { bites: true },
);

scenario(
  'an interrupted turn keeps what was transcribed and nothing more',
  [
    outPartial('Now connect the '), interrupted(),
    outFinal('Now connect the '),
  ],
  [{ role: 'agent', text: 'Now connect the' }],
  {
    // And the interruption has to reach the player, or the tutor carries on
    // talking over the learner who just cut in. scripts/check-live-audio.mjs
    // is where the flush itself is checked.
    also: (got) => assert.equal(got.interrupts, 1, 'the barge-in never reached the player'),
  },
);

scenario(
  'a refusal is shown once and reported to the caller',
  [refusal('live_budget_exhausted', "You've reached today's live tutoring time on this plan.")],
  [{ role: 'system', text: "You've reached today's live tutoring time on this plan." }],
  {
    also: (got) => {
      assert.equal(got.refused?.code, 'live_budget_exhausted');
      assert.equal(got.refused?.message, "You've reached today's live tutoring time on this plan.");
    },
  },
);

scenario(
  'junk on the socket changes nothing',
  [null, 42, 'not an object', {}, { content: {} }, { content: { parts: [] } }, { content: { parts: [{}] } }],
  [],
);

// A whole exchange, in the order the bridge actually relays it.
scenario(
  'a recorded session reads as a conversation',
  [
    outPartial('Show me '), outPartial('your parts.'), outFinal('Show me your parts.'), turnComplete(),
    userContent('[stage changed to inventory]'),
    inPartial('here they '), inPartial('are'), inFinal('here they are'),
    audioChunk('AAAA'), outPartial('I can see the LDR '), audioChunk('BBBB'),
    outPartial('and the buzzer.'), outFinal('I can see the LDR and the buzzer.'), turnComplete(),
    userContent('[stage changed to wiring]'),
    userContent('[stage=wiring] which row does the LDR go in'),
    audioChunk('CCCC'), outPartial('Row twelve, '), outPartial('either side of the gap.'),
    outFinal('Row twelve, either side of the gap.'), turnComplete(), usage(),
  ],
  [
    { role: 'agent', text: 'Show me your parts.' },
    { role: 'user', text: 'here they are' },
    { role: 'agent', text: 'I can see the LDR and the buzzer.' },
    { role: 'user', text: 'which row does the LDR go in' },
    { role: 'agent', text: 'Row twelve, either side of the gap.' },
  ],
  { bites: true, also: (got) => assert.equal(got.audioChunks, 3) },
);

// A long session must stay bounded and keep the newest lines.
scenario(
  'a long session keeps the newest lines and stays bounded',
  Array.from({ length: TRANSCRIPT_LIMIT + 50 }, (_, i) => outFinal(`line ${i}`)),
  Array.from({ length: TRANSCRIPT_LIMIT }, (_, i) => ({ role: 'agent', text: `line ${i + 50}` })),
);

// ── Prefix stripping, directly ──────────────────────────────────────────────

console.log('stage plumbing');
for (const [input, want] of [
  ['[stage changed to wiring]', null],
  ['[stage changed to code]  ', null],
  ['[stage=wiring] the LED is in backwards', 'the LED is in backwards'],
  ['[stage=test] does 4.7k work here?', 'does 4.7k work here?'],
  ['[STAGE=CODE] upload it', 'upload it'],
  ['no tag at all', 'no tag at all'],
  ['the resistor is [stage=wiring] shaped', 'the resistor is [stage=wiring] shaped'],
]) {
  try {
    assert.equal(stripStagePlumbing(input), want);
    console.log(`  ok   ${JSON.stringify(input)} -> ${JSON.stringify(want)}`);
  } catch (err) {
    failures.push(`stripStagePlumbing(${JSON.stringify(input)}): ${err.message}`);
    console.log(`  FAIL ${JSON.stringify(input)}`);
  }
}

// ── Reconnect and the child cap, against the web hook they were ported from ──

console.log('session policy');
const web = readFileSync(new URL('../../frontend/hooks/useLiveBridge.ts', import.meta.url), 'utf8');

function policy(name, fn) {
  try { fn(); console.log(`  ok   ${name}`); }
  catch (err) { failures.push(`${name}: ${err.message}`); console.log(`  FAIL ${name}`); console.log(`       ${err.message.split('\n')[0]}`); }
}

policy('backoff schedule matches the web client', () => {
  const delays = Array.from({ length: RECONNECT_ATTEMPTS }, (_, i) => reconnectDelayMs(i));
  assert.deepEqual(delays, [1000, 2000, 4000, 8000, 10000]);
  assert.match(web, /Math\.min\(1000 \* Math\.pow\(2, attempt\), 10000\)/);
  assert.match(web, /attempt < 5/);
  assert.equal(RECONNECT_ATTEMPTS, 5);
});

policy('the reconnect gives up rather than retrying forever', () => {
  assert.equal(reconnectDelayMs(20), 10000, 'the delay is capped, so the attempt count is what ends it');
  const hook = readFileSync(new URL('../src/hooks/useLiveBridge.ts', import.meta.url), 'utf8');
  assert.match(hook, /attempt >= RECONNECT_ATTEMPTS/);
  assert.match(hook, /Couldn't get back to the tutor/);
});

policy('the child session cap matches the web cap', () => {
  assert.equal(CHILD_SESSION_LIMIT_MS, 30 * 60 * 1000);
  assert.match(web, /childSafe \? 30 \* 60 \* 1000 : 0/);
});

// The cap is arithmetic, so it is checked as arithmetic rather than by reading
// the effect that schedules it. minute(n) is n minutes in ms.
const minute = (n) => n * 60 * 1000;

policy('the cap runs the full 30 minutes for an uninterrupted session', () => {
  const start = 1_000_000;
  assert.equal(sessionTimeRemainingMs(CHILD_SESSION_LIMIT_MS, 0, start, start), minute(30));
  assert.equal(
    sessionTimeRemainingMs(CHILD_SESSION_LIMIT_MS, 0, start, start + minute(29)),
    minute(1),
  );
  assert.equal(
    sessionTimeRemainingMs(CHILD_SESSION_LIMIT_MS, 0, start, start + minute(31)),
    0,
    'past the cap there is nothing left, and the timer fires at once',
  );
});

policy('a reconnect does not buy a minor more time', () => {
  // Twenty minutes in, the socket drops and comes back: the twenty are spent.
  const resumed = 2_000_000;
  assert.equal(
    sessionTimeRemainingMs(CHILD_SESSION_LIMIT_MS, minute(20), resumed, resumed),
    minute(10),
  );
  assert.equal(
    sessionTimeRemainingMs(CHILD_SESSION_LIMIT_MS, minute(20), resumed, resumed + minute(10)),
    0,
  );
});

policy('a break after a dropped connection does not spend the cap', () => {
  // Ten minutes used, then the learner is away for forty and starts again.
  // Measured on the wall clock this returns 0 and the new session dies on open.
  const later = 5_000_000;
  assert.equal(
    sessionTimeRemainingMs(CHILD_SESSION_LIMIT_MS, minute(10), later, later),
    minute(20),
  );
});

policy('no cap means no timer', () => {
  assert.equal(sessionTimeRemainingMs(0, minute(99), 1, 2), 0);
});

policy('a socket that is no longer the current one cannot touch the session', () => {
  // Two opens can race (the guard sits before an awaited getIdToken), and a
  // deliberate End nulls the ref before the close arrives. Either way the
  // leftover socket's close must not schedule a reconnect over a live one.
  const hook = readFileSync(new URL('../src/hooks/useLiveBridge.ts', import.meta.url), 'utf8');
  assert.match(hook, /ws\.onclose = \(\) => \{[\s\S]{0,400}?if \(wsRef\.current !== ws\) return;/);
  assert.match(hook, /if \(wsRef\.current \|\| openingRef\.current\) return;/);
  // One check after each await in the open path: a token fetch and the audio
  // session call both take time the learner can leave during. Scoped to
  // openSocket, because the same awaits appear elsewhere in the hook where the
  // generation is not what guards them.
  const from = hook.indexOf('const openSocket = useCallback');
  const to = hook.indexOf('openSocketRef.current = openSocket;');
  assert.ok(from >= 0 && to > from, 'openSocket is no longer where this check looks for it');
  const open = hook.slice(from, to);
  const awaits = open.match(/await [A-Za-z_$][\w$.]*\(/g) ?? [];
  const guards = open.match(/if \(generation !== generationRef\.current\) return;/g) ?? [];
  assert.ok(awaits.length >= 2, 'the open path awaits a token and the audio session');
  assert.equal(guards.length, awaits.length, 'every await in the open path needs a generation check after it');
});

policy('child mode stays behind EXPO_PUBLIC_OHMLET_CHILD_MODE', () => {
  const screen = readFileSync(new URL('../src/app/live.tsx', import.meta.url), 'utf8');
  assert.match(screen, /useChildSafe\(\)/, 'the live screen must resolve child mode through useChildSafe');
  assert.match(screen, /childSafe,/, 'and pass it to the hook');
  const gate = readFileSync(new URL('../src/hooks/useChildSafe.ts', import.meta.url), 'utf8');
  assert.match(gate, /CHILD_MODE_ENABLED/);
  const flag = readFileSync(new URL('../src/services/ageModel.ts', import.meta.url), 'utf8');
  assert.match(flag, /EXPO_PUBLIC_OHMLET_CHILD_MODE/);
});

// ── Result ──────────────────────────────────────────────────────────────────

if (failures.length) {
  console.error(`\n${failures.length} problem${failures.length === 1 ? '' : 's'}:`);
  for (const f of failures) console.error(`  - ${f}`);
  if (vacuous) console.error(`\n${vacuous} scenario(s) no longer bite: the pre-fix handler passes them, so they prove nothing.`);
  process.exit(1);
}
console.log('\n  ok    the transcript a learner reads is the one this file describes');
