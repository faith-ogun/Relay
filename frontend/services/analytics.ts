// ── Product analytics (#59) ──
//
// A small, typed event layer over Firebase Analytics for the funnel, retention,
// and cancellation signals we actually make decisions on. Two hard rules:
//
//   1. Consent-gated (ADR-0005): every call no-ops unless the user has opted in
//      to analytics cookies. The gate is `getOhmletAnalytics()`, which itself
//      returns null before consent — so nothing is collected without permission.
//   2. One typed catalogue: events are named in `AnalyticsEvent`, so the funnel
//      stays consistent and greppable and a rename is a single edit.
//
// Firebase Analytics already captures page_view/session automatically; this file
// is for the *product* events those don't cover.

import { logEvent } from 'firebase/analytics';
import { getOhmletAnalytics } from './firebase';

/** The product events we track. Keep names snake_case (GA4 convention). */
export type AnalyticsEvent =
  // Acquisition / activation funnel
  | 'sign_up'
  | 'login'
  | 'onboarding_complete'
  | 'lesson_start'
  | 'lesson_complete'
  | 'live_session_start'
  | 'live_session_end'
  // Engagement / retention
  | 'streak_extended'
  | 'challenge_join'
  | 'challenge_leave'
  | 'simulator_open'
  | 'sketch_compile'
  // Monetisation. The actual subscription cancel completes inside Stripe's
  // hosted Portal (we redirect away), so it is observed server-side via the
  // webhook; `billing_portal_open` is the client-side cancellation-funnel entry.
  | 'paywall_view'
  | 'checkout_start'
  | 'subscribe'
  | 'billing_portal_open';

/** Loose, GA-friendly param values. */
export type AnalyticsParams = Record<string, string | number | boolean | undefined>;

/**
 * Record a product event. Safe to call anywhere: it is non-blocking, never
 * throws, and silently no-ops when analytics consent has not been granted.
 */
export function track(event: AnalyticsEvent, params?: AnalyticsParams): void {
  // Fire-and-forget; analytics must never block or break a user flow.
  void (async () => {
    try {
      const analytics = await getOhmletAnalytics(); // null without consent
      if (!analytics) return;
      // Cast to the generic string overload: some of our names (login, sign_up)
      // collide with GA's reserved-event overloads that demand specific params.
      logEvent(analytics, event as string, sanitize(params));
    } catch {
      /* analytics is best-effort */
    }
  })();
}

/** Drop undefined values so we never log empty params. */
function sanitize(params?: AnalyticsParams): AnalyticsParams | undefined {
  if (!params) return undefined;
  const out: AnalyticsParams = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}
