import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Close } from '../../components/icons';
import { goBack } from '../../services/nav';
import { LessonComplete } from '../../components/LessonComplete';
import { HeartsMeter } from '../../components/HeartsMeter';
import { OutOfHearts } from '../../components/OutOfHearts';
import { useHearts } from '../../hooks/useHearts';
import { track } from '../../services/analytics';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Button } from '../../components/Button';
import { StepView } from '../../lesson/StepView';
import { useRun } from '../../lesson/useRun';
import type { Lesson } from '../../lesson/types';
import { getLesson, getManifest } from '../../services/curriculum';
import { authoredLessonAlreadyCleared, corpusLessonIds } from '../../services/achievementRules';
import { applyCompletion, bumpMetric, loadProgress, saveProgress, type Progress } from '../../services/progress';
import { LEVEL_META, nextAttemptLevel } from '../../lesson/levels';
import { useAuth } from '../../hooks/useAuth';
import { font, space, type, curve } from '../../theme/tokens';
import { duration } from '../../theme/motion';
import { makeStyles, useColors } from '../../theme/theme';

export default function LessonScreen() {
  const colors = useColors();
  const s = useS();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  /**
   * Which level this run is played at, and the level already on record.
   *
   * Read BEFORE the run, because afterwards every lesson looks completed, and
   * because the level decides which steps the run is even made of. Held at null
   * until it is known: a run that started at Bronze and then learned it was a
   * Silver attempt would rebuild itself and throw away the learner's answers.
   *
   * `held` is what tells the completion screen whether this run pays anything.
   * A learner replaying Gold earns no XP, and the screen used to promise some.
   */
  const [attempt, setAttempt] = useState<{ level: number; held: number } | null>(null);
  // The record this run opened against. Kept so the completion screen can show
  // the streak the moment the run ends rather than after two round trips; see
  // the save effect below.
  const openedAgainst = useRef<Progress | null>(null);
  useEffect(() => {
    if (authLoading) return;
    let alive = true;
    if (!user?.uid) {
      // Signed out: nothing is on record, so the run is a Bronze pass.
      setAttempt({ level: 1, held: 0 });
      return;
    }
    void loadProgress(user.uid).then((p) => {
      if (!alive) return;
      openedAgainst.current = p;
      const held = p.lessonLevels[String(id)] ?? 0;
      setAttempt({ level: nextAttemptLevel(held), held });
    });
    return () => { alive = false; };
  }, [authLoading, user?.uid, id]);

  const hearts = useHearts();

  // Distinguishes the two ways this screen shows the wall: refused entry
  // (already empty when they arrived) versus ran out mid-run. They need
  // different copy and a different way forward.
  const ranOut = useRef(false);
  // Bumped on every retry so a fresh run cannot reuse a spent idempotency key
  // and get its first miss refunded.
  const [runId, setRunId] = useState(() => Date.now());

  const onWrong = useCallback(async (missOrdinal: number) => {
    track('heart_lost', { lessonId: String(id) });
    const next = await hearts.spend(`${id}:${runId}:${missOrdinal}`);
    if (next && !next.unlimited && (next.hearts ?? 1) <= 0) ranOut.current = true;
  }, [hearts, id, runId]);

  const run = useRun(lesson, attempt?.level ?? 1, onWrong);
  const [canCheck, setCanCheck] = useState(false);
  // A drawing step and a scroll view both want vertical drags. While a stroke
  // is live the scroller stands down, so an upward line stays a line.
  const [drawing, setDrawing] = useState(false);
  const graderRef = useRef<(() => void) | null>(null);

  // Latched, so the screen survives the heart it is waiting for arriving. Left
  // unlatched it would vanish the instant the balance ticked up, and the moment
  // the learner is waiting for would be the one moment they never see.
  const [wall, setWall] = useState(false);
  useEffect(() => { if (hearts.empty) setWall(true); }, [hearts.empty]);

  const leaveWall = useCallback(() => goBack('/path'), []);
  const resumeFromWall = useCallback(() => {
    setWall(false);
    if (ranOut.current) {
      ranOut.current = false;
      setRunId(Date.now());
      run.retry();
    }
  }, [run]);

  const registerGrader = useCallback((g: (() => void) | null) => { graderRef.current = g; }, []);

  // Drawings the grader accepted during this run, credited once at completion
  // so a retry cannot inflate the count mid-run.
  const drawingsRight = useRef(0);
  const lastGraded = useRef<string | null>(null);
  useEffect(() => {
    if (!run.checked || run.correct !== true || !run.step) return;
    const key = `${run.position}:${run.step.type}`;
    if (lastGraded.current === key) return;      // effect can re-fire on re-render
    lastGraded.current = key;
    if (run.step.type === 'draw_circuit' || run.step.type === 'draw_fix') {
      drawingsRight.current += 1;
    }
  }, [run.checked, run.correct, run.step, run.position]);

  useEffect(() => {
    let alive = true;
    getLesson(String(id))
      .then((c) => alive && setLesson((c?.lesson as Lesson) ?? null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  // Persist once, when the run completes. Guarded so a re-render cannot
  // double-award XP.
  //
  // What the completion screen reports back. Set twice: once from the shared
  // rule the instant the run ends, so the reward lands on a real number, and
  // again from the SAVED record once it is written, which is what the learner
  // keeps. Both readings come from the same rule, so the second only ever
  // corrects for something that changed on another device mid-run.
  const [outcome, setOutcome] = useState<{ streak: number; extended: boolean } | null>(null);

  useEffect(() => {
    if (!run.done || saved || !user?.uid || !lesson) return;
    setSaved(true);
    // What the streak WILL be, from the record this run opened against and the
    // same shared rule the save is about to apply. The authoritative value
    // replaces it below; without it the reward screen renders a streak of 0 for
    // as long as two round trips take, which on a slow connection is seconds of
    // the celebration showing a number that is never true.
    const opened = openedAgainst.current;
    if (opened) {
      const projected = applyCompletion(opened, String(id), run.earnedXp, run.level);
      setOutcome({ streak: projected.streak, extended: projected.streak > opened.streak });
    }
    void (async () => {
      const current = await loadProgress(user.uid);
      // Read BEFORE the completion is applied: afterwards every lesson looks
      // completed. This is the gate on the once-per-lesson counters.
      //
      // `perfect` and `drawings` used to be bumped on EVERY clean run, replays
      // included, while `builds` counts distinct lesson ids. So "Flawless, 25
      // flawless builds" was earned by replaying one easy lesson twenty five
      // times. A replay is real practice and still counts toward the streak and
      // its level, but it is not a twenty sixth build. The web LessonRunner
      // gates on exactly the same condition, so the two surfaces stay in step.
      // The AUTHORED lesson, not this session. One authored lesson can ship as
      // two parts, so asking about the session id paid `perfect` and `drawings`
      // twice for the same work while `builds` counted it once. The manifest is
      // already cached by the time a lesson is running; if it somehow is not,
      // fall back to the session question, which is the old behaviour and errs
      // toward paying rather than withholding.
      const manifest = await getManifest();
      const alreadyCompleted = manifest
        ? authoredLessonAlreadyCleared(String(id), current.lessonLevels, corpusLessonIds(manifest.units))
        : (current.lessonLevels[String(id)] ?? 0) >= 1;
      // The level reached is recorded, not assumed. This call used to leave the
      // argument off and take the default of 1, so a Gold round on the phone was
      // written down as Bronze, and a Gold earned in the browser was overwritten
      // by the next save from here.
      let next = applyCompletion(current, String(id), run.earnedXp, run.level);
      if (!alreadyCompleted) {
        // A run cleared with no wrong answer is what the "perfect" achievements count.
        // A run holding a step the grader could not reach is not a proven
        // flawless run, so it does not pay `perfect` either.
        if (!run.anyWrong && !run.anyUnassessed) next = bumpMetric(next, 'perfect');
        if (drawingsRight.current > 0) next = bumpMetric(next, 'drawings', drawingsRight.current);
      }
      await saveProgress(user.uid, next);
      setOutcome({ streak: next.streak, extended: next.streak > current.streak });
      track('lesson_complete', {
        lessonId: String(id),
        xp: run.earnedXp,
        // What actually went on the ledger. A replay at or below the level held
        // pays nothing, and reporting the level's price as earned XP would put
        // XP in the funnel that no learner ever received.
        awarded: next.xp - current.xp,
        level: run.level,
        perfect: !run.anyWrong,
        streak: next.streak,
      });
    })();
  }, [run.done, run.earnedXp, run.level, run.anyWrong, saved, user?.uid, lesson, id]);

  const progress = useSharedValue(0);
  useEffect(() => { progress.value = withTiming(run.progress, { duration: 340 }); }, [run.progress, progress]);
  const trackWidth = useSharedValue(0);
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -(1 - progress.value) * trackWidth.value }],
  }));

  // Slides up, does not bounce. A spring with overshoot made the verdict wobble
  // on arrival, which reads as uncertainty about the answer — and any overshoot
  // on a panel anchored to the bottom pushes its top line out of view.
  const bannerY = useSharedValue(40);
  useEffect(() => {
    bannerY.value = run.checked
      ? withTiming(0, { duration: duration.snappy })
      : withTiming(40, { duration: duration.instant });
  }, [run.checked, bannerY]);
  const bannerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bannerY.value }],
    opacity: 1 - bannerY.value / 40,
  }));

  // The level has to be settled before a single step is shown: it decides which
  // steps the round is made of, so resolving it late would rebuild the round
  // under the learner.
  if (loading || !attempt) {
    return (
      <Center>
        <ActivityIndicator color={colors.goldDeep} accessibilityLabel="Loading lesson" />
      </Center>
    );
  }

  const levelMeta = LEVEL_META[Math.min(3, Math.max(1, run.level)) as 1 | 2 | 3];
  // A run pays only when it reaches a level above the one on record, which is
  // the same condition services/completion.ts applies to the record itself.
  const paysXp = run.level > attempt.held;

  if (!lesson || run.total === 0) {
    return (
      <Center>
        <Text style={s.bigTitle}>Couldn't load this lesson</Text>
        <Text style={s.body}>It may need a connection the first time you open it.</Text>
        <Button label="Go back" onPress={() => goBack('/path')} style={{ marginTop: space.lg }} />
      </Center>
    );
  }

  // Held back until the feedback banner has been acknowledged, so the last
  // wrong answer is explained before the wall replaces the screen.
  if (wall && !run.checked) {
    return (
      <OutOfHearts
        onResume={resumeFromWall}
        resumeLabel={ranOut.current ? 'Try again' : 'Start lesson'}
        onLeave={leaveWall}
        leaveLabel={ranOut.current ? 'Leave lesson' : 'Back to the path'}
      />
    );
  }

  if (run.done) {
    return (
      <LessonComplete
        earnedXp={run.earnedXp}
        paysXp={paysXp}
        level={run.level}
        perfect={!run.anyWrong}
        streak={outcome?.streak ?? 0}
        streakExtended={outcome?.extended ?? false}
        onDone={() => goBack('/home')}
      />
    );
  }

  const explanation =
    (run.step as { explanation?: string } | null)?.explanation ?? '';

  return (
    <View style={s.screen}>
      {/* Top bar: leave, progress, the medal being played for, hearts */}
      <View style={s.topBar}>
        <Pressable onPress={() => goBack('/path')} hitSlop={12} accessibilityLabel="Leave lesson" accessibilityRole="button">
          <Close size={22} />
        </Pressable>
        <View
          style={s.track}
          onLayout={(e) => { trackWidth.value = e.nativeEvent.layout.width; }}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: run.total, now: Math.round(run.progress * run.total) }}
        >
          <Animated.View style={[s.fill, barStyle]} />
        </View>
        {run.level > 1 && (
          <View
            style={[s.levelChip, { backgroundColor: levelMeta.soft, borderColor: levelMeta.color }]}
            accessibilityRole="text"
            accessibilityLabel={`${levelMeta.name} round`}
          >
            <Text style={s.levelChipText} maxFontSizeMultiplier={1.2}>{levelMeta.name.toUpperCase()}</Text>
          </View>
        )}
        <HeartsMeter onPress={() => { track('hearts_paywall_view'); router.push('/plans'); }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!drawing}
      >
        {run.step && (
          <StepView
            step={run.step}
            checked={run.checked}
            correct={run.correct}
            onUnassessed={run.markUnassessed}
            onSubmit={run.submit}
            onCanCheck={setCanCheck}
            registerGrader={registerGrader}
            onDrawingChange={setDrawing}
          />
        )}
      </ScrollView>

      {/* Feedback and the action sit in ONE bottom stack, in flow.
          The banner used to be absolutely positioned at bottom:96 while the
          action bar measures ~112, so the bar covered its first line and
          "Correct" was cut in half — worse with an explanation under it. In flow
          the bar cannot overlap it at any text size. */}
      <View style={s.bottom}>
        {run.checked && (
          <Animated.View style={[s.banner, run.correct ? s.bannerGood : s.bannerBad, bannerStyle]}>
            <Text style={s.bannerTitle}>{run.correct ? 'Correct' : 'Not quite'}</Text>
            {!!explanation && <Text style={s.bannerBody}>{explanation}</Text>}
          </Animated.View>
        )}

        <View style={s.actions}>
          <Button
            label={run.checked ? 'Continue' : 'Check'}
            disabled={!run.checked && !canCheck}
            onPress={() => {
              if (run.checked) return run.advance();
              graderRef.current?.();
            }}
          />
        </View>
      </View>
    </View>
  );
}

const Center: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const s = useS();
  return (
    <View style={s.center}>{children}</View>
  );
};

const useS = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.cream },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.cream, padding: space.xl,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md,
  },
  close: { fontFamily: font.black, fontSize: type.heading, color: colors.inkSoft },
  track: {
    flex: 1, height: 14, borderRadius: 7, ...curve, backgroundColor: colors.surface,
    borderWidth: 2, borderColor: colors.ink, overflow: 'hidden',
  },
  fill: { height: '100%', width: '100%', backgroundColor: colors.gold },
  // Only shown above Bronze, so it never competes with the progress track on a
  // first pass. Border in the medal's colour, fill in its pale tint.
  levelChip: { borderWidth: 2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  levelChipText: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 1, color: colors.ink,
  },
  content: { padding: space.lg, paddingBottom: space.xxl * 2 },
  bottom: { backgroundColor: colors.cream },
  banner: {
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderTopWidth: 2.5,
  },
  bannerGood: { backgroundColor: colors.greenSoft, borderTopColor: colors.greenDeep },
  bannerBad: { backgroundColor: colors.redSoft, borderTopColor: colors.red },
  bannerTitle: { fontFamily: font.black, fontSize: type.body, color: colors.ink },
  bannerBody: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    marginTop: 4, lineHeight: 20,
  },
  actions: {
    padding: space.lg, paddingBottom: space.xl,
    backgroundColor: colors.cream,
  },
  kickerBig: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.greenDeep },
  bigTitle: {
    fontFamily: font.black, fontSize: type.display, color: colors.ink,
    letterSpacing: -1, marginTop: 6, textAlign: 'center',
  },
  body: {
    fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft,
    textAlign: 'center', marginTop: space.sm, lineHeight: 22,
  },
  quiet: { marginTop: space.md, paddingVertical: space.sm },
  quietText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
}));
