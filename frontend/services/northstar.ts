// ── North-star instrumentation (#83) ──
//
// The one metric that matters pre-launch is FBC7: the share of new learners
// who complete a real bench build within 7 days of signing up. To measure it
// we need two events:
//
//   • build_complete        — fires every time a learner finishes a build.
//   • first_build_complete  — fires once per learner, the FBC7 numerator,
//                             carrying days_since_signup and within_7_days.
//
// Everything routes through the consent-gated `track()` layer, so nothing is
// collected without permission. See metadata/founder-os/metrics.md for how
// each north-star metric is computed from these events.

import { auth } from './firebase';
import { track } from './analytics';

const firstBuildKey = (uid: string) => `ohmlet.firstBuildAt.${uid || 'anon'}`;

/** Whole days between signup and now, or undefined if the signup time is unknown. */
function daysSinceSignup(): number | undefined {
  const created = auth.currentUser?.metadata?.creationTime;
  if (!created) return undefined;
  const ms = Date.now() - new Date(created).getTime();
  if (Number.isNaN(ms) || ms < 0) return undefined;
  return Math.floor(ms / 86_400_000);
}

/**
 * Record that a learner finished a real build. Fires `build_complete` every
 * time, and `first_build_complete` exactly once per learner (the FBC7 signal).
 * Safe to call from any handler: non-blocking, never throws.
 */
export function trackBuildComplete(opts: {
  /** Where the build happened, e.g. 'live_tutor'. */
  source: string;
  /** Wall-clock length of the build session in seconds, if known. */
  sessionSeconds?: number;
  /** Verified corrections applied this session (Time Spent Building Well input, #77). */
  correctionsApplied?: number;
}): void {
  try {
    const days = daysSinceSignup();
    track('build_complete', {
      source: opts.source,
      session_seconds: opts.sessionSeconds,
      corrections_applied: opts.correctionsApplied,
      days_since_signup: days,
    });

    const uid = auth.currentUser?.uid ?? 'anon';
    const key = firstBuildKey(uid);
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, new Date().toISOString());
      track('first_build_complete', {
        source: opts.source,
        days_since_signup: days,
        within_7_days: days !== undefined ? days <= 7 : undefined,
      });
    }
  } catch {
    /* instrumentation is best-effort and must never break a user flow */
  }
}
