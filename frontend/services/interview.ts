// ── Interview Mode client (#21) ──
//
// The mock interview itself runs over the live WebSocket (useLiveBridge with
// mode: 'interview'). This module covers the REST surface on live-bridge: secure
// resume extraction, and the post-session feedback report. All Max-gated; the
// server derives the uid from the token and enforces the tier.

import { getIdToken } from './firebase';

const apiBase = () => (import.meta.env.VITE_OHMLET_API_BASE_URL || '').trim().replace(/\/+$/, '');

export interface TranscriptTurn {
  role: 'interviewer' | 'candidate';
  text: string;
}

export interface InterviewContext {
  role?: string;
  seniority?: string;
  jobDescription?: string;
  resume?: string;
  warmup?: boolean;
}

export interface ReportAnswer {
  question: string;
  excerpt?: string;
  technical: number;
  structure: number;
  communication: number;
  signal: number;
  why: string;
  stronger: string;
}

export interface InterviewReport {
  overall: number;
  readiness: { level: string; headline: string; summary: string };
  competencies: Array<{ name: string; score: number; covered: boolean; note: string }>;
  answers: ReportAnswer[];
  delivery: { notes: string };
  actions: string[];
  recommendedTopics: string[];
}

export interface ReportListItem {
  id: string;
  role?: string;
  seniority?: string;
  overall?: number;
  createdAt?: string;
}

export class InterviewError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function authed(path: string, init?: RequestInit): Promise<Response> {
  const base = apiBase();
  if (!base) throw new InterviewError('Interview Mode is not available right now.', 503);
  const token = await getIdToken();
  if (!token) throw new InterviewError('Please sign in.', 401);
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
}

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new InterviewError(detail?.detail || fallback, res.status);
  }
  return (await res.json()) as T;
}

/** Validate + extract text from an uploaded resume file. */
export async function extractResume(fileBase64: string, filename: string): Promise<{ kind: string; text: string }> {
  const res = await authed('/v1/interview/extract', {
    method: 'POST',
    body: JSON.stringify({ fileBase64, filename }),
  });
  return jsonOrThrow(res, 'We could not read that file.');
}

/** Generate the post-session feedback report from the transcript. */
export async function generateReport(
  transcript: TranscriptTurn[],
  ctx: InterviewContext,
): Promise<{ id: string; createdAt: string; report: InterviewReport }> {
  const res = await authed('/v1/interview/report', {
    method: 'POST',
    body: JSON.stringify({
      transcript,
      role: ctx.role,
      seniority: ctx.seniority,
      jobDescription: ctx.jobDescription,
      warmup: ctx.warmup ?? false,
    }),
  });
  return jsonOrThrow(res, 'Could not generate your report.');
}

export async function listReports(): Promise<ReportListItem[]> {
  try {
    const res = await authed('/v1/interview/reports');
    if (!res.ok) return [];
    return (await res.json()).reports ?? [];
  } catch {
    return [];
  }
}

export async function getReport(id: string): Promise<{ id: string; createdAt: string; report: InterviewReport } | null> {
  try {
    const res = await authed(`/v1/interview/reports/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Read a File into base64 (no data: prefix). Used for resume upload. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}
