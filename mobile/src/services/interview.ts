// Interview Mode client.
//
// The interview itself is a live session on a different persona: the same
// WebSocket spine, `mode=interview`, and the server refuses it for anyone but
// Max. This module owns the two halves that are NOT the live session, which are
// getting a resume into the interviewer's hands beforehand and turning the
// transcript into a scored report afterwards.
//
// One thing here is different from every other AI mock interview: a weakness the
// interviewer finds comes back routed to the lesson that closes it. The server
// validates that routing against the real curriculum rather than trusting the
// model, and reports what it could not route in `uncoveredTopics`. That list is
// the most honest curriculum backlog the product will ever have, because it is
// written by what candidates actually get asked.

import { API_BASE } from './config';
import { getIdToken } from './firebase';
import type { Result } from './checkpoints';

/** Report generation is a Pro-model call over a whole transcript: slower than a
 *  fetch, and worth waiting for rather than failing at the usual 12s. */
const REPORT_TIMEOUT_MS = 90_000;
const TIMEOUT_MS = 15_000;

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

/**
 * A weakness the interviewer found, routed to the lesson that closes it.
 *
 * Key names are the server's, exactly: `skillTitle` and `unitTitle`, not `title`.
 * The web carried this field as `string[]` for a while and rendered each object
 * straight into JSX, which React throws on, so any report that recommended
 * anything took the view down. Kept honest by
 * `frontend/scripts/check-interview-contract.mjs`, which checks both clients
 * against the keys the server actually writes.
 */
export interface RoutedTopic {
  topic: string;
  why?: string;
  skillId: string | null;
  skillTitle?: string;
  unitId?: string;
  unitTitle?: string;
  /** False when no skill in the curriculum teaches it. */
  covered: boolean;
}

export interface InterviewReport {
  overall: number;
  readiness: { level: string; headline: string; summary: string };
  competencies: Array<{ name: string; score: number; covered: boolean; note: string }>;
  answers: ReportAnswer[];
  delivery: { notes: string };
  actions: string[];
  recommendedTopics: RoutedTopic[];
  /** Probed, and Ohmlet does not teach it yet. Shown, not hidden: a learner told
   *  they are weak on something deserves to know we have no lesson for it. */
  uncoveredTopics?: string[];
}

export interface ReportListItem {
  id: string;
  role?: string;
  seniority?: string;
  overall?: number;
  createdAt?: string;
}

async function call<T>(path: string, init?: RequestInit, timeoutMs = TIMEOUT_MS): Promise<Result<T>> {
  if (!API_BASE) return { ok: false, reason: 'offline' };
  const token = await getIdToken();
  if (!token) return { ok: false, reason: 'unauthenticated' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (res.status === 401) return { ok: false, reason: 'unauthenticated' };
    // 402 and 403 are different answers to different questions: 402 is "not on
    // your plan", 403 is "not you". Collapsing them would send a Max subscriber
    // to the pricing page over an expired token.
    if (res.status === 402) return { ok: false, reason: 'upgrade_required' };
    if (res.status === 403) return { ok: false, reason: 'unauthenticated' };
    if (res.status === 404) return { ok: false, reason: 'not_found' };
    if (res.status === 429) return { ok: false, reason: 'rate_limited' };
    if (!res.ok) return { ok: false, reason: 'server' };
    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    const aborted = (err as { name?: string } | null)?.name === 'AbortError';
    return { ok: false, reason: aborted ? 'timeout' : 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Score a finished interview.
 *
 * Sent once, when the learner ends the session. A transcript with fewer than two
 * turns is not sent at all: there is nothing to score, and a report generated
 * from an empty conversation would be a fabricated assessment of a real person.
 */
export function generateReport(
  transcript: TranscriptTurn[],
  ctx: InterviewContext,
): Promise<Result<{ id?: string; report: InterviewReport }>> {
  return call<{ id?: string; report: InterviewReport }>(
    '/v1/interview/report',
    {
      method: 'POST',
      body: JSON.stringify({
        transcript,
        role: ctx.role || undefined,
        seniority: ctx.seniority || undefined,
        jobDescription: ctx.jobDescription || undefined,
        warmup: !!ctx.warmup,
      }),
    },
    REPORT_TIMEOUT_MS,
  );
}

/** Past interviews, newest first. Server-owned, so they survive a reinstall. */
export function listReports(): Promise<Result<ReportListItem[]>> {
  return call<ReportListItem[]>('/v1/interview/reports');
}

export function getReport(
  id: string,
): Promise<Result<{ id: string; createdAt: string; report: InterviewReport }>> {
  return call<{ id: string; createdAt: string; report: InterviewReport }>(
    `/v1/interview/reports/${encodeURIComponent(id)}`,
  );
}

/** "3 days ago". Absolute dates make a learner do arithmetic to answer "is this
 *  the one I did this morning?", which is the only question they are asking. */
export function relTime(iso?: string): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}
