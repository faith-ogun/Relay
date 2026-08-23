import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { goBack } from '../../services/nav';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Button } from '../../components/Button';
import { StepView } from '../../lesson/StepView';
import { useRun } from '../../lesson/useRun';
import type { Lesson } from '../../lesson/types';
import { getLesson } from '../../services/curriculum';
import { applyCompletion, bumpMetric, loadProgress, saveProgress } from '../../services/progress';
import { useAuth } from '../../hooks/useAuth';
import { colors, font, pressSmall, radius, space, type } from '../../theme/tokens';

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const run = useRun(lesson);
  const [canCheck, setCanCheck] = useState(false);
  const graderRef = useRef<(() => void) | null>(null);

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
    })();
  }, [run.done, run.earnedXp, saved, user?.uid, lesson, id]);

  const progress = useSharedValue(0);
  useEffect(() => { progress.value = withTiming(run.progress, { duration: 340 }); }, [run.progress, progress]);
  const barStyle = useAnimatedStyle(() => ({ width: `${Math.round(progress.value * 100)}%` }));

  const bannerY = useSharedValue(120);
  useEffect(() => {
    bannerY.value = withSpring(run.checked ? 0 : 120, { damping: 18, stiffness: 160 });
  }, [run.checked, bannerY]);
  const bannerStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bannerY.value }] }));

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

  if (run.failed) {
    return (
      <Center>
        <Text style={s.bigTitle}>Out of hearts.</Text>
        <Text style={s.body}>
          No harm done. Run it again — the questions you missed come back first.
        </Text>
        <Button label="Try again" onPress={run.retry} style={{ marginTop: space.lg }} />
        <Pressable onPress={() => goBack('/path')} style={s.quiet}><Text style={s.quietText}>Leave lesson</Text></Pressable>
      </Center>
    );
  }

  if (run.done) {
    return (
      <Center>
        <Text style={s.kickerBig}>LESSON COMPLETE</Text>
        <Text style={s.bigTitle}>+{run.earnedXp} XP</Text>
        <Text style={s.body}>
          {run.anyWrong
            ? 'Cleared every question, including the ones that came back.'
            : 'Straight through with no mistakes.'}
        </Text>
        <Button label="Back to the path" onPress={() => goBack('/path')} style={{ marginTop: space.lg }} />
      </Center>
    );
  }

  const explanation =
    (run.step as { explanation?: string } | null)?.explanation ?? '';

  return (
    <View style={s.screen}>
      {/* Top bar: leave, progress, hearts */}
      <View style={s.topBar}>
        <Pressable onPress={() => goBack('/path')} hitSlop={12} accessibilityLabel="Leave lesson" accessibilityRole="button">
          <Text style={s.close}>✕</Text>
        </Pressable>
        <View style={s.track} accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: run.total, now: Math.round(run.progress * run.total) }}>
          <Animated.View style={[s.fill, barStyle]} />
        </View>
        <View style={s.hearts} accessibilityLabel={`${run.hearts} hearts left`}>
          <Text style={s.heartText}>♥ {run.hearts}</Text>
        </View>
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

      {/* Feedback slides up over the action bar once an answer is graded. */}
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
    paddingHorizontal: space.lg, paddingTop: space.xxl * 1.1, paddingBottom: space.md,
  },
  close: { fontFamily: font.black, fontSize: type.heading, color: colors.inkSoft },
  track: {
    flex: 1, height: 14, borderRadius: 7, backgroundColor: colors.white,
    borderWidth: 2, borderColor: colors.ink, overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.gold },
  hearts: {
    borderWidth: 2, borderColor: colors.ink, borderRadius: 999,
    backgroundColor: colors.white, paddingHorizontal: 10, paddingVertical: 3,
  },
  heartText: { fontFamily: font.black, fontSize: type.small, color: colors.red },
  content: { padding: space.lg, paddingBottom: space.xxl * 2 },
  banner: {
    position: 'absolute', left: 0, right: 0, bottom: 96,
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
    borderTopWidth: 2, borderTopColor: colors.line, backgroundColor: colors.cream,
  },
  kickerBig: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.greenDeep },
  bigTitle: {
    fontFamily: font.black, fontSize: type.display, color: colors.ink,
    letterSpacing: -1, marginTop: 6, textAlign: 'center',
  },
  body: {
    fontFamily: font.semibold, fontSize: type.body, color: colors.inkSoft,
    textAlign: 'center', marginTop: space.sm, lineHeight: 22,
  },
  quiet: { marginTop: space.md, paddingVertical: space.sm },
  quietText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
});
