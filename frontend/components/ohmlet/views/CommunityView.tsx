import React, { useMemo, useState } from 'react';
import { Award, Flame, Heart, MessageCircle, Send, Share2, Trophy, TrendingUp } from 'lucide-react';
import { DEFAULT_POSTS, DEFAULT_COMMENT_REPLIES } from '../data/defaults';
import { LEADERBOARD_WEEKLY, AVATAR_COLORS } from '../data/leaderboard';

/**
 * CommunityView — the social layer. A real feed (avatars, relative timestamps,
 * animated likes, threaded replies), a weekly league, and live challenges.
 */

interface CommunityViewProps {
  currentUser?: string;
}

type Reply = { author: string; text: string; avatar: string; timeAgo: string };

const avatarColor = (seed: string) => AVATAR_COLORS[seed.charCodeAt(0) % AVATAR_COLORS.length];

const CHALLENGES = [
  { id: 'streak7', title: '7-Day Streak', desc: 'Build something every day this week', reward: '+150 XP', joined: 4210, accent: 'from-ohmlet-red to-[#ff9472]', icon: Flame },
  { id: 'genericOnly', title: 'No-Kit Hero', desc: 'Complete a build with only loose parts', reward: 'Champion badge', joined: 1876, accent: 'from-ohmlet-blue to-[#7cc0ff]', icon: Award },
  { id: 'teachBack', title: 'Teach It Back', desc: 'Post a build and explain how it works', reward: '+80 XP', joined: 942, accent: 'from-ohmlet-green to-[#a8e063]', icon: TrendingUp },
];

export const CommunityView: React.FC<CommunityViewProps> = ({ currentUser = 'faith' }) => {
  const [posts, setPosts] = useState(DEFAULT_POSTS);
  const [likeBurst, setLikeBurst] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replies, setReplies] = useState<Record<string, Reply[]>>(DEFAULT_COMMENT_REPLIES);
  const [joined, setJoined] = useState<Record<string, boolean>>({ streak7: true });

  const toggleLike = (id: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p)),
    );
    setLikeBurst(id);
    setTimeout(() => setLikeBurst((cur) => (cur === id ? null : cur)), 450);
  };

  const submitReply = (id: string) => {
    const text = (drafts[id] || '').trim();
    if (!text) return;
    setReplies((prev) => ({
      ...prev,
      [id]: [...(prev[id] || []), { author: currentUser, text, avatar: currentUser[0].toUpperCase(), timeAgo: 'now' }],
    }));
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, comments: p.comments + 1 } : p)));
    setDrafts((prev) => ({ ...prev, [id]: '' }));
    setOpen((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="ohmlet-rise">
      <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Community</p>
      <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">Builders helping builders.</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        {/* Feed */}
        <div className="space-y-5">
          {posts.map((post) => {
            const isOpen = open[post.id];
            const thread = replies[post.id] || [];
            return (
              <article key={post.id} className="overflow-hidden rounded-[1.6rem] border-2 border-ohmlet-line bg-white shadow-soft transition-shadow hover:shadow-press-sm">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 pt-5">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-ohmlet-ink text-base font-black text-ohmlet-ink"
                    style={{ background: avatarColor(post.avatar) }}
                  >
                    {post.avatar}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-black text-ohmlet-ink">
                      {post.author}
                      {post.badge && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ohmlet-gold-soft px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-ohmlet-gold-deep">
                          <Award className="h-3 w-3" /> {post.badge}
                        </span>
                      )}
                    </p>
                    <p className="text-xs font-bold text-ohmlet-ink-soft">{post.timeAgo}</p>
                  </div>
                  {post.buildName && (
                    <span className="hidden shrink-0 rounded-full border border-ohmlet-line bg-ohmlet-cream px-3 py-1 text-xs font-bold text-ohmlet-ink-soft sm:inline">
                      {post.buildName}
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="px-5 pt-3">
                  <h3 className="text-lg font-black leading-tight tracking-tight text-ohmlet-ink">{post.title}</h3>
                  <p className="mt-1.5 text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">{post.body}</p>
                </div>

                {/* Build visual */}
                <div className="mx-5 mt-4 flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-ohmlet-line bg-gradient-to-br from-ohmlet-cream to-ohmlet-gold-soft">
                  <img src="/brand/ohmlet-mascot.png" alt="" aria-hidden className="h-20 w-auto opacity-90" draggable={false} />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 px-3 py-3">
                  <button
                    onClick={() => toggleLike(post.id)}
                    className={`relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition-colors ${
                      post.liked ? 'text-ohmlet-red' : 'text-ohmlet-ink-soft hover:text-ohmlet-ink'
                    }`}
                  >
                    <Heart className={`h-5 w-5 ${likeBurst === post.id ? 'ohmlet-heart-pop' : ''}`} fill={post.liked ? 'currentColor' : 'none'} />
                    {post.likes}
                  </button>
                  <button
                    onClick={() => setOpen((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black text-ohmlet-ink-soft transition-colors hover:text-ohmlet-ink"
                  >
                    <MessageCircle className="h-5 w-5" />
                    {post.comments}
                  </button>
                  <button className="ml-auto inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black text-ohmlet-ink-soft transition-colors hover:text-ohmlet-ink">
                    <Share2 className="h-5 w-5" />
                  </button>
                </div>

                {/* Thread */}
                {(isOpen || post.replyPreview) && (
                  <div className="border-t border-ohmlet-line bg-ohmlet-cream/50 px-5 py-4">
                    {!isOpen && post.replyPreview && (
                      <button onClick={() => setOpen((prev) => ({ ...prev, [post.id]: true }))} className="flex w-full items-start gap-2.5 text-left">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-ohmlet-ink" style={{ background: avatarColor(post.replyPreview.avatar) }}>
                          {post.replyPreview.avatar}
                        </span>
                        <p className="text-sm font-semibold text-ohmlet-ink-soft">
                          <span className="font-black text-ohmlet-ink">{post.replyPreview.author}</span> {post.replyPreview.text}
                        </p>
                      </button>
                    )}

                    {isOpen && (
                      <div className="space-y-3">
                        {thread.map((r, i) => (
                          <div key={i} className="flex items-start gap-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-ohmlet-ink" style={{ background: avatarColor(r.avatar) }}>
                              {r.avatar}
                            </span>
                            <div className="rounded-2xl rounded-tl-sm bg-white px-3.5 py-2 shadow-soft">
                              <p className="text-xs font-black text-ohmlet-ink">
                                {r.author} <span className="font-bold text-ohmlet-ink-soft/60">· {r.timeAgo}</span>
                              </p>
                              <p className="text-sm font-semibold text-ohmlet-ink">{r.text}</p>
                            </div>
                          </div>
                        ))}

                        <div className="flex items-center gap-2 pt-1">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-ohmlet-ink" style={{ background: avatarColor(currentUser[0].toUpperCase()) }}>
                            {currentUser[0].toUpperCase()}
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
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {/* Sidebar: league + challenges */}
        <div className="space-y-6">
          <section className="overflow-hidden rounded-[1.6rem] border-2 border-ohmlet-ink bg-white shadow-press-sm">
            <div className="flex items-center gap-2 bg-ohmlet-ink px-5 py-3.5 text-white">
              <Trophy className="h-5 w-5 text-ohmlet-gold" />
              <h3 className="text-sm font-black tracking-tight">Copper League · This week</h3>
            </div>
            <ol className="divide-y divide-ohmlet-line">
              {LEADERBOARD_WEEKLY.map((row, i) => {
                const me = row.name === currentUser;
                return (
                  <li key={row.name} className={`flex items-center gap-3 px-4 py-3 ${me ? 'bg-ohmlet-gold-soft' : ''}`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                      i === 0 ? 'ohmlet-podium-1 text-ohmlet-ink' : i === 1 ? 'ohmlet-podium-2 text-ohmlet-ink' : i === 2 ? 'ohmlet-podium-3 text-white' : 'bg-ohmlet-line text-ohmlet-ink-soft'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ohmlet-ink text-xs font-black text-ohmlet-ink" style={{ background: avatarColor(row.avatar) }}>
                      {row.avatar}
                    </span>
                    <span className={`flex-1 truncate text-sm font-black ${me ? 'text-ohmlet-ink' : 'text-ohmlet-ink'}`}>
                      {row.name}{me && <span className="ml-1 text-ohmlet-ink-soft">(you)</span>}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-ohmlet-ink-soft">
                      <Flame className="h-3.5 w-3.5 text-ohmlet-red" />{row.streak}
                    </span>
                    <span className="w-16 text-right text-sm font-black tabular-nums text-ohmlet-ink">{row.points.toLocaleString()}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section>
            <h3 className="px-1 text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Live challenges</h3>
            <div className="mt-3 space-y-3">
              {CHALLENGES.map((c) => {
                const Icon = c.icon;
                const isJoined = joined[c.id];
                return (
                  <div key={c.id} className="overflow-hidden rounded-2xl border-2 border-ohmlet-line bg-white shadow-soft">
                    <div className={`flex items-center gap-3 bg-gradient-to-r ${c.accent} px-4 py-3 text-white`}>
                      <Icon className="h-5 w-5" />
                      <p className="text-sm font-black">{c.title}</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-sm font-semibold text-ohmlet-ink-soft">{c.desc}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs font-bold text-ohmlet-ink-soft">{c.joined.toLocaleString()} joined · {c.reward}</span>
                        <button
                          onClick={() => setJoined((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                          className={`rounded-full border-2 px-3.5 py-1.5 text-xs font-black transition-all ${
                            isJoined ? 'border-ohmlet-green bg-[#f1f9e6] text-ohmlet-green-deep' : 'border-ohmlet-ink bg-ohmlet-gold text-ohmlet-ink shadow-press-sm hover:translate-y-[2px] hover:shadow-none'
                          }`}
                        >
                          {isJoined ? 'Joined' : 'Join'}
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
