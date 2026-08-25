// ── Hearts client ──
//
// The mirror of mobile/src/services/hearts.ts, against the same endpoints, so a
// Pro subscriber gets the same unlimited hearts on the web as on their phone. A
// perk that only holds on one surface is a pricing page that lies on the other.
//
// The balance is the SERVER's (backend/live-bridge/app/hearts.py). Hearts used
// to be per-run state seeded from the attempted level, which meant refreshing
// the page refilled them — fine when they were a pacing device, useless now
// that removing them is something people pay for.

import { onAuthStateChanged } from 'firebase/auth';
import { auth, getIdToken } from './firebase';

export interface Hearts {
  /** null means unlimited (Pro and Max). */
  hearts: number | null;
  max: number | null;
  unlimited: boolean;
  nextHeartInSeconds: number | null;
  fullInSeconds: number | null;
  regenSeconds: number | null;
}

type Listener = () => void;

const apiBase = () => (import.meta.env.VITE_OHMLET_API_BASE_URL || '').trim().replace(/\/+$/, '');

const listeners = new Set<Listener>();
let snapshot: Hearts | null = null;
let receivedAt = 0;
let inFlight: Promise<Hearts | null> | null = null;

function emit(next: Hearts | null): void {
  snapshot = next;
  receivedAt = Date.now();
  listeners.forEach((l) => l());
}

export function subscribeHearts(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function getHeartsSnapshot(): Hearts | null {
  return snapshot;
}

/** Seconds to the next heart, adjusted for how long ago the server answered. */
export function secondsToNextHeart(): number | null {
  if (!snapshot || snapshot.unlimited || snapshot.nextHeartInSeconds == null) return null;
  return Math.max(0, snapshot.nextHeartInSeconds - (Date.now() - receivedAt) / 1000);
}

export async function refreshHearts(): Promise<Hearts | null> {
  if (inFlight) return inFlight;

  const run = async (): Promise<Hearts | null> => {
    const base = apiBase();
    if (!base) return null;
    const token = await getIdToken();
    if (!token) { emit(null); return null; }
    try {
      const res = await fetch(`${base}/v1/me/hearts`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return snapshot;
      const next = (await res.json()) as Hearts;
      emit(next);
      return next;
    } catch {
      return snapshot;
    }
  };

  // Cleared from outside the async body: a `finally` inside would run before the
  // assignment on any path that returns without awaiting, and latch this forever.
  const p = run();
  inFlight = p;
  void p.finally(() => { if (inFlight === p) inFlight = null; });
  return p;
}

/**
 * Charge a heart for a wrong answer.
 *
 * `key` identifies one specific miss, so a retried request costs one heart
 * rather than two. The optimistic decrement makes the top bar respond on the
 * same frame; the server's reply then overwrites it.
 */
export async function spendHeart(key: string): Promise<Hearts | null> {
  if (snapshot?.unlimited) return snapshot;

  if (snapshot && snapshot.hearts != null) {
    emit({
      ...snapshot,
      hearts: Math.max(0, snapshot.hearts - 1),
      nextHeartInSeconds: snapshot.nextHeartInSeconds ?? snapshot.regenSeconds ?? 90 * 60,
    });
  }

  const base = apiBase();
  if (!base) return snapshot;
  const token = await getIdToken();
  if (!token) return snapshot;
  try {
    const res = await fetch(`${base}/v1/me/hearts/spend`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': key },
    });
    if (!res.ok) return snapshot;
    const next = (await res.json()) as Hearts;
    emit(next);
    return next;
  } catch {
    return snapshot;
  }
}

// A regenerating balance is stale the moment a backgrounded tab comes forward,
// and that is exactly when someone checks whether their hearts are back.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && snapshot && !snapshot.unlimited) void refreshHearts();
  });
}

// Hearts belong to a uid: signing out must clear them rather than leave the
// previous account's balance on screen for the next person on a shared machine.
onAuthStateChanged(auth, (user) => {
  if (user) void refreshHearts();
  else emit(null);
});
