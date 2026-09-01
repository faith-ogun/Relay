# Live audio on the phone

What the tutor's voice does on a device, what broke, and how to tell quickly if
it breaks again. Written after 2026-08-27, when getting this right took seven
builds and most of an evening.

The web is not affected by any of this. Browsers resample a buffer to the
context rate for you; React Native does not.

---

## The contract

| | |
|---|---|
| Learner to server | PCM, **16 kHz**, 16-bit signed, mono, little-endian, raw binary WebSocket frames |
| Server to learner | PCM, **24 kHz**, 16-bit signed, mono, base64 in a JSON event |
| Server expects | `types.Blob(mime_type="audio/pcm;rate=16000")` (`backend/live-bridge/app/main.py`) |
| Chunk cadence | Gemini Live sends roughly one chunk every **40 ms** |

Both directions are `react-native-audio-api`, and on iOS both run on ONE shared
`AVAudioEngine` (`ios/audioapi/ios/system/AudioEngine.mm`). miniaudio is vendored
in the package but is not the iOS path; assuming it was cost a wrong diagnosis,
recorded below.

---

## The bug that cost the evening

**Symptom:** the tutor talks at about double speed and sounds grainy and
sandpapery. Every word is intelligible; nothing is wrong in any log.

**Cause:** the engine reads a buffer at the **context's** sample rate and ignores
the buffer's own.

```cpp
// AudioBufferSourceNode.cpp, runBufferProcessor
const float sampleRate = getContextSampleRate();
```

So 24,000 samples of tutor sitting in a context running at the device's rate get
read one sample per output frame and finish early:

```
context 48000Hz  ->  1.000s plays in 0.500s  ->  2.00x
context 44100Hz  ->  1.000s plays in 0.544s  ->  1.84x
```

The graininess was the same fault, not a second one: reading samples at the wrong
rate is harsh, and the scheduling counted frames at 24 kHz while the clock ran at
the device rate, so chunks were also placed at roughly half their intended
spacing and overlapped each other.

**Fix:** take whatever rate the hardware is running at and convert into it.

```ts
ctx = new AudioContext();                 // NOT { sampleRate: 24000 }
const rate = ctx.sampleRate;
const voice = resampleTo(samples, AGENT_SAMPLE_RATE, rate);
const buffer = ctx.createBuffer(1, voice.length, rate);
```

Buffer rate equals context rate by construction. Nothing downstream can disagree
about how fast to read it.

**Do not** "fix" this by asking for a 24 kHz context. That was tried. It does not
survive the engine's format negotiation on a real device, and it fails silently:
the code looks correct and the tutor talks at double speed.

---

## The other two things, both real, both separate

**Echo cancellation was off, and the first explanation of why was wrong.**

Without cancellation the loudspeaker goes straight back into the microphone: the
model hears itself, cuts its own sentence off, and its words arrive on the
learner's side of the transcript.

The first diagnosis said `react-native-audio-api` records through miniaudio,
which hardcodes `kAudioUnitSubType_RemoteIO`, so Apple's canceller was
unreachable. **That was wrong about iOS.** miniaudio is in the tree, but
`ios/audioapi/ios/core/IOSAudioRecorder.mm` records through
`[AudioEngine sharedInstance]`, and `system/AudioEngine.mm` holds ONE
`AVAudioEngine` used for capture and playback both. The RemoteIO in miniaudio is
a path iOS never takes.

That distinction is the whole thing, because Apple's canceller needs to see both
directions. One shared engine means
`audioEngine.inputNode.setVoiceProcessingEnabled:YES` is all it takes, and the
library simply never called it. `patches/react-native-audio-api+0.12.2.patch`
adds that call; `scripts/check-patches.mjs` fails if it stops being applied.

**Watch the playback quality when changing this.** The voice-processing unit is
duplex, so enabling it on the input affects the OUTPUT too, which is the same
mechanism that made the tutor sound like a phone call under `iosMode:
'videoChat'`. If the voice degrades after a change here, this is the first thing
to suspect.

Half duplex is kept **as well as** the canceller, deliberately: while the tutor
is speaking, and for 250 ms after while the last buffer leaves the speaker, no
microphone frames are sent (`micGatedForEcho`). Belt and braces until the
canceller has been heard working on a device. Once it has, relaxing the gate is
what gives barge-in back, and that is a one-constant change to make on its own so
it can be judged on its own.

**Do not set a telephony session mode.** `iosMode: 'videoChat'` (and `voiceChat`,
`gameChat`, `voicePrompt`) engages iOS voice processing and pulls the session to
a voice-optimised rate. It was set here for the echo cancellation that does not
exist on this path, so it cost fidelity and bought nothing. Use `default`.
`check-live-audio.mjs` refuses the telephony modes.

---

## If the voice sounds wrong again

Ask which of these it is, because they point in completely different directions.

| What it sounds like | Almost certainly |
|---|---|
| Too fast or too slow, pitch shifted | Sample rate. The buffer and the context disagree |
| Talks over itself, its words appear as the learner's | Echo. The gate is off or the mic is not being gated |
| Gaps mid-sentence | Underrun. The cushion is too small for the arrival jitter |
| Like a phone call, narrowband | A telephony session mode is back |

Then, in this order:

1. `cd mobile && node scripts/check-playback-audio.mjs`. It renders the real
   decode and resample path over synthesised chunks and measures the result at
   24k, 44.1k and 48k out: a one second utterance must last one second, chunk
   boundaries must not step further than the waveform's own slope, and a 440 Hz
   tone must still be 440 Hz. **This catches the rate bug offline.** Reverting
   the resampler makes it report `1.84x`, `2.00x` and a 440 Hz tone at 876 Hz.
2. `node scripts/check-live-audio.mjs` for the wire format, the echo gate, the
   session mode and the cushion.
3. Only then put a build on a device.

That order is the whole lesson. Six of the seven builds were shipped to a phone
on the strength of reading the engine's source and reasoning about what it ought
to do. Every one was wrong, and each cost a round trip. The seventh measured.

---

## Reading the engine is not the same as measuring it

The rate bug was "ruled out" twice by reading `IOSAudioPlayer`, seeing it create
its `AVAudioSourceNode` at the rate requested, and concluding the rate was
honoured. That checked the layer and never checked the outcome.

If a device measurement is ever needed again: `log collect --device-udid` needs
root and `log stream --device` does not exist on macOS 26, so neither is
available casually. The workable options are a `__DEV__`-only readout in the live
view, or reporting the numbers to the bridge and reading them out of Cloud
Logging.

A runtime speed probe is the cheapest useful measurement: schedule a buffer of
known duration, time how long until `onEnded`, and the ratio of expected to
actual is how much too fast it played. Note that `onEnded` fires a little late,
so the ratio reads low: **a healthy session measures around 0.85, not 1.00.**
Trust it for "is this 2x" and not for finer than about 20%.

---

## Constants, and why they are what they are

| Constant | Value | Why |
|---|---|---|
| `MIC_SAMPLE_RATE` | 16000 | What the bridge declares to Gemini. Changing one without the other is silent chipmunks |
| `AGENT_SAMPLE_RATE` | 24000 | What Gemini Live sends. Resampled to the output rate on arrival |
| `PLAYBACK_LEAD_S` | 0.28 | Chunks arrive every 40 ms and are consumed as fast as they land. 80 ms underran on any jitter, and an underrun inserts a whole cushion of silence. Above ~0.4 s the learner notices the tutor hesitating |
| `ECHO_GATE_TAIL_S` | 0.25 | The last buffer leaving the speaker, plus the room. Shorter and the closing syllable returns as learner input |

---

## Both optionals, now done

- ~~`createBufferQueueSource`~~ **done.** One long-lived node walking a queue
  instead of a source node per chunk, so a late chunk resumes the sentence rather
  than leaving a hole. It shipped total silence the first time because it was
  started with an **empty** queue, and `processNode` returns early on an empty
  buffer deque without ever reaching the code that moves the node from SCHEDULED
  to PLAYING. Enqueue first, then start; `check-live-audio.mjs` asserts that
  order. Because a native node cannot be exercised off a device, the code does
  not trust it: if the first buffer has not reported back by the time it should
  have finished, the queue is abandoned and the rest of the session uses the
  per-chunk scheduler, which is known to work.
