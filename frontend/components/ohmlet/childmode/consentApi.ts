// Child-mode consent API client (#94). Talks to the live-bridge consent endpoints
// with the signed-in user's Firebase ID token; the server is authoritative (it
// recomputes the age, sets the isMinor/ageStatus/consentVerified custom claims, and
// keeps the append-only consent record). Inert when no API base URL is configured.

import { getIdToken } from '../../../services/firebase';
import type { AgeStatus } from './ageModel';

const API_BASE = (import.meta.env.VITE_OHMLET_API_BASE_URL || '').trim().replace(/\/+$/, '');

export function consentApiConfigured(): boolean {
  return Boolean(API_BASE);
}

export class ConsentApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ConsentApiError';
    this.status = status;
  }
}

async function authFetch<T>(path: string, init: RequestInit): Promise<T> {
  const token = await getIdToken();
  if (!token) throw new ConsentApiError(401, 'Not signed in');
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ConsentApiError(res.status, body || res.statusText);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

export interface AgeAssessmentResponse {
  isMinor: boolean;
  coppa: boolean;
  consentAge: number;
  ageStatus: AgeStatus;
}

/** Record the learner's age server-side; the server sets the age/consent claims. */
export function submitAge(birthYear: number, country: string): Promise<AgeAssessmentResponse> {
  return authFetch('/v1/consent/age', { method: 'POST', body: JSON.stringify({ birthYear, country }) });
}

export interface ConsentStartResponse {
  provider: string;
  url: string | null;
  reference: string | null;
  status?: string;
}

/** A parent begins verifiable consent; returns a redirect URL to the hosted card check. */
export function startConsent(parentEmail: string): Promise<ConsentStartResponse> {
  return authFetch('/v1/consent/start', { method: 'POST', body: JSON.stringify({ parentEmail }) });
}

/** Finalise consent; the server re-verifies with the provider before flipping the claim. */
export function confirmConsent(reference: string): Promise<{ status: string }> {
  return authFetch('/v1/consent/confirm', { method: 'POST', body: JSON.stringify({ reference }) });
}

export interface ConsentStatusResponse {
  childModeEnabled: boolean;
  isMinor: boolean;
  ageStatus: string | null;
  consentVerified: boolean;
  consentProvider: string | null;
}

export function getConsentStatus(): Promise<ConsentStatusResponse> {
  return authFetch('/v1/consent/status', { method: 'GET' });
}
