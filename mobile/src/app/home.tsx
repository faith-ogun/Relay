import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppTabs } from '../components/AppTabs';
import { StatStrip } from '../components/StatStrip';
import { PathSkeleton } from '../components/Skeleton';
import { useAuth } from '../hooks/useAuth';
import { getManifest, allLessons, type Manifest } from '../services/curriculum';
import { EMPTY, loadProgress, type Progress } from '../services/progress';
import { GOAL_FRAMING, loadProfile, type LearnerProfile } from '../services/learnerProfile';
import { colors, font, radius, space, type, unitColor, curve } from '../theme/tokens';
import { elevation } from '../theme/elevation';

/**
 * Learn: the path, and nothing else.
 *
 * This screen used to carry a greeting, three stat cards, a hero, and eight
 * navigation rows. Everything competed and nothing was ranked, which is a menu
 * rather than a product. Achievements, twins, plan and account have moved to
 * Profile; the simulator, live tutor and community are tabs. What is left is the
 * thing the app is for: where you are, and what is next.
 *
 * Units are colour-coded and each one is its own banner, because on a path the
 * colour IS the wayfinding: "the green one" is how a learner remembers where
 * they got to.
 */
export default function Home() {
  const { user } = useAuth();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [progress, setProgress] = useState<Progress>(EMPTY);
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const done = useMemo(() => new Set(Object.keys(progress.lessonLevels)), [progress]);

  const next = useMemo(() => {
    if (!manifest) return null;
    return allLessons(manifest).find((l) => !done.has(l.id)) ?? null;
  }, [manifest, done]);

  const dailyGoal = profile?.dailyGoal ?? 1;

  if (loading) {
    return (
      <AppTabs active="learn">
        <StatStrip xp={0} streak={0} doneToday={0} dailyGoal={dailyGoal} />
        <PathSkeleton />
      </AppTabs>
    );
  }

  return (
    <AppTabs active="learn">
      <StatStrip
        xp={progress.xp}
        streak={progress.streak}
        doneToday={progress.completedToday}
        dailyGoal={dailyGoal}
      />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }}
            tintColor={colors.goldDeep}
          />
        }
      >
        {!manifest ? (
          <View style={s.offline}>
            <Text style={s.offlineTitle}>Can't reach your lessons</Text>
            <Text style={s.offlineBody}>
              Pull down to retry. Lessons you have already opened still work without a connection.
            </Text>
          </View>
        ) : (
          manifest.units.map((unit, ui) => {
            const lessons = unit.skills.flatMap((sk) => sk.lessons);
            const unitDone = lessons.filter((l) => done.has(l.id)).length;
            const complete = unitDone === lessons.length && lessons.length > 0;
            const tint = unitColor(ui);
            // A unit is open once the one before it is finished, so the path
            // reads as a path rather than a list of everything at once.
            const prev = ui === 0 ? null : manifest.units[ui - 1];
            const unlocked = ui === 0 || (prev
              ? prev.skills.flatMap((sk) => sk.lessons).every((l) => done.has(l.id))
              : false);

            return (
              <View key={unit.id} style={s.unitBlock}>
                <View style={[s.banner, { backgroundColor: tint }]}>
                  <Text style={s.bannerKicker}>
                    UNIT {ui + 1}
                    {complete ? ' · COMPLETE' : unlocked ? ` · ${unitDone} OF ${lessons.length}` : ' · LOCKED'}
                  </Text>
                  <Text style={s.bannerTitle}>{unit.title}</Text>
                </View>

                <View style={s.trail}>
                  {lessons.map((lesson, li) => {
                    const isDone = done.has(lesson.id);
                    const isNext = next?.id === lesson.id;
                    // The trail staggers left and right so it reads as a route,
                    // not a column of buttons.
                    const offset = [0, 44, 74, 44, 0, -44, -74, -44][li % 8];
                    return (
                      <Pressable
                        key={lesson.id}
                        disabled={!unlocked}
                        onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } })}
                        style={[
                          s.node,
                          { marginLeft: offset },
                          isDone && { backgroundColor: tint, borderColor: colors.ink },
                          isNext && s.nodeNext,
                          !unlocked && s.nodeLocked,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${lesson.title}${isDone ? ', done' : isNext ? ', next up' : ''}`}
                      >
                        {isDone ? <Tick /> : !unlocked ? <Lock /> : <Play tint={isNext ? colors.ink : colors.inkSoft} />}
                      </Pressable>
                    );
                  })}
                </View>

                {isNextUnit(next, lessons) && (
                  <View style={[s.nextCard, { borderColor: tint }]}>
                    <Text style={[s.nextKicker, { color: tint }]}>
                      {profile ? GOAL_FRAMING[profile.goal] : 'NEXT UP'}
                    </Text>
                    <Text style={s.nextTitle}>{next?.title}</Text>
                    {!!next?.summary && <Text style={s.nextBody}>{next.summary}</Text>}
                    <Pressable
                      onPress={() => next && router.push({ pathname: '/lesson/[id]', params: { id: next.id } })}
                      style={[s.nextButton, { backgroundColor: tint }]}
                      accessibilityRole="button"
                    >
                      <Text style={s.nextButtonText}>Start</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </AppTabs>
  );
}

/** True when the next lesson overall lives in this unit. */
function isNextUnit(next: { id: string } | null, lessons: Array<{ id: string }>): boolean {
  return !!next && lessons.some((l) => l.id === next.id);
}

const Tick: React.FC = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24">
    <Path d="m5.5 12.5 4.2 4.2L18.5 8" fill="none" stroke={colors.ink}
          strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const Play: React.FC<{ tint: string }> = ({ tint }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Path d="M8 5.5 18 12 8 18.5z" fill={tint} />
  </Svg>
);

const Lock: React.FC = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5" fill="none" stroke={colors.inkSoft} strokeWidth={2.2} />
    <Circle cx={12} cy={15.5} r={1.8} fill={colors.inkSoft} />
    <Path d="M5.5 10.5h13v9h-13z" fill="none" stroke={colors.inkSoft} strokeWidth={2.2} strokeLinejoin="round" />
  </Svg>
);

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: space.lg, paddingBottom: space.xxl },

  unitBlock: { marginBottom: space.xl },
  banner: {
    borderRadius: radius.lg, ...curve, borderWidth: 2.5, borderColor: colors.ink,
    paddingVertical: space.md, paddingHorizontal: space.md, ...elevation.card,
  },
  bannerKicker: { fontFamily: font.black, fontSize: 10, letterSpacing: 1.6, color: 'rgba(255,255,255,0.85)' },
  bannerTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.white, marginTop: 2 },

  trail: { alignItems: 'center', marginTop: space.lg, gap: 14 },
  node: {
    width: 64, height: 64, borderRadius: 32, ...curve,
    borderWidth: 3, borderColor: colors.line, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', ...elevation.card,
  },
  nodeNext: { borderColor: colors.ink, borderWidth: 4, backgroundColor: colors.goldSoft },
  nodeLocked: { opacity: 0.45 },

  nextCard: {
    marginTop: space.lg, borderWidth: 2.5, borderRadius: radius.lg, ...curve,
    backgroundColor: colors.white, padding: space.md, ...elevation.card,
  },
  nextKicker: { fontFamily: font.black, fontSize: 10, letterSpacing: 1.6 },
  nextTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink, marginTop: 4 },
  nextBody: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 6, lineHeight: 20 },
  nextButton: {
    marginTop: space.md, borderRadius: radius.md, ...curve, borderWidth: 2.5, borderColor: colors.ink,
    paddingVertical: 12, alignItems: 'center',
  },
  nextButtonText: { fontFamily: font.black, fontSize: type.body, color: colors.white },

  offline: {
    borderWidth: 2.5, borderColor: colors.line, borderRadius: radius.lg, ...curve,
    backgroundColor: colors.white, padding: space.lg, marginTop: space.lg,
  },
  offlineTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink },
  offlineBody: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 6, lineHeight: 20 },
});
