// ── Billing client (#30) ──
//
// Talks to the live-bridge billing endpoints. Checkout and the Customer Portal
// both return a Stripe-hosted URL we redirect to. The token authenticates the
// user; the server derives the UID and never trusts a client-sent plan.

import type { Plan } from '../components/ohmlet/entitlements';
import { getIdToken } from './firebase';
import { track } from './analytics';

export type Interval = 'monthly' | 'annual';

const apiBase = () => (import.meta.env.VITE_OHMLET_API_BASE_URL || '').trim().replace(/\/+$/, '');

async function post(path: string, body?: unknown): Promise<{ url?: string } | null> {
  const base = apiBase();
  if (!base) return null;
  const token = await getIdToken();
  if (!token) return null;
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) return null;
    return (await res.json()) as { url?: string };
  } catch {
    return null;
  }
}

/** Start a subscription Checkout. Redirects to Stripe on success; returns false otherwise. */
export async function startCheckout(plan: Exclude<Plan, 'free'>, interval: Interval): Promise<boolean> {
  track('checkout_start', { plan, interval });
  const data = await post('/v1/billing/checkout', { plan, interval });
  if (data?.url) {
    window.location.assign(data.url);
    return true;
  }
  return false;
}

/** Open the Stripe Customer Portal to manage/cancel a subscription. */
export async function openBillingPortal(): Promise<boolean> {
  track('billing_portal_open');
  const data = await post('/v1/billing/portal');
  if (data?.url) {
    window.location.assign(data.url);
    return true;
  }
  return false;
}
