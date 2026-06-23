import React, { useCallback, useEffect, useState } from 'react';
import { Award, Flame, Heart, Loader2, MessageCircle, Send, Share2, TrendingUp, Trophy, Users } from 'lucide-react';
import { AVATAR_COLORS } from '../data/leaderboard';
import {
  addComment,
  createPost,
  fetchChallenges,
  fetchComments,
  fetchFeed,
  fetchLeaderboard,
  joinChallenge,
  relativeTime,
  toggleLike,
  type Challenge,
  type CommunityComment,
  type CommunityPost,
  type Leaderboard,
} from '../../../services/community';

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

// Small decorative lookup so seeded challenges keep their personality.
const CHALLENGE_STYLE: Record<string, { icon: React.ElementType; accent: string }> = {
  streak7: { icon: Flame, accent: 'from-ohmlet-red to-[#ff9472]' },
  nokit: { icon: Award, accent: 'from-ohmlet-blue to-[#7cc0ff]' },
  teachback: { icon: TrendingUp, accent: 'from-ohmlet-green to-[#a8e063]' },
};
const challengeStyle = (id: string) => CHALLENGE_STYLE[id] ?? { icon: Award, accent: 'from-ohmlet-ink to-ohmlet-slate-700' };

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

  const onJoin = useCallback(async (id: string) => {
    setChallenges((prev) => prev.map((c) => (c.id === id ? { ...c, joined: true, participantCount: c.participantCount + 1 } : c)));
    await joinChallenge(id);
  }, []);

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
            <h3 className="px-1 text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Live challenges</h3>
            <div className="mt-3 space-y-3">
              {challenges.map((c) => {
                const { icon: Icon, accent } = challengeStyle(c.id);
                return (
                  <div key={c.id} className="overflow-hidden rounded-2xl border-2 border-ohmlet-line bg-white shadow-soft">
                    <div className={`flex items-center gap-3 bg-gradient-to-r ${accent} px-4 py-3 text-white`}>
                      <Icon className="h-5 w-5" />
                      <p className="text-sm font-black">{c.title}</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-sm font-semibold text-ohmlet-ink-soft">{c.desc}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs font-bold text-ohmlet-ink-soft">{c.participantCount.toLocaleString()} joined · {c.reward}</span>
                        <button
                          onClick={() => !c.joined && onJoin(c.id)}
                          disabled={c.joined}
                          className={`rounded-full border-2 px-3.5 py-1.5 text-xs font-black transition-all ${
                            c.joined ? 'border-ohmlet-green bg-[#f1f9e6] text-ohmlet-green-deep' : 'border-ohmlet-ink bg-ohmlet-gold text-ohmlet-ink shadow-press-sm hover:translate-y-[2px] hover:shadow-none'
                          }`}
                        >
                          {c.joined ? 'Joined' : 'Join'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
