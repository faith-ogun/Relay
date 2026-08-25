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

export const PLAN_META: Record<Plan, { label: string; blurb: string; perks: string[] }> = {
  free: {
    label: 'Free',
    blurb: 'Learn the fundamentals and try a live session.',
    perks: [
      'All 142 lessons',
      '3 hearts, back on their own in 90 minutes',
      '60 minutes of live tutoring a month',
      '1 3D twin a month',
    ],
  },
  pro: {
    label: 'Pro',
    blurb: 'Real bench time, every week.',
    perks: [
      'Everything in Free',
      'Unlimited hearts, so a wrong answer never stops you',
      '10 hours of live tutoring a month',
      '30 3D twins a month',
      'Priority models',
    ],
  },
  max: {
    label: 'Max',
    blurb: 'Everything, plus Interview Mode.',
    perks: [
      'Everything in Pro',
      '30 hours of live tutoring a month',
      '100 3D twins a month',
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
