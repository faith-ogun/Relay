import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import { goBack } from '../services/nav';
import { Button } from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import {
  addComment, blockUser, createPost, fetchChallenges, fetchComments, fetchFeed,
  fetchLeaderboard, joinChallenge, leaveChallenge, relativeTime, reportPost, toggleLike,
  type Challenge, type Comment, type Leaderboard, type Post,
} from '../services/community';
import { bumpMetric, creditLeagueWin, loadProgress, saveProgress } from '../services/progress';
import { colors, font, pressSmall, radius, space, type } from '../theme/tokens';

type Tab = 'feed' | 'challenges' | 'league';
type LoadState = 'loading' | 'ready' | 'offline' | 'forbidden';

export default function Community() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('feed');
  const [state, setState] = useState<LoadState>('loading');
  const [posts, setPosts] = useState<Post[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [league, setLeague] = useState<Leaderboard | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    const [feed, chal, board] = await Promise.all([fetchFeed(), fetchChallenges(), fetchLeaderboard()]);
    if (!feed.ok) { setState(feed.reason === 'forbidden' ? 'forbidden' : 'offline'); return; }
    setPosts(feed.data.posts ?? []);
    if (chal.ok) setChallenges(chal.data.challenges ?? []);
    if (board.ok) {
      setLeague(board.data);
      // A top-three finish is worth an achievement, credited once per week.
      if (user?.uid && board.data.me.rank) {
        const p = await loadProgress(user.uid);
        const next = creditLeagueWin(p, board.data.week, board.data.me.rank);
        if (next !== p) await saveProgress(user.uid, next);
      }
    }
    setState('ready');
  }, [user?.uid]);

  useEffect(() => { void load(); }, [load]);

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
    return (
      <View style={s.center}>
        <Text style={s.emptyTitle}>Can't reach the community</Text>
        <Text style={s.emptyBody}>Check your connection and pull down to try again.</Text>
        <Button label="Retry" onPress={() => void load()} style={{ marginTop: space.lg }} />
      </View>
    );
  }

  return (
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
          {(['feed', 'challenges', 'league'] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabActive]}
              accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t === 'feed' ? 'Feed' : t === 'challenges' ? 'Challenges' : 'League'}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'feed' && (
          <Feed
            posts={posts}
            onChanged={load}
            onCompose={() => setComposing(true)}
            uid={user?.uid}
          />
        )}
        {tab === 'challenges' && <Challenges items={challenges} onChanged={load} uid={user?.uid} />}
        {tab === 'league' && <League board={league} />}
      </ScrollView>

      {composing && <Composer onClose={() => setComposing(false)} onPosted={load} uid={user?.uid} />}
    </KeyboardAvoidingView>
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
              <Text style={[s.actionText, p.liked && s.actionOn]}>♥ {p.likes}</Text>
            </Pressable>
            <Pressable
              onPress={() => setOpenComments(openComments === p.id ? null : p.id)}
              style={s.action}
              accessibilityRole="button"
            >
              <Text style={s.actionText}>💬 {p.comments}</Text>
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
          <Text style={s.replySendText}>↑</Text>
        </Pressable>
      </View>
    </View>
  );
};

// ── Challenges ─────────────────────────────────────────────────────────────
const Challenges: React.FC<{ items: Challenge[]; onChanged: () => Promise<void>; uid?: string }> = ({ items, onChanged, uid }) => {
  if (items.length === 0) {
    return <View style={s.emptyBlock}><Text style={s.emptyTitle}>No live challenges</Text>
      <Text style={s.emptyBody}>New ones appear each week.</Text></View>;
  }
  return (
    <View>
      {items.map((c) => (
        <View key={c.id} style={s.post}>
          <Text style={s.postTitle}>{c.title}</Text>
          <Text style={s.postBody}>{c.description}</Text>
          <Text style={s.meta}>{c.participantCount} taking part</Text>
          <Button
            label={c.joined ? 'Leave challenge' : 'Join challenge'}
            variant={c.joined ? 'secondary' : 'primary'}
            onPress={async () => {
              const res = c.joined ? await leaveChallenge(c.id) : await joinChallenge(c.id);
              if (res.ok && !c.joined && uid) {
                const p = await loadProgress(uid);
                await saveProgress(uid, bumpMetric(p, 'challenges'));
              }
              await onChanged();
            }}
            style={{ marginTop: space.md }}
          />
        </View>
      ))}
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
  scroll: { padding: space.lg, paddingTop: space.xxl * 1.2, paddingBottom: space.xxl },
  backLink: { paddingVertical: space.sm, alignSelf: 'flex-start' },
  backText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
  eyebrow: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.inkSoft, marginTop: space.md },
  title: { fontFamily: font.black, fontSize: type.display, color: colors.ink, letterSpacing: -0.8, marginTop: 4, marginBottom: space.md },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: space.md },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 999, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center' },
  tabActive: { borderColor: colors.ink, backgroundColor: colors.gold },
  tabText: { fontFamily: font.black, fontSize: type.small, color: colors.inkSoft },
  tabTextActive: { color: colors.ink },
  post: {
    backgroundColor: colors.white, borderWidth: 2.5, borderColor: colors.ink,
    borderRadius: radius.lg, padding: space.md, marginBottom: space.md, ...pressSmall,
  },
  postTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.goldSoft,
    borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: font.black, fontSize: type.small, color: colors.ink },
  author: { fontFamily: font.black, fontSize: type.small, color: colors.ink },
  meta: { fontFamily: font.semibold, fontSize: type.meta, color: colors.inkSoft, marginTop: 1 },
  dots: { fontFamily: font.black, fontSize: type.small, color: colors.inkSoft },
  menu: { marginTop: space.sm, borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, overflow: 'hidden' },
  menuItem: { paddingVertical: 10, paddingHorizontal: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  menuText: { fontFamily: font.bold, fontSize: type.small, color: colors.ink },
  postTitle: { fontFamily: font.black, fontSize: type.body, color: colors.ink, marginTop: space.sm },
  postBody: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 4, lineHeight: 20 },
  postActions: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  action: { paddingVertical: 4 },
  actionText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
  actionOn: { color: colors.red },
  comments: { marginTop: space.md, borderTopWidth: 2, borderTopColor: colors.line, paddingTop: space.sm },
  comment: { marginBottom: space.sm },
  commentAuthor: { fontFamily: font.black, fontSize: type.meta, color: colors.ink },
  commentBody: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 2 },
  replyRow: { flexDirection: 'row', gap: 8, marginTop: space.sm },
  replyInput: {
    flex: 1, borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 8, fontFamily: font.semibold, fontSize: type.small, color: colors.ink,
  },
  replySend: {
    width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.gold,
    borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center',
  },
  replySendText: { fontFamily: font.black, fontSize: type.body, color: colors.ink },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  leaderMe: { backgroundColor: colors.goldSoft, borderRadius: radius.sm, paddingHorizontal: 8 },
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
  sheet: { backgroundColor: colors.white, borderWidth: 2.5, borderColor: colors.ink, borderRadius: radius.lg, padding: space.lg, width: '100%' },
  sheetTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink, marginBottom: space.md },
  input: {
    borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.white,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: space.sm,
    fontFamily: font.semibold, fontSize: type.body, color: colors.ink,
  },
  error: { fontFamily: font.bold, fontSize: type.small, color: colors.red },
  sheetClose: { marginTop: space.sm, alignItems: 'center', paddingVertical: space.sm },
  sheetCloseText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
});
