// ── Durable achievements client ──
//
// The mirror of mobile/src/services/achievements.ts, against the same endpoint,
// so a medal earned on a phone is already earned when the web app opens, and a
// reinstall does not cost anyone their trophy case.
//
// The server owns earning completely (backend/live-bridge/app/achievements.py):
// it computes every metric from the learner's own records, and it STAMPS the
// first moment a condition holds inside a Firestore transaction. A second sync
// therefore stamps nothing, whatever this client does, and a counter that later
// falls, or a metric that is later derived differently, cannot take a medal
// back. That is the whole reason the record exists: three counter corrections
// shipped in one day and each one un-earned somebody's medals.
//
// What this client owns is the presentation: the union of what the server has
// stamped and what it can see is true right now, so a threshold crossed while
// offline still lights up immediately.
//
// The stamped record is mirrored into localStorage, keyed by uid, so the trophy
// case is right on a cold start with no network. It is a CACHE of the server's
// answer, never a source: nothing is ever added to it locally.

import { auth, getIdToken } from './firebase';
import { readLocal, userKey, writeLocal } from './localState';

/** One stamped achievement: when it was earned, and against what. */
export interface EarnedEntry {
  /** ISO instant. For a backfilled entry this is when we RECORDED it. */
  at: string;
  metric: string;
  threshold: number;
  /** The counter's value at the moment it was stamped. */
  value: number;
  /** True when the learner earned this before the record existed. */
  backfilled?: boolean;
}

export interface AchievementRecord {
  /** achievement id -> the stamp. The durable answer to "have I earned this?" */
  earned: Record<string, EarnedEntry>;
  /** Ids stamped by THIS call: what to celebrate, if anything. */
  newlyEarned: string[];
  /** Every metric, computed server-side. Authoritative for units and builds. */
  stats: Record<string, number>;
  /** True on a learner's very first sync, when the record is catching up. */
  backfilled: boolean;
  /** False when the stamp could not be written; the record read is still valid. */
  synced: boolean;
  version: string;
}

export type FailReason =
  | 'offline'          // the request never reached a server
  | 'timeout'          // it reached one and nothing came back in time
  | 'unauthenticated'  // no usable ID token: the session needs refreshing
  | 'rate_limited'     // 429 from the REST rate limiter in main.py
  | 'server';          // 5xx, or any other unexpected status

export type Result<T> = { ok: true; data: T } | { ok: false; reason: FailReason };

// Long enough to cover a Cloud Run cold start, short enough that a real failure
// surfaces while the learner is still looking at the screen.
const TIMEOUT_MS = 12_000;

const apiBase = () => (import.meta.env.VITE_OHMLET_API_BASE_URL || '').trim().replace(/\/+$/, '');

const cacheKey = (uid: string | null | undefined) => userKey('achievements.earned.v1', uid);

/**
 * The last stamped record this device saw for a user.
 *
 * `uid` is worth passing when the caller has one: `auth.currentUser` is null for
 * the first moments after a reload, and a reader that lands in that window would
 * otherwise see an empty case and have no reason to look again.
 */
export function readCachedEarned(uid?: string | null): Record<string, EarnedEntry> {
  const raw = readLocal(cacheKey(uid ?? auth.currentUser?.uid));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, EarnedEntry>) : {};
  } catch {
    return {};
  }
}

/**
 * Fold the server's answer into this device's mirror. A UNION, never a replace.
 *
 * `sync` answers with `synced: false` and whatever it could read when the stamp
 * itself fails, and during a Firestore outage that read fails too, so the answer
 * is an empty map with a 200 beside it. Writing it over the mirror would leave
 * the learner with an empty trophy case on their next cold start, which is the
 * exact harm this record exists to prevent. Nothing may ever narrow the set, so
 * the write here cannot either.
 */
function cacheEarned(earned: Record<string, EarnedEntry>): void {
  const uid = auth.currentUser?.uid;
  if (!uid) return; // never cache under 'anon': the next person would inherit it
  writeLocal(cacheKey(uid), JSON.stringify({ ...readCachedEarned(uid), ...earned }));
}

// One sync in flight at a time. A second caller awaits the same reply rather
// than opening a second round trip, which matters because the achievements view
// and the workspace header both want this on the same paint.
let syncing: Promise<Result<AchievementRecord>> | null = null;

/**
 * Record everything the learner has earned, and read back the durable record.
 *
 * Safe to call on every visit: the transaction on the server skips anything
 * already stamped, so a repeat call writes nothing and returns the same set.
 */
export function syncAchievements(): Promise<Result<AchievementRecord>> {
  if (syncing) return syncing;
  const p = request();
  syncing = p;
  // Cleared from outside the promise chain, so a synchronous rejection cannot
  // latch this forever.
  void p.finally(() => { if (syncing === p) syncing = null; });
  return p;
}

async function request(): Promise<Result<AchievementRecord>> {
  const base = apiBase();
  if (!base) return { ok: false, reason: 'offline' };
  const token = await getIdToken();
  // A missing token is a session problem, not a network one, and telling
  // someone to check their connection when they need to sign in again wastes
  // their time.
  if (!token) return { ok: false, reason: 'unauthenticated' };

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/v1/me/achievements/sync`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) return { ok: false, reason: 'unauthenticated' };
    if (res.status === 429) return { ok: false, reason: 'rate_limited' };
    if (!res.ok) return { ok: false, reason: 'server' };
    const data = (await res.json()) as AchievementRecord;
    if (data && typeof data.earned === 'object' && data.earned) cacheEarned(data.earned);
    return { ok: true, data };
  } catch (err) {
    const aborted = (err as { name?: string } | null)?.name === 'AbortError';
    return { ok: false, reason: aborted ? 'timeout' : 'offline' };
  } finally {
    window.clearTimeout(timer);
  }
}
