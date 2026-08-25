// ── Motion ──
//
// Perception, not taste: under 100ms reads as instant, 100-200 as snappy,
// 200-350 as smooth, 350-500 as deliberate, and past 500 people think it is
// broken and tap again. iOS itself uses ~350ms for a push and 0ms for a tab
// switch, which is why tab content here does not animate at all.
//
// Reanimated's `duration` is PERCEPTUAL: the wall-clock is about 1.5x, so the
// numbers below are smaller than they look.
//
// The rule for choosing: if a finger caused it, use a spring, because a spring
// can be interrupted mid-flight and retarget. If the system caused it (loading,
// a progress bar filling), use timing, because you want the same duration every
// time.

export const motion = {
  /** Finger down. No bounce, or it feels loose. */
  press: { duration: 120, dampingRatio: 1.0, overshootClamping: true },
  /** Finger up. A barely-perceptible overshoot; perfectly damped feels dead. */
  release: { duration: 220, dampingRatio: 0.85 },
  /** Something arriving. */
  enter: { duration: 320, dampingRatio: 0.9 },
  /** The only place bounce is allowed: a reward, a level-up, a streak. */
  reward: { duration: 450, dampingRatio: 0.55 },
} as const;

/** Timing durations for system-driven motion. */
export const duration = {
  instant: 0,
  snappy: 160,
  smooth: 280,
  /** A progress bar SHOULD be slow: it is showing accumulation. */
  fill: 600,
  /** XP counting up. */
  count: 800,
} as const;

/** Entrances decelerate, exits accelerate. Getting this backwards is visible. */
export const stagger = (i: number, step = 40, cap = 6) => Math.min(i, cap) * step;
