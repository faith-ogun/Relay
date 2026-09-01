// The achievement catalogue, served from the backend like the curriculum, so a
// new achievement does not need an App Store review. Which ones are EARNED is
// computed on-device from the learner's own metrics — the catalogue is identical
// for everyone.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from './config';
import { getIdToken } from './firebase';

export type Tier = 'common' | 'rare' | 'epic' | 'legendary';

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  backText: string;
  /** Approximate share of users who hold it, for flavour on locked cards. */
  rarity: number;
  tier: Tier;
  bg: string;
  glowColor: string;
  metric: string;
  threshold: number;
  shape: string;
  art?: string;
}

// v2: the catalogue now carries ABSOLUTE art URLs. A v1 cache holds
// root-relative paths that a phone cannot resolve, so it is dropped rather
// than left to render 50 art-less medals until the next successful fetch.
const CACHE = 'ohmlet.achievements.v2';

export const TIER_LABEL: Record<Tier, string> = {
  common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary',
};

// Tier accents. Kept here rather than parsed from the web's CSS gradients,
// which are multi-stop and do not translate to a single React Native colour.
export const TIER_COLOR: Record<Tier, string> = {
  common: '#94a3b8', rare: '#60a5fa', epic: '#c084fc', legendary: '#fbbf24',
};

export async function getAchievements(): Promise<Achievement[]> {
  let cached: Achievement[] | null = null;
  try {
    const raw = await AsyncStorage.getItem(CACHE);
    if (raw) cached = JSON.parse(raw) as Achievement[];
  } catch { /* ignore */ }

  if (!API_BASE) return cached ?? [];
  const token = await getIdToken();
  if (!token) return cached ?? [];

  try {
    const res = await fetch(`${API_BASE}/v1/curriculum/achievements`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return cached ?? [];
    const data = await res.json();
    const list = (data?.achievements ?? []) as Achievement[];
    if (list.length) await AsyncStorage.setItem(CACHE, JSON.stringify(list)).catch(() => {});
    return list;
  } catch {
    return cached ?? [];
  }
}

export const isEarned = (a: Achievement, stats: Record<string, number>): boolean =>
  (stats[a.metric] ?? 0) >= a.threshold;

/** 0..1 toward the threshold, for the progress ring on a locked card. */
export const progressOf = (a: Achievement, stats: Record<string, number>): number =>
  a.threshold <= 0 ? 1 : Math.min(1, (stats[a.metric] ?? 0) / a.threshold);

/**
 * Metrics with no source on this client. Empty: `likes` (likes received) used
 * to live here because only the server can see it, and the three achievements
 * that depend on it were unearnable. `/v1/community/stats` now supplies it.
 *
 * Kept as the mechanism, not the exception: a metric added to the curriculum
 * before its source exists belongs here so its card says so, instead of showing
 * a progress ring frozen at zero.
 */
export const UNTRACKED = new Set<string>();

// ── The durable earned record ────────────────────────────────────────────────
//
// The mirror of frontend/services/achievements.ts, against the same endpoint, so
// a medal earned in the browser is already earned when the app opens, and a
// reinstall does not cost anyone their trophy case.
//
// `isEarned` above is a LIVE comparison, and a live comparison is only as
// permanent as the counter behind it. Counters move: the session split, the
// checkpoint XP correction and the move to server-side community tallies each
// un-earned medals from learners who had done the work. So the server stamps the
// first moment a condition holds (backend/live-bridge/app/achievements.py) and
// that stamp is what "earned" means from then on. Use `isEarnedWith` from
// services/achievementRules.ts, which reads the stamp first and falls back to
// the live comparison only for something not yet recorded.

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

/**
 * React Native's fetch has NO default timeout, so a request on a weak connection
 * can sit open indefinitely and the screen just looks dead. Twelve seconds covers
 * a Cloud Run cold start on a slow link and still surfaces a real failure while
 * the learner is looking at it.
 */
const SYNC_TIMEOUT_MS = 12_000;

// Keyed by uid, never device-global: Ohmlet is used on shared phones by design,
// and one account's trophy case must not follow the next person in.
const EARNED_KEY = (uid: string) => `ohmlet.achievements.earned.v1:${uid}`;

/** The last stamped record this device saw. Read before the network answers. */
export async function readCachedEarned(uid: string | null | undefined): Promise<Record<string, EarnedEntry>> {
  if (!uid) return {};
  try {
    const raw = await AsyncStorage.getItem(EARNED_KEY(uid));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, EarnedEntry>) : {};
  } catch {
    return {};
  }
}

/**
 * Drop this device's copy of a learner's earned record.
 *
 * Called after account deletion, alongside the other local caches. The server
 * has erased its side and revoked the session, but a cache left behind would
 * show a deleted account's medals to whoever opens the app next.
 */
export async function clearCachedEarned(uid: string | null | undefined): Promise<void> {
  if (!uid) return;
  try {
    await AsyncStorage.removeItem(EARNED_KEY(uid));
  } catch {
    /* storage unavailable: nothing cached to leak */
  }
}

/**
 * Record everything the learner has earned, and read back the durable record.
 *
 * Safe to call on every visit: the transaction on the server skips anything
 * already stamped, so a repeat call writes nothing and returns the same set.
 * Returns null when the record could not be reached, which is not an error the
 * screen has to handle as one: the cached record still stands and the live
 * comparison still lights up anything crossed since.
 */
export async function syncEarned(uid: string | null | undefined): Promise<AchievementRecord | null> {
  if (!API_BASE) return null;
  const token = await getIdToken();
  if (!token) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/v1/me/achievements/sync`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as AchievementRecord;
    if (!data || typeof data.earned !== 'object' || !data.earned) return null;
    // A UNION with what is already mirrored, never a replace. `sync` answers
    // with `synced: false` and whatever it could read when the stamp fails, and
    // during a Firestore outage that read fails too, so the answer is an empty
    // map with a 200 beside it. Writing it over the mirror would empty the
    // trophy case on the next cold start, which is the exact harm this record
    // exists to prevent.
    if (uid) {
      const merged = { ...(await readCachedEarned(uid)), ...data.earned };
      await AsyncStorage.setItem(EARNED_KEY(uid), JSON.stringify(merged)).catch(() => {});
    }
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
