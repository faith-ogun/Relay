import React, { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useChildSafe } from '../hooks/useChildSafe';
import { usePlan } from '../hooks/usePlan';
import { EMPTY, loadProgress, type Progress } from '../services/progress';
import { getAchievements, isEarned, type Achievement } from '../services/achievements';
import { achievementStats } from '../services/progress';
import { getManifest, allLessons } from '../services/curriculum';
import { AppTabs } from '../components/AppTabs';
import { colors, font, radius, space, type, curve, tabular } from '../theme/tokens';
import { elevation } from '../theme/elevation';

/**
 * Profile: everything about YOU, in one place.
 *
 * Achievements, twins, plan and account all used to be rows on the front page,
 * competing with the thing the app is actually for. They belong behind a face,
 * the way every app with a tab bar arranges them, so Learn can be about
 * learning.
 */
export default function Profile() {
  const { user, displayName } = useAuth();
  const { childSafe } = useChildSafe();
  const plan = usePlan();
  const [progress, setProgress] = useState<Progress>(EMPTY);
  const [earned, setEarned] = useState<Achievement[]>([]);
  const [units, setUnits] = useState(0);
  const [total, setTotal] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const [p, list, manifest] = await Promise.all([
          user?.uid ? loadProgress(user.uid) : Promise.resolve(EMPTY),
          getAchievements(),
          getManifest(),
        ]);
        if (!alive) return;
        setProgress(p);
        setTotal(manifest ? allLessons(manifest).length : 0);
        if (manifest) {
          const done = new Set(Object.keys(p.lessonLevels));
          setUnits(manifest.units.filter((u) =>
            u.skills.every((sk) => sk.lessons.every((l) => done.has(l.id)))).length);
        }
        const stats = achievementStats(p, units);
        setEarned((list ?? []).filter((a) => isEarned(a, stats)));
      })();
      return () => { alive = false; };
    }, [user?.uid, units]),
  );

  const built = Object.keys(progress.lessonLevels).length;

  return (
    <AppTabs active="profile">
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.head}>
          <Image
            source={require('../../assets/brand/mascot-wave.png')}
            style={s.avatar}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel=""
          />
          <Text style={s.name}>{displayName || 'Builder'}</Text>
          {!!user?.email && <Text style={s.email}>{user.email}</Text>}
        </View>

        <View style={s.stats}>
          <Stat value={String(progress.xp)} label="XP" tint={colors.goldDeep} />
          <Stat value={String(progress.streak)} label="day streak" tint={colors.red} />
          <Stat value={`${built}`} label={`of ${total || '—'} built`} tint={colors.blueDeep} />
        </View>

        <Text style={s.section}>ACHIEVEMENTS</Text>
        <Pressable
          onPress={() => router.push('/achievements')}
          style={s.trophyCase}
          accessibilityRole="button"
          accessibilityLabel={`Achievements, ${earned.length} earned`}
        >
          {earned.length === 0 ? (
            <Text style={s.trophyEmpty}>
              Finish your first lesson and the case starts filling up.
            </Text>
          ) : (
            <View style={s.trophyRow}>
              {earned.slice(0, 4).map((a) => (
                <View key={a.id} style={s.trophy}>
                  <Text style={s.trophyTitle} numberOfLines={2}>{a.title}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={s.trophyMore}>
            {earned.length} earned · See all ›
          </Text>
        </Pressable>

        <Text style={s.section}>YOU</Text>
        <Row title="3D twins" sub="Models of everything you've built" onPress={() => router.push('/twins')} />
        {!childSafe && (
          <Row
            title="Plan"
            sub={plan.unlimited ? 'Unlimited live time' : `${plan.plan} · ${plan.minutesRemaining ?? 0} live minutes left`}
            onPress={() => router.push('/plans')}
          />
        )}
        <Row title="Account and privacy" sub="Your data, legal, sign out" onPress={() => router.push('/account')} />
      </ScrollView>
    </AppTabs>
  );
}

const Stat: React.FC<{ value: string; label: string; tint: string }> = ({ value, label, tint }) => (
  <View style={s.stat}>
    <Text style={[s.statValue, { color: tint }]}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
  </View>
);

const Row: React.FC<{ title: string; sub: string; onPress: () => void }> = ({ title, sub, onPress }) => (
  <Pressable onPress={onPress} style={s.row} accessibilityRole="button">
    <View style={{ flex: 1 }}>
      <Text style={s.rowTitle}>{title}</Text>
      <Text style={s.rowSub}>{sub}</Text>
    </View>
    <Text style={s.chevron}>›</Text>
  </Pressable>
);

const s = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: space.xxl },
  head: { alignItems: 'center', gap: 2 },
  avatar: { width: 108, height: 108 },
  name: { fontFamily: font.black, fontSize: type.title, color: colors.ink, letterSpacing: -0.5 },
  email: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft },

  stats: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  stat: {
    flex: 1, borderWidth: 2, borderColor: colors.line, borderRadius: radius.md, ...curve,
    backgroundColor: colors.white, paddingVertical: space.md, alignItems: 'center',
  },
  statValue: { ...tabular, fontFamily: font.black, fontSize: type.heading },
  statLabel: { fontFamily: font.bold, fontSize: 10, color: colors.inkSoft, marginTop: 2 },

  section: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 2,
    color: colors.inkSoft, marginTop: space.xl, marginBottom: space.sm,
  },
  trophyCase: {
    borderWidth: 2.5, borderColor: colors.ink, borderRadius: radius.lg, ...curve,
    backgroundColor: colors.goldSoft, padding: space.md, ...elevation.card,
  },
  trophyRow: { flexDirection: 'row', gap: space.sm },
  trophy: {
    flex: 1, borderWidth: 2, borderColor: colors.ink, borderRadius: radius.md, ...curve,
    backgroundColor: colors.white, paddingVertical: space.sm, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center', minHeight: 62,
  },
  trophyTitle: { fontFamily: font.black, fontSize: 9, color: colors.ink, textAlign: 'center', lineHeight: 12 },
  trophyEmpty: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.ink,
    textAlign: 'center', lineHeight: 20, paddingVertical: space.sm,
  },
  trophyMore: {
    fontFamily: font.bold, fontSize: type.small, color: colors.ink,
    marginTop: space.sm, textAlign: 'center',
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 2, borderColor: colors.line, borderRadius: radius.md, ...curve,
    backgroundColor: colors.white, padding: space.md, marginBottom: 8,
  },
  rowTitle: { fontFamily: font.bold, fontSize: type.body, color: colors.ink },
  rowSub: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 2 },
  chevron: { fontFamily: font.black, fontSize: type.heading, color: colors.inkSoft },
});
