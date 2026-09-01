// ── Privacy rights on mobile (GDPR Art. 15/17, App Store 5.1.1(v)) ──
//
// App Store review guideline 5.1.1(v) requires an app that offers account
// creation to offer account deletion from inside the app. A link out to the
// website does not satisfy it, and neither does an address to email. This is
// the client half; the server does the erasure.

import { API_BASE } from './config';
import { getIdToken } from './firebase';

async function authHeaders(): Promise<Record<string, string> | null> {
  const token = await getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export type PrivacyResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'offline' | 'unauthenticated' | 'error' };

/** Everything Ohmlet holds about the signed-in user, as JSON. */
export async function fetchMyData(): Promise<PrivacyResult<unknown>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, reason: 'unauthenticated' };
  try {
    const res = await fetch(`${API_BASE}/v1/me/export`, { headers });
    if (!res.ok) return { ok: false, reason: 'error' };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}

/**
 * Permanently delete the account. The server cancels billing, erases every
 * collection holding this uid, purges the 3D twin files, and deletes the
 * Firebase Auth user, which revokes every session on every device.
 */
export async function deleteMyAccount(): Promise<PrivacyResult<true>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, reason: 'unauthenticated' };
  try {
    const res = await fetch(`${API_BASE}/v1/me/delete`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });
    if (!res.ok) return { ok: false, reason: 'error' };
    return { ok: true, data: true };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}
