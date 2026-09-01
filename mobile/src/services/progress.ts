// Learner progress, shared with the web app.
//
// Uses the SAME /v1/state records the web workspace persists, so XP, streak,
// completed lessons and achievement counters follow a person between surfaces
// rather than forking. The backend derives the uid from the verified token and
// refuses cross-user access, so the path segment is advisory.
//
// State is KEYED: 'progress' and 'metrics' are separate server documents, which
// is what stops this app and the web workspace from overwriting each other. The
// unkeyed path this file used to call wrote the whole document, so a save from
// the phone replaced whatever the browser had stored and the other way round.
//
// The nested `metrics` object stays inside the progress record as well as being
// written to its own. Builds already installed in the field read the unkeyed
// path and take their counters from there, and dropping it would break them.
//
// Cache-first, like the curriculum: a local copy makes the app usable offline
// and the remote copy is the source of truth once reachable.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CompletionRecord } from './completion';
import { API_BASE } from './config';
import { getIdToken } from './firebase';

/** Counters behind the achievements that xp/streak/lessons do not cover. */
export interface Metrics {
  liveSessions: number;
  drawings: number;
  perfect: number;
  twins: number;
  posts: number;
  comments: number;
  challenges: number;
  leagueWins: number;
  /** ISO week already credited, so one week can only ever count once. */
  lastLeagueWeek: string;
}

export interface Progress extends CompletionRecord {
  /** lesson id -> level (1 bronze, 2 silver, 3 gold). Present means completed. */
  lessonLevels: Record<string, number>;
  xp: number;
  streak: number;
  completedToday: number;
  /**
   * Which lessons have counted toward today's goal. Reset when the day turns.
   *
   * The goal used to be a raw tally, so replaying one easy lesson five times
   * filled a five-lesson daily goal without learning anything. Distinct lessons
   * is what the goal was always claiming to measure.
   */
  todayLessonIds?: string[];
  lastActiveDate: string;
  /**
   * How much of `xp` came from claimed checkpoints. The ledger that makes the
   * payout exactly-once: the server records the grant (checkpoints.py), this
   * records how much of it has been counted here, and reconciliation is the
   * difference between the two. See services/checkpoints.ts. Optional because
   * records written before checkpoints paid out do not carry it, and zero is
   * the correct reading of its absence.
   */
  checkpointXp?: number;
  metrics: Metrics;
}

export const EMPTY_METRICS: Metrics = {
  liveSessions: 0, drawings: 0, perfect: 0, twins: 0,
  posts: 0, comments: 0, challenges: 0, leagueWins: 0, lastLeagueWeek: '',
};

export const EMPTY: Progress = {
  lessonLevels: {}, xp: 0, streak: 0, completedToday: 0, todayLessonIds: [], lastActiveDate: '',
  metrics: EMPTY_METRICS,
};

const CACHE_KEY = (uid: string) => `ohmlet.progress.v1:${uid}`;
const ENVELOPE_VERSION = 1;

/** Server record keys. Each one is its own document; see the note at the top. */
const PROGRESS_KEY = 'progress';
const METRICS_KEY = 'metrics';

const statePath = (uid: string, key: string) =>
  `/v1/state/${encodeURIComponent(uid)}/${encodeURIComponent(key)}`;

const today = () => new Date().toISOString().slice(0, 10);

/** Fill in anything a stored record predates or a partial response omits. */
const withDefaults = (p: Partial<Progress> | null | undefined): Progress => ({
  ...EMPTY,
  ...(p ?? {}),
  metrics: { ...EMPTY_METRICS, ...(p?.metrics ?? {}) },
});

/**
 * Reconcile the counters the phone kept with the shared record.
 *
 * Every counter is monotonic, so the higher number is the one that saw more of
 * the learner's actual activity and taking the max can never erase work. The
 * league week is an ISO `YYYY-Www` string, zero padded, so the later week sorts
 * later and the comparison is chronological.
 */
function mergeMetrics(...sources: (Partial<Metrics> | null | undefined)[]): Metrics {
  const out: Metrics = { ...EMPTY_METRICS };
  for (const source of sources) {
    if (!source) continue;
    for (const [name, value] of Object.entries(source)) {
      if (name === 'lastLeagueWeek') {
        if (typeof value === 'string' && value > out.lastLeagueWeek) out.lastLeagueWeek = value;
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        const key = name as keyof Omit<Metrics, 'lastLeagueWeek'>;
        out[key] = Math.max(out[key] ?? 0, value);
      }
    }
  }
  return out;
}

/** The `data` object of a state envelope, or null if the response is unusable. */
async function readRecord<T>(res: Response | null): Promise<T | null> {
  if (!res) return null;
  try {
    const envelope = await res.json();
    const data = envelope?.data;
    return data && typeof data === 'object' ? (data as T) : null;
  } catch {
    return null;
  }
}

async function authed(path: string, init?: RequestInit) {
  if (!API_BASE) return null;
  const token = await getIdToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

/**
 * Drop everything this device cached about `uid`.
 *
 * Called after account deletion. The server has already erased its side and
 * revoked the session, but the local cache would otherwise survive and show a
 * deleted account's progress to whoever opens the app next, which on a shared
 * phone is someone else.
 */
export async function clearLocalState(uid: string | null | undefined): Promise<void> {
  if (!uid) return;
  try {
    await AsyncStorage.removeItem(CACHE_KEY(uid));
  } catch {
    /* storage unavailable: nothing cached to leak */
  }
}

export async function loadProgress(uid: string): Promise<Progress> {
  // Local first so the UI paints immediately.
  let local: Progress | null = null;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY(uid));
    if (raw) local = JSON.parse(raw) as Progress;
  } catch { /* ignore */ }

  // Both records in parallel. A missing metrics record is normal (a learner who
  // has never triggered a counter) and must not stop progress from loading.
  const [progressRes, metricsRes] = await Promise.all([
    authed(statePath(uid, PROGRESS_KEY)),
    authed(statePath(uid, METRICS_KEY)),
  ]);
  if (!progressRes) return withDefaults(local);

  const remote = await readRecord<Progress>(progressRes);
  if (!remote) return withDefaults(local);

  const shared = await readRecord<Partial<Metrics>>(metricsRes);
  const merged = withDefaults({ ...remote, metrics: mergeMetrics(remote.metrics, shared) });
  try {
    await AsyncStorage.setItem(CACHE_KEY(uid), JSON.stringify(merged));
  } catch { /* offline copy is best-effort */ }
  return merged;
}

export async function saveProgress(uid: string, next: Progress): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY(uid), JSON.stringify(next));
  } catch { /* offline copy is best-effort */ }

  const updatedAt = new Date().toISOString();
  const envelope = (data: unknown) =>
    JSON.stringify({ version: ENVELOPE_VERSION, data, updatedAt });

  // Two records, two writes. The counters go to the shared metrics record so
  // the web achievements page sees them, and stay nested in the progress record
  // for builds already installed in the field.
  await Promise.all([
    authed(statePath(uid, PROGRESS_KEY), { method: 'PUT', body: envelope(next) }),
    authed(statePath(uid, METRICS_KEY), {
      method: 'PUT',
      body: envelope({ ...EMPTY_METRICS, ...next.metrics }),
    }),
  ]);
}

/**
 * Record a finished lesson.
 *
 * Re-exported from the shared rule so the phone and the browser cannot drift:
 * see services/completion.ts for the whole table of what a completion does.
 */
export { applyCompletion } from './completion';


/** Increment a counter. Returns a new Progress; the caller persists it. */
export function bumpMetric(current: Progress, metric: keyof Omit<Metrics, 'lastLeagueWeek'>, by = 1): Progress {
  const metrics = { ...EMPTY_METRICS, ...current.metrics };
  return { ...current, metrics: { ...metrics, [metric]: (metrics[metric] ?? 0) + by } };
}

/**
 * Credit a top-three weekly finish exactly once per league week, keyed by the
 * week id the leaderboard itself reports so revisits cannot inflate it.
 */
export function creditLeagueWin(current: Progress, week: string, rank: number | null): Progress {
  const metrics = { ...EMPTY_METRICS, ...current.metrics };
  if (!week || !rank || rank > 3 || metrics.lastLeagueWeek === week) return current;
  return { ...current, metrics: { ...metrics, lastLeagueWeek: week, leagueWins: metrics.leagueWins + 1 } };
}

/** The stats an achievement is evaluated against. */
/** Counters only the server can see; see `fetchCommunityStats`. */
export interface ServerStats {
  likesReceived: number;
  posts: number;
  comments: number;
}

export function achievementStats(p: Progress, unitsCompleted = 0, server?: ServerStats | null) {
  const m = { ...EMPTY_METRICS, ...p.metrics };
  return {
    xp: p.xp,
    streak: p.streak,
    builds: Object.keys(p.lessonLevels).length,
    units: unitsCompleted,
    liveSessions: m.liveSessions,
    drawings: m.drawings,
    perfect: m.perfect,
    twins: m.twins,
    challenges: m.challenges,
    leagueWins: m.leagueWins,
    // Likes RECEIVED only exist on other people's screens, so they come from
    // the server. Posts and comments prefer the server's count too: it survives
    // a cleared cache and a second device, where the local tally does not.
    likes: server?.likesReceived ?? 0,
    posts: Math.max(m.posts, server?.posts ?? 0),
    comments: Math.max(m.comments, server?.comments ?? 0),
  } as Record<string, number>;
}
