// Learner progress, shared with the web app.
//
// Uses the SAME /v1/state envelope the web workspace persists, so XP, streak and
// completed lessons follow a person between surfaces rather than forking. The
// backend derives the uid from the verified token and refuses cross-user access,
// so the path segment is advisory.
//
// Cache-first, like the curriculum: a local copy makes the app usable offline
// and the remote copy is the source of truth once reachable.

import AsyncStorage from '@react-native-async-storage/async-storage';
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

export interface Progress {
  /** lesson id -> level (1 bronze, 2 silver, 3 gold). Present means completed. */
  lessonLevels: Record<string, number>;
  xp: number;
  streak: number;
  completedToday: number;
  lastActiveDate: string;
  metrics: Metrics;
}

export const EMPTY_METRICS: Metrics = {
  liveSessions: 0, drawings: 0, perfect: 0, twins: 0,
  posts: 0, comments: 0, challenges: 0, leagueWins: 0, lastLeagueWeek: '',
};

export const EMPTY: Progress = {
  lessonLevels: {}, xp: 0, streak: 0, completedToday: 0, lastActiveDate: '',
  metrics: EMPTY_METRICS,
};

const CACHE_KEY = (uid: string) => `ohmlet.progress.v1:${uid}`;
const ENVELOPE_VERSION = 1;

const today = () => new Date().toISOString().slice(0, 10);

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

export async function loadProgress(uid: string): Promise<Progress> {
  // Local first so the UI paints immediately.
  let local: Progress | null = null;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY(uid));
    if (raw) local = JSON.parse(raw) as Progress;
  } catch { /* ignore */ }

  const res = await authed(`/v1/state/${encodeURIComponent(uid)}`);
  if (!res) return local ?? EMPTY;

  try {
    const envelope = await res.json();
    const remote = (envelope?.data ?? null) as Progress | null;
    if (remote && typeof remote === 'object') {
      await AsyncStorage.setItem(CACHE_KEY(uid), JSON.stringify(remote)).catch(() => {});
      return { ...EMPTY, ...remote, metrics: { ...EMPTY_METRICS, ...(remote.metrics ?? {}) } };
    }
  } catch { /* fall through */ }
  return local ? { ...EMPTY, ...local, metrics: { ...EMPTY_METRICS, ...(local.metrics ?? {}) } } : EMPTY;
}

export async function saveProgress(uid: string, next: Progress): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY(uid), JSON.stringify(next));
  } catch { /* offline copy is best-effort */ }
  await authed(`/v1/state/${encodeURIComponent(uid)}`, {
    method: 'PUT',
    body: JSON.stringify({
      version: ENVELOPE_VERSION,
      data: next,
      updatedAt: new Date().toISOString(),
    }),
  });
}

/**
 * Record a finished lesson. Keeps the higher level if it was already completed
 * better before, so replaying a lesson can never demote a learner's result.
 * Streak advances once per calendar day.
 */
export function applyCompletion(
  current: Progress,
  lessonId: string,
  xpGained: number,
  level = 1,
): Progress {
  const day = today();
  const already = current.lessonLevels[lessonId] ?? 0;
  const sameDay = current.lastActiveDate === day;

  // A day's gap of exactly one keeps the streak; anything longer restarts it.
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const streak = sameDay
    ? current.streak
    : current.lastActiveDate === yesterday
      ? current.streak + 1
      : 1;

  return {
    ...current,
    lessonLevels: { ...current.lessonLevels, [lessonId]: Math.max(already, level) },
    // Re-completing a lesson does not re-award XP.
    xp: current.xp + (already ? 0 : xpGained),
    streak,
    completedToday: sameDay ? current.completedToday + 1 : 1,
    lastActiveDate: day,
  };
}


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
export function achievementStats(p: Progress, unitsCompleted = 0) {
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
    posts: m.posts,
    comments: m.comments,
    challenges: m.challenges,
    leagueWins: m.leagueWins,
    // 'likes' (likes RECEIVED) is server-side data this client never observes;
    // it stays absent rather than being guessed at.
  } as Record<string, number>;
}
