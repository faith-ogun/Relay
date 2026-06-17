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
  /** Monthly price in the display currency, null = free. Provisional, see #19. */
  priceMonthly: number | null;
  blurb: string;
}

export const PLAN_META: Record<Plan, PlanMeta> = {
  free: { id: 'free', label: 'Free', priceMonthly: null, blurb: 'Learn the fundamentals and try a live session.' },
  pro: { id: 'pro', label: 'Pro', priceMonthly: 12, blurb: 'Unlimited learning and real bench time.' },
  max: { id: 'max', label: 'max', priceMonthly: 29, blurb: 'Everything in Pro, plus Interview Mode.' },
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

// Daily live-tutor budget per plan (minutes). Vision + audio is the cost driver,
// so the free tier is metered. These are provisional pending real cost data (#17,
// #19); Infinity = effectively unlimited (still server-capped for abuse).
export const LIVE_MINUTES_PER_DAY: Record<Plan, number> = {
  free: 20,
  pro: 180,
  max: Infinity,
};

export const planHas = (plan: Plan, feature: Feature): boolean => FEATURES_BY_PLAN[plan].includes(feature);

export const isBetaFeature = (feature: Feature): boolean => BETA_FEATURES.has(feature);

/** The lowest plan that unlocks a feature (for "Upgrade to X" copy). */
export const requiredPlan = (feature: Feature): Plan => {
  if (planHas('free', feature)) return 'free';
  if (planHas('pro', feature)) return 'pro';
  return 'max';
};
