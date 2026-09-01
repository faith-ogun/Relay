import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppTabs } from '../components/AppTabs';
import { StatStrip } from '../components/StatStrip';
import { PathSkeleton } from '../components/Skeleton';
import { UnitPath } from '../components/path/UnitPath';
import { FilmPlayer } from '../components/FilmPlayer';
import { BossCard } from '../components/BossCard';
import { UnitEmblem } from '../components/path/UnitEmblem';
import { useAuth } from '../hooks/useAuth';
import { getManifest, allLessons, type CurriculumLesson, type Manifest } from '../services/curriculum';
import { EMPTY, loadProgress, type Progress } from '../services/progress';
import { GOAL_FRAMING, loadProfile, type LearnerProfile } from '../services/learnerProfile';
import { fetchBosses, type BossStatus } from '../services/bosses';
import { font, radius, space, type, unitColor, curve, tabular } from '../theme/tokens';
import { completedTodayNow, currentStreak } from '../services/completion';
import { makeStyles, useColors } from '../theme/theme';

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
/**
 * The last successfully loaded screen state, kept at module scope.
 *
 * The tab bar navigates with `router.replace`, so leaving Learn UNMOUNTS it and
 * every piece of React state goes with it. Coming back was therefore a cold
 * start every single time: `loading` reset to true, `PathSkeleton` took the
 * screen, and four network calls ran before anything real appeared.
 *
 * That is the latency reported on 2026-09-01, and it is why Learn and Community
 * felt slow while Simulator, Live and Plans were instant. Those three fetch
 * nothing on mount. Profile is the interesting one: it refetches on focus like
 * this screen does, but has no skeleton gate, so it renders immediately and
 * updates behind. That is the pattern being copied here.
 *
 * Module scope rather than React state because it has to outlive the component.
 * It is per-process and dies with the app, which is correct: it is a render
 * cache, not storage, and `getManifest` still owns the real persistence.
 *
 * Keyed by uid so signing in as somebody else on a shared phone cannot show the
 * previous person's path for the moment before their own arrives.
 */
type Snapshot = {
  uid: string | undefined;
  manifest: Manifest | null;
  progress: Progress;
  profile: LearnerProfile | null;
  bosses: Record<string, BossStatus> | null;
  passRatio: number;
};
let snapshot: Snapshot | null = null;

/** What a unit banner needs, derived once per path rather than per render. */
type UnitMeta = {
  lessons: CurriculumLesson[];
  unitDone: number;
  complete: boolean;
  tint: string;
  unlocked: boolean;
};

/**
 * One unit: banner, path, boss, and the "next up" card when it lands here.
 *
 * Extracted from the render loop and memoised so a FlatList can mount these
 * lazily. Scrolling the path used to re-render every unit on the screen because
 * they were all children of one map; now a unit only re-renders when something
 * it is actually shown changes.
 */
const UnitBlock = React.memo<{
  unit: Manifest['units'][number];
  index: number;
  meta: UnitMeta;
  boss: BossStatus | null;
  passRatio: number;
  next: CurriculumLesson | null;
  goalKicker: string;
  completed: Set<string>;
  onPlayFilm: (skillId: string, title: string) => void;
}>(({ unit, index: ui, meta, boss, passRatio, next, goalKicker, completed, onPlayFilm }) => {
     const s = useS();
  const { lessons, unitDone, complete, tint, unlocked } = meta;
  return (
    <View style={s.unitBlock}>
      <View style={[s.banner, { backgroundColor: tint }]}>
        {/* Text and emblem share a row; the progress bar spans the full width
            underneath it, because a bar interrupted by a picture stops reading
            as a measure of the whole unit. */}
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
        {/* Full width, below the emblem row. Beside the art it lost a third of
            its width and half the units ellipsised. */}
        <Text style={s.bannerSub} numberOfLines={1}>{unit.subtitle}</Text>
        {/* Progress as a bar rather than a count in the kicker. "6 of 12" is a
            fact; a filled bar is a position, and position is what someone
            scanning a unit header is looking for. */}
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

      {/* The unit's lessons as a path with a checkpoint at every skill boundary.
          It replaced a column of identical circles: eleven to fourteen of those
          is a list, and the skill grouping the curriculum already authors was
          invisible in it. */}
      <View style={s.trail}>
        <UnitPath
          unit={unit}
          completed={completed}
          accent={tint}
          locked={!unlocked}
          onStart={(lessonId) => router.push({ pathname: '/lesson/[id]', params: { id: lessonId } })}
          onPlayFilm={onPlayFilm}
        />
      </View>

      {/* The boss sits at the END of the unit, after its path, because that is
          where it is in the journey. Shown from the moment the unit is open so a
          learner can see what they are working toward, not sprung on them once
          the lessons run out. */}
      {unlocked && (
        <BossCard
          unitTitle={unit.title}
          status={boss}
          passRatio={passRatio}
          lessonsRemaining={lessons.length - unitDone}
          onStart={() => router.push({ pathname: '/boss/[unitId]', params: { unitId: unit.id } })}
        />
      )}

      {isNextUnit(next, lessons) && (
        <View style={[s.nextCard, { borderColor: tint }]}>
          <Text style={[s.nextKicker, { color: tint }]}>{goalKicker}</Text>
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
});
UnitBlock.displayName = 'UnitBlock';

export default function Home() {
  const colors = useColors();
  const s = useS();
  const { user } = useAuth();
  // Seeded from the last visit when there is one, so a tab switch paints
  // immediately and refreshes behind. `warm` is only true for the same learner.
  const warm = snapshot && snapshot.uid === user?.uid ? snapshot : null;
  const [manifest, setManifest] = useState<Manifest | null>(warm?.manifest ?? null);
  const [progress, setProgress] = useState<Progress>(warm?.progress ?? EMPTY);
  const [profile, setProfile] = useState<LearnerProfile | null>(warm?.profile ?? null);
  const [loading, setLoading] = useState(!warm);
  const [refreshing, setRefreshing] = useState(false);
  // The film opened from a path node. Held here rather than in UnitPath so the
  // player is a modal over the whole screen, the same way Labs opens one.
  const [playing, setPlaying] = useState<{ skillId: string; title: string } | null>(null);
  /**
   * Boss state, keyed by unit. Null until it has ever been fetched, which is
   * the distinction the gate below turns on: "not cleared" and "we do not know"
   * must not be treated the same, or a learner on a train would find every unit
   * they had already opened locked behind an exam they cannot reach.
   */
  const [bosses, setBosses] = useState<Record<string, BossStatus> | null>(warm?.bosses ?? null);
  const [passRatio, setPassRatio] = useState(warm?.passRatio ?? 0.8);
  // Read inside `load` without making it depend on them: a failed boss fetch
  // must carry the previous values into the snapshot rather than null them.
  const bossesRef = useRef(bosses);
  const ratioRef = useRef(passRatio);
  bossesRef.current = bosses;
  ratioRef.current = passRatio;

  const load = useCallback(async () => {
    // getManifest returns the cached path first and refreshes behind it, so the
    // two can arrive in either order: loadProgress below also hits the network,
    // and when it is the slower of the two the refreshed path lands BEFORE this
    // Promise.all settles. Applying the returned copy unconditionally then put
    // the stale path straight back on screen.
    let refreshed: Manifest | null = null;
    const [m, p, prof, b] = await Promise.all([
      // The callback matters: without it a refreshed manifest was written to
      // cache and not shown until the next cold start, so content changes
      // appeared to take a relaunch.
      getManifest((fresh) => { refreshed = fresh; setManifest(fresh); }),
      user?.uid ? loadProgress(user.uid) : Promise.resolve(EMPTY),
      loadProfile(),
      fetchBosses(),
    ]);
    const shown = refreshed ?? m;
    if (!refreshed) setManifest(m);
    setProgress(p);
    setProfile(prof);
    // Left alone on failure rather than cleared: a dropped connection should not
    // relock the path, and a stale "cleared" is the safe direction to be wrong in.
    let nextBosses = bossesRef.current;
    let nextRatio = ratioRef.current;
    if (b.ok) {
      nextBosses = Object.fromEntries(b.data.units.map((u) => [u.unitId, u]));
      nextRatio = b.data.passRatio;
      setBosses(nextBosses);
      setPassRatio(nextRatio);
    }

    // Kept for the next mount, so a tab switch paints instead of skeletons.
    // Written from the values just computed rather than from state, because a
    // setState in this tick is not readable in this tick.
    snapshot = {
      uid: user?.uid,
      manifest: shown,
      progress: p,
      profile: prof,
      bosses: nextBosses,
      passRatio: nextRatio,
    };
  }, [user?.uid]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const done = useMemo(() => new Set(Object.keys(progress.lessonLevels)), [progress]);

  const next = useMemo(() => {
    if (!manifest) return null;
    return allLessons(manifest).find((l) => !done.has(l.id)) ?? null;
  }, [manifest, done]);

  /**
   * Everything each unit banner needs, computed in one pass over the path.
   *
   * This used to happen inside the render loop, where deciding whether unit N
   * was unlocked walked ALL of unit N-1's lessons. Over the whole curriculum
   * that is quadratic in lessons, repeated on every render, for an answer that
   * only changes when progress does. Carrying a running "everything so far is
   * done" flag makes it one linear pass, memoised on the two things it actually
   * depends on.
   */
  const unitMeta = useMemo(() => {
    if (!manifest) return [] as UnitMeta[];
    let prevLessonsDone = false;
    let prevId: string | null = null;
    return manifest.units.map((unit, ui) => {
      const lessons = unit.skills.flatMap((sk) => sk.lessons);
      const unitDone = lessons.filter((l) => done.has(l.id)).length;
      const complete = lessons.length > 0 && unitDone === lessons.length;
      // A unit is open once the one before it is FINISHED AND ITS BOSS IS
      // CLEARED, so the path reads as a path rather than a list of everything at
      // once, and nobody advances carrying a skill they never proved.
      //
      // The boss half applies only when boss state has actually been fetched.
      // Offline this falls back to the older rule, which leaves an offline
      // learner where they were rather than locked out. The server refuses the
      // exam endpoint independently, so the gate does not rest on this check.
      const prevBossCleared = !bosses || prevId === null || (bosses[prevId]?.cleared ?? false);
      const unlocked = ui === 0 || (prevLessonsDone && prevBossCleared);
      prevLessonsDone = complete;
      prevId = unit.id;
      return { lessons, unitDone, complete, tint: unitColor(ui), unlocked };
    });
  }, [manifest, done, bosses]);

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
        streak={currentStreak(progress)}
        doneToday={completedTodayNow(progress)}
        dailyGoal={dailyGoal}
      />

      {/* A FlatList, not a ScrollView with .map over every unit.
          
          The whole curriculum is roughly 332 lessons. Rendering all of it
          eagerly meant every visit to Learn mounted the entire path
          synchronously before the screen could appear, and because the tab bar
          uses `router.replace` the screen unmounts on every tab switch, so that
          cost was paid every single time.

          Reported 2026-09-01: "I click the Learning tab, and now there's a delay
          before it takes you there... me clicking a button, it not registering
          immediately." Note what that says about the earlier snapshot fix: it
          removed the skeleton that had at least ACKNOWLEDGED the tap, without
          removing the work underneath it, which made the wait feel worse even
          though it got shorter. A screen that looks frozen is worse than a
          screen that looks busy.

          FlatList mounts only what is near the viewport. */}
      <FlatList
        data={manifest ? manifest.units : []}
        keyExtractor={(u) => u.id}
        contentContainerStyle={s.scroll}
        // Two units fill a phone screen; a third covers a fast flick. Beyond
        // that is work nobody has asked to see yet.
        initialNumToRender={3}
        windowSize={5}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }}
            tintColor={colors.goldDeep}
          />
        }
        ListEmptyComponent={
          <View style={s.offline}>
            <Text style={s.offlineTitle}>Can't reach your lessons</Text>
            <Text style={s.offlineBody}>
              Pull down to retry. Lessons you have already opened still work without a connection.
            </Text>
          </View>
        }
        renderItem={({ item: unit, index: ui }) => (
          <UnitBlock
            unit={unit}
            index={ui}
            meta={unitMeta[ui]}
            boss={bosses?.[unit.id] ?? null}
            passRatio={passRatio}
            next={next}
            goalKicker={profile ? GOAL_FRAMING[profile.goal] : 'NEXT UP'}
            completed={done}
            onPlayFilm={(skillId, title) => setPlaying({ skillId, title })}
          />
        )}
      />

      <Modal visible={!!playing} animationType="slide" onRequestClose={() => setPlaying(null)}>
        {playing && (
          <FilmPlayer skillId={playing.skillId} title={playing.title} onClose={() => setPlaying(null)} />
        )}
      </Modal>
    </AppTabs>
  );
}

/** True when the next lesson overall lives in this unit. */
function isNextUnit(next: { id: string } | null, lessons: Array<{ id: string }>): boolean {
  return !!next && lessons.some((l) => l.id === next.id);
}

const useS = makeStyles((colors, th) => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: space.lg, paddingBottom: space.xxl },

  unitBlock: { marginBottom: space.xl },
  banner: {
    borderRadius: radius.lg, ...curve, borderWidth: 2.5, borderColor: colors.ink,
    paddingVertical: space.md, paddingHorizontal: space.md, ...th.elevation.card,
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
  bannerFill: { height: '100%', backgroundColor: colors.surface, borderRadius: 6, ...curve },
  bannerCount: { fontFamily: font.black, fontSize: type.small, color: colors.white, ...tabular },

  trail: { marginTop: space.lg },
  nextCard: {
    marginTop: space.lg, borderWidth: 2.5, borderRadius: radius.lg, ...curve,
    backgroundColor: colors.surface, padding: space.md, ...th.elevation.card,
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
    backgroundColor: colors.surface, padding: space.lg, marginTop: space.lg,
  },
  offlineTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink },
  offlineBody: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 6, lineHeight: 20 },
}));
