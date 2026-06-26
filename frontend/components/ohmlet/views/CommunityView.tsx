import React, { useCallback, useEffect, useState } from 'react';
import { Award, Bug, Flame, Heart, Loader2, MessageCircle, Radar, Send, Share2, Sparkles, TrendingUp, Trophy, Users } from 'lucide-react';
import { AVATAR_COLORS } from '../data/leaderboard';
import {
  addComment,
  createPost,
  fetchChallenges,
  fetchComments,
  fetchFeed,
  fetchLeaderboard,
  joinChallenge,
  leaveChallenge,
  relativeTime,
  toggleLike,
  type Challenge,
  type CommunityComment,
  type CommunityPost,
  type Leaderboard,
} from '../../../services/community';
import { ChallengeArt, themeFor } from '../challenges/ChallengeArt';
import { ChallengeJoinDialog, ChallengeLeaveDialog } from '../challenges/ChallengeDialogs';

/**
 * CommunityView — the social layer (#63), now backed by real persistence.
 * Feed with reactions + threaded comments, joinable challenges, and a weekly
 * league that resets every week. The investment (posts, likes, league rank) is
 * what keeps people coming back.
 */

interface CommunityViewProps {
  currentUser?: string;
}

const initial = (s: string) => (s || 'O').trim().charAt(0).toUpperCase();
const avatarColor = (seed: string) => AVATAR_COLORS[(seed || 'O').charCodeAt(0) % AVATAR_COLORS.length];

// Per-challenge icon (the accent colour now comes from the challenge's theme).
const CHALLENGE_ICON: Record<string, React.ElementType> = {
  streak: Flame,
  nokit: Award,
  teachback: TrendingUp,
  sensors: Radar,
  debug: Bug,
  firstlight: Sparkles,
};
const challengeIcon = (art?: string) => CHALLENGE_ICON[art ?? ''] ?? Award;

const KIND_LABEL: Record<CommunityPost['kind'], string> = { build: 'Build', win: 'Win', question: 'Question' };

export const CommunityView: React.FC<CommunityViewProps> = ({ currentUser = 'You' }) => {
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [league, setLeague] = useState<Leaderboard | null>(null);

  const [likeBurst, setLikeBurst] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [threads, setThreads] = useState<Record<string, CommunityComment[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const [composerTitle, setComposerTitle] = useState('');
  const [composerBody, setComposerBody] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchFeed().then((p) => alive && setPosts(p));
    fetchChallenges().then((c) => alive && setChallenges(c));
    fetchLeaderboard().then((l) => alive && setLeague(l));
    return () => {
      alive = false;
    };
  }, []);

  const submitPost = useCallback(async () => {
    const title = composerTitle.trim();
    const body = composerBody.trim();
    if (!title && !body) return;
    setPosting(true);
    const created = await createPost('build', title, body);
    setPosting(false);
    if (created) {
      setPosts((prev) => [created, ...(prev ?? [])]);
      setComposerTitle('');
      setComposerBody('');
    }
  }, [composerTitle, composerBody]);

  const onLike = useCallback(async (id: string) => {
    setLikeBurst(id);
    setTimeout(() => setLikeBurst((cur) => (cur === id ? null : cur)), 450);
    // optimistic
    setPosts((prev) =>
      (prev ?? []).map((p) => (p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p)),
    );
    const res = await toggleLike(id);
    if (res) {
      setPosts((prev) => (prev ?? []).map((p) => (p.id === id ? { ...p, liked: res.liked, likes: res.likes } : p)));
    }
  }, []);

  const openThread = useCallback(async (id: string) => {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
    if (!threads[id]) {
      const c = await fetchComments(id);
      setThreads((prev) => ({ ...prev, [id]: c }));
    }
  }, [threads]);

  const submitReply = useCallback(async (id: string) => {
    const text = (drafts[id] || '').trim();
    if (!text) return;
    setDrafts((prev) => ({ ...prev, [id]: '' }));
    const created = await addComment(id, text);
    if (created) {
      setThreads((prev) => ({ ...prev, [id]: [...(prev[id] || []), created] }));
      setPosts((prev) => (prev ?? []).map((p) => (p.id === id ? { ...p, comments: p.comments + 1 } : p)));
      setOpen((prev) => ({ ...prev, [id]: true }));
    }
  }, [drafts]);

  // The challenge currently being confirmed (join or leave), or null.
  const [joinTarget, setJoinTarget] = useState<Challenge | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<Challenge | null>(null);

  const confirmJoin = useCallback(async () => {
    const target = joinTarget;
    if (!target) return;
    setJoinTarget(null);
    setChallenges((prev) =>
      prev.map((c) => (c.id === target.id ? { ...c, joined: true, participantCount: c.participantCount + 1 } : c)),
    );
    const res = await joinChallenge(target.id);
    if (res) {
      setChallenges((prev) =>
        prev.map((c) => (c.id === target.id ? { ...c, joined: res.joined, participantCount: res.participantCount } : c)),
      );
    }
  }, [joinTarget]);

  const confirmLeave = useCallback(async () => {
    const target = leaveTarget;
    if (!target) return;
    setLeaveTarget(null);
    setChallenges((prev) =>
      prev.map((c) =>
        c.id === target.id ? { ...c, joined: false, participantCount: Math.max(0, c.participantCount - 1) } : c,
      ),
    );
    const res = await leaveChallenge(target.id);
    if (res) {
      setChallenges((prev) =>
        prev.map((c) => (c.id === target.id ? { ...c, joined: res.joined, participantCount: res.participantCount } : c)),
      );
    }
  }, [leaveTarget]);

  return (
    <div className="ohmlet-rise">
      <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Community</p>
      <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">Builders helping builders.</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        {/* Feed */}
        <div className="space-y-5">
          {/* Composer */}
          <div className="rounded-[1.6rem] border-2 border-ohmlet-ink bg-white p-4 shadow-press-sm">
            <input
              value={composerTitle}
              onChange={(e) => setComposerTitle(e.target.value)}
              placeholder="Share a build or a win…"
              className="w-full rounded-xl border-2 border-ohmlet-line bg-ohmlet-cream px-4 py-2.5 text-sm font-black outline-none focus:border-ohmlet-ink"
            />
            <textarea
              value={composerBody}
              onChange={(e) => setComposerBody(e.target.value)}
              placeholder="What did you make? What tripped you up?"
              rows={2}
              className="mt-2 w-full resize-none rounded-xl border-2 border-ohmlet-line bg-ohmlet-cream px-4 py-2.5 text-sm font-semibold outline-none focus:border-ohmlet-ink"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={submitPost}
                disabled={posting || (!composerTitle.trim() && !composerBody.trim())}
                className="inline-flex items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-5 py-2 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all enabled:hover:translate-y-[2px] enabled:hover:shadow-none disabled:opacity-50"
              >
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Post
              </button>
            </div>
          </div>

          {posts === null && (
            <div className="flex items-center justify-center gap-2 rounded-[1.6rem] border-2 border-ohmlet-line bg-white py-12 text-ohmlet-ink-soft">
              <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-sm font-bold">Loading the feed…</span>
            </div>
          )}

          {posts !== null && posts.length === 0 && (
            <div className="rounded-[1.6rem] border-2 border-dashed border-ohmlet-line bg-white px-6 py-12 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ohmlet-gold-soft">
                <Users className="h-7 w-7 text-ohmlet-gold-deep" />
              </span>
              <p className="mt-4 text-base font-black text-ohmlet-ink">Be the first to post</p>
              <p className="mt-1 text-sm font-semibold text-ohmlet-ink-soft">Share your latest build and kick off the feed.</p>
            </div>
          )}

          {(posts ?? []).map((post) => {
            const isOpen = open[post.id];
            const thread = threads[post.id] || [];
            return (
              <article key={post.id} className="overflow-hidden rounded-[1.6rem] border-2 border-ohmlet-line bg-white shadow-soft transition-shadow hover:shadow-press-sm">
                <div className="flex items-center gap-3 px-5 pt-5">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-ohmlet-ink text-base font-black text-ohmlet-ink"
                    style={{ background: avatarColor(post.authorName) }}
                  >
                    {initial(post.authorName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-ohmlet-ink">{post.authorName}</p>
                    <p className="text-xs font-bold text-ohmlet-ink-soft">{relativeTime(post.createdAt)}</p>
                  </div>
                  <span className="hidden shrink-0 rounded-full border border-ohmlet-line bg-ohmlet-cream px-3 py-1 text-xs font-bold text-ohmlet-ink-soft sm:inline">
                    {KIND_LABEL[post.kind]}
                  </span>
                </div>

                <div className="px-5 pt-3">
                  {post.title && <h3 className="text-lg font-black leading-tight tracking-tight text-ohmlet-ink">{post.title}</h3>}
                  {post.body && <p className="mt-1.5 text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">{post.body}</p>}
                </div>

                <div className="flex items-center gap-1 px-3 py-3">
                  <button
                    onClick={() => onLike(post.id)}
                    className={`relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition-colors ${
                      post.liked ? 'text-ohmlet-red' : 'text-ohmlet-ink-soft hover:text-ohmlet-ink'
                    }`}
                  >
                    <Heart className={`h-5 w-5 ${likeBurst === post.id ? 'ohmlet-heart-pop' : ''}`} fill={post.liked ? 'currentColor' : 'none'} />
                    {post.likes}
                  </button>
                  <button
                    onClick={() => openThread(post.id)}
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black text-ohmlet-ink-soft transition-colors hover:text-ohmlet-ink"
                  >
                    <MessageCircle className="h-5 w-5" />
                    {post.comments}
                  </button>
                  <button className="ml-auto inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black text-ohmlet-ink-soft transition-colors hover:text-ohmlet-ink">
                    <Share2 className="h-5 w-5" />
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-ohmlet-line bg-ohmlet-cream/50 px-5 py-4">
                    <div className="space-y-3">
                      {thread.map((r) => (
                        <div key={r.id} className="flex items-start gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-ohmlet-ink" style={{ background: avatarColor(r.authorName) }}>
                            {initial(r.authorName)}
                          </span>
                          <div className="rounded-2xl rounded-tl-sm bg-white px-3.5 py-2 shadow-soft">
                            <p className="text-xs font-black text-ohmlet-ink">
                              {r.authorName} <span className="font-bold text-ohmlet-ink-soft/60">· {relativeTime(r.createdAt)}</span>
                            </p>
                            <p className="text-sm font-semibold text-ohmlet-ink">{r.text}</p>
                          </div>
                        </div>
                      ))}
                      {thread.length === 0 && <p className="text-xs font-bold text-ohmlet-ink-soft">No replies yet. Start the conversation.</p>}

                      <div className="flex items-center gap-2 pt-1">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-ohmlet-ink" style={{ background: avatarColor(currentUser) }}>
                          {initial(currentUser)}
                        </span>
                        <input
                          value={drafts[post.id] || ''}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && submitReply(post.id)}
                          placeholder="Add a reply"
                          className="flex-1 rounded-full border-2 border-ohmlet-line bg-white px-4 py-2 text-sm font-semibold outline-none focus:border-ohmlet-ink"
                        />
                        <button
                          onClick={() => submitReply(post.id)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ohmlet-ink bg-ohmlet-gold text-ohmlet-ink shadow-press-sm transition-all hover:translate-y-[2px] hover:shadow-none"
                          aria-label="Reply"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {/* Sidebar: weekly league + challenges */}
        <div className="space-y-6">
          <section className="overflow-hidden rounded-[1.6rem] border-2 border-ohmlet-ink bg-white shadow-press-sm">
            <div className="flex items-center gap-2 bg-ohmlet-ink px-5 py-3.5 text-white">
              <Trophy className="h-5 w-5 text-ohmlet-gold" />
              <h3 className="text-sm font-black tracking-tight">Weekly League</h3>
              {league?.me?.rank && <span className="ml-auto text-xs font-bold text-white/70">You're #{league.me.rank}</span>}
            </div>
            {league === null ? (
              <div className="flex items-center justify-center gap-2 py-10 text-ohmlet-ink-soft">
                <Loader2 className="h-4 w-4 animate-spin" /> <span className="text-xs font-bold">Loading…</span>
              </div>
            ) : league.leaders.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm font-semibold text-ohmlet-ink-soft">
                Earn XP this week to climb the league. The board resets every Monday.
              </p>
            ) : (
              <ol className="divide-y divide-ohmlet-line">
                {league.leaders.map((row, i) => (
                  <li key={`${row.rank}-${row.name}`} className={`flex items-center gap-3 px-4 py-3 ${row.isMe ? 'bg-ohmlet-gold-soft' : ''}`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                      i === 0 ? 'ohmlet-podium-1 text-ohmlet-ink' : i === 1 ? 'ohmlet-podium-2 text-ohmlet-ink' : i === 2 ? 'ohmlet-podium-3 text-white' : 'bg-ohmlet-line text-ohmlet-ink-soft'
                    }`}>
                      {row.rank}
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ohmlet-ink text-xs font-black text-ohmlet-ink" style={{ background: avatarColor(row.name) }}>
                      {initial(row.name)}
                    </span>
                    <span className="flex-1 truncate text-sm font-black text-ohmlet-ink">
                      {row.name}{row.isMe && <span className="ml-1 text-ohmlet-ink-soft">(you)</span>}
                    </span>
                    <span className="w-16 text-right text-sm font-black tabular-nums text-ohmlet-ink">{row.xp.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section>
            <div className="flex items-baseline justify-between px-1">
              <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Live challenges</h3>
              <span className="text-xs font-bold text-ohmlet-ink-soft">{challenges.length}</span>
            </div>
            <div className="mt-3 space-y-3">
              {challenges.map((c) => {
                const Icon = challengeIcon(c.art);
                const palette = themeFor(c.theme);
                return (
                  <div
                    key={c.id}
                    className="group overflow-hidden rounded-2xl border-2 border-ohmlet-line bg-white shadow-soft transition-all hover:-translate-y-0.5 hover:border-ohmlet-ink hover:shadow-press-sm"
                  >
                    {/* Art strip with the icon + title overlaid */}
                    <button
                      type="button"
                      onClick={() => (c.joined ? setLeaveTarget(c) : setJoinTarget(c))}
                      className="relative block h-24 w-full text-left"
                      aria-label={c.joined ? `Manage ${c.title}` : `Join ${c.title}`}
                    >
                      <ChallengeArt art={c.art} theme={c.theme} className="absolute inset-0 h-full w-full" />
                      <div className="absolute inset-0 bg-gradient-to-t from-ohmlet-ink/55 to-transparent" />
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-ohmlet-ink bg-white">
                          <Icon className="h-4 w-4 text-ohmlet-ink" strokeWidth={2.5} />
                        </span>
                        <p className="truncate text-sm font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">{c.title}</p>
                        {c.joined && (
                          <span className="ml-auto shrink-0 rounded-full border border-white/70 bg-white/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white backdrop-blur">
                            In
                          </span>
                        )}
                      </div>
                    </button>

                    <div className="px-4 py-3">
                      <p className="text-sm font-semibold leading-snug text-ohmlet-ink-soft">{c.desc}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-ohmlet-ink-soft">
                          {c.participantCount.toLocaleString()} joined · {c.reward}
                        </span>
                        {c.joined ? (
                          <button
                            onClick={() => setLeaveTarget(c)}
                            className="shrink-0 rounded-full border-2 border-ohmlet-line px-3.5 py-1.5 text-xs font-black text-ohmlet-ink-soft transition-all hover:border-ohmlet-red hover:text-ohmlet-red"
                          >
                            Leave
                          </button>
                        ) : (
                          <button
                            onClick={() => setJoinTarget(c)}
                            className="shrink-0 rounded-full border-2 border-ohmlet-ink bg-ohmlet-gold px-3.5 py-1.5 text-xs font-black text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none"
                          >
                            Join
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {joinTarget && (
        <ChallengeJoinDialog challenge={joinTarget} onConfirm={confirmJoin} onClose={() => setJoinTarget(null)} />
      )}
      {leaveTarget && (
        <ChallengeLeaveDialog challenge={leaveTarget} onConfirm={confirmLeave} onClose={() => setLeaveTarget(null)} />
      )}
    </div>
  );
};
