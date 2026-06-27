// ── Reporter client (#31) ──
//
// Talks to the reporter service: generate a 3D digital twin from a build photo,
// list/fetch/delete twins, and stream a twin's GLB mesh as a blob URL the viewer
// can load. The token authenticates the user; the server derives the UID and
// enforces the per-plan quota. Inert (returns null / "not configured") when the
// reporter URL is unset, so the UI can hide the feature cleanly.

import { getIdToken } from './firebase';

const apiBase = () => (import.meta.env.VITE_OHMLET_REPORTER_API_BASE_URL || '').trim().replace(/\/+$/, '');

export const reporterConfigured = (): boolean => !!apiBase();

export interface Twin {
  id: string;
  status: 'processing' | 'ready' | 'failed' | string;
  title: string;
  buildId?: string | null;
  sessionId?: string | null;
  provider?: string | null;
  sizeBytes?: number | null;
  createdAt?: string | null;
  error?: string | null;
}

export class ReporterError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const token = await getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
}

/**
 * Generate a 3D twin from a base64 build photo. Resolves to the finished twin
 * (status 'ready'). Throws ReporterError with a status the caller can branch on
 * (402 = out of quota / upgrade, 503 = not available).
 */
export async function generateTwin(
  imageBase64: string,
  opts: { title?: string; sessionId?: string; buildId?: string } = {},
): Promise<Twin> {
  const base = apiBase();
  if (!base) throw new ReporterError('3D twins are not available right now.', 503);
  const headers = await authHeaders();
  if (!headers) throw new ReporterError('Please sign in to create a 3D twin.', 401);

  let res: Response;
  try {
    res = await fetch(`${base}/v1/twin`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: imageBase64, ...opts }),
    });
  } catch {
    throw new ReporterError('Could not reach the 3D service. Check your connection.', 0);
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new ReporterError(detail?.detail || 'The 3D twin could not be generated.', res.status);
  }
  return (await res.json()) as Twin;
}

export async function listTwins(): Promise<Twin[]> {
  const base = apiBase();
  if (!base) return [];
  const headers = await authHeaders();
  if (!headers) return [];
  try {
    const res = await fetch(`${base}/v1/twins`, { headers });
    if (!res.ok) return [];
    const data = (await res.json()) as { twins: Twin[] };
    return data?.twins ?? [];
  } catch {
    return [];
  }
}

export async function deleteTwin(id: string): Promise<boolean> {
  const base = apiBase();
  if (!base) return false;
  const headers = await authHeaders();
  if (!headers) return false;
  try {
    const res = await fetch(`${base}/v1/twins/${encodeURIComponent(id)}`, { method: 'DELETE', headers });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch a twin's GLB mesh (with auth) and return an object URL for the viewer.
 * The caller must revokeObjectURL when done. Returns null on failure.
 */
export async function fetchTwinModelUrl(id: string): Promise<string | null> {
  const base = apiBase();
  if (!base) return null;
  const headers = await authHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(`${base}/v1/twins/${encodeURIComponent(id)}/model`, { headers });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}
