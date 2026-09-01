// ── Achievement metric events ──
//
// 24 of the 50 achievements were permanently unearnable because nine of the
// thirteen metrics were never counted anywhere: the workspace only ever supplied
// xp, streak, builds and units, so every achievement about live sessions,
// drawings, perfect builds, twins, posts, comments and challenges sat at zero
// forever no matter what the learner did.
//
// Emitters (the live tutor, the lesson runner, the twin studio, the community
// view) publish an event; ONE listener in the workspace owns the counters and
// persists them. That avoids prop-drilling a setter through half the view tree,
// and keeps a single writer so the debounced save cannot race itself.

export type CountedMetric =
  | 'liveSessions'
  | 'drawings'
  | 'perfect'
  | 'twins'
  | 'posts'
  | 'comments'
  | 'challenges'
  | 'leagueWins';

const EVENT = 'ohmlet:metric';

/**
 * Record that something achievement-worthy happened. Fire-and-forget, safe to
 * call from anywhere, and a no-op outside the browser.
 */
export function recordMetric(metric: CountedMetric, amount = 1): void {
  if (typeof window === 'undefined' || amount === 0) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { metric, amount } }));
}

/** Subscribe to metric events. Returns an unsubscribe function. */
export function onMetric(handler: (metric: CountedMetric, amount: number) => void): () => void {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<{ metric: CountedMetric; amount: number }>).detail;
    if (detail?.metric) handler(detail.metric, detail.amount ?? 1);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
