// ── Community client (#63) ──
//
// The social layer: feed, reactions, comments, challenges, and the weekly league.
// All authed; the server derives the author/uid from the verified token.

import { getIdToken } from './firebase';

const apiBase = () => (import.meta.env.VITE_OHMLET_API_BASE_URL || '').trim().replace(/\/+$/, '');

export interface CommunityPost {
  id: string;
  authorName: string;
  kind: 'build' | 'win' | 'question';
  title: string;
  body: string;
  likes: number;
  comments: number;
  liked: boolean;
  createdAt: string;
}

export interface CommunityComment {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface Challenge {
  id: string;
  title: string;
  desc: string;
  reward: string;
  participantCount: number;
  joined: boolean;
  progress: number;
}

export interface LeaderRow {
  rank: number;
  name: string;
  xp: number;
  isMe: boolean;
}

export interface Leaderboard {
  week: string;
  leaders: LeaderRow[];
  me: { xp: number; rank: number | null };
}

async function api<T>(path: string, init?: RequestInit): Promise<T | null> {
  const base = apiBase();
  if (!base) return null;
  const token = await getIdToken();
  if (!token) return null;
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchFeed(): Promise<CommunityPost[]> {
  const data = await api<{ posts: CommunityPost[] }>('/v1/community/posts');
  return data?.posts ?? [];
}

export async function createPost(
  kind: CommunityPost['kind'],
  title: string,
  body: string,
): Promise<CommunityPost | null> {
  return api<CommunityPost>('/v1/community/posts', { method: 'POST', body: JSON.stringify({ kind, title, body }) });
}

export async function toggleLike(postId: string): Promise<{ liked: boolean; likes: number } | null> {
  return api(`/v1/community/posts/${postId}/like`, { method: 'POST' });
}

export async function fetchComments(postId: string): Promise<CommunityComment[]> {
  const data = await api<{ comments: CommunityComment[] }>(`/v1/community/posts/${postId}/comments`);
  return data?.comments ?? [];
}

export async function addComment(postId: string, text: string): Promise<CommunityComment | null> {
  return api<CommunityComment>(`/v1/community/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function fetchChallenges(): Promise<Challenge[]> {
  const data = await api<{ challenges: Challenge[] }>('/v1/community/challenges');
  return data?.challenges ?? [];
}

export async function joinChallenge(id: string): Promise<{ joined: boolean; participantCount: number } | null> {
  return api(`/v1/community/challenges/${id}/join`, { method: 'POST' });
}

export async function fetchLeaderboard(): Promise<Leaderboard | null> {
  return api<Leaderboard>('/v1/community/leaderboard');
}

/** Report XP into the weekly league. Best-effort; never blocks the caller. */
export async function reportXp(amount: number): Promise<void> {
  if (amount <= 0) return;
  await api('/v1/community/xp', { method: 'POST', body: JSON.stringify({ amount }) });
}

/** Compact relative time, e.g. "3m", "2h", "5d". */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!then) return 'now';
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
