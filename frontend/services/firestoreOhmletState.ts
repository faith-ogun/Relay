/**
 * Ohmlet user-state persistence client.
 *
 * The browser no longer touches Firestore directly. It calls our backend
 * (`GET`/`PUT /v1/state/{userId}`), which reads/writes Firestore with the
 * service account. That lets Firestore client rules deny all direct browser
 * access while persistence keeps working through the trusted server path.
 *
 * The exported surface (`loadOhmletState`, `saveOhmletState`,
 * `isFirestoreConfigured`) is unchanged so `useOhmletUserState` stays as-is —
 * only the transport underneath moved.
 */

import { getIdToken } from './firebase';

type OhmletStateConfig = {
  apiBaseUrl?: string;
};

const API_BASE_URL = (import.meta.env.VITE_OHMLET_API_BASE_URL || '').trim();

const normalizeUrl = (url: string) => url.trim().replace(/\/+$/, '');

const resolveConfig = (override?: OhmletStateConfig) => {
  const apiBaseUrl = normalizeUrl(override?.apiBaseUrl || API_BASE_URL || '');
  return { apiBaseUrl, enabled: Boolean(apiBaseUrl) };
};

const makeUrl = (userId: string, cfg: ReturnType<typeof resolveConfig>) =>
  `${cfg.apiBaseUrl}/v1/state/${encodeURIComponent(userId)}`;

export const isFirestoreConfigured = (override?: OhmletStateConfig) => resolveConfig(override).enabled;

export async function loadOhmletState<T extends Record<string, unknown>>(
  userId: string,
  override?: OhmletStateConfig
): Promise<T | null> {
  const cfg = resolveConfig(override);
  if (!cfg.enabled) return null;

  // The backend derives identity from this token (#44). Signed out -> nothing to
  // load from the server; fall back to local state.
  const token = await getIdToken();
  if (!token) return null;

  const response = await fetch(makeUrl(userId, cfg), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`State load failed (${response.status}): ${body}`);
  }
  const parsed = (await response.json()) as T;
  // Backend returns {} when no document exists; treat that as "nothing stored".
  if (!parsed || Object.keys(parsed).length === 0) return null;
  return parsed;
}

export async function saveOhmletState<T extends Record<string, unknown>>(
  userId: string,
  state: T,
  override?: OhmletStateConfig
): Promise<void> {
  const cfg = resolveConfig(override);
  if (!cfg.enabled) return;

  // No token -> not signed in; skip the server write (local state still holds).
  const token = await getIdToken();
  if (!token) return;

  const response = await fetch(makeUrl(userId, cfg), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(state),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`State save failed (${response.status}): ${body}`);
  }
}
