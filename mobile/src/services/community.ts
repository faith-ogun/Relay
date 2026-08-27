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

// ── Challenges ──
//
// A challenge is a SERIES. What a learner joins is an INSTANCE of it, with a
// real start, a real end, and standings that freeze when it closes. The shapes
// below mirror `_challenge_card`, `/challenges/mine`, `/challenges/claim`,
// `/challenges/{id}/standings` and `/challenges/{id}/results` in
// backend/live-bridge/app/community.py field for field. Design:
// metadata/decisions/2026-08-26_live-challenge-lifecycle.md
//
// Note `desc`, not `description`: the card is the template spread whole, and the
// template's key is `desc`. This client read `description` and therefore drew no
// blurb at all.

/** How often a fresh instance opens. */
export type ChallengeCadence = 'weekly' | 'season' | 'rolling';

/** open -> closing -> closed. `closing` is the brief moment a close is running. */
export type InstanceStatus = 'open' | 'closing' | 'closed';

/** The run of a series that is on the clock right now. */
export interface ChallengeInstance {
  instanceId: string | null;
  periodKey: string | null;
  status: InstanceStatus;
  startsAt: string | null;
  endsAt: string | null;
  /** Seconds left when the SERVER answered, not when it is read. */
  endsInSeconds: number | null;
  participantCount: number;
}

/** How this learner has done at this series across every instance so far. */
export interface ChallengeHistory {
  instancesPlayed: number;
  instancesCompleted: number;
  bestRank: number | null;
  xpEarned: number;
}

export interface Challenge {
  id: string;
  title: string;
  /** One-line hook under the title. */
  tagline?: string;
  /** The blurb on the card. */
  desc: string;
  /** The fuller explanation, shown when joining. */
  longDesc?: string;
  /** Display string for what completing pays, e.g. "+150 XP". */
  reward: string;
  /** What "done" looks like, e.g. "7 days in a row". */
  goal?: string;
  durationDays?: number;
  /** Selects the hero illustration. */
  art?: string;
  /** Colour theme key (red/blue/green/gold/violet/indigo). */
  theme?: string;
  order?: number;
  cadence?: ChallengeCadence;
  /** What counts toward the goal, machine readable. */
  metric?: string;
  rewardXp?: number;
  rewardBadge?: string;
  /** Everyone enrolled in the SERIES, which is what the card shows. */
  participantCount: number;
  joined: boolean;
  progress: number;
  target: number;
  completed: boolean;
  /** Rolling challenges have no shared window, so nothing to rank against. */
  ranked: boolean;
  /** False when this instance can no longer be cleared by someone joining now. */
  joinableNow: boolean;
  /** "next" means: in the series, but sitting this instance out. */
  enrolledFor: 'current' | 'next';
  endsInSeconds: number | null;
  instance: ChallengeInstance;
  history: ChallengeHistory;
}

/** A row of the live standings for an open instance. */
export interface StandingRow {
  rank: number;
  name: string;
  progress: number;
  target: number;
  completed: boolean;
  isMe: boolean;
}

/** A row of the FROZEN standings on a closed instance. No per-row target: the
 *  instance carries the one target everybody was racing. */
export interface ResultRow {
  rank: number;
  name: string;
  progress: number;
  completed: boolean;
  isMe: boolean;
}

export interface ChallengeResults {
  challengeId: string;
  title: string;
  periodKey: string | null;
  closedAt: string | null;
  participantCount: number;
  completedCount: number;
  target: number;
  /** Null when nobody cleared the goal. The server refuses to invent one. */
  winner: { uid: string; name: string } | null;
  standings: ResultRow[];
  /** The caller's own frozen row, present even if they missed the top-100 cut. */
  me: ResultRow | null;
}

/** What one finished instance pays, deterministic from the frozen entry. */
export interface ChallengeAward {
  instanceId: string | null;
  challengeId: string;
  title: string;
  periodKey: string | null;
  rank: number | null;
  progress: number;
  target: number;
  completed: boolean;
  /** Completion reward plus podium bonus. */
  xp: number;
  podiumBonus: number;
  badge?: string | null;
  /** When it was settled. Only on awards already in the record. */
  at?: string;
}

/** A run the learner has on the clock right now. */
export interface RunningChallenge {
  challengeId: string;
  title: string;
  art?: string;
  theme?: string;
  cadence?: ChallengeCadence;
  goal?: string;
  instanceId: string | null;
  periodKey: string | null;
  progress: number;
  target: number;
  completed: boolean;
  ranked: boolean;
  endsInSeconds: number | null;
}

export interface MyChallenges {
  running: RunningChallenge[];
  /** Finished instances waiting to be claimed. */
  unclaimed: ChallengeAward[];
  totalXp: number;
  completedCount: number;
  history: ChallengeAward[];
}

/** What a claim actually granted. Empty when there was nothing outstanding. */
export interface ClaimResult {
  granted: ChallengeAward[];
  xp: number;
  badges: string[];
}

export interface LeaderRow { rank: number; name: string; xp: number; isMe: boolean }
export interface Leaderboard { week: string; leaders: LeaderRow[]; me: { xp: number; rank: number | null } }

/**
 * Why a call failed, at the resolution the UI needs.
 *
 * This used to be three values, and everything that was not a 403 collapsed into
 * "offline". So a rate limit, a 500, an expired session and a genuinely dead
 * connection all rendered the same "check your connection" screen, which is
 * wrong three times out of four and leaves nobody, including us, able to tell
 * what actually happened from a screenshot.
 */
export type FailReason =
  | 'offline'          // the request never reached a server
  | 'timeout'          // it reached one and nothing came back in time
  | 'unauthenticated'  // no usable ID token: the session needs refreshing
  | 'forbidden'        // the server refused this account (child mode)
  | 'not_found'        // there is genuinely nothing there yet, and that is fine
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
    // 404 is an answer, not a fault: "this round has not finished yet" is the
    // normal state of a new series, and reporting it as a server error would
    // put an outage screen in front of a learner whose week is simply young.
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
/** Every series, its live instance, and how many finished rounds are unclaimed. */
export const fetchChallenges = () =>
  call<{ challenges: Challenge[]; unclaimedResults: number }>('/challenges');

/** The caller's own view: what is running, and what is waiting to be claimed. */
export const fetchMyChallenges = () => call<MyChallenges>('/challenges/mine');

/** Live standings for the open instance. `ranked: false` for rolling challenges. */
export const fetchChallengeStandings = (id: string) =>
  call<{ ranked: boolean; instance: ChallengeInstance | null; standings: StandingRow[] }>(
    `/challenges/${encodeURIComponent(id)}/standings`,
  );

/**
 * Frozen results for a closed round, most recent by default.
 *
 * A 404 here is not a failure: it is "no finished round yet", which is the
 * normal state of a series in its first week. The caller distinguishes it from a
 * real outage, so `server` is not the right reason to report. The status is
 * surfaced as `notFound` rather than collapsed into a network error.
 */
export const fetchChallengeResults = (id: string, period?: string) =>
  call<ChallengeResults>(
    `/challenges/${encodeURIComponent(id)}/results${period ? `?period=${encodeURIComponent(period)}` : ''}`,
  );

export const fetchLeaderboard = () => call<Leaderboard>('/leaderboard');

/**
 * Settle every finished challenge not yet paid for.
 *
 * Idempotent server-side: the award is keyed by instance id inside a transaction
 * on the caller's record, so a second call, or a second device, grants zero. The
 * server decides IF and HOW MUCH; the client records the XP into the progress
 * envelope and reports it to the weekly league.
 */
export const claimChallenges = () => call<ClaimResult>('/challenges/claim', { method: 'POST' });

/** Report XP into the weekly league. Best effort; the caller does not block on it. */
export const reportXp = (amount: number) =>
  call<{ ok: boolean; week: string }>('/xp', { method: 'POST', body: JSON.stringify({ amount }) });

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

/**
 * Enrol in a series and enter the instance that is running.
 *
 * `enrolledFor` is the one field worth reading on the way back. A day-counting
 * goal with fewer days left than the target needs is not merely hard, it is
 * arithmetically impossible, so the server books the enrolment for the NEXT
 * instance and says so. Telling the learner is not optional: otherwise they
 * watch a bar that cannot move and conclude the app is broken.
 */
export const joinChallenge = (id: string) =>
  call<{
    joined: boolean;
    /** True only the first time this learner has ever joined this series. */
    firstJoin: boolean;
    participantCount: number;
    enrolledFor: 'current' | 'next';
    progress: number;
    target: number;
    endsInSeconds: number | null;
  }>(`/challenges/${encodeURIComponent(id)}/join`, { method: 'POST' });

/** Leave a series. Finished instances are untouched: an unclaimed award stays claimable. */
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
