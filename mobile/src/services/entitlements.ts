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
  /** One line on why this tier exists, for the card header. */
  tagline: string;
}> = {
  free: {
    label: 'Free',
    priceMonthly: null,
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
    priceMonthly: 15.99,
    tagline: 'The full bench tutor',
    blurb: 'Real bench time, every week.',
    perks: [
      'Everything in Free',
      'Unlimited hearts, so a wrong answer never stops you',
      '4 hours of live tutoring a month',
      'Every 3D twin kept for good',
      'Priority models',
    ],
  },
  max: {
    label: 'Max',
    priceMonthly: 34.99,
    tagline: 'Learn it, then land the job',
    blurb: 'Everything, plus Interview Mode.',
    perks: [
      'Everything in Pro',
      '9 hours of live tutoring a month',
      'Every 3D twin kept for good',
      'Interview Mode',
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
