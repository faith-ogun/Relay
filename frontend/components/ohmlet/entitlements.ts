// ── Entitlements: the single source of truth for who can use what ──
//
// One mechanism drives two things:
//   1. Plan gating   — Free / Pro / max see different features.
//   2. Beta gating    — features still in beta are flagged regardless of plan.
//
// The golden rule: the UI hides/locks for nice UX, but access is ALSO enforced
// on the server (the live-bridge / quiz-engine check the user's plan before
// doing expensive work). Never trust the client alone — a determined user can
// flip a flag in devtools, so the server is the real gate. This file is the
// shared contract both sides read from.

export type Plan = 'free' | 'pro' | 'max';

export type Feature =
  | 'path' // guided learning path
  | 'community' // social feed + leagues
  | 'live' // live voice + camera tutor
  | 'sandbox' // 3D breadboard (beta)
  | 'drawing' // drawing practice (beta)
  | 'twin3d' // 3D digital twin of a finished build
  | 'priorityTutor' // priority model routing (less queueing, Pro 2.5-pro by default)
  | 'interview'; // Interview Mode (career prep) — the Max tier headline

export interface PlanMeta {
  id: Plan;
  label: string;
  /**
   * Published monthly price in USD, null = free.
   *
   * MUST match PricingPage.tsx and mobile/src/services/entitlements.ts. It did
   * not: this module said 12 and 29 while both other sources said 15.99 and
   * 34.99, so the app and its own pricing page disagreed about what Ohmlet
   * costs. frontend/scripts/check-prices.mjs now refuses a build where the
   * three disagree.
   */
  priceMonthly: number | null;
  blurb: string;
}

export const PLAN_META: Record<Plan, PlanMeta> = {
  free: { id: 'free', label: 'Free', priceMonthly: null, blurb: 'Learn the fundamentals and try a live session.' },
  pro: { id: 'pro', label: 'Pro', priceMonthly: 12.99, blurb: 'Unlimited learning and real bench time.' },
  max: { id: 'max', label: 'Max', priceMonthly: 24.99, blurb: 'Everything in Pro, plus Interview Mode.' },
};

// Which features each plan unlocks. Plans are additive (pro = free + extra).
const FREE: Feature[] = ['path', 'community', 'live', 'sandbox', 'drawing'];
const PRO: Feature[] = [...FREE, 'twin3d', 'priorityTutor'];
const MAX: Feature[] = [...PRO, 'interview'];

export const FEATURES_BY_PLAN: Record<Plan, Feature[]> = {
  free: FREE,
  pro: PRO,
  max: MAX,
};

// Features still in beta. These are gated by a "Beta" treatment (not a paywall):
// available, but clearly flagged as in-progress so we set expectations.
export const BETA_FEATURES: ReadonlySet<Feature> = new Set<Feature>(['sandbox', 'drawing']);

// Monthly live-tutor budget per plan (minutes). These match the pricing page,
// the phone's plan cards, and the server-enforced caps in backend. No plan is
// unlimited: the live tutor has real per-minute cost (~$3/active hr), so every
// tier is bounded. The server is the real gate; this mirror is for UX.
//
// The comment here used to claim Pro 10 hr and Max 30 hr while the numbers below
// said 4 and 9. A comment that contradicts the value under it is worse than no
// comment, so the hours now come from the numbers: check-prices.mjs derives the
// advertised hour copy from these and fails when the two drift apart.
export const LIVE_MINUTES_PER_MONTH: Record<Plan, number> = {
  free: 60,
  pro: 150,
  max: 300,
};

/**
 * A plan's live budget written the way a learner reads it: "2.5 hours", "5
 * hours", "1 hour". Never minutes, and never rounded.
 *
 * `Math.round(minutes / 60)` was doing this job at the upgrade prompt, which was
 * exact while every cap was a whole number of hours and became an overclaim the
 * moment one was not: Pro's 150 minutes rounds up to 3, so the button offered an
 * extra half hour nobody had bought.
 */
export const liveHoursLabel = (plan: Plan): string => {
  const hours = LIVE_MINUTES_PER_MONTH[plan] / 60;
  const figure = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return `${figure} ${hours === 1 ? 'hour' : 'hours'}`;
};

export const planHas = (plan: Plan, feature: Feature): boolean => FEATURES_BY_PLAN[plan].includes(feature);

export const isBetaFeature = (feature: Feature): boolean => BETA_FEATURES.has(feature);

/** The lowest plan that unlocks a feature (for "Upgrade to X" copy). */
export const requiredPlan = (feature: Feature): Plan => {
  if (planHas('free', feature)) return 'free';
  if (planHas('pro', feature)) return 'pro';
  return 'max';
};
