// ── Account + entitlements client (#56) ──
//
// Reads the signed-in user's plan from the server (GET /v1/me), which derives it
// from the verified token — so the plan is a server fact, not a client-editable
// localStorage value. Falls back gracefully (returns null) when signed out or
// the backend is unreachable, so the UI keeps working on its cached value.

import type { Plan } from '../components/ohmlet/entitlements';
import { getIdToken } from './firebase';

export interface MeResponse {
  uid: string;
  email: string | null;
  isAdmin: boolean;
  plan: Plan;
  priorityModels: boolean;
  liveCapMinutes: number | null; // null = unlimited (no tier is, but kept for safety)
  liveSecondsUsedThisMonth: number;
}

const apiBase = () => (import.meta.env.VITE_OHMLET_API_BASE_URL || '').trim().replace(/\/+$/, '');

export async function fetchMe(): Promise<MeResponse | null> {
  const base = apiBase();
  if (!base) return null;
  const token = await getIdToken();
  if (!token) return null;
  try {
    const res = await fetch(`${base}/v1/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return (await res.json()) as MeResponse;
  } catch {
    return null;
  }
}

/** Admin-only: change your own plan to test the tiers. Returns the new plan or null. */
export async function setMyPlan(plan: Plan): Promise<Plan | null> {
  const base = apiBase();
  if (!base) return null;
  const token = await getIdToken();
  if (!token) return null;
  try {
    const res = await fetch(`${base}/v1/me/plan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { plan: Plan };
    return data.plan;
  } catch {
    return null;
  }
}
