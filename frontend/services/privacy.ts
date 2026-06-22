// ── Privacy client (#34) ──
//
// GDPR/CCPA self-service: download all my data, or delete my account. Both are
// authed; the server derives the UID from the verified token.

import { getIdToken } from './firebase';

const apiBase = () => (import.meta.env.VITE_OHMLET_API_BASE_URL || '').trim().replace(/\/+$/, '');

/** Fetch the full data export and trigger a JSON download. Returns true on success. */
export async function exportMyData(): Promise<boolean> {
  const base = apiBase();
  if (!base) return false;
  const token = await getIdToken();
  if (!token) return false;
  try {
    const res = await fetch(`${base}/v1/me/export`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return false;
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `ohmlet-data-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Permanently delete the account and all personal data. Returns true on success. */
export async function deleteMyAccount(): Promise<boolean> {
  const base = apiBase();
  if (!base) return false;
  const token = await getIdToken();
  if (!token) return false;
  try {
    const res = await fetch(`${base}/v1/me/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ confirm: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
