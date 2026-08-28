import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Animated, {
  Easing, FadeIn, FadeInDown, useAnimatedProps, useAnimatedStyle, useDerivedValue,
  useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Close, Comment as CommentIcon, Heart, Send } from '../components/icons';
import {
  ChallengeArt, CheckGlyph, ClockGlyph, RewardGlyph, TargetGlyph, TrophyGlyph, UsersGlyph,
  themeFor, type ChallengePalette,
} from '../components/ChallengeArt';
import { goBack } from '../services/nav';
import { AppTabs } from '../components/AppTabs';
import { Button } from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { useChildSafe } from '../hooks/useChildSafe';
import { ClosedForNow } from '../components/ClosedForNow';
import {
  addComment, blockUser, claimChallenges, createPost, fetchChallenges, fetchChallengeResults,
  fetchChallengeStandings, fetchComments, fetchFeed, fetchLeaderboard, fetchMyChallenges,
  joinChallenge, leaveChallenge, relativeTime, reportPost, reportXp, toggleLike,
  type Challenge, type ChallengeAward, type ChallengeResults, type Comment, type FailReason,
  type Leaderboard, type MyChallenges, type Post, type StandingRow,
} from '../services/community';
import { bumpMetric, creditLeagueWin, loadProgress, saveProgress } from '../services/progress';
import { colors, font, leading, radius, space, tabular, tracking, type, curve } from '../theme/tokens';
import { elevation, innerLight } from '../theme/elevation';
import { duration, motion, stagger } from '../theme/motion';

type Tab = 'feed' | 'challenges' | 'league';
type LoadState = 'loading' | 'ready' | 'offline' | 'forbidden';

/**
 * What to say when the feed will not load.
 *
 * Every one of these used to read "check your connection", which is wrong for
 * four of the five and sends someone to fiddle with their wifi while their
 * session quietly needs refreshing. Naming the failure is also what makes a
 * screenshot diagnosable.
 */
const FAILURE_COPY: Record<FailReason, { title: string; body: string }> = {
  offline: {
    title: "Can't reach the community",
    body: 'Your device could not reach Ohmlet. Check your connection and try again.',
  },
  timeout: {
    title: 'That took too long',
    body: 'Ohmlet answered too slowly to wait for, which usually means a weak connection. Trying again often works straight away.',
  },
  unauthenticated: {
    title: 'Your session needs refreshing',
    body: 'Sign out and back in, and the feed will load.',
  },
  forbidden: {
    title: 'Community is off for this account',
    body: 'Younger builders get the lessons, the simulator and the live tutor, without the social feed.',
  },
  not_found: {
    title: 'Nothing here yet',
    body: 'There is no finished round to show. Come back once this one closes.',
  },
  rate_limited: {
    title: 'Slow down a moment',
    body: 'Too many requests in a short window. Wait a minute and try again.',
  },
  server: {
    title: 'Something went wrong on our side',
    body: 'This one is ours, not yours. It is worth trying again shortly.',
  },
};

export default function Community() {
  const { childSafe, resolved: childResolved } = useChildSafe();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('feed');
  const [state, setState] = useState<LoadState>('loading');
  // Kept separately from `state` so the screen can name the failure instead of
  // blaming the learner's connection for a server error or an expired session.
  const [failure, setFailure] = useState<FailReason>('offline');
  const [posts, setPosts] = useState<Post[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  // A challenge list that failed is not an empty challenge list. Kept apart so
  // an outage does not render "no live challenges", which reads as the product
  // having nothing to offer.
  const [challengeFail, setChallengeFail] = useState<FailReason | null>(null);
  // When the list was answered, so the countdowns can advance from the server's
  // own `endsInSeconds` instead of trusting the phone's clock against a UTC
  // deadline it has no business knowing about.
  const [challengesAt, setChallengesAt] = useState(() => Date.now());
  const [unclaimedCount, setUnclaimedCount] = useState(0);
  const [mine, setMine] = useState<MyChallenges | null>(null);
  const [league, setLeague] = useState<Leaderboard | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [composing, setComposing] = useState(false);
  // Overlays live beside the ScrollView, never inside it: an absolutely
  // positioned child of scrolling content is positioned against the content,
  // so it would sit wherever the list happened to be scrolled to.
  const [resultsFor, setResultsFor] = useState<Challenge | null>(null);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    const [feed, chal, board, own] = await Promise.all([
      fetchFeed(), fetchChallenges(), fetchLeaderboard(), fetchMyChallenges(),
    ]);
    if (!feed.ok) {
      if (feed.reason === 'forbidden') { setState('forbidden'); return; }
      setFailure(feed.reason);
      setState('offline');
      return;
    }
    setPosts(feed.data.posts ?? []);
    if (chal.ok) {
      setChallenges(chal.data.challenges ?? []);
      setUnclaimedCount(chal.data.unclaimedResults ?? 0);
      setChallengesAt(Date.now());
      setChallengeFail(null);
    } else {
      setChallengeFail(chal.reason);
    }
    setMine(own.ok ? own.data : null);
    if (board.ok) setLeague(board.data);
    // Render as soon as the feed is in. The league-win credit below is a
    // write-behind: it used to sit between the data arriving and the screen
    // appearing, so every visit waited on a progress read and sometimes a write
    // before showing a feed that was already in hand.
    setState('ready');

    // A top-three finish is worth an achievement, credited once per week.
    if (board.ok && user?.uid && board.data.me.rank && board.data.me.rank <= 3) {
      const p = await loadProgress(user.uid);
      const next = creditLeagueWin(p, board.data.week, board.data.me.rank);
      if (next !== p) await saveProgress(user.uid, next);
    }
  }, [user?.uid]);

  // Nothing is fetched until the age posture is known. `resolved` starts false,
  // so firing this on mount would send four community requests for a minor and
  // collect four 403s before the gate below could render, which is audit noise
  // for a screen they are never going to see.
  useEffect(() => {
    if (!childResolved || childSafe) return;
    void load();
  }, [load, childResolved, childSafe]);

  // Child mode (#94): refused before anything is fetched. Hiding the row on
  // Home is not a control, and the server refuses this too.
  if (childResolved && childSafe) {
    return (
      <ClosedForNow
        title="Community is for older builders"
        body="Ohmlet keeps the public feed, challenges and the league closed while an account belongs to someone under the age of digital consent. Everything else in the app is open to you."
      />
    );
  }

  if (state === 'loading') {
    return <View style={s.center}><ActivityIndicator color={colors.goldDeep} /></View>;
  }

  // Child accounts are refused server-side; say so plainly rather than showing
  // an empty feed that looks broken.
  if (state === 'forbidden') {
    return (
      <View style={s.center}>
        <Text style={s.emptyTitle}>Community is off for this account</Text>
        <Text style={s.emptyBody}>
          Younger builders get the lessons, the simulator and the live tutor, without the social feed.
        </Text>
        <Button label="Go back" onPress={() => goBack('/home')} style={{ marginTop: space.lg }} />
      </View>
    );
  }

  if (state === 'offline') {
    const copy = FAILURE_COPY[failure] ?? FAILURE_COPY.offline;
    return (
      <View style={s.center}>
        <Text style={s.emptyTitle}>{copy.title}</Text>
        <Text style={s.emptyBody}>{copy.body}</Text>
        <Button label="Try again" onPress={() => void load()} style={{ marginTop: space.lg }} />
      </View>
    );
  }

  return (
    <AppTabs active="community">
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} tintColor={colors.goldDeep}
              onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} />
          }
        >
          <Pressable onPress={() => goBack('/home')} style={s.backLink}><Text style={s.backText}>‹ Back</Text></Pressable>
          <Text style={s.eyebrow}>COMMUNITY</Text>
          <Text style={s.title}>Builders like you.</Text>

          <View style={s.tabs}>
            {(['feed', 'challenges', 'league'] as Tab[]).map((t) => {
              // A finished round is the one thing here that expires, and this
              // screen opens on the feed. Without a count on the pill a learner
              // who never thinks to press Challenges is never told they placed.
              // The server counts real closed entries for exactly this.
              const waiting = t === 'challenges' ? (mine?.unclaimed.length || unclaimedCount) : 0;
              const label = t === 'feed' ? 'Feed' : t === 'challenges' ? 'Challenges' : 'League';
              return (
                <Pressable key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabActive]}
                  accessibilityRole="tab" accessibilityState={{ selected: tab === t }}
                  accessibilityLabel={
                    waiting > 0
                      ? `${label}, ${waiting} finished ${waiting === 1 ? 'round' : 'rounds'} to collect`
                      : label
                  }>
                  <Text style={[s.tabText, tab === t && s.tabTextActive]}>{label}</Text>
                  {waiting > 0 && (
                    <View style={s.tabBadge} pointerEvents="none">
                      <Text style={s.tabBadgeText}>{waiting}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {tab === 'feed' && (
            <Feed
              posts={posts}
              onChanged={load}
              onCompose={() => setComposing(true)}
              uid={user?.uid}
            />
          )}
          {tab === 'challenges' && (
            <Challenges
              items={challenges}
              fail={challengeFail}
              fetchedAt={challengesAt}
              unclaimed={mine?.unclaimed ?? []}
              unclaimedCount={unclaimedCount}
              mineFailed={mine === null}
              onChanged={load}
              onOpenResults={setResultsFor}
              onOpenClaim={() => setClaiming(true)}
              uid={user?.uid}
            />
          )}
          {tab === 'league' && <League board={league} />}
        </ScrollView>

        {composing && <Composer onClose={() => setComposing(false)} onPosted={load} uid={user?.uid} />}
        {!!resultsFor && <ResultsSheet challenge={resultsFor} onClose={() => setResultsFor(null)} />}
        {claiming && (
          <ClaimSheet
            awards={mine?.unclaimed ?? []}
            challenges={challenges}
            uid={user?.uid}
            onClose={() => setClaiming(false)}
            onClaimed={load}
          />
        )}
      </KeyboardAvoidingView>
    </AppTabs>
  );
}

// ── Feed ───────────────────────────────────────────────────────────────────
const Feed: React.FC<{ posts: Post[]; onChanged: () => Promise<void>; onCompose: () => void; uid?: string }> = ({
  posts, onChanged, onCompose, uid,
}) => {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [openComments, setOpenComments] = useState<string | null>(null);

  if (posts.length === 0) {
    return (
      <View style={s.emptyBlock}>
        <Text style={s.emptyTitle}>No posts yet</Text>
        <Text style={s.emptyBody}>Finish a build and share it. Someone has to go first.</Text>
        <Button label="Share a build" onPress={onCompose} style={{ marginTop: space.md }} />
      </View>
    );
  }

  return (
    <View>
      <Button label="Share a build" onPress={onCompose} style={{ marginBottom: space.md }} />
      {posts.map((p) => (
        <View key={p.id} style={s.post}>
          <View style={s.postTop}>
            <View style={s.avatar}><Text style={s.avatarText}>{(p.authorName || '?').slice(0, 1).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.author}>{p.authorName}</Text>
              <Text style={s.meta}>{relativeTime(p.createdAt)} · {p.kind}</Text>
            </View>
            <Pressable onPress={() => setMenuFor(menuFor === p.id ? null : p.id)} hitSlop={10}
              accessibilityRole="button" accessibilityLabel="Post options">
              <Text style={s.dots}>•••</Text>
            </Pressable>
          </View>

          {menuFor === p.id && (
            <View style={s.menu}>
              <Pressable
                onPress={async () => {
                  await reportPost(p.id);
                  setReported((r) => new Set(r).add(p.id));
                  setMenuFor(null);
                }}
                style={s.menuItem}
              >
                <Text style={s.menuText}>{reported.has(p.id) ? 'Reported' : 'Report this post'}</Text>
              </Pressable>
              {p.uid && p.uid !== uid && (
                <Pressable
                  onPress={async () => { await blockUser(p.uid); setMenuFor(null); await onChanged(); }}
                  style={s.menuItem}
                >
                  <Text style={s.menuText}>Block {p.authorName}</Text>
                </Pressable>
              )}
            </View>
          )}

          {!!p.title && <Text style={s.postTitle}>{p.title}</Text>}
          {!!p.body && <Text style={s.postBody}>{p.body}</Text>}

          <View style={s.postActions}>
            <Pressable
              onPress={async () => { await toggleLike(p.id); await onChanged(); }}
              style={s.action}
              accessibilityRole="button"
              accessibilityLabel={p.liked ? 'Unlike' : 'Like'}
            >
              <View style={s.actionRow}>
                <Heart size={16} color={p.liked ? colors.red : colors.inkSoft} filled={p.liked} />
                <Text style={[s.actionText, p.liked && s.actionOn]}>{p.likes}</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => setOpenComments(openComments === p.id ? null : p.id)}
              style={s.action}
              accessibilityRole="button"
            >
              <View style={s.actionRow}>
                <CommentIcon size={16} />
                <Text style={s.actionText}>{p.comments}</Text>
              </View>
            </Pressable>
          </View>

          {openComments === p.id && <Comments postId={p.id} onChanged={onChanged} uid={uid} />}
        </View>
      ))}
    </View>
  );
};

const Comments: React.FC<{ postId: string; onChanged: () => Promise<void>; uid?: string }> = ({ postId, onChanged, uid }) => {
  const [items, setItems] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchComments(postId).then((r) => alive && setItems(r.ok ? r.data.comments ?? [] : []));
    return () => { alive = false; };
  }, [postId]);

  const send = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    const res = await addComment(postId, draft.trim());
    setBusy(false);
    if (!res.ok) return;
    setDraft('');
    if (uid) {
      const p = await loadProgress(uid);
      await saveProgress(uid, bumpMetric(p, 'comments'));
    }
    const fresh = await fetchComments(postId);
    if (fresh.ok) setItems(fresh.data.comments ?? []);
    await onChanged();
  };

  return (
    <View style={s.comments}>
      {items === null ? (
        <ActivityIndicator color={colors.goldDeep} />
      ) : items.length === 0 ? (
        <Text style={s.meta}>No replies yet.</Text>
      ) : (
        items.map((c) => (
          <View key={c.id} style={s.comment}>
            <Text style={s.commentAuthor}>{c.authorName} <Text style={s.meta}>{relativeTime(c.createdAt)}</Text></Text>
            <Text style={s.commentBody}>{c.body}</Text>
          </View>
        ))
      )}
      <View style={s.replyRow}>
        <TextInput value={draft} onChangeText={setDraft} placeholder="Reply…"
          placeholderTextColor={colors.inkSoft} style={s.replyInput} accessibilityLabel="Reply" />
        <Pressable onPress={send} disabled={!draft.trim() || busy} style={[s.replySend, (!draft.trim() || busy) && { opacity: 0.4 }]}>
          <Send size={18} />
        </Pressable>
      </View>
    </View>
  );
};

// ── Challenges ─────────────────────────────────────────────────────────────
//
// A challenge is not a feed post and must not be built like one. A post is
// text first: avatar, name, body, a row of counters. A challenge is a thing on
// a clock, so the card is built around two things a post does not have, the ART
// and the DEADLINE. The scene runs full bleed to the card's own border with the
// countdown sitting on it, and the body underneath is a goal and a track that
// fills, not paragraphs. Swap this component for the post component and the
// difference is the whole layout, which is the test the design rules set.
//
// Server contract: backend/live-bridge/app/community.py.
// Design: metadata/decisions/2026-08-26_live-challenge-lifecycle.md.

const HOUR = 3_600;
const DAY = 86_400;

/** How long is left, as a learner reads it and as a screen reader says it. */
function remainingLabel(secs: number): { short: string; spoken: string } {
  if (secs <= 0) return { short: 'Closing now', spoken: 'Closing now' };
  if (secs < 60) return { short: `${secs}s left`, spoken: `${secs} seconds left` };
  if (secs < HOUR) {
    const m = Math.floor(secs / 60);
    const rest = secs % 60;
    return {
      short: `${m}m ${String(rest).padStart(2, '0')}s left`,
      spoken: `${m} minutes left`,
    };
  }
  if (secs < DAY) {
    const h = Math.floor(secs / HOUR);
    const m = Math.floor((secs % HOUR) / 60);
    return { short: `${h}h ${m}m left`, spoken: `${h} hours ${m} minutes left` };
  }
  const d = Math.floor(secs / DAY);
  const h = Math.floor((secs % DAY) / HOUR);
  return { short: `${d}d ${h}h left`, spoken: `${d} days ${h} hours left` };
}

const CADENCE_LABEL: Record<string, string> = {
  weekly: 'This week',
  season: 'This season',
  rolling: 'Your own run',
};

/**
 * A clock that only ticks as fast as the screen needs.
 *
 * A second-by-second re-render is right when a round is minutes from closing and
 * wasteful when the next boundary is four days away, and a countdown that only
 * moves every thirty seconds looks frozen in the last minute. So the cadence is
 * re-chosen on EVERY tick from how much is actually left, never once from how
 * much was left when the list arrived: a card opened at sixty-one minutes
 * crosses into its final hour while it is being looked at, and a cadence fixed
 * at mount would spend that whole hour stepping the seconds thirty at a time.
 * It also drops back to the slow cadence once the urgent round has closed.
 *
 * The deadlines are absolute instants on THIS DEVICE's clock, derived from the
 * server's own countdown plus the moment it answered, so a phone whose clock is
 * an hour out still counts down correctly. An empty list means nothing on screen
 * is on a clock, and then nothing ticks at all. The timer is torn down with the
 * tab, so nothing ticks behind the feed.
 */
function useTicker(deadlines: readonly number[]): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadlines.length === 0) return;
    // Seconds only matter for the next deadline still ahead of us.
    const cadence = (at: number) => {
      const next = deadlines.find((d) => d > at);
      return next !== undefined && next - at < HOUR * 1_000 ? 1_000 : 30_000;
    };
    let id = setTimeout(function tick() {
      const at = Date.now();
      setNow(at);
      id = setTimeout(tick, cadence(at));
    }, cadence(Date.now()));
    return () => clearTimeout(id);
  }, [deadlines]);
  return now;
}

interface ChallengesProps {
  items: Challenge[];
  fail: FailReason | null;
  fetchedAt: number;
  unclaimed: ChallengeAward[];
  unclaimedCount: number;
  mineFailed: boolean;
  onChanged: () => Promise<void>;
  onOpenResults: (c: Challenge) => void;
  onOpenClaim: () => void;
  uid?: string;
}

const Challenges: React.FC<ChallengesProps> = ({
  items, fail, fetchedAt, unclaimed, unclaimedCount, mineFailed, onChanged, onOpenResults, onOpenClaim, uid,
}) => {
  // The deadlines advance from the server's own count, not from the phone's
  // clock: the boundary is anchored to UTC and the learner should never have to
  // know that, so a device an hour out still sees the right countdown. Each one
  // is anchored to the instant the list was answered, which makes the whole
  // thing a difference between two readings of the same clock, and therefore
  // immune to that clock being wrong.
  const deadlines = useMemo(
    () => items
      .map((c) => (c.endsInSeconds === null ? null : fetchedAt + c.endsInSeconds * 1_000))
      .filter((d): d is number => d !== null)
      .sort((a, b) => a - b),
    [items, fetchedAt],
  );
  const now = useTicker(deadlines);
  const elapsed = Math.max(0, Math.floor((now - fetchedAt) / 1000));

  if (fail) {
    const copy = FAILURE_COPY[fail] ?? FAILURE_COPY.offline;
    return (
      <View style={s.emptyBlock}>
        <Text style={s.emptyTitle}>{copy.title}</Text>
        <Text style={s.emptyBody}>{copy.body}</Text>
        <Button label="Try again" onPress={() => void onChanged()} style={{ marginTop: space.lg }} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={s.emptyBlock}>
        <Text style={s.emptyTitle}>No live challenges</Text>
        <Text style={s.emptyBody}>New ones open every Monday. Check back then.</Text>
      </View>
    );
  }

  return (
    <View>
      {(unclaimed.length > 0 || unclaimedCount > 0) && (
        <ResultsWaiting
          awards={unclaimed}
          count={unclaimed.length || unclaimedCount}
          stale={mineFailed}
          onOpen={onOpenClaim}
          onRetry={onChanged}
        />
      )}
      {items.map((c, i) => (
        <ChallengeCard
          key={c.id}
          challenge={c}
          elapsed={elapsed}
          index={i}
          onChanged={onChanged}
          onOpenResults={() => onOpenResults(c)}
          uid={uid}
        />
      ))}
    </View>
  );
};

/**
 * The banner for finished rounds nobody has collected yet.
 *
 * Deliberately the darkest surface in the tab. A result is a different KIND of
 * thing from a challenge that is still running, so it does not get a white card
 * with a border like everything else; it gets an ink panel that stops the eye
 * before it reaches the list. It stays in front of the learner until they claim.
 */
const ResultsWaiting: React.FC<{
  awards: ChallengeAward[];
  count: number;
  stale: boolean;
  onOpen: () => void;
  onRetry: () => Promise<void>;
}> = ({ awards, count, stale, onOpen, onRetry }) => {
  const reduced = useReducedMotion();
  const xp = awards.reduce((sum, a) => sum + (a.xp ?? 0), 0);
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(320)}
      style={s.claimBanner}
    >
      <View style={s.claimBadge}><TrophyGlyph size={20} color={colors.gold} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.claimBannerTitle}>
          {count === 1 ? 'A round finished' : `${count} rounds finished`}
        </Text>
        <Text style={s.claimBannerBody}>
          {stale
            ? 'Your result is ready. It could not be loaded just now.'
            : xp > 0
              ? `${xp} XP is waiting for you.`
              : 'Your final placing is ready.'}
        </Text>
      </View>
      <Pressable
        onPress={stale ? () => void onRetry() : onOpen}
        style={({ pressed }) => [s.claimCta, pressed && s.claimCtaPressed]}
        accessibilityRole="button"
        accessibilityLabel={stale ? 'Try loading your result again' : 'See your result'}
      >
        <Text style={s.claimCtaText}>{stale ? 'Retry' : 'See it'}</Text>
      </Pressable>
    </Animated.View>
  );
};

const ChallengeCard: React.FC<{
  challenge: Challenge;
  elapsed: number;
  index: number;
  onChanged: () => Promise<void>;
  onOpenResults: () => void;
  uid?: string;
}> = ({ challenge: c, elapsed, index, onChanged, onOpenResults, uid }) => {
  const reduced = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const palette = themeFor(c.theme);

  const closed = c.instance.status === 'closed';
  const remaining = c.endsInSeconds === null ? null : Math.max(0, c.endsInSeconds - elapsed);
  const clock = remaining === null ? null : remainingLabel(remaining);
  const waiting = c.joined && c.enrolledFor === 'next';

  const join = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await joinChallenge(c.id);
    setBusy(false);
    if (!res.ok) {
      setError(
        res.reason === 'forbidden'
          ? 'Challenges are not available for this account.'
          : 'That did not go through. Try again in a moment.',
      );
      return;
    }
    // Credit the achievement only on a FIRST-EVER join of this series. The server
    // answers that durably, because leaving deletes the enrolment and a re-join
    // would otherwise look brand new: join, leave, join earned the badge twice.
    if (uid && res.data?.firstJoin) {
      const p = await loadProgress(uid);
      await saveProgress(uid, bumpMetric(p, 'challenges'));
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await onChanged();
  };

  const leave = () => {
    Alert.alert(
      'Leave this challenge?',
      `You will drop out of ${c.title} and this round's progress resets. You can rejoin any time, and anything you have already finished stays yours.`,
      [
        { text: 'Stay in', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            if (busy) return;
            setBusy(true);
            setError(null);
            const res = await leaveChallenge(c.id);
            setBusy(false);
            if (!res.ok) {
              setError('That did not go through. Try again in a moment.');
              return;
            }
            await onChanged();
          },
        },
      ],
    );
  };

  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(stagger(index)).duration(320)}
      style={s.challenge}
    >
      <View style={s.art}>
        <ChallengeArt art={c.art} id={c.id} theme={c.theme} height={116} />
        <View style={s.artRow} pointerEvents="none">
          <View style={s.cadenceChip}>
            <Text style={s.cadenceText}>{CADENCE_LABEL[c.cadence ?? 'weekly'] ?? 'This week'}</Text>
          </View>
          <View
            style={s.clockChip}
            accessible
            accessibilityLabel={
              closed ? 'This round has finished'
                : clock ? clock.spoken
                  : `Runs for ${c.durationDays ?? 0} days once you start`
            }
          >
            <ClockGlyph size={12} color={colors.white} />
            <Text style={s.clockText}>
              {closed ? 'Finished' : clock ? clock.short : `${c.durationDays ?? 0} days once you start`}
            </Text>
          </View>
        </View>
        {c.completed && (
          <View style={s.clearedFlag}>
            <CheckGlyph size={12} color={colors.goldText} />
            <Text style={s.clearedText}>GOAL CLEARED</Text>
          </View>
        )}
      </View>

      <View style={s.challengeBody}>
        <Text style={s.challengeTitle}>{c.title}</Text>
        {!!c.tagline && <Text style={[s.challengeTagline, { color: palette.ink }]}>{c.tagline}</Text>}
        <Text style={s.challengeDesc}>{c.desc}</Text>

        {c.joined ? (
          <GoalTrack
            progress={c.progress}
            target={c.target}
            goal={c.goal}
            completed={c.completed}
            waiting={waiting}
            palette={palette}
          />
        ) : (
          <View style={s.metaRail}>
            <MetaCell icon={<TargetGlyph size={13} color={palette.ink} />} label="Goal" value={c.goal ?? `${c.target}`} tint={palette.tint} ink={palette.ink} />
            <MetaCell icon={<RewardGlyph size={13} color={palette.ink} />} label="Reward" value={c.reward} tint={palette.tint} ink={palette.ink} />
          </View>
        )}

        <View style={s.challengeFoot}>
          <View style={s.people}>
            <UsersGlyph size={13} color={colors.inkSoft} />
            <Text style={s.peopleText}>
              {c.participantCount === 1 ? '1 builder in' : `${c.participantCount.toLocaleString()} builders in`}
            </Text>
          </View>
          {c.ranked && (
            <Pressable
              onPress={onOpenResults}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`See the last finished round of ${c.title}`}
              style={({ pressed }) => [s.lastRound, pressed && { opacity: 0.6 }]}
            >
              <Text style={s.lastRoundText}>Last round</Text>
            </Pressable>
          )}
        </View>

        {!!error && <Text style={s.error}>{error}</Text>}

        {c.joined ? (
          <View style={s.joinedRow}>
            <View style={s.joinedPill}>
              <CheckGlyph size={12} color={colors.goldText} />
              <Text style={s.joinedText}>{waiting ? 'IN FROM NEXT ROUND' : "YOU'RE IN"}</Text>
            </View>
            <Pressable
              onPress={leave}
              disabled={busy}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Leave ${c.title}`}
              style={({ pressed }) => [s.leave, (pressed || busy) && { opacity: 0.5 }]}
            >
              <Text style={s.leaveText}>Leave</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Button
              label={busy ? 'Joining…' : c.joinableNow ? 'Join challenge' : 'Join the next round'}
              onPress={join}
              disabled={busy}
              style={{ marginTop: space.md }}
            />
            {!c.joinableNow && (
              <Text style={s.note}>
                This round needs {c.goal ?? `${c.target}`} and there is not enough time left for that, so you will
                start with the next one.
              </Text>
            )}
          </>
        )}
      </View>
    </Animated.View>
  );
};

const MetaCell: React.FC<{
  icon: React.ReactNode; label: string; value: string; tint: string; ink: string;
}> = ({ icon, label, value, tint, ink }) => (
  <View style={[s.metaCell, { backgroundColor: tint }]}>
    {icon}
    <View style={{ flex: 1 }}>
      <Text style={s.metaLabel}>{label.toUpperCase()}</Text>
      <Text style={[s.metaValue, { color: ink }]} numberOfLines={1}>{value}</Text>
    </View>
  </View>
);

/**
 * Progress against the goal.
 *
 * Segmented while the target is small enough to count at a glance, because a
 * streak is seven DAYS and drawing it as a smooth bar throws away the one thing
 * the learner is counting. Past ten it becomes a continuous fill, since thirty
 * two-pixel slivers is a texture, not a count.
 */
const GoalTrack: React.FC<{
  progress: number;
  target: number;
  goal?: string;
  completed: boolean;
  waiting: boolean;
  palette: ChallengePalette;
}> = ({ progress, target, goal, completed, waiting, palette }) => {
  const reduced = useReducedMotion();
  const safeTarget = Math.max(1, target);
  const done = Math.min(progress, safeTarget);
  const pct = Math.round((done / safeTarget) * 100);
  const width = useSharedValue(reduced ? pct : 0);

  useEffect(() => {
    if (reduced) {
      width.value = pct;
      return;
    }
    // Timing, not a spring: a bar is showing accumulation, and it should take
    // the same time to fill every time it is looked at.
    width.value = withTiming(pct, { duration: duration.fill, easing: Easing.out(Easing.cubic) });
  }, [pct, reduced, width]);

  const fill = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View
      style={s.track}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={goal ? `Progress toward ${goal}` : 'Progress toward the goal'}
      accessibilityValue={{ min: 0, max: safeTarget, now: done, text: `${done} of ${safeTarget}` }}
    >
      <View style={s.trackHead}>
        <Text style={s.trackCount}>
          <Text style={[s.trackCountNow, { color: palette.ink }]}>{done}</Text>
          <Text style={s.trackCountOf}> / {safeTarget}</Text>
          {!!goal && <Text style={s.trackGoal}>  {goal}</Text>}
        </Text>
        {completed && <Text style={[s.trackDone, { color: palette.ink }]}>CLEARED</Text>}
      </View>

      {safeTarget <= 10 ? (
        <View style={s.segments}>
          {Array.from({ length: safeTarget }, (_, i) => (
            <Animated.View
              key={i}
              entering={reduced || i >= done ? undefined : FadeIn.delay(stagger(i, 60)).duration(240)}
              style={[
                s.segment,
                i < done
                  ? { backgroundColor: palette.c1, borderColor: colors.ink }
                  : { backgroundColor: colors.inkFaint, borderColor: colors.line },
              ]}
            />
          ))}
        </View>
      ) : (
        <View style={s.bar}>
          <Animated.View style={[s.barFill, { backgroundColor: palette.c1 }, fill]} />
        </View>
      )}

      {waiting && (
        <Text style={s.note}>
          You are in the series, sitting this round out. There was not enough time left in it to reach the goal, so
          your run starts with the next one.
        </Text>
      )}
    </View>
  );
};

// ── League ─────────────────────────────────────────────────────────────────
const League: React.FC<{ board: Leaderboard | null }> = ({ board }) => {
  if (!board) {
    return <View style={s.emptyBlock}><Text style={s.emptyTitle}>League unavailable</Text>
      <Text style={s.emptyBody}>Pull down to try again.</Text></View>;
  }
  if (board.leaders.length === 0) {
    return <View style={s.emptyBlock}><Text style={s.emptyTitle}>Nobody on the board yet</Text>
      <Text style={s.emptyBody}>Earn XP this week and you'll be first.</Text></View>;
  }
  return (
    <View style={s.post}>
      <Text style={s.postTitle}>This week</Text>
      {board.leaders.map((row) => (
        <View key={`${row.rank}-${row.name}`} style={[s.leaderRow, row.isMe && s.leaderMe]}>
          <Text style={s.leaderRank}>{row.rank}</Text>
          <Text style={[s.leaderName, row.isMe && s.leaderNameMe]} numberOfLines={1}>{row.name}</Text>
          <Text style={s.leaderXp}>{row.xp} XP</Text>
        </View>
      ))}
      {board.me.rank === null && (
        <Text style={s.meta}>You have {board.me.xp} XP this week. Keep going to reach the board.</Text>
      )}
    </View>
  );
};

// ── Finished rounds ────────────────────────────────────────────────────────
//
// A closed instance is a different kind of object from an open one: its
// standings were computed once and frozen, so two learners opening this a month
// apart see the same podium. It gets its own surface rather than a variant of
// the card, which is what the design decision asked for.

const ResultsSheet: React.FC<{ challenge: Challenge; onClose: () => void }> = ({ challenge: c, onClose }) => {
  const [results, setResults] = useState<ChallengeResults | null>(null);
  // The order in the round running RIGHT NOW, fetched only when there is no
  // finished round to show. A series in its first week would otherwise open on
  // a sentence and a Close button, which is a dead end in the one place a
  // learner came looking for a scoreboard: the race IS happening, it just has
  // not finished, and the live order is the honest answer to the question they
  // asked. Live standings are never mixed with frozen ones, because only frozen
  // standings are final.
  const [live, setLive] = useState<StandingRow[] | null>(null);
  // Whether the live lookup has been attempted, as distinct from whether it
  // returned anything. Without it a standings call that fails leaves the sheet
  // spinning forever, because "no rows" and "not asked yet" look identical.
  const [liveTried, setLiveTried] = useState(false);
  const [fail, setFail] = useState<FailReason | null>(null);
  const palette = themeFor(c.theme);

  useEffect(() => {
    let alive = true;
    setResults(null);
    setLive(null);
    setLiveTried(false);
    setFail(null);
    void fetchChallengeResults(c.id).then((r) => {
      if (!alive) return;
      if (r.ok) { setResults(r.data); setFail(null); return; }
      setResults(null);
      setFail(r.reason);
      if (r.reason !== 'not_found') { setLiveTried(true); return; }
      void fetchChallengeStandings(c.id).then((s) => {
        if (!alive) return;
        if (s.ok && s.data.ranked) setLive(s.data.standings);
        setLiveTried(true);
      });
    });
    return () => { alive = false; };
  }, [c.id]);

  /**
   * What the sheet is showing, decided once.
   *
   * Overlapping conditions are how a sheet ends up rendering a spinner and an
   * empty state at the same time: `not_found` arrives before the live standings
   * do, and for that gap both "still loading" and "nothing here" are true of
   * different requests. One value, one branch each.
   */
  const view: 'loading' | 'results' | 'live' | 'liveEmpty' | 'fail' =
    results ? 'results'
      : !fail ? 'loading'
        : fail !== 'not_found' ? 'fail'
          : !liveTried ? 'loading'
            : live && live.length > 0 ? 'live'
              : live ? 'liveEmpty'
                : 'fail';

  const podium = results ? results.standings.slice(0, 3) : [];
  // Everything below the podium. Fewer than three finishers means there is no
  // podium to draw, so the whole thing is listed as rows instead.
  const listed = results ? (podium.length === 3 ? results.standings.slice(3) : results.standings) : [];
  // Their own row, pinned at the bottom, ONLY when it is not already on screen.
  // The server derives `me` by finding the caller inside the frozen standings,
  // so today it is always one of the rows above and this pins nothing; the guard
  // is what makes that true. Without it every placing from fourth down printed
  // twice, once in the list and once again underneath it.
  const me = results?.me ?? null;
  const meOutside =
    me && !podium.some((r) => r.rank === me.rank) && !listed.some((r) => r.rank === me.rank) ? me : null;

  return (
    <View style={s.sheetBackdrop}>
      <View style={s.resultSheet}>
        <View style={s.resultHead}>
          <ChallengeArt art={c.art} id={c.id} theme={c.theme} height={92} />
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => [s.sheetX, pressed && { opacity: 0.6 }]}
          >
            <Close size={16} color={colors.ink} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={s.resultBody} showsVerticalScrollIndicator={false}>
          <Text style={s.resultEyebrow}>
            {view === 'live' || view === 'liveEmpty' ? 'HOW IT STANDS RIGHT NOW' : 'LAST FINISHED ROUND'}
          </Text>
          <Text style={s.resultTitle}>{c.title}</Text>

          {view === 'loading' && (
            <View style={s.resultCentre}><ActivityIndicator color={colors.goldDeep} /></View>
          )}

          {view === 'fail' && !!fail && (
            <View style={s.resultCentre}>
              <Text style={s.emptyTitle}>
                {fail === 'not_found' ? 'No finished round yet' : (FAILURE_COPY[fail] ?? FAILURE_COPY.offline).title}
              </Text>
              <Text style={s.emptyBody}>
                {fail === 'not_found'
                  ? 'This one is still running. When it closes, the standings freeze and your placing appears here.'
                  : (FAILURE_COPY[fail] ?? FAILURE_COPY.offline).body}
              </Text>
            </View>
          )}

          {view === 'liveEmpty' && (
            <View style={s.resultCentre}>
              <Text style={s.emptyTitle}>Nobody has scored yet</Text>
              <Text style={s.emptyBody}>
                This round is open and the board is empty. Make any progress at all and you are top of it.
              </Text>
            </View>
          )}

          {/* The round on the clock, ordered as it stands. Nothing here is
              final, and the copy says so rather than letting a mid-week lead
              read as a win. */}
          {view === 'live' && !!live && (
            <>
              <Text style={s.resultSummary}>
                This round has not closed. Nothing below is final until it does, and then the standings freeze
                and your placing is yours.
              </Text>
              {live.map((row) => (
                <View key={row.rank} style={[s.resultRow, row.isMe && s.resultRowMe]}>
                  <Text style={s.resultRank}>{row.rank}</Text>
                  <Text style={[s.resultName, row.isMe && s.resultNameMe]} numberOfLines={1}>{row.name}</Text>
                  <Text style={s.resultProgress}>
                    {row.progress}
                    <Text style={s.resultOf}> / {row.target}</Text>
                  </Text>
                </View>
              ))}
              {!live.some((row) => row.isMe) && (
                <Text style={s.note}>
                  You are not in this round. Join and every day from now counts toward it.
                </Text>
              )}
            </>
          )}

          {!!results && (
            <>
              <Text style={s.resultSummary}>
                {results.winner
                  ? `${results.winner.name} got there first.`
                  : 'Nobody cleared the goal this round.'}
                {' '}
                {results.completedCount} of {results.participantCount}{' '}
                {results.participantCount === 1 ? 'builder' : 'builders'} made the target of {results.target}.
              </Text>

              {podium.length === 3 && (
                <View style={s.podium}>
                  {[podium[1], podium[0], podium[2]].map((row, i) => (
                    <PodiumStep key={row.rank} row={row} tall={i === 1} palette={palette} />
                  ))}
                </View>
              )}

              {listed.map((row) => (
                <View key={row.rank} style={[s.resultRow, row.isMe && s.resultRowMe]}>
                  <Text style={s.resultRank}>{row.rank}</Text>
                  <Text style={[s.resultName, row.isMe && s.resultNameMe]} numberOfLines={1}>{row.name}</Text>
                  <Text style={s.resultProgress}>
                    {row.progress}
                    <Text style={s.resultOf}> / {results.target}</Text>
                  </Text>
                </View>
              ))}

              {results.standings.length === 0 && (
                <Text style={s.emptyBody}>Nobody entered this round.</Text>
              )}

              {/* Their own row is stamped onto their entry at close, so it
                  survives independently of the top-100 cut. Pinning it means a
                  learner who placed 214th still sees where they came. */}
              {!!meOutside && (
                <View style={[s.resultRow, s.resultRowMe, { marginTop: space.sm }]}>
                  <Text style={s.resultRank}>{meOutside.rank}</Text>
                  <Text style={[s.resultName, s.resultNameMe]} numberOfLines={1}>{meOutside.name}</Text>
                  <Text style={s.resultProgress}>
                    {meOutside.progress}
                    <Text style={s.resultOf}> / {results.target}</Text>
                  </Text>
                </View>
              )}

              {!results.me && (
                <Text style={s.note}>You were not in this round. Join now and you are in the next one from its first minute.</Text>
              )}
            </>
          )}
        </ScrollView>

        <View style={s.sheetFoot}>
          <Button label="Close" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </View>
  );
};

const PodiumStep: React.FC<{
  row: { rank: number; name: string; progress: number; completed: boolean; isMe: boolean };
  tall: boolean;
  palette: ChallengePalette;
}> = ({ row, tall, palette }) => (
  <View style={s.podiumCol}>
    <Text style={[s.podiumName, row.isMe && s.podiumNameMe]} numberOfLines={1}>{row.name}</Text>
    <Text style={s.podiumScore}>{row.progress}</Text>
    <View
      style={[
        s.podiumStep,
        { height: tall ? 74 : 54, backgroundColor: tall ? palette.c1 : palette.tint },
        row.isMe && s.podiumStepMe,
      ]}
    >
      <Text style={[s.podiumRank, { color: tall ? colors.ink : palette.ink }]}>{row.rank}</Text>
    </View>
  </View>
);

// ── Claiming a result ──────────────────────────────────────────────────────
//
// The server decides IF and HOW MUCH; the client records the XP into the
// progress envelope and reports it to the weekly league. Claiming is idempotent
// server side (keyed by instance id inside a transaction on the learner's
// record), so a second device asking pays nothing and this sheet says so rather
// than pretending.

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const ClaimSheet: React.FC<{
  awards: ChallengeAward[];
  challenges: Challenge[];
  uid?: string;
  onClose: () => void;
  onClaimed: () => Promise<void>;
}> = ({ awards, challenges, uid, onClose, onClaimed }) => {
  const [phase, setPhase] = useState<'review' | 'busy' | 'granted'>('review');
  const [granted, setGranted] = useState<ChallengeAward[]>([]);
  const [earned, setEarned] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const celebrated = useRef(false);

  const badgeFor = (challengeId: string): string | null => {
    const c = challenges.find((x) => x.id === challengeId);
    return c?.rewardBadge ? c.reward : null;
  };

  const claim = async () => {
    if (phase === 'busy') return;
    setPhase('busy');
    setError(null);
    const res = await claimChallenges();
    if (!res.ok) {
      setPhase('review');
      setError(
        res.reason === 'forbidden'
          ? 'Challenge rewards are not available for this account.'
          : 'That did not go through. Your result is safe, so try again in a moment.',
      );
      return;
    }
    const xp = res.data.xp ?? 0;
    setGranted(res.data.granted ?? []);
    setEarned(xp);
    if (uid && xp > 0) {
      const p = await loadProgress(uid);
      await saveProgress(uid, { ...p, xp: p.xp + xp });
      // The weekly league is a separate tally, and it is best effort: a learner
      // who is offline for this call keeps the XP that matters.
      void reportXp(xp);
    }
    setPhase('granted');
  };

  useEffect(() => {
    if (phase !== 'granted' || celebrated.current) return;
    celebrated.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const t = setTimeout(() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }, 120);
    return () => clearTimeout(t);
  }, [phase]);

  const shown = phase === 'granted' ? granted : awards;
  const total = awards.reduce((sum, a) => sum + (a.xp ?? 0), 0);

  return (
    <View style={s.sheetBackdrop}>
      <View style={s.claimSheet}>
        <Text style={s.claimEyebrow}>{phase === 'granted' ? 'COLLECTED' : 'YOUR RESULT'}</Text>

        {phase === 'granted' && earned > 0 && <XpLanding value={earned} />}

        {phase === 'granted' && granted.length === 0 && (
          <Text style={s.claimNothing}>
            This one had already been collected, on another device or in another window. Nothing was paid twice.
          </Text>
        )}

        {shown.map((a, i) => (
          <AwardRow key={a.instanceId ?? `${a.challengeId}-${i}`} award={a} badge={badgeFor(a.challengeId)} index={i} />
        ))}

        {!!error && <Text style={s.error}>{error}</Text>}

        {phase === 'granted' ? (
          <Button
            label="Nice"
            onPress={() => { void onClaimed(); onClose(); }}
            style={{ marginTop: space.md }}
          />
        ) : (
          <>
            <Button
              label={phase === 'busy' ? 'Collecting…' : total > 0 ? `Claim ${total} XP` : 'Claim result'}
              onPress={claim}
              disabled={phase === 'busy'}
              style={{ marginTop: space.md }}
            />
            <Pressable onPress={onClose} style={s.sheetClose} accessibilityRole="button">
              <Text style={s.sheetCloseText}>Later</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
};

/**
 * The XP landing.
 *
 * An animated TextInput, not a Text: Reanimated has no animated Text with
 * animated CONTENT, and driving a number through the JS thread costs a full
 * render per frame. `defaultValue` rides alongside `text` because the shadow
 * node measures its intrinsic width from what React committed, so a growing
 * number is otherwise clipped.
 */
const XpLanding: React.FC<{ value: number }> = ({ value }) => {
  const reduced = useReducedMotion();
  const n = useSharedValue(reduced ? value : 0);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (reduced) { n.value = value; return; }
    n.value = withTiming(value, { duration: duration.count, easing: Easing.out(Easing.cubic) });
    pop.value = withDelay(
      duration.count - 120,
      withSequence(withSpring(1.1, motion.reward), withSpring(1, motion.release)),
    );
  }, [value, reduced, n, pop]);

  const text = useDerivedValue(() => `${Math.round(n.value)}`);
  const counter = useAnimatedProps(() => ({ text: text.value, defaultValue: text.value }) as never);
  const popped = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Animated.View style={[s.claimXpRow, popped]} accessible accessibilityLabel={`${value} XP earned`}>
      <Text style={s.claimPlus}>+</Text>
      <AnimatedTextInput animatedProps={counter} editable={false} caretHidden style={s.claimXp} maxFontSizeMultiplier={1.15} />
      <Text style={s.claimXpUnit}>XP</Text>
    </Animated.View>
  );
};

const AwardRow: React.FC<{ award: ChallengeAward; badge: string | null; index: number }> = ({ award: a, badge, index }) => {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(stagger(index + 1)).duration(300)}
      style={s.awardRow}
    >
      <View style={[s.awardRank, a.completed && s.awardRankDone]}>
        {a.rank === null
          ? <CheckGlyph size={13} color={a.completed ? colors.goldText : colors.inkSoft} />
          : <Text style={[s.awardRankText, a.completed && { color: colors.goldText }]}>{a.rank}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.awardTitle}>{a.title}</Text>
        <Text style={s.awardMeta}>
          {a.completed ? 'Goal cleared' : 'Goal missed'} · {a.progress} of {a.target}
          {a.rank !== null ? ` · finished ${ordinal(a.rank)}` : ''}
        </Text>
        {a.podiumBonus > 0 && <Text style={s.awardBonus}>Podium bonus +{a.podiumBonus} XP</Text>}
        {!!badge && a.completed && <Text style={s.awardBonus}>{badge}</Text>}
      </View>
      {a.xp > 0 && <Text style={s.awardXp}>+{a.xp}</Text>}
    </Animated.View>
  );
};

/** 1st, 2nd, 3rd, 4th. Used only for a rank, so it never sees a negative. */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const rem10 = n % 10;
  return `${n}${rem10 === 1 ? 'st' : rem10 === 2 ? 'nd' : rem10 === 3 ? 'rd' : 'th'}`;
}

// ── Composer ───────────────────────────────────────────────────────────────
const Composer: React.FC<{ onClose: () => void; onPosted: () => Promise<void>; uid?: string }> = ({ onClose, onPosted, uid }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true); setError(null);
    const res = await createPost('build', title.trim(), body.trim());
    setBusy(false);
    if (!res.ok) {
      setError(res.reason === 'forbidden'
        ? 'Posting is not available for this account.'
        : 'That did not post. Check your connection and try again.');
      return;
    }
    if (uid) {
      const p = await loadProgress(uid);
      await saveProgress(uid, bumpMetric(p, 'posts'));
    }
    await onPosted();
    onClose();
  };

  return (
    <View style={s.sheetBackdrop}>
      <View style={s.sheet}>
        <Text style={s.sheetTitle}>Share a build</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="What did you build?"
          placeholderTextColor={colors.inkSoft} style={s.input} accessibilityLabel="Title" />
        <TextInput value={body} onChangeText={setBody} placeholder="How did it go?" multiline
          placeholderTextColor={colors.inkSoft} style={[s.input, { height: 96, textAlignVertical: 'top' }]}
          accessibilityLabel="Body" />
        {!!error && <Text style={s.error}>{error}</Text>}
        <Button label={busy ? 'Posting…' : 'Post'} onPress={submit} disabled={busy || !title.trim()} style={{ marginTop: space.sm }} />
        <Pressable onPress={onClose} style={s.sheetClose}><Text style={s.sheetCloseText}>Cancel</Text></Pressable>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream, padding: space.xl },
  scroll: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl },
  backLink: { paddingVertical: space.sm, alignSelf: 'flex-start' },
  backText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
  eyebrow: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.inkSoft, marginTop: space.md },
  title: { fontFamily: font.black, fontSize: type.display, color: colors.ink, letterSpacing: -0.8, marginTop: 4, marginBottom: space.md },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: space.md },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 999, ...curve, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center' },
  tabActive: { borderColor: colors.ink, backgroundColor: colors.gold },
  tabText: { fontFamily: font.black, fontSize: type.small, color: colors.inkSoft },
  tabTextActive: { color: colors.ink },
  // Sits on the pill's shoulder rather than in the row: three pills share the
  // width evenly and "Challenges" already fills its own, so an inline count
  // would squeeze the label on a small phone. The cream ring keeps it legible
  // over the white pill and the gold active one alike.
  tabBadge: {
    position: 'absolute', top: -7, right: 6, minWidth: 20, height: 20, borderRadius: 10, ...curve,
    paddingHorizontal: 4, backgroundColor: colors.red, borderWidth: 2, borderColor: colors.cream,
    alignItems: 'center', justifyContent: 'center',
  },
  tabBadgeText: { fontFamily: font.black, fontSize: 10, color: colors.white, ...tabular },
  post: {
    backgroundColor: colors.white, borderWidth: 2.5, borderColor: colors.ink,
    borderRadius: radius.lg, ...curve, padding: space.md, marginBottom: space.md, ...elevation.card,
  },
  postTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  avatar: {
    width: 36, height: 36, borderRadius: 18, ...curve, backgroundColor: colors.goldSoft,
    borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: font.black, fontSize: type.small, color: colors.ink },
  author: { fontFamily: font.black, fontSize: type.small, color: colors.ink },
  meta: { fontFamily: font.semibold, fontSize: type.meta, color: colors.inkSoft, marginTop: 1 },
  dots: { fontFamily: font.black, fontSize: type.small, color: colors.inkSoft },
  menu: { marginTop: space.sm, borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, ...curve, overflow: 'hidden' },
  menuItem: { paddingVertical: 10, paddingHorizontal: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  menuText: { fontFamily: font.bold, fontSize: type.small, color: colors.ink },
  postTitle: { fontFamily: font.black, fontSize: type.body, color: colors.ink, marginTop: space.sm },
  postBody: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 4, lineHeight: 20 },
  postActions: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  action: { paddingVertical: 4 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
  actionOn: { color: colors.red },
  comments: { marginTop: space.md, borderTopWidth: 2, borderTopColor: colors.line, paddingTop: space.sm },
  comment: { marginBottom: space.sm },
  commentAuthor: { fontFamily: font.black, fontSize: type.meta, color: colors.ink },
  commentBody: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 2 },
  replyRow: { flexDirection: 'row', gap: 8, marginTop: space.sm },
  replyInput: {
    flex: 1, borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, ...curve,
    paddingHorizontal: 12, paddingVertical: 8, fontFamily: font.semibold, fontSize: type.small, color: colors.ink,
  },
  replySend: {
    width: 38, height: 38, borderRadius: radius.sm, ...curve, backgroundColor: colors.gold,
    borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center',
  },
  replySendText: { fontFamily: font.black, fontSize: type.body, color: colors.ink },
  // ── Challenge card ──
  // Deliberately NOT s.post. The art runs to the border, so the card clips its
  // children and carries no padding of its own; the padding lives on the body.
  challenge: {
    backgroundColor: colors.white, borderWidth: 2.5, borderColor: colors.ink,
    borderRadius: radius.lg, ...curve, overflow: 'hidden', marginBottom: space.lg,
    ...elevation.lifted,
  },
  art: { borderBottomWidth: 2.5, borderBottomColor: colors.ink },
  artRow: {
    position: 'absolute', left: space.sm, right: space.sm, bottom: space.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm,
  },
  cadenceChip: {
    backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 2, borderColor: colors.ink,
    borderRadius: 999, ...curve, paddingHorizontal: 9, paddingVertical: 3,
  },
  cadenceText: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: tracking.meta,
    color: colors.ink, textTransform: 'uppercase',
  },
  clockChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.ink, borderRadius: 999, ...curve,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  clockText: { fontFamily: font.black, fontSize: type.meta, color: colors.white, ...tabular },
  clearedFlag: {
    position: 'absolute', top: space.sm, right: space.sm, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.ink, borderRadius: 999, ...curve,
    paddingHorizontal: 8, paddingVertical: 3, ...innerLight,
  },
  clearedText: { fontFamily: font.black, fontSize: type.meta, letterSpacing: tracking.meta, color: colors.goldText },
  challengeBody: { padding: space.md },
  challengeTitle: {
    fontFamily: font.black, fontSize: type.title, lineHeight: leading.title,
    letterSpacing: tracking.title, color: colors.ink,
  },
  challengeTagline: { fontFamily: font.extrabold, fontSize: type.small, marginTop: 1 },
  challengeDesc: {
    fontFamily: font.semibold, fontSize: type.small, lineHeight: leading.small,
    color: colors.inkSoft, marginTop: 6,
  },
  metaRail: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  metaCell: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, ...curve,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  metaLabel: { fontFamily: font.black, fontSize: 9, letterSpacing: tracking.meta, color: colors.inkMute },
  metaValue: { fontFamily: font.extrabold, fontSize: type.small },
  track: { marginTop: space.md },
  trackHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 },
  trackCount: { fontFamily: font.bold, fontSize: type.small },
  trackCountNow: { fontFamily: font.black, fontSize: type.heading, ...tabular },
  trackCountOf: { fontFamily: font.bold, fontSize: type.small, color: colors.inkMute, ...tabular },
  trackGoal: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft },
  trackDone: { fontFamily: font.black, fontSize: type.meta, letterSpacing: tracking.meta },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 12, borderRadius: 5, ...curve, borderWidth: 2 },
  bar: {
    height: 12, borderRadius: 6, ...curve, backgroundColor: colors.inkFaint,
    borderWidth: 2, borderColor: colors.line, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4, ...curve },
  note: { fontFamily: font.semibold, fontSize: type.meta, lineHeight: leading.meta + 3, color: colors.inkSoft, marginTop: space.sm },
  challengeFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: space.md, paddingTop: space.sm, borderTopWidth: 2, borderTopColor: colors.line,
  },
  people: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  peopleText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft, ...tabular },
  lastRound: { paddingVertical: 2, paddingHorizontal: 2 },
  lastRoundText: { fontFamily: font.black, fontSize: type.small, color: colors.goldText },
  joinedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md },
  joinedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.goldSoft, borderWidth: 2, borderColor: colors.gold,
    borderRadius: 999, ...curve, paddingHorizontal: 10, paddingVertical: 5,
  },
  joinedText: { fontFamily: font.black, fontSize: type.meta, letterSpacing: tracking.meta, color: colors.goldText },
  leave: { paddingVertical: 6, paddingHorizontal: 4 },
  leaveText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkMute },

  // ── The results banner ──
  claimBanner: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.ink, borderRadius: radius.lg, ...curve,
    padding: space.md, marginBottom: space.lg, ...elevation.lifted,
  },
  claimBadge: {
    width: 40, height: 40, borderRadius: 20, ...curve,
    backgroundColor: 'rgba(250,204,46,0.16)', alignItems: 'center', justifyContent: 'center',
  },
  claimBannerTitle: { fontFamily: font.black, fontSize: type.body, color: colors.white },
  claimBannerBody: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkMute, marginTop: 1 },
  claimCta: {
    backgroundColor: colors.gold, borderRadius: radius.sm, ...curve,
    paddingHorizontal: 14, paddingVertical: 9, ...innerLight,
  },
  claimCtaPressed: { backgroundColor: colors.goldDeep },
  claimCtaText: { fontFamily: font.black, fontSize: type.small, color: colors.goldText },

  // ── Results sheet ──
  resultSheet: {
    backgroundColor: colors.white, borderWidth: 2.5, borderColor: colors.ink,
    borderRadius: radius.lg, ...curve, width: '100%', maxHeight: '86%', overflow: 'hidden',
    ...elevation.overlay,
  },
  resultHead: { borderBottomWidth: 2.5, borderBottomColor: colors.ink },
  sheetX: {
    position: 'absolute', top: space.sm, right: space.sm,
    width: 30, height: 30, borderRadius: 15, ...curve,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  resultBody: { padding: space.md },
  resultCentre: { paddingVertical: space.xl, alignItems: 'center' },
  resultEyebrow: { fontFamily: font.black, fontSize: type.meta, letterSpacing: tracking.meta, color: colors.inkMute },
  resultTitle: {
    fontFamily: font.black, fontSize: type.heading, lineHeight: leading.heading,
    letterSpacing: tracking.heading, color: colors.ink, marginTop: 2,
  },
  resultSummary: {
    fontFamily: font.semibold, fontSize: type.small, lineHeight: leading.small,
    color: colors.inkSoft, marginTop: 6, marginBottom: space.md,
  },
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginBottom: space.md },
  podiumCol: { flex: 1, alignItems: 'center' },
  podiumName: { fontFamily: font.black, fontSize: type.meta, color: colors.ink, maxWidth: '100%' },
  podiumNameMe: { color: colors.goldText },
  podiumScore: { fontFamily: font.black, fontSize: type.body, color: colors.inkSoft, ...tabular, marginBottom: 4 },
  podiumStep: {
    width: '100%', borderWidth: 2.5, borderColor: colors.ink,
    borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm, ...curve,
    alignItems: 'center', justifyContent: 'center',
  },
  podiumStepMe: { borderColor: colors.goldText },
  podiumRank: { fontFamily: font.black, fontSize: type.title, ...tabular },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.line,
  },
  resultRowMe: { backgroundColor: colors.goldSoft, borderRadius: radius.sm, ...curve, paddingHorizontal: 8 },
  resultRank: { fontFamily: font.black, fontSize: type.small, color: colors.inkMute, width: 26, ...tabular },
  resultName: { flex: 1, fontFamily: font.bold, fontSize: type.small, color: colors.ink },
  resultNameMe: { fontFamily: font.black, color: colors.goldText },
  resultProgress: { fontFamily: font.black, fontSize: type.small, color: colors.ink, ...tabular },
  resultOf: { fontFamily: font.bold, color: colors.inkMute },
  sheetFoot: { padding: space.md, borderTopWidth: 2, borderTopColor: colors.line },

  // ── Claim sheet ──
  claimSheet: {
    backgroundColor: colors.white, borderWidth: 2.5, borderColor: colors.ink,
    borderRadius: radius.lg, ...curve, padding: space.lg, width: '100%', ...elevation.overlay,
  },
  claimEyebrow: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: tracking.meta,
    color: colors.inkMute, marginBottom: space.sm,
  },
  claimXpRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: space.md },
  claimPlus: { fontFamily: font.black, fontSize: type.title, color: colors.goldDeep },
  claimXp: {
    fontFamily: font.black, fontSize: 56, lineHeight: 60, color: colors.ink,
    padding: 0, minWidth: 40, textAlign: 'center', ...tabular,
  },
  claimXpUnit: { fontFamily: font.black, fontSize: type.heading, color: colors.goldDeep, marginLeft: 4 },
  claimNothing: {
    fontFamily: font.semibold, fontSize: type.small, lineHeight: leading.small,
    color: colors.inkSoft, marginBottom: space.sm,
  },
  awardRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line,
  },
  awardRank: {
    width: 32, height: 32, borderRadius: 16, ...curve, backgroundColor: colors.inkFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  awardRankDone: { backgroundColor: colors.goldSoft },
  awardRankText: { fontFamily: font.black, fontSize: type.small, color: colors.inkSoft, ...tabular },
  awardTitle: { fontFamily: font.black, fontSize: type.small, color: colors.ink },
  awardMeta: { fontFamily: font.semibold, fontSize: type.meta, color: colors.inkSoft, marginTop: 1 },
  awardBonus: { fontFamily: font.bold, fontSize: type.meta, color: colors.goldText, marginTop: 1 },
  awardXp: { fontFamily: font.black, fontSize: type.body, color: colors.goldText, ...tabular },

  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  leaderMe: { backgroundColor: colors.goldSoft, borderRadius: radius.sm, ...curve, paddingHorizontal: 8 },
  leaderRank: { fontFamily: font.black, fontSize: type.small, color: colors.inkSoft, width: 24 },
  leaderName: { flex: 1, fontFamily: font.bold, fontSize: type.small, color: colors.ink },
  leaderNameMe: { fontFamily: font.black },
  leaderXp: { fontFamily: font.black, fontSize: type.small, color: colors.goldDeep },
  emptyBlock: { alignItems: 'center', paddingVertical: space.xl },
  emptyTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink, textAlign: 'center' },
  emptyBody: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, textAlign: 'center', marginTop: space.sm, lineHeight: 20 },
  sheetBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(20,24,31,0.5)', alignItems: 'center', justifyContent: 'center', padding: space.lg,
  },
  sheet: { backgroundColor: colors.white, borderWidth: 2.5, borderColor: colors.ink, borderRadius: radius.lg, ...curve, padding: space.lg, width: '100%' },
  sheetTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink, marginBottom: space.md },
  input: {
    borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, ...curve, backgroundColor: colors.white,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: space.sm,
    fontFamily: font.bold, fontSize: type.body, color: colors.ink,
  },
  error: { fontFamily: font.bold, fontSize: type.small, color: colors.red },
  sheetClose: { marginTop: space.sm, alignItems: 'center', paddingVertical: space.sm },
  sheetCloseText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
});
