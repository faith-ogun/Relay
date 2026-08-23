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

/** Distinguishes "nothing here" from "could not reach the server". */
export type Result<T> = { ok: true; data: T } | { ok: false; reason: 'offline' | 'forbidden' | 'error' };

async function call<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  if (!API_BASE) return { ok: false, reason: 'offline' };
  const token = await getIdToken();
  if (!token) return { ok: false, reason: 'offline' };
  try {
    const res = await fetch(`${API_BASE}/v1/community${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 403) return { ok: false, reason: 'forbidden' };
    if (!res.ok) return { ok: false, reason: 'error' };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, reason: 'offline' };
  }
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
