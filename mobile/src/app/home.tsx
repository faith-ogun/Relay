import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppTabs } from '../components/AppTabs';
import { StatStrip } from '../components/StatStrip';
import { PathSkeleton } from '../components/Skeleton';
import { UnitPath } from '../components/path/UnitPath';
import { BossCard } from '../components/BossCard';
import { UnitEmblem } from '../components/path/UnitEmblem';
import { useAuth } from '../hooks/useAuth';
import { getManifest, allLessons, type Manifest } from '../services/curriculum';
import { EMPTY, loadProgress, type Progress } from '../services/progress';
import { GOAL_FRAMING, loadProfile, type LearnerProfile } from '../services/learnerProfile';
import { fetchBosses, type BossStatus } from '../services/bosses';
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
  /**
   * Boss state, keyed by unit. Null until it has ever been fetched, which is
   * the distinction the gate below turns on: "not cleared" and "we do not know"
   * must not be treated the same, or a learner on a train would find every unit
   * they had already opened locked behind an exam they cannot reach.
   */
  const [bosses, setBosses] = useState<Record<string, BossStatus> | null>(null);
  const [passRatio, setPassRatio] = useState(0.8);

  const load = useCallback(async () => {
    // getManifest returns the cached path first and refreshes behind it, so the
    // two can arrive in either order: loadProgress below also hits the network,
    // and when it is the slower of the two the refreshed path lands BEFORE this
    // Promise.all settles. Applying the returned copy unconditionally then put
    // the stale path straight back on screen.
    let refreshed = false;
    const [m, p, prof, b] = await Promise.all([
      // The callback matters: without it a refreshed manifest was written to
      // cache and not shown until the next cold start, so content changes
      // appeared to take a relaunch.
      getManifest((fresh) => { refreshed = true; setManifest(fresh); }),
      user?.uid ? loadProgress(user.uid) : Promise.resolve(EMPTY),
      loadProfile(),
      fetchBosses(),
    ]);
    if (!refreshed) setManifest(m);
    setProgress(p);
    setProfile(prof);
    // Left alone on failure rather than cleared: a dropped connection should not
    // relock the path, and a stale "cleared" is the safe direction to be wrong in.
    if (b.ok) {
      setBosses(Object.fromEntries(b.data.units.map((u) => [u.unitId, u])));
      setPassRatio(b.data.passRatio);
    }
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
            // A unit is open once the one before it is FINISHED AND ITS BOSS IS
            // CLEARED, so the path reads as a path rather than a list of
            // everything at once, and nobody advances carrying a skill they
            // never proved.
            //
            // The boss half is applied only when boss state has actually been
            // fetched. Offline, this falls back to the old rule (previous unit's
            // lessons complete), which leaves an offline learner exactly where
            // they were before bosses existed rather than locked out. The server
            // refuses the exam endpoint independently, so the gate does not rest
            // on this check being unskippable.
            const prev = ui === 0 ? null : manifest.units[ui - 1];
            const prevLessonsDone = prev
              ? prev.skills.flatMap((sk) => sk.lessons).every((l) => done.has(l.id))
              : false;
            const prevBossCleared = !bosses || !prev || (bosses[prev.id]?.cleared ?? false);
            const unlocked = ui === 0 || (prevLessonsDone && prevBossCleared);

            return (
              <View key={unit.id} style={s.unitBlock}>
                <View style={[s.banner, { backgroundColor: tint }]}>
                  {/* Text and emblem share a row; the progress bar spans the
                      full width underneath it, because a bar interrupted by a
                      picture stops reading as a measure of the whole unit. */}
                  <View style={s.bannerRow}>
                    <View style={s.bannerText}>
                      <Text style={s.bannerKicker}>
                        UNIT {ui + 1}
                        {complete ? ' · COMPLETE' : unlocked ? '' : ' · LOCKED'}
                      </Text>
                      <Text style={s.bannerTitle}>{unit.title}</Text>
                    </View>
                    <UnitEmblem unitId={unit.id} dimmed={!unlocked} />
                  </View>
                  {/* Full width, below the emblem row. Beside the art it lost a
                      third of its width and half the units ellipsised. */}
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

                {/* The boss sits at the END of the unit, after its path, because
                    that is where it is in the journey. Shown from the moment the
                    unit is open so a learner can see what they are working
                    toward, not sprung on them once the lessons run out. */}
                {unlocked && (
                  <BossCard
                    unitTitle={unit.title}
                    status={bosses?.[unit.id] ?? null}
                    passRatio={passRatio}
                    lessonsRemaining={lessons.length - unitDone}
                    onStart={() => router.push({ pathname: '/boss/[unitId]', params: { unitId: unit.id } })}
                  />
                )}

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
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 64 },
  bannerText: { flex: 1, minWidth: 0 },
  bannerKicker: { fontFamily: font.black, fontSize: 10, letterSpacing: 1.6, color: 'rgba(255,255,255,0.85)' },
  // 22, not type.title's 28: see the note on EMBLEM in UnitEmblem.tsx. At 28 the
  // long titles ran to three lines and no two banners were the same height.
  bannerTitle: { fontFamily: font.black, fontSize: 22, color: colors.white, marginTop: 1, letterSpacing: -0.5, lineHeight: 27 },
  bannerSub: { fontFamily: font.bold, fontSize: type.small, color: 'rgba(255,255,255,0.88)', marginTop: 4 },
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
