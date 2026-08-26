import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppTabs } from '../components/AppTabs';
import { StatStrip } from '../components/StatStrip';
import { PathSkeleton } from '../components/Skeleton';
import { UnitPath } from '../components/path/UnitPath';
import { useAuth } from '../hooks/useAuth';
import { getManifest, allLessons, type Manifest } from '../services/curriculum';
import { EMPTY, loadProgress, type Progress } from '../services/progress';
import { GOAL_FRAMING, loadProfile, type LearnerProfile } from '../services/learnerProfile';
import { colors, font, radius, space, type, unitColor, curve, tabular } from '../theme/tokens';
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
    // getManifest returns the cached path first and refreshes behind it, so the
    // two can arrive in either order: loadProgress below also hits the network,
    // and when it is the slower of the two the refreshed path lands BEFORE this
    // Promise.all settles. Applying the returned copy unconditionally then put
    // the stale path straight back on screen.
    let refreshed = false;
    const [m, p, prof] = await Promise.all([
      // The callback matters: without it a refreshed manifest was written to
      // cache and not shown until the next cold start, so content changes
      // appeared to take a relaunch.
      getManifest((fresh) => { refreshed = true; setManifest(fresh); }),
      user?.uid ? loadProgress(user.uid) : Promise.resolve(EMPTY),
      loadProfile(),
    ]);
    if (!refreshed) setManifest(m);
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
                    {complete ? ' · COMPLETE' : unlocked ? '' : ' · LOCKED'}
                  </Text>
                  <Text style={s.bannerTitle}>{unit.title}</Text>
                  <Text style={s.bannerSub} numberOfLines={1}>{unit.subtitle}</Text>
                  {/* Progress as a bar rather than a count in the kicker. "6 of 12"
                      is a fact; a filled bar is a position, and position is what
                      someone scanning a unit header is looking for. */}
                  {unlocked && (
                    <View style={s.bannerProgress}>
                      <View style={s.bannerTrack}>
                        <View
                          style={[
                            s.bannerFill,
                            { width: `${lessons.length ? (unitDone / lessons.length) * 100 : 0}%` },
                          ]}
                        />
                      </View>
                      <Text style={s.bannerCount}>{unitDone}/{lessons.length}</Text>
                    </View>
                  )}
                </View>

                {/* The unit's lessons as a path with a checkpoint at every skill
                    boundary. It replaced a column of identical circles: eleven to
                    fourteen of those is a list, and the skill grouping the
                    curriculum already authors was invisible in it. */}
                <View style={s.trail}>
                  <UnitPath
                    unit={unit}
                    completed={done}
                    accent={tint}
                    locked={!unlocked}
                    onStart={(lessonId) => router.push({ pathname: '/lesson/[id]', params: { id: lessonId } })}
                  />
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

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: space.lg, paddingBottom: space.xxl },

  unitBlock: { marginBottom: space.xl },
  banner: {
    borderRadius: radius.lg, ...curve, borderWidth: 2.5, borderColor: colors.ink,
    paddingVertical: space.md, paddingHorizontal: space.md, ...elevation.card,
  },
  bannerKicker: { fontFamily: font.black, fontSize: 10, letterSpacing: 1.6, color: 'rgba(255,255,255,0.85)' },
  bannerTitle: { fontFamily: font.black, fontSize: type.title, color: colors.white, marginTop: 1, letterSpacing: -0.6 },
  bannerSub: { fontFamily: font.bold, fontSize: type.small, color: 'rgba(255,255,255,0.88)', marginTop: 2 },
  bannerProgress: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: space.md },
  bannerTrack: {
    flex: 1, height: 12, borderRadius: 6, ...curve,
    backgroundColor: 'rgba(20,24,31,0.22)', overflow: 'hidden',
  },
  bannerFill: { height: '100%', backgroundColor: colors.white, borderRadius: 6, ...curve },
  bannerCount: { fontFamily: font.black, fontSize: type.small, color: colors.white, ...tabular },

  trail: { marginTop: space.lg },
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
