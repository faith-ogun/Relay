// ── Vision-verifier client (#33) ──
//
// The camera component inventory check: post a still of the learner's bench plus
// the build's expected parts, get back a per-part present/missing verdict. Authed
// (the server derives the user from the verified Firebase token).

import { getIdToken } from './firebase';

const apiBase = () =>
  (import.meta.env.VITE_OHMLET_VERIFIER_API_BASE_URL || '').trim().replace(/\/+$/, '');

export type PartStatus = {
  name: string;
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

/** Thrown with a user-safe message; `retryable` flags a transient 503 (busy). */
export class VerifierError extends Error {
  retryable: boolean;
  constructor(message: string, retryable = false) {
    super(message);
    this.name = 'VerifierError';
    this.retryable = retryable;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const base = apiBase();
  if (!base) throw new VerifierError('Kit check is not available right now.');
  const token = await getIdToken();
  if (!token) throw new VerifierError('Please sign in to use the kit check.');
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new VerifierError('Could not reach the kit check. Check your connection and try again.', true);
  }
  if (res.status === 503) {
    throw new VerifierError("The kit check is busy right now. Try again in a moment, or just start and I'll watch as you go.", true);
  }
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.detail ?? '';
    } catch {
      /* ignore */
    }
    throw new VerifierError(detail || "Couldn't check your kit just now. Please try again.", res.status >= 500);
  }
  return (await res.json()) as T;
}

/** Check a bench photo against a build's expected parts. */
export function verifyInventory(
  imageBase64: string,
  expectedParts: string[],
  buildTitle?: string,
): Promise<InventoryResult> {
  return post<InventoryResult>('/v1/verify-inventory', {
    image_base64: imageBase64,
    expected_parts: expectedParts,
    build_title: buildTitle,
  });
}

/** Identify a single component held up to the camera. */
export function identifyComponent(imageBase64: string, hint?: string): Promise<IdentifiedComponent> {
  return post<IdentifiedComponent>('/v1/identify-component', { image_base64: imageBase64, hint });
}

/** Whether the verifier service is configured (a base URL is set). */
export const verifierConfigured = () => Boolean(apiBase());
