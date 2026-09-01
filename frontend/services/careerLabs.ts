// The verified build record, career coaching and Ohmlet Labs, on the web.
//
// These three shipped on the phone first and were sold on the web pricing page
// the whole time, which meant the web charged for a build record it never
// showed. The mobile client (`mobile/src/services/labs.ts`) is the twin of this
// file; the endpoints and the shapes are deliberately identical, because the
// server is the same server and a second interpretation of one payload is how
// two surfaces start disagreeing about what a learner has done.

import { getIdToken } from './firebase';

const apiBase = () => (import.meta.env.VITE_OHMLET_API_BASE_URL || '').trim().replace(/\/+$/, '');

/** What went wrong, in terms a screen can turn into a sentence. */
export type FailReason =
  | 'offline' | 'unauthenticated' | 'upgrade_required' | 'not_found' | 'rate_limited' | 'server' | 'timeout';

export type Result<T> = { ok: true; data: T } | { ok: false; reason: FailReason };

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
  const base = apiBase();
  if (!base) return { ok: false, reason: 'offline' };
  const token = await getIdToken();
  if (!token) return { ok: false, reason: 'unauthenticated' };

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${path}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    });
    // 402 and 403 answer different questions: 402 is "not on your plan", 403 is
    // "not you". Collapsing them sends a Max subscriber to the pricing page over
    // an expired token.
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
    window.clearTimeout(timer);
  }
}

export function fetchLabs(): Promise<Result<LabsStatus>> {
  return call<LabsStatus>('/v1/me/labs');
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

/**
 * Signed URLs for one skill's film.
 *
 * NEVER cached. The URLs expire in thirty minutes by design, and a cached signed
 * URL is one that outlives the reason it was short-lived. Fetch it when the
 * learner presses play.
 */
export function fetchFilm(skillId: string): Promise<Result<FilmUrls>> {
  return call<FilmUrls>(`/v1/curriculum/films/${encodeURIComponent(skillId)}`);
}

/** One sentence for a failed load, in the learner's terms rather than HTTP's. */
export function reasonToSentence(reason: FailReason, subject: string): string {
  switch (reason) {
    case 'upgrade_required':
      return `${subject} is part of Max.`;
    case 'unauthenticated':
      return 'Please sign in again.';
    case 'offline':
    case 'timeout':
      return `${subject} lives on the server, so this needs a connection.`;
    case 'rate_limited':
      return 'That was a lot of requests at once. Give it a moment.';
    default:
      return `${subject} could not be loaded just now.`;
  }
}
