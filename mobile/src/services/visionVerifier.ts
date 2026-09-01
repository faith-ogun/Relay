// Vision-verifier client: the camera component inventory check.
//
// Step 2 of the core learning loop, and one of the flagship features: before a
// learner starts wiring, they point the camera at their parts and the tutor
// confirms the kit. The service has been deployed and answering for a while
// (ohmlet-vision-verifier, europe-west1) and the web has talked to it since
// #33; the phone declared VERIFIER_BASE and then never called it.
//
// A port of frontend/services/visionVerifier.ts, kept deliberately close to it
// so the two clients cannot drift into disagreeing about the same contract.
// Two differences, both forced by the platform:
//   - env comes from process.env at build time, not import.meta
//   - every request carries an abort timeout, because a phone on a flaky
//     connection will otherwise sit on an open socket until the OS gives up,
//     and the learner is holding the camera over their bench the whole time.

import { VERIFIER_BASE } from './config';
import { getIdToken } from './firebase';

export type PartStatus = {
  name: string;
  /** Normalised server-side to exactly these three. */
  status: 'present' | 'missing' | 'unsure';
  note?: string | null;
};

export type InventoryResult = {
  parts: PartStatus[];
  found_extras: string[];
  ready: boolean;
  feedback: string;
  confidence: number;
};

export type IdentifiedComponent = {
  name: string;
  value?: string | null;
  purpose: string;
  tip: string;
  confidence: number;
};

/** Thrown with a message safe to show a learner; `retryable` flags a transient failure. */
export class VerifierError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable = false) {
    super(message);
    this.name = 'VerifierError';
    this.retryable = retryable;
  }
}

/** Whether the kit check is configured. Callers hide the feature when it is not. */
export const verifierConfigured = (): boolean => !!VERIFIER_BASE;

// The service targets a 2-3s round trip and caps its own Vertex call at 15s.
// 25s leaves room for a slow uplink carrying the frame without ever letting a
// request hang indefinitely.
const REQUEST_TIMEOUT_MS = 25_000;

// The server rejects anything larger (OHMLET_MAX_IMAGE_B64_CHARS, ~6 MB
// encoded) with a 413. Checking here turns a wasted upload of several megabytes
// over mobile data into an instant, useful message.
const MAX_IMAGE_B64_CHARS = 9 * 1024 * 1024;

async function post<T>(path: string, body: unknown): Promise<T> {
  if (!VERIFIER_BASE) throw new VerifierError('Kit check is not available right now.');

  const token = await getIdToken();
  if (!token) throw new VerifierError('Please sign in to use the kit check.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${VERIFIER_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    throw new VerifierError(
      timedOut
        ? 'The kit check took too long. Check your connection and try again.'
        : 'Could not reach the kit check. Check your connection and try again.',
      true,
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.ok) return (await res.json()) as T;

  // The server's own wording is the better wording where it gives us one: it
  // knows whether the image was too large, the parts list was empty, or Vertex
  // is unavailable. Fall back to a plain sentence when it does not.
  let detail = '';
  try {
    detail = ((await res.json()) as { detail?: string })?.detail ?? '';
  } catch {
    /* an error body that is not JSON tells us nothing extra */
  }

  if (res.status === 401 || res.status === 403) {
    throw new VerifierError('Please sign in again to use the kit check.');
  }
  if (res.status === 429) {
    throw new VerifierError('That is a lot of checks in a row. Give it a moment and try again.', true);
  }
  if (res.status === 503) {
    throw new VerifierError(
      detail ||
        "The kit check is busy right now. Try again in a moment, or just start and I'll watch as you go.",
      true,
    );
  }
  throw new VerifierError(
    detail || "Couldn't check your kit just now. Please try again.",
    res.status >= 500,
  );
}

function checkImage(imageBase64: string): void {
  if (!imageBase64?.trim()) {
    throw new VerifierError('No photo was captured. Point the camera at your parts and try again.');
  }
  if (imageBase64.length > MAX_IMAGE_B64_CHARS) {
    throw new VerifierError('That photo is too large to check. Try again a little further back.');
  }
}

/**
 * Check a bench photo against a build's expected parts.
 *
 * `expectedParts` is required and must not be empty: the server answers 422
 * without it, since there is nothing to check the photo against.
 */
export async function verifyInventory(
  imageBase64: string,
  expectedParts: string[],
  buildTitle?: string,
): Promise<InventoryResult> {
  checkImage(imageBase64);
  const parts = expectedParts.map((p) => p.trim()).filter(Boolean);
  if (!parts.length) {
    throw new VerifierError('There is no parts list for this build yet, so there is nothing to check.');
  }
  return post<InventoryResult>('/v1/verify-inventory', {
    image_base64: imageBase64,
    expected_parts: parts,
    build_title: buildTitle,
  });
}

/** Identify a single component held up to the camera. */
export async function identifyComponent(
  imageBase64: string,
  hint?: string,
): Promise<IdentifiedComponent> {
  checkImage(imageBase64);
  return post<IdentifiedComponent>('/v1/identify-component', {
    image_base64: imageBase64,
    hint,
  });
}
