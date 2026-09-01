import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Lock } from '../components/icons';
import { goBack } from '../services/nav';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../hooks/useAuth';
import {
  getAchievements, progressOf, readCachedEarned, syncEarned, TIER_COLOR, TIER_LABEL, UNTRACKED,
  type Achievement, type EarnedEntry, type Tier,
} from '../services/achievements';
import {
  authoredLessonsCompleted, authoredUnitsCompleted, isEarnedWith, mergeStats,
} from '../services/achievementRules';
import { achievementStats, EMPTY, loadProgress, type Progress, type ServerStats } from '../services/progress';
import { fetchCommunityStats } from '../services/community';
import { getManifest } from '../services/curriculum';
import { AchievementCard } from '../components/AchievementCard';
import { MedalArt } from '../components/MedalArt';
import { font, radius, space, type, curve } from '../theme/tokens';
import { makeStyles, useColors, useTheme } from '../theme/theme';

export default function Achievements() {
  const colors = useColors();
  const s = useS();
  const { user } = useAuth();
  const [items, setItems] = useState<Achievement[] | null>(null);
  const [progress, setProgress] = useState<Progress>(EMPTY);
  const [units, setUnits] = useState(0);
  const [builds, setBuilds] = useState(0);
  const [open, setOpen] = useState<Achievement | null>(null);
  const [server, setServer] = useState<ServerStats | null>(null);
  // The durable record: what this learner has EARNED, which is a thing that
  // happened and not a property of today's counters. Seeded from this device's
  // cache so the case is right before the network answers, then replaced by the
  // server's copy, which is the one that survives a reinstall and a second phone.
  const [earnedAt, setEarnedAt] = useState<Record<string, EarnedEntry>>({});
  const [serverStats, setServerStats] = useState<Record<string, number> | null>(null);
  const [recordUnreachable, setRecordUnreachable] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [list, prog, manifest, stats, cached] = await Promise.all([
        getAchievements(),
        user?.uid ? loadProgress(user.uid) : Promise.resolve(EMPTY),
        getManifest(),
        // Community stats are a bonus, not a gate: the screen renders from
        // local progress if the call fails, rather than blocking on the network.
        user?.uid ? fetchCommunityStats() : Promise.resolve(null),
        readCachedEarned(user?.uid),
      ]);
      if (!alive) return;
      setItems(list);
      setProgress(prog);
      setEarnedAt(cached);
      if (stats && stats.ok) setServer(stats.data);
      // A unit counts as complete when every AUTHORED lesson under it is done.
      //
      // Not every lesson ON THE PATH: the 142 authored lessons are served as 284
      // shorter sessions, and counting sessions meant a learner who had finished
      // the whole curriculum had every part one done and every part two
      // untouched, so their unit medals vanished. How many sittings a lesson is
      // delivered in is packaging, and packaging must not move medals.
      if (manifest) {
        const done = new Set(Object.keys(prog.lessonLevels));
        setUnits(authoredUnitsCompleted(manifest.units, done));
        setBuilds(authoredLessonsCompleted(manifest.units, done));
      }

      // Then the durable record. Separate from the paint above on purpose: the
      // case renders from what this device knows, and the server's answer
      // arrives into it rather than gating it.
      const record = await syncEarned(user?.uid);
      if (!alive) return;
      if (record) {
        // Merged, never replaced. The cache can hold a stamp the server has not
        // answered with yet, and nothing in this screen may narrow the set.
        setEarnedAt((held) => ({ ...held, ...record.earned }));
        setServerStats(record.stats);
        setRecordUnreachable(false);
      } else {
        setRecordUnreachable(Object.keys(cached).length === 0);
      }
    })();
    return () => { alive = false; };
  }, [user?.uid]);

  // `builds` counts lessons, so it is counted in AUTHORED lessons for the same
  // reason `units` is. The server's stats win where they are higher: they see a
  // second device, where this one only sees itself.
  const stats = useMemo<Record<string, number>>(
    () => mergeStats<Record<string, number>>(
      { ...achievementStats(progress, units, server), builds },
      serverStats,
    ),
    [progress, units, server, builds, serverStats],
  );

  const ordered = useMemo(() => {
    if (!items) return [];
    return [...items]
      .map((a) => ({ a, earned: isEarnedWith(a, stats, earnedAt), pct: progressOf(a, stats) }))
      .sort((x, y) => (x.earned === y.earned ? y.pct - x.pct : x.earned ? -1 : 1));
  }, [items, stats, earnedAt]);

  const earnedCount = ordered.filter((o) => o.earned).length;

  if (!items) {
    return <View style={s.center}><ActivityIndicator color={colors.goldDeep} /></View>;
  }

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.scroll}>
      <Pressable onPress={() => goBack('/home')} style={s.backLink} accessibilityRole="button">
        <Text style={s.backText}>‹ Back</Text>
      </Pressable>

      <Text style={s.eyebrow}>TROPHY CASE</Text>
      <Text style={s.title}>Achievements</Text>
      <Text style={s.sub}>{earnedCount} of {items.length} unlocked</Text>

      {/* The case still renders from what this device can prove, so this is a
          freshness notice rather than an error screen. What it costs is a medal
          earned on another device, which is worth saying out loud. */}
      {recordUnreachable && (
        <Text style={s.notice} accessibilityRole="alert">
          Showing this device. Medals earned elsewhere will appear once you are back online.
        </Text>
      )}

      <View style={s.grid}>
        {ordered.map(({ a, earned, pct }) => (
          <Card key={a.id} a={a} earned={earned} pct={pct} onPress={() => setOpen(a)} />
        ))}
      </View>

      {/* Detail sheet: the back-text is the reward for earning it, so it stays
          hidden until the card is unlocked.

          In a Modal, not an absolutely-positioned View. It used to sit inside the
          ScrollView, where `position: absolute` is relative to the CONTENT rather
          than the screen: with fifty cards the content runs several screens tall,
          so `justifyContent: center` put the sheet halfway down the page while the
          backdrop covered everything. Tapping a card dimmed the screen and showed
          nothing. A Modal renders above the whole app and handles the Android back
          button as well. */}
      {/* Tapping a card opens it big. Tapping the card turns it over; tapping
          anywhere outside goes back to the case. The story on the back is the
          reward for earning it, so it costs a gesture rather than arriving with
          the panel. */}
      <Modal
        visible={!!open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(null)}
      >
        {open && (
          <Pressable
            style={s.sheetBackdrop}
            onPress={() => setOpen(null)}
            accessibilityRole="button"
            accessibilityLabel="Back to all achievements"
          >
            {/* Swallows taps so a press on the card or its blurb does not close
                the inspector, while a press anywhere else does. */}
            <Pressable onPress={(e) => e.stopPropagation()}>
              <AchievementCard
                achievement={open}
                earned={isEarnedWith(open, stats, earnedAt)}
                progress={progressOf(open, stats)}
                progressLabel={
                  UNTRACKED.has(open.metric)
                    ? 'Tracked on the community side, not shown here yet'
                    : `${stats[open.metric] ?? 0} of ${open.threshold}`
                }
              />
            </Pressable>
          </Pressable>
        )}
      </Modal>
    </ScrollView>
  );
}

const RING = 30;

const Card: React.FC<{ a: Achievement; earned: boolean; pct: number; onPress: () => void }> = ({
  a, earned, pct, onPress,
}) => {
  const colors = useColors();
  const s = useS();
  const tint = TIER_COLOR[a.tier as Tier] ?? colors.line;
  const circumference = 2 * Math.PI * (RING - 4);
  // The artwork is the reward. It was declared on the type and never rendered,
  // so every medal was a flat coloured disc. If a file is missing or the network
  // is down the disc is still there underneath, so the grid degrades to what it
  // used to be rather than to a hole.
  const { elevation } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[s.card, earned && { borderColor: colors.ink, ...elevation.card }]}
      accessibilityRole="button"
      accessibilityLabel={`${a.title}. ${earned ? 'Unlocked' : `Locked, ${Math.round(pct * 100)} percent`}`}
    >
      <View style={s.medalWrap}>
        <Svg width={RING * 2} height={RING * 2}>
          <Circle cx={RING} cy={RING} r={RING - 4} stroke={colors.line} strokeWidth={4} fill="none" />
          {!earned && pct > 0 && (
            <Circle
              cx={RING} cy={RING} r={RING - 4} stroke={colors.gold} strokeWidth={4} fill="none"
              strokeDasharray={`${circumference * pct} ${circumference}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${RING} ${RING})`}
            />
          )}
          <Circle cx={RING} cy={RING} r={RING - 11} fill={earned ? tint : colors.cream} />
        </Svg>
        <MedalArt art={a.art} size={RING * 1.5} dimmed={!earned} style={s.art} />
        {!earned && <View style={s.lock}><Lock size={16} /></View>}
      </View>
      <Text style={[s.cardTitle, !earned && s.cardTitleLocked]} numberOfLines={2}>{a.title}</Text>
      <Text style={s.cardTier}>{TIER_LABEL[a.tier as Tier]}</Text>
    </Pressable>
  );
};

const useS = makeStyles((colors) => ({
  flex: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  scroll: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl },
  backLink: { paddingVertical: space.sm, alignSelf: 'flex-start' },
  backText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
  eyebrow: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.inkSoft, marginTop: space.md },
  title: { fontFamily: font.black, fontSize: type.display, color: colors.ink, letterSpacing: -0.8, marginTop: 4 },
  sub: { fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft, marginTop: 4, marginBottom: space.lg },
  notice: {
    fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft,
    borderLeftWidth: 3, borderLeftColor: colors.red, paddingLeft: space.sm, marginBottom: space.lg,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: {
    width: '31%', backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.line,
    borderRadius: radius.md, ...curve, padding: space.sm, alignItems: 'center',
  },
  medalWrap: { alignItems: 'center', justifyContent: 'center' },
  // Size and the drained look for a locked medal both come from MedalArt; this
  // only says where it sits.
  art: { position: 'absolute' },
  lock: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  cardTitle: {
    fontFamily: font.black, fontSize: type.meta, color: colors.ink,
    textAlign: 'center', marginTop: 6, lineHeight: 14,
  },
  cardTitleLocked: { color: colors.inkSoft },
  cardTier: { fontFamily: font.bold, fontSize: 9, color: colors.inkSoft, marginTop: 2, letterSpacing: 0.5 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,24,31,0.5)', alignItems: 'center', justifyContent: 'center', padding: space.lg,
  },
}));
