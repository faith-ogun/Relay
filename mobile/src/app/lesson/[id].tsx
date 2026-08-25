import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { getLesson } from '../../services/curriculum';
import { applyCompletion, bumpMetric, loadProgress, saveProgress } from '../../services/progress';
import { useAuth } from '../../hooks/useAuth';
import { colors, font, pressSmall, radius, space, type, curve } from '../../theme/tokens';
import { duration } from '../../theme/motion';

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

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

  const run = useRun(lesson, onWrong);
  const [canCheck, setCanCheck] = useState(false);
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
  // What the completion screen reports back. Read from the SAVED progress
  // rather than recomputed, so the streak shown is the streak that was written.
  const [outcome, setOutcome] = useState<{ streak: number; extended: boolean } | null>(null);

  useEffect(() => {
    if (!run.done || saved || !user?.uid || !lesson) return;
    setSaved(true);
    void (async () => {
      const current = await loadProgress(user.uid);
      let next = applyCompletion(current, String(id), run.earnedXp);
      // A run cleared with no wrong answer is what the "perfect" achievements count.
      if (!run.anyWrong) next = bumpMetric(next, 'perfect');
      if (drawingsRight.current > 0) next = bumpMetric(next, 'drawings', drawingsRight.current);
      await saveProgress(user.uid, next);
      setOutcome({ streak: next.streak, extended: next.streak > current.streak });
      track('lesson_complete', {
        lessonId: String(id),
        xp: run.earnedXp,
        perfect: !run.anyWrong,
        streak: next.streak,
      });
    })();
  }, [run.done, run.earnedXp, saved, user?.uid, lesson, id]);

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

  if (loading) return <Center><ActivityIndicator color={colors.goldDeep} /></Center>;

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
      {/* Top bar: leave, progress, hearts */}
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
        <HeartsMeter onPress={() => { track('hearts_paywall_view'); router.push('/plans'); }} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {run.step && (
          <StepView
            step={run.step}
            checked={run.checked}
            correct={run.correct}
            onSubmit={run.submit}
            onCanCheck={setCanCheck}
            registerGrader={registerGrader}
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

const Center: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={s.center}>{children}</View>
);

const s = StyleSheet.create({
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
    flex: 1, height: 14, borderRadius: 7, ...curve, backgroundColor: colors.white,
    borderWidth: 2, borderColor: colors.ink, overflow: 'hidden',
  },
  fill: { height: '100%', width: '100%', backgroundColor: colors.gold },
  content: { padding: space.lg, paddingBottom: space.xxl * 2 },
  bottom: { backgroundColor: colors.cream },
  banner: {
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderTopWidth: 2.5,
  },
  bannerGood: { backgroundColor: '#eef7e0', borderTopColor: colors.greenDeep },
  bannerBad: { backgroundColor: '#fdece8', borderTopColor: colors.red },
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
});
