// Hearts — the free tier's attempt budget, mirrored from the server.
//
// The balance is NOT owned here. The server derives it from the verified uid
// (backend/live-bridge/app/hearts.py) because a balance the device owns is a
// balance the device can refill: reinstalling the app, clearing storage, or
// moving the system clock forward would each hand out a free pool and make the
// paid tier's headline perk worthless. This module caches what the server said
// and counts down toward the next refresh; it never invents a heart.
//
// It is a module-level store rather than a hook's state because more than one
// screen shows the balance at once — the home header and the lesson top bar —
// and two independent copies would visibly disagree the moment one of them
// spent a heart.

import { AppState } from 'react-native';
import { API_BASE } from './config';
import { auth, getIdToken } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

export interface Hearts {
  /** null means unlimited (Pro and Max), matching liveCapMinutes. */
  hearts: number | null;
  max: number | null;
  unlimited: boolean;
  /** Seconds until one heart returns, as of `receivedAt`. */
  nextHeartInSeconds: number | null;
  fullInSeconds: number | null;
  /** Length of one regen cycle, so the client can draw progress through it
   *  without hard-coding a number the server is free to tune. */
  regenSeconds: number | null;
}

/** Only a display hint for the instant between an optimistic spend and the
 *  server's reply. The real number always comes back from the server. */
const REGEN_HINT_SECONDS = 90 * 60;

type Listener = () => void;

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

/** The last thing the server said. Stable identity between changes, so it is
 *  safe as a useSyncExternalStore snapshot. */
export function getHeartsSnapshot(): Hearts | null {
  return snapshot;
}

/**
 * Seconds until the next heart, adjusted for how long ago the server answered.
 *
 * Derived from wall-clock elapsed rather than a decrementing counter: a counter
 * stops while the app is backgrounded and would still read "12 minutes" after an
 * hour on the lock screen.
 */
export function secondsToNextHeart(): number | null {
  if (!snapshot || snapshot.unlimited || snapshot.nextHeartInSeconds == null) return null;
  const elapsed = (Date.now() - receivedAt) / 1000;
  return Math.max(0, snapshot.nextHeartInSeconds - elapsed);
}

export async function refreshHearts(): Promise<Hearts | null> {
  if (inFlight) return inFlight;

  const run = async (): Promise<Hearts | null> => {
    if (!API_BASE) return null;
    const token = await getIdToken();
    if (!token) { emit(null); return null; }
    try {
      const res = await fetch(`${API_BASE}/v1/me/hearts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return snapshot;
      const next = (await res.json()) as Hearts;
      emit(next);
      return next;
    } catch {
      // Keep showing the last known balance rather than blanking the header on
      // a dropped connection.
      return snapshot;
    }
  };

  // The latch is cleared from OUTSIDE the async body. Clearing it in a `finally`
  // inside would run before the assignment below on any path that returns
  // without awaiting, latching `inFlight` permanently and freezing the balance
  // for the rest of the session.
  const p = run();
  inFlight = p;
  void p.finally(() => { if (inFlight === p) inFlight = null; });
  return p;
}

/**
 * Charge a heart for a wrong answer.
 *
 * `key` must be stable for one specific miss (run id + step) so that a retry
 * over a flaky connection costs one heart rather than two. The optimistic
 * decrement is what makes the heart leave the top bar on the same frame as the
 * wrong answer; the server's reply then overwrites it, so a client that
 * miscounts self-corrects within a round trip.
 */
export async function spendHeart(key: string): Promise<Hearts | null> {
  if (snapshot?.unlimited) return snapshot;

  if (snapshot && snapshot.hearts != null) {
    const optimistic = Math.max(0, snapshot.hearts - 1);
    emit({
      ...snapshot,
      hearts: optimistic,
      // A heart just left a full pool, so the regen clock starts now. Leaving
      // the old null here would show "next heart in --" until the server replied.
      nextHeartInSeconds: snapshot.nextHeartInSeconds ?? REGEN_HINT_SECONDS,
    });
  }

  if (!API_BASE) return snapshot;
  const token = await getIdToken();
  if (!token) return snapshot;
  try {
    const res = await fetch(`${API_BASE}/v1/me/hearts/spend`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': key },
    });
    if (!res.ok) return snapshot;
    const next = (await res.json()) as Hearts;
    emit(next);
    return next;
  } catch {
    // The optimistic value stands until the next refresh reconciles it. Being
    // briefly stricter than the server is the safe direction to be wrong in.
    return snapshot;
  }
}

/** Whether a lesson may start. Unknown (not yet loaded) counts as yes: a
 *  learner must never be locked out because a request was slow. */
export function canStartLesson(): boolean {
  if (!snapshot) return true;
  return snapshot.unlimited || (snapshot.hearts ?? 1) > 0;
}

// A balance that regenerates on a clock is stale the moment the app comes back
// from the background, and that is exactly when someone checks whether their
// hearts are back.
AppState.addEventListener('change', (state) => {
  if (state === 'active' && snapshot && !snapshot.unlimited) void refreshHearts();
});

// Hearts belong to a uid. Signing out must clear them rather than leave the
// previous account's balance on screen for the next person on a shared device.
onAuthStateChanged(auth, (user) => {
  if (user) void refreshHearts();
  else emit(null);
});
