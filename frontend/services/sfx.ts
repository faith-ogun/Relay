// ── Sound effects ──
//
// Tiny Web Audio synthesiser for answer feedback — Duolingo-style. No audio
// files (no assets to ship, no licensing): we synthesise short, pleasant tones
// on the fly. Sounds only fire from user gestures (answering), which satisfies
// browser autoplay rules. Respects a persisted mute preference and the OS
// "reduce motion / reduced sound" intent is honoured via the explicit toggle.

const MUTE_KEY = 'ohmlet:sfx-muted';

let ctx: AudioContext | null = null;

const getCtx = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
};

export const isSfxMuted = (): boolean => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
};

export const setSfxMuted = (muted: boolean): void => {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* ignore */
  }
};

/** One shaped sine/triangle blip with a soft attack + exponential release. */
const tone = (
  audio: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
  gain = 0.18,
  type: OscillatorType = 'sine',
) => {
  const osc = audio.createOscillator();
  const env = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  env.gain.setValueAtTime(0.0001, startAt);
  env.gain.exponentialRampToValueAtTime(gain, startAt + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(env).connect(audio.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
};

/** Bright rising two-note chime for a correct answer. */
export const playCorrect = (): void => {
  if (isSfxMuted()) return;
  const audio = getCtx();
  if (!audio) return;
  const t = audio.currentTime;
  tone(audio, 660, t, 0.12, 0.16); // E5
  tone(audio, 988, t + 0.09, 0.22, 0.18); // B5 — resolves up, feels rewarding
};

/** Soft, low, non-harsh "not quite" for a wrong answer. */
export const playWrong = (): void => {
  if (isSfxMuted()) return;
  const audio = getCtx();
  if (!audio) return;
  const t = audio.currentTime;
  tone(audio, 196, t, 0.18, 0.14, 'triangle'); // G3
  tone(audio, 165, t + 0.12, 0.2, 0.12, 'triangle'); // E3 — gentle downward, not a buzzer
};

/** Celebratory arpeggio for finishing a lesson/level. */
export const playComplete = (): void => {
  if (isSfxMuted()) return;
  const audio = getCtx();
  if (!audio) return;
  const t = audio.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => tone(audio, f, t + i * 0.085, 0.22, 0.16)); // C-E-G-C
};
