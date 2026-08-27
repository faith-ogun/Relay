// 3D digital twins, against the reporter service.
//
// The reporter (backend/reporter) is a complete service with a deploy target in
// deploy.sh, but it has not been deployed: on 2026-08-26 `gcloud run services
// list --project=ohmlet-app --region=europe-west1` returned live-bridge,
// quiz-engine, vision-verifier and compiler, and no reporter. It needs a
// Stability API key and a storage bucket first.
//
// So the client cannot decide what it can do from a build-time constant. A URL
// is set in .env and it points at a service that is not there, which means
// `!!REPORTER_BASE` answers "yes, twins work" and is wrong. `probeTwins` asks
// the service instead, and the screen offers capture only when something
// answers. The day `./deploy.sh reporter` runs, the flow below starts working
// with no further change here.
//
// Everything degrades to a stated reason rather than a hang or a fake artifact.
// That honesty matters: the web app once showed a "capture a twin" button that
// had never worked for anyone.

import { REPORTER_BASE } from './config';
import { getIdToken } from './firebase';

export interface Twin {
  id: string;
  status: 'processing' | 'ready' | 'failed' | string;
  title: string;
  createdAt?: string | null;
  sizeBytes?: number | null;
  error?: string | null;
  shared?: boolean;
  shareId?: string | null;
}

export type TwinError =
  | 'unconfigured'
  | 'unauthorised'
  | 'quota'
  | 'busy'
  | 'too-large'
  | 'unavailable'
  | 'failed';

export type TwinResult<T> = { ok: true; data: T } | { ok: false; reason: TwinError; message: string };

/**
 * What the 3D service can actually do for this learner right now.
 *
 * `ready`         generation is available
 * `no-provider`   the service is up but has no 3D provider configured
 * `unreachable`   a URL is set and nothing answered on it
 * `unconfigured`  this build has no reporter URL at all
 *
 * The last two are worth telling apart. `unconfigured` is a build that shipped
 * without the setting; `unreachable` is a service that is down or not deployed.
 * They need different people to fix them.
 */
export type TwinAvailability = 'ready' | 'no-provider' | 'unreachable' | 'unconfigured';

// Generation runs a real image-to-mesh model and the service allows itself 300s.
// A phone should not wait that long on a socket, but it must not give up while
// a twin it has already been charged for is being built either.
const GENERATE_TIMEOUT_MS = 180_000;
const READ_TIMEOUT_MS = 20_000;
const PROBE_TIMEOUT_MS = 6_000;

/** The reporter rejects anything larger with a 413 (~8 MB encoded). */
const MAX_IMAGE_B64_CHARS = 11 * 1024 * 1024;

async function authHeaders(): Promise<Record<string, string> | null> {
  const token = await getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
}

/** fetch with a hard deadline, so no call can hang the screen forever. */
async function withTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// One probe per app run is enough: a service does not get deployed while a
// learner is looking at the screen, and re-asking on every mount would put a
// network round trip in front of a list that is already cached.
//
// `force` is what the screen's "Try again" passes. Without it the first answer
// would outlive the condition that produced it: a learner who opened the app on
// a dead connection would be told the 3D service is down for the rest of that
// app run, with no way back short of killing the app.
let availability: TwinAvailability | null = null;

export async function probeTwins(force = false): Promise<TwinAvailability> {
  if (availability !== null && !force) return availability;
  if (!REPORTER_BASE) return (availability = 'unconfigured');
  try {
    // /health is deliberately unauthenticated, so this works before sign-in and
    // tells us whether a 3D provider is configured, not merely whether the
    // container is up.
    const res = await withTimeout(`${REPORTER_BASE}/health`, {}, PROBE_TIMEOUT_MS);
    if (!res.ok) return (availability = 'unreachable');
    const body = (await res.json()) as { status?: string; provider?: string };
    if (body?.status !== 'ok') return (availability = 'unreachable');
    return (availability = !body.provider || body.provider === 'unconfigured' ? 'no-provider' : 'ready');
  } catch {
    return (availability = 'unreachable');
  }
}

/**
 * The heading to show a learner when twins are not available.
 *
 * Paired with `unavailableReason` and kept beside it so the two cannot drift
 * into a heading that says one thing and a body that says another. "Not
 * switched on yet" is true of a build with no reporter URL and a lie about a
 * service that is deployed and briefly down.
 */
export function unavailableTitle(state: TwinAvailability): string {
  switch (state) {
    case 'no-provider':
      return "Twins can't be built right now";
    case 'unreachable':
      return "The 3D service isn't answering";
    default:
      return "Twins aren't switched on yet";
  }
}

/** The sentence to show a learner when twins are not available. */
export function unavailableReason(state: TwinAvailability): string {
  switch (state) {
    case 'no-provider':
      return 'The 3D service is running but cannot build models yet. This is on us, not on your build.';
    case 'unreachable':
      return 'The 3D service is not answering right now. Your builds are safe, and this page will work again once it is back.';
    default:
      return 'Turning builds into 3D models is not switched on yet. Everything else works as normal.';
  }
}

export async function listTwins(): Promise<TwinResult<Twin[]>> {
  if (!REPORTER_BASE) {
    return { ok: false, reason: 'unconfigured', message: unavailableReason('unconfigured') };
  }
  const headers = await authHeaders();
  if (!headers) return { ok: false, reason: 'unauthorised', message: 'Please sign in again.' };
  try {
    const res = await withTimeout(`${REPORTER_BASE}/v1/twins`, { headers }, READ_TIMEOUT_MS);
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: 'unauthorised', message: 'Please sign in again.' };
    }
    if (!res.ok) return { ok: false, reason: 'unavailable', message: 'Could not load your twins.' };
    const data = (await res.json()) as { twins?: Twin[] };
    return { ok: true, data: data?.twins ?? [] };
  } catch {
    return { ok: false, reason: 'unavailable', message: 'Could not reach the 3D service.' };
  }
}

export interface GenerateTwinOptions {
  /** What the learner built. The service defaults it to "My build". */
  title?: string;
  /** The live session the build was finished in, if there was one. */
  sessionId?: string;
  /** The library build this twin is of, if it came from one. */
  buildId?: string;
}

/** Generate a twin from a base64 build photo. Slow by nature: a real model runs. */
export async function generateTwin(
  imageBase64: string,
  options: GenerateTwinOptions = {},
): Promise<TwinResult<Twin>> {
  if (!REPORTER_BASE) {
    return { ok: false, reason: 'unconfigured', message: unavailableReason('unconfigured') };
  }
  if (!imageBase64?.trim()) {
    return { ok: false, reason: 'failed', message: 'No photo was captured. Try that again.' };
  }
  if (imageBase64.length > MAX_IMAGE_B64_CHARS) {
    return {
      ok: false,
      reason: 'too-large',
      message: 'That photo is too large to turn into a model. Try again a little further back.',
    };
  }

  const headers = await authHeaders();
  if (!headers) return { ok: false, reason: 'unauthorised', message: 'Please sign in again.' };

  let res: Response;
  try {
    res = await withTimeout(
      `${REPORTER_BASE}/v1/twin`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: imageBase64,
          title: options.title,
          sessionId: options.sessionId,
          buildId: options.buildId,
        }),
      },
      GENERATE_TIMEOUT_MS,
    );
  } catch {
    return {
      ok: false,
      reason: 'unavailable',
      message: 'Could not reach the 3D service. Your build is safe, try again in a moment.',
    };
  }

  if (res.ok) return { ok: true, data: (await res.json()) as Twin };

  // The service explains itself well (quota wording differs by plan, and it
  // knows whether the provider or the breaker is at fault), so prefer its text.
  let detail = '';
  try {
    detail = ((await res.json()) as { detail?: string })?.detail ?? '';
  } catch {
    /* a non-JSON error body tells us nothing extra */
  }

  switch (res.status) {
    case 401:
    case 403:
      return { ok: false, reason: 'unauthorised', message: 'Please sign in again.' };
    case 402:
      return {
        ok: false,
        reason: 'quota',
        message: detail || "You've used all your 3D twins this month.",
      };
    case 413:
      return {
        ok: false,
        reason: 'too-large',
        message: 'That photo is too large to turn into a model. Try again a little further back.',
      };
    case 429:
      return { ok: false, reason: 'busy', message: 'That is a lot at once. Give it a moment and try again.' };
    case 503:
      return {
        ok: false,
        reason: 'unavailable',
        message: detail || '3D twin generation is busy. Try again in a moment.',
      };
    default:
      return {
        ok: false,
        reason: 'failed',
        message: detail || "That twin couldn't be generated. Please try again.",
      };
  }
}

/** Authenticated GLB bytes for the viewer. */
export async function fetchTwinModel(id: string): Promise<ArrayBuffer | null> {
  if (!REPORTER_BASE) return null;
  const headers = await authHeaders();
  if (!headers) return null;
  try {
    const res = await withTimeout(
      `${REPORTER_BASE}/v1/twins/${encodeURIComponent(id)}/model`,
      { headers },
      GENERATE_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export async function shareTwin(id: string): Promise<string | null> {
  if (!REPORTER_BASE) return null;
  const headers = await authHeaders();
  if (!headers) return null;
  try {
    const res = await withTimeout(
      `${REPORTER_BASE}/v1/twins/${encodeURIComponent(id)}/share`,
      { method: 'POST', headers },
      READ_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    return ((await res.json()) as { shareId?: string }).shareId ?? null;
  } catch {
    return null;
  }
}

export async function unshareTwin(id: string): Promise<boolean> {
  if (!REPORTER_BASE) return false;
  const headers = await authHeaders();
  if (!headers) return false;
  try {
    const res = await withTimeout(
      `${REPORTER_BASE}/v1/twins/${encodeURIComponent(id)}/unshare`,
      { method: 'POST', headers },
      READ_TIMEOUT_MS,
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** The public page a share id resolves to. */
export const shareLink = (shareId: string): string => `https://ohmlet.org/t/${shareId}`;
