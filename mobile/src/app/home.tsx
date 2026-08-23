import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button } from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { useChildSafe } from '../hooks/useChildSafe';
import { getManifest, allLessons, type Manifest } from '../services/curriculum';
import { EMPTY, loadProgress, type Progress } from '../services/progress';
import {
  BENCH_NOTE, GOAL_FRAMING, loadProfile, type LearnerProfile,
} from '../services/learnerProfile';
import { colors, font, pressSmall, radius, space, type } from '../theme/tokens';

export default function Home() {
  const { displayName, user } = useAuth();
  const { childSafe } = useChildSafe();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [progress, setProgress] = useState<Progress>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<LearnerProfile | null>(null);

  const load = useCallback(async () => {
    const [m, p, prof] = await Promise.all([
      getManifest(),
      user?.uid ? loadProgress(user.uid) : Promise.resolve(EMPTY),
      loadProfile(),
    ]);
    setManifest(m);
    setProgress(p);
    setProfile(prof);
  }, [user?.uid]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  // Progress changes when a lesson is finished, so refresh on return to this tab.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const { next, completedCount, totalCount } = useMemo(() => {
    if (!manifest) return { next: null, completedCount: 0, totalCount: 0 };
    const lessons = allLessons(manifest);
    const doneIds = new Set(Object.keys(progress.lessonLevels));
    return {
      next: lessons.find((l) => !doneIds.has(l.id)) ?? null,
      completedCount: lessons.filter((l) => doneIds.has(l.id)).length,
      totalCount: lessons.length,
    };
  }, [manifest, progress]);

  const pct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  // The daily target the learner set during setup. Their streak counts against
  // it, so it is shown rather than kept private, and it is the reason the setup
  // question was worth asking.
  const dailyGoal = profile?.dailyGoal ?? 1;
  const doneToday = Math.min(progress.completedToday, dailyGoal);
  const goalMet = progress.completedToday >= dailyGoal;


  if (loading) {
    return <View style={s.center}><ActivityIndicator color={colors.goldDeep} /></View>;
  }

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={s.scroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }}
          tintColor={colors.goldDeep}
        />
      }
    >
      <Text style={s.eyebrow}>TODAY</Text>
      <Text style={s.title}>Welcome back, {displayName}.</Text>

      {/* Real counters, straight from persisted progress. */}
      <View style={s.stats}>
        <Stat value={String(progress.xp)} label="XP" tint={colors.goldDeep} />
        <Stat value={String(progress.streak)} label="day streak" tint={colors.red} />
        <Stat value={`${completedCount}`} label={`of ${totalCount} lessons`} tint={colors.blueDeep} />
      </View>

      {/* Today's target, against the goal they chose. */}
      <View style={[s.daily, goalMet && s.dailyDone]}>
        <View style={s.dailyPips}>
          {Array.from({ length: dailyGoal }).map((_, i) => (
            <View key={i} style={[s.pip, i < doneToday && s.pipOn]} />
          ))}
        </View>
        <Text style={s.dailyText}>
          {goalMet
            ? `Daily goal done: ${progress.completedToday} today.`
            : `${doneToday} of ${dailyGoal} today`}
        </Text>
      </View>

      {next ? (
        <View style={s.hero}>
          <Text style={s.heroKicker}>
            {completedCount === 0
              ? 'START HERE'
              : profile
                ? GOAL_FRAMING[profile.goal]
                : 'PICK UP WHERE YOU LEFT OFF'}
          </Text>
          <Text style={s.heroTitle}>{next.title}</Text>
          {!!next.summary && <Text style={s.heroBody}>{next.summary}</Text>}

          <View style={s.track}>
            <View style={[s.fill, { width: `${pct}%` }]} />
          </View>
          <Text style={s.trackLabel}>{pct}% of the path complete</Text>

          <Button
            label={completedCount === 0 ? 'Start your first lesson' : 'Continue'}
            onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: next.id } })}
            style={{ marginTop: space.md }}
          />
        </View>
      ) : manifest ? (
        <View style={s.hero}>
          <Text style={s.heroKicker}>PATH COMPLETE</Text>
          <Text style={s.heroTitle}>You've finished every lesson.</Text>
          <Text style={s.heroBody}>
            {totalCount} lessons done. Take it to the bench: start a live session and build something real.
          </Text>
        </View>
      ) : (
        <View style={s.hero}>
          <Text style={s.heroKicker}>OFFLINE</Text>
          <Text style={s.heroTitle}>Can't reach your lessons</Text>
          <Text style={s.heroBody}>
            Pull down to retry. Lessons you've already opened still work without a connection.
          </Text>
        </View>
      )}

      <Row
        title="Live tutor"
        sub={profile ? BENCH_NOTE[profile.bench] : 'Camera + voice on your real bench'}
        onPress={() => router.push('/live')}
      />
      <Row
        title="Simulator"
        sub={
          profile?.bench === 'none'
            ? 'No board yet? Run real Arduino code here.'
            : 'Run a sketch without wiring anything up'
        }
        onPress={() => router.push('/simulator')}
      />
      <Row
        title="Learning path"
        sub={
          profile?.experience === 'lots' && completedCount === 0
            ? 'Know some of this already? Jump in further along.'
            : `${manifest?.units.length ?? 12} units, in the order they unlock`
        }
        onPress={() => router.push('/path')}
      />
      <Row title="Achievements" sub="Your trophy case" onPress={() => router.push('/achievements')} />
      {/* Child mode (#94): a minor sees no public social surface and no way to
          spend money. The server enforces both; this keeps them off the screen. */}
      {!childSafe && (
        <Row title="Community" sub="Builds, challenges and the weekly league" onPress={() => router.push('/community')} />
      )}
      <Row title="3D twins" sub="Models of everything you've built" onPress={() => router.push('/twins')} />
      {!childSafe && (
        <Row title="Plans" sub="More live tutoring time" onPress={() => router.push('/plans')} />
      )}

      <Row title="Account" sub="Your plan, your data, and privacy" onPress={() => router.push('/account')} />
    </ScrollView>
  );
}

const Stat: React.FC<{ value: string; label: string; tint: string }> = ({ value, label, tint }) => (
  <View style={s.stat}>
    <Text style={[s.statValue, { color: tint }]}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
  </View>
);

const Row: React.FC<{ title: string; sub: string; onPress: () => void }> = ({ title, sub, onPress }) => (
  <Pressable onPress={onPress} style={s.row} accessibilityRole="button" accessibilityLabel={title}>
    <View style={{ flex: 1 }}>
      <Text style={s.rowTitle}>{title}</Text>
      <Text style={s.rowSub}>{sub}</Text>
    </View>
    <Text style={s.chevron}>›</Text>
  </Pressable>
);

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  scroll: { padding: space.lg, paddingTop: space.xxl * 1.3, paddingBottom: space.xxl },
  daily: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    borderWidth: 2, borderColor: colors.line, borderRadius: radius.md,
    backgroundColor: colors.white, paddingVertical: 10, paddingHorizontal: space.md,
    marginBottom: space.md,
  },
  dailyDone: { borderColor: colors.greenDeep, backgroundColor: '#eef7e0' },
  dailyPips: { flexDirection: 'row', gap: 5 },
  pip: { width: 14, height: 8, borderRadius: 4, backgroundColor: colors.line },
  pipOn: { backgroundColor: colors.goldDeep },
  dailyText: { fontFamily: font.bold, fontSize: type.small, color: colors.ink },
  eyebrow: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.inkSoft },
  title: { fontFamily: font.black, fontSize: type.title, color: colors.ink, letterSpacing: -0.6, marginTop: 4 },
  stats: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  stat: {
    flex: 1, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.line,
    borderRadius: radius.md, paddingVertical: space.md, alignItems: 'center',
  },
  statValue: { fontFamily: font.black, fontSize: type.title, letterSpacing: -0.5 },
  statLabel: { fontFamily: font.bold, fontSize: type.meta, color: colors.inkSoft, marginTop: 2, textAlign: 'center' },
  hero: {
    marginTop: space.md, backgroundColor: colors.white, borderWidth: 2.5, borderColor: colors.ink,
    borderRadius: radius.lg, padding: space.lg, ...pressSmall,
  },
  heroKicker: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 2, color: colors.inkSoft },
  heroTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink, marginTop: 6, lineHeight: type.heading * 1.25 },
  heroBody: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 6, lineHeight: 20 },
  track: {
    height: 10, borderRadius: 5, backgroundColor: colors.cream, borderWidth: 2,
    borderColor: colors.ink, marginTop: space.md, overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.gold },
  trackLabel: { fontFamily: font.bold, fontSize: type.meta, color: colors.inkSoft, marginTop: 6 },
  row: {
    marginTop: space.md, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, borderWidth: 2.5, borderColor: colors.ink,
    borderRadius: radius.lg, padding: space.md, ...pressSmall,
  },
  rowTitle: { fontFamily: font.black, fontSize: type.body, color: colors.ink },
  rowSub: { fontFamily: font.semibold, fontSize: type.meta, color: colors.inkSoft, marginTop: 2 },
  chevron: { fontFamily: font.black, fontSize: type.title, color: colors.inkSoft },
});
