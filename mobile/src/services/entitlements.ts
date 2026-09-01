// Plan + live-minute entitlements, read from the server.
//
// The client never decides what a person is entitled to: /v1/me derives the plan
// and the remaining live budget from Firestore and the Stripe webhook, and the
// live-bridge enforces the same cap again at the socket. This module exists to
// SHOW the state, not to gate on it.

import { API_BASE } from './config';
import { getIdToken } from './firebase';
import type { Hearts } from './hearts';

export type Plan = 'free' | 'pro' | 'max';

export interface Me {
  uid: string;
  email: string | null;
  isAdmin: boolean;
  plan: Plan;
  priorityModels: boolean;
  /** null means unlimited (JSON has no infinity). */
  liveCapMinutes: number | null;
  liveSecondsUsedThisMonth: number;
  hearts: Hearts;
}

export const PLAN_META: Record<Plan, {
  label: string;
  blurb: string;
  perks: string[];
  /** The published monthly price. Null for Free. This is what the PRICING PAGE
   *  promises; the real charge always comes from the store package, so a card
   *  shows this only until a package is loaded. */
  priceMonthly: number | null;
  /** Per month when paying yearly, and the total that is actually charged.
   *  Apple sells only at fixed price points, so the total is NOT twelve times
   *  the per-month figure: 6.50 x 12 is 78.00 and Apple's nearest is 77.99.
   *  Kept in step with frontend/components/PricingPage.tsx by check-prices.mjs. */
  priceAnnualPerMonth: number | null;
  priceAnnualTotal: number | null;
  /** One line on why this tier exists, for the card header. */
  tagline: string;
}> = {
  free: {
    label: 'Free',
    priceMonthly: null,
    priceAnnualPerMonth: null,
    priceAnnualTotal: null,
    tagline: 'Start building today',
    blurb: 'Learn the fundamentals and try a live session.',
    perks: [
      'All 284 lessons',
      '3 hearts, back on their own in 90 minutes',
      '60 minutes of live tutoring a month',
      'A 3D twin of every build, kept for 30 days',
    ],
  },
  pro: {
    label: 'Pro',
    priceMonthly: 12.99,
    priceAnnualPerMonth: 6.50,
    priceAnnualTotal: 77.99,
    tagline: 'The full bench tutor',
    blurb: 'Real bench time, every week.',
    perks: [
      'Everything in Free',
      'Unlimited hearts, so a wrong answer never stops you',
      '2.5 hours of live tutoring a month',
      'Every 3D twin kept for good',
      'Priority models',
    ],
  },
  max: {
    label: 'Max',
    priceMonthly: 24.99,
    priceAnnualPerMonth: 12.50,
    priceAnnualTotal: 149.99,
    tagline: 'Prove what you have built',
    blurb: 'A record of your bench work that an employer can trust.',
    perks: [
      'Everything in Pro',
      'A verified record of your bench work, proven not claimed',
      'Career coaching built on that record',
      'Interview Mode, with every gap routed to a lesson',
      'Early access to Ohmlet Labs',
      '5 hours of live tutoring a month',
    ],
  },
};

export async function fetchMe(): Promise<Me | null> {
  if (!API_BASE) return null;
  const token = await getIdToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/v1/me`, { headers: { Authorization: `Bearer ${token}` } });
    return res.ok ? ((await res.json()) as Me) : null;
  } catch {
    return null;
  }
}

/** Minutes of live tutoring left this month, or null for unlimited. */
export function minutesRemaining(me: Me | null): number | null {
  if (!me) return 0;
  if (me.liveCapMinutes === null) return null;
  return Math.max(0, Math.round(me.liveCapMinutes - me.liveSecondsUsedThisMonth / 60));
}
