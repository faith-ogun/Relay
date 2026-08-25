// The social layer, against the deployed live-bridge community API.
//
// Every write endpoint is guarded server-side by require_non_minor, so a child
// account is refused with a 403 no matter what this client does. Reads are open
// to any signed-in user. This module surfaces failures rather than swallowing
// them: the web app returned null on error, which made an outage look identical
// to an empty feed and rendered a cheerful "be the first to post" during
// downtime.

import { API_BASE } from './config';
import { getIdToken } from './firebase';

export interface Post {
  id: string;
  uid: string;
  authorName: string;
  kind: 'build' | 'win' | 'question';
  title: string;
  body: string;
  likes: number;
  comments: number;
  liked: boolean;
  createdAt: string;
}

export interface Comment {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  participantCount: number;
  joined: boolean;
  endsAt?: string;
}

export interface LeaderRow { rank: number; name: string; xp: number; isMe: boolean }
export interface Leaderboard { week: string; leaders: LeaderRow[]; me: { xp: number; rank: number | null } }

/**
 * Why a call failed, at the resolution the UI needs.
 *
 * This used to be three values, and everything that was not a 403 collapsed into
 * "offline". So a rate limit, a 500, an expired session and a genuinely dead
 * connection all rendered the same "check your connection" screen — which is
 * wrong three times out of four, and leaves nobody, including us, able to tell
 * what actually happened from a screenshot.
 */
export type FailReason =
  | 'offline'          // the request never reached a server
  | 'timeout'          // it reached one and nothing came back in time
  | 'unauthenticated'  // no usable ID token: the session needs refreshing
  | 'forbidden'        // the server refused this account (child mode)
  | 'rate_limited'     // 429
  | 'server';          // 5xx, or any other unexpected status

export type Result<T> = { ok: true; data: T } | { ok: false; reason: FailReason };

/**
 * React Native's fetch has NO default timeout, so a request on a weak mobile
 * connection can sit open indefinitely and the screen just looks dead. Twelve
 * seconds is long enough to cover a Cloud Run cold start on a slow link and
 * short enough that a real failure surfaces while the learner is still looking
 * at the screen.
 */
const TIMEOUT_MS = 12_000;

/** One retry, because the FIRST request after the service scales to zero pays a
 *  cold start and is the one most likely to time out. Retrying a read is safe;
 *  writes are excluded below. */
const RETRY_DELAY_MS = 900;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function once<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  if (!API_BASE) return { ok: false, reason: 'offline' };
  const token = await getIdToken();
  // A missing token is a session problem, not a network problem, and telling
  // someone to check their connection when they need to sign in again wastes
  // their time.
  if (!token) return { ok: false, reason: 'unauthenticated' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/v1/community${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 403) return { ok: false, reason: 'forbidden' };
    if (res.status === 401) return { ok: false, reason: 'unauthenticated' };
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

/** Failures worth trying again once: nothing was durably decided by the server. */
const TRANSIENT: ReadonlySet<FailReason> = new Set<FailReason>(['timeout', 'offline', 'server']);

async function call<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  const first = await once<T>(path, init);
  // Never retry a write: a POST that timed out may well have been applied, and
  // a second one would double-post or double-like.
  const isWrite = !!init?.method && init.method.toUpperCase() !== 'GET';
  if (first.ok || isWrite || !TRANSIENT.has(first.reason)) return first;
  await sleep(RETRY_DELAY_MS);
  return once<T>(path, init);
}

export interface CommunityStats {
  /** Likes this user's own posts have received. Only the server can see this. */
  likesReceived: number;
  posts: number;
  comments: number;
}

/** Social counters the client cannot observe about itself. */
export const fetchCommunityStats = () => call<CommunityStats>('/stats');

export const fetchFeed = () => call<{ posts: Post[] }>('/posts');
export const fetchComments = (postId: string) =>
  call<{ comments: Comment[] }>(`/posts/${encodeURIComponent(postId)}/comments`);
export const fetchChallenges = () => call<{ challenges: Challenge[] }>('/challenges');
export const fetchLeaderboard = () => call<Leaderboard>('/leaderboard');

export const createPost = (kind: Post['kind'], title: string, body: string) =>
  call<Post>('/posts', { method: 'POST', body: JSON.stringify({ kind, title, body }) });

export const toggleLike = (postId: string) =>
  call<{ liked: boolean; likes: number }>(`/posts/${encodeURIComponent(postId)}/like`, { method: 'POST' });

export const addComment = (postId: string, body: string) =>
  call<Comment>(`/posts/${encodeURIComponent(postId)}/comments`, { method: 'POST', body: JSON.stringify({ body }) });

export const reportPost = (postId: string) =>
  call<{ status: string }>(`/posts/${encodeURIComponent(postId)}/report`, { method: 'POST' });

export const blockUser = (targetUid: string) =>
  call<{ status: string }>('/block', { method: 'POST', body: JSON.stringify({ targetUid }) });

export const joinChallenge = (id: string) =>
  call<{ joined: boolean; participantCount: number }>(`/challenges/${encodeURIComponent(id)}/join`, { method: 'POST' });

export const leaveChallenge = (id: string) =>
  call<{ joined: boolean; participantCount: number }>(`/challenges/${encodeURIComponent(id)}/leave`, { method: 'POST' });

/** Relative time, matching the web app's phrasing. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}
