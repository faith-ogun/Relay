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

export interface Progress {
  /** lesson id -> level (1 bronze, 2 silver, 3 gold). Present means completed. */
  lessonLevels: Record<string, number>;
  xp: number;
  streak: number;
  completedToday: number;
  lastActiveDate: string;
}

export const EMPTY: Progress = {
  lessonLevels: {}, xp: 0, streak: 0, completedToday: 0, lastActiveDate: '',
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
      return { ...EMPTY, ...remote };
    }
  } catch { /* fall through */ }
  return local ?? EMPTY;
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
