// 3D digital twins, against the reporter service.
//
// The reporter is not deployed yet (it needs a Stability API key and a storage
// bucket), so every call here degrades to a stated reason rather than a hang or
// a fake artifact. That honesty matters: the web app once showed a "capture a
// twin" button that had never worked for anyone.

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

export const twinsConfigured = (): boolean => !!REPORTER_BASE;

export type TwinError = 'unconfigured' | 'unauthorised' | 'quota' | 'unavailable' | 'failed';

export type TwinResult<T> = { ok: true; data: T } | { ok: false; reason: TwinError; message: string };

async function authHeaders(): Promise<Record<string, string> | null> {
  const token = await getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export async function listTwins(): Promise<TwinResult<Twin[]>> {
  if (!REPORTER_BASE) {
    return { ok: false, reason: 'unconfigured', message: '3D twins are not switched on yet.' };
  }
  const headers = await authHeaders();
  if (!headers) return { ok: false, reason: 'unauthorised', message: 'Please sign in again.' };
  try {
    const res = await fetch(`${REPORTER_BASE}/v1/twins`, { headers });
    if (!res.ok) return { ok: false, reason: 'unavailable', message: 'Could not load your twins.' };
    const data = await res.json();
    return { ok: true, data: (data?.twins ?? []) as Twin[] };
  } catch {
    return { ok: false, reason: 'unavailable', message: 'Could not reach the 3D service.' };
  }
}

/** Generate a twin from a base64 build photo. Slow by nature — a real model runs. */
export async function generateTwin(imageBase64: string, title?: string): Promise<TwinResult<Twin>> {
  if (!REPORTER_BASE) {
    return { ok: false, reason: 'unconfigured', message: '3D twins are not switched on yet.' };
  }
  const headers = await authHeaders();
  if (!headers) return { ok: false, reason: 'unauthorised', message: 'Please sign in again.' };
  try {
    const res = await fetch(`${REPORTER_BASE}/v1/twin`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: imageBase64, title }),
    });
    if (res.status === 402) {
      return { ok: false, reason: 'quota', message: "You've used all your 3D twins this month." };
    }
    if (!res.ok) return { ok: false, reason: 'failed', message: "That twin couldn't be generated." };
    return { ok: true, data: (await res.json()) as Twin };
  } catch {
    return { ok: false, reason: 'unavailable', message: 'Could not reach the 3D service.' };
  }
}

/** Authenticated GLB bytes for the viewer. */
export async function fetchTwinModel(id: string): Promise<ArrayBuffer | null> {
  if (!REPORTER_BASE) return null;
  const headers = await authHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(`${REPORTER_BASE}/v1/twins/${encodeURIComponent(id)}/model`, { headers });
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
    const res = await fetch(`${REPORTER_BASE}/v1/twins/${encodeURIComponent(id)}/share`, {
      method: 'POST', headers,
    });
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
    return (await fetch(`${REPORTER_BASE}/v1/twins/${encodeURIComponent(id)}/unshare`, {
      method: 'POST', headers,
    })).ok;
  } catch {
    return false;
  }
}

/** The public page a share id resolves to. */
export const shareLink = (shareId: string): string => `https://ohmlet.org/t/${shareId}`;
