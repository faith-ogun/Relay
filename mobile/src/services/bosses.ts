// Boss client: the unit exam, its gate, and its result.
//
// Thin on purpose. Everything that decides anything lives on the server
// (backend/live-bridge/app/bosses.py): which questions are asked, what the pass
// bar is, what a clear pays, and whether the next unit opens. This file fetches,
// posts, and gets out of the way.
//
// The one thing worth understanding here is the SEED. An exam arrives with a
// seed that produced it; the result is posted back with that same seed, and the
// server re-composes the identical question list to grade against. That is why
// the result payload can be as small as a list of indices: the server already
// knows what it asked, so it does not have to be told.

import { API_BASE } from './config';
import { getIdToken } from './firebase';
import type { Result } from './checkpoints';

const TIMEOUT_MS = 12_000;

/** One unit's boss, as the path needs to draw it. */
export interface BossStatus {
  unitId: string;
  title: string;
  questions: number;
  xp: number;
  /** The unit before this one has been cleared. */
  reachable: boolean;
  /** This unit's own lessons are all finished. */
  ready: boolean;
  cleared: boolean;
  bestRatio: number;
  attempts: number;
  xpAwarded: number;
}

export interface BossesStatus {
  units: BossStatus[];
  passRatio: number;
  totalAwardedXp: number;
}

export interface BossExam {
  unitId: string;
  title: string;
  seed: string;
  questions: number;
  passRatio: number;
  xp: number;
  /** Authored steps, each tagged with the skill it came from. */
  steps: Array<Record<string, unknown>>;
}

export interface BossSkillRow {
  skillId: string;
  title: string;
  asked: number;
  correct: number;
}

export interface BossResult {
  unitId: string;
  passed: boolean;
  ratio: number;
  correct: number;
  total: number;
  passRatio: number;
  /** XP granted by THIS sitting. Zero on a re-sit, however well it went. */
  xp: number;
  firstClear: boolean;
  cleared: boolean;
  bestRatio: number;
  attempts: number;
  /** Weakest skill first: the screen is a list of what to go and fix. */
  skills: BossSkillRow[];
}

async function call<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  if (!API_BASE) return { ok: false, reason: 'offline' };
  const token = await getIdToken();
  if (!token) return { ok: false, reason: 'unauthenticated' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/v1/me${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 401 || res.status === 403) return { ok: false, reason: 'unauthenticated' };
    if (res.status === 429) return { ok: false, reason: 'rate_limited' };
    if (!res.ok) return { ok: false, reason: 'server' };
    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    const aborted = (err as { name?: string } | null)?.name === 'AbortError';
    return { ok: false, reason: aborted ? 'timeout' : 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

/** Every unit's boss: reachable, ready, cleared, best score. */
export function fetchBosses(): Promise<Result<BossesStatus>> {
  return call<BossesStatus>('/bosses');
}

/**
 * A fresh exam for one unit.
 *
 * Never cached. Two sittings should be two different exams, and a cached one
 * would let a learner memorise the questions between attempts. The server
 * refuses this outright if the unit is not finished or the previous boss is
 * uncleared, so a client bug cannot open a gate the path is drawing as shut.
 */
export function fetchBossExam(unitId: string): Promise<Result<BossExam>> {
  return call<BossExam>(`/bosses/${encodeURIComponent(unitId)}/exam`);
}

/**
 * Post a sat exam and get the graded result back.
 *
 * Never retried on timeout. A POST that timed out may well have been recorded,
 * and this reply carries the ceremony: retrying could celebrate a clear twice,
 * or show a learner nothing for one that landed.
 */
export function submitBossResult(
  unitId: string,
  seed: string,
  firstTryCorrect: number[],
): Promise<Result<BossResult>> {
  return call<BossResult>(`/bosses/${encodeURIComponent(unitId)}/result`, {
    method: 'POST',
    body: JSON.stringify({ seed, firstTryCorrect }),
  });
}
