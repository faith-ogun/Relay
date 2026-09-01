// Ohmlet Labs client: unfinished features, switched on early for Max.
//
// The server decides everything. This asks what is on and renders it. A client
// that decided its own early access would be a switch, not a gate.

import { API_BASE } from './config';
import { getIdToken } from './firebase';
import type { Result } from './checkpoints';

const TIMEOUT_MS = 12_000;

export interface LabEntry {
  id: string;
  title: string;
  blurb: string;
  /** What is still unfinished. Always shown: early access to a rough feature is
   *  only a privilege if you are told which part is rough. */
  rough: string;
  stage: 'off' | 'max' | 'all';
  since: string;
  earlyAccess: boolean;
}

export interface LabsStatus {
  plan: string;
  labs: LabEntry[];
  /** Shown to Free and Pro so the screen is never empty, which reads as broken. */
  comingToEveryone: Array<{ id: string; title: string; blurb: string }>;
  hasEarlyAccess: boolean;
}

/** What Ohmlet can attest to about a learner, from server-owned records only. */
export interface CareerEvidence {
  bench: { sessions: number; minutes: number; cameraSessions: number; cameraMinutes: number };
  learning: { completed: number; total: number; gold: number };
  assessed: {
    unitsCleared: number; unitsTotal: number; meanScore: number;
    strongest: Array<{ unitId: string; title: string; score: number; attempts: number }>;
    attemptedNotCleared: Array<{ unitId: string; title: string; score: number; attempts: number }>;
  };
  artifacts: { twins: number };
  /** Travels with the numbers on purpose. Every one of them is a floor. */
  caveat: string;
  /** One sentence a learner could defensibly put in front of an interviewer. */
  summary: string;
}

export interface FilmUrls {
  skillId: string;
  expiresInSeconds: number;
  video: { phone: string; web: string };
  poster: { phone: string; web: string };
  captions: string;
}

async function call<T>(path: string): Promise<Result<T>> {
  if (!API_BASE) return { ok: false, reason: 'offline' };
  const token = await getIdToken();
  if (!token) return { ok: false, reason: 'unauthenticated' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (res.status === 401 || res.status === 403) return { ok: false, reason: 'unauthenticated' };
    if (res.status === 402) return { ok: false, reason: 'upgrade_required' };
    if (res.status === 404) return { ok: false, reason: 'not_found' };
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

export function fetchLabs(): Promise<Result<LabsStatus>> {
  return call<LabsStatus>('/v1/me/labs');
}

/**
 * Signed URLs for one skill's film.
 *
 * NEVER cached. The URLs expire in thirty minutes by design, and a cached
 * signed URL is one that outlives the reason it was short-lived. Fetch it when
 * the learner presses play.
 */
export function fetchFilm(skillId: string): Promise<Result<FilmUrls>> {
  return call<FilmUrls>(`/v1/curriculum/films/${encodeURIComponent(skillId)}`);
}

/**
 * The verified build record behind career coaching.
 *
 * Max only, and the server says so rather than the client guessing: a 402 comes
 * back as `upgrade_required`.
 */
export function fetchCareer(): Promise<Result<CareerEvidence>> {
  return call<CareerEvidence>('/v1/me/career');
}
