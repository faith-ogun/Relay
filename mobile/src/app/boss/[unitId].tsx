import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Close } from '../../components/icons';
import { Button } from '../../components/Button';
import { BossResult } from '../../components/BossResult';
import { StepView } from '../../lesson/StepView';
import { useRun } from '../../lesson/useRun';
import type { Lesson, LessonStep } from '../../lesson/types';
import { goBack } from '../../services/nav';
import { track } from '../../services/analytics';
import { fetchBossExam, submitBossResult, type BossExam, type BossResult as Result } from '../../services/bosses';
import { loadProgress, saveProgress } from '../../services/progress';
import { useAuth } from '../../hooks/useAuth';
import { curve, font, space, type } from '../../theme/tokens';
import { duration } from '../../theme/motion';
import { makeStyles, useColors } from '../../theme/theme';

/**
 * The unit exam.
 *
 * Runs through the SAME `useRun` as a lesson, which is the point: a boss should
 * feel like the thing it is testing, not like a different app. Three things
 * differ, and only three.
 *
 *   1. **No hearts.** `useRun` reports a miss and leaves the cost to its caller
 *      (see the comment on `onWrong` there); the lesson screen spends a heart,
 *      and this screen deliberately does not. A gate that also charges a life
 *      would punish exactly the behaviour it is asking for, which is to sit it
 *      again until it is passed.
 *
 *   2. **The steps come composed.** The server drew them across every skill in
 *      the unit and handed back the seed that produced them. They are played in
 *      the order given, which is why the exam is capped under the run loop's
 *      pool-sampling threshold: see MAX_QUESTIONS in bosses.py.
 *
 *   3. **First try is what counts.** The run still requeues a missed step so it
 *      is taught, but a step that had to come round twice is not a step the
 *      learner knew, and it is reported as missed.
 */

/** The composed steps, carrying the index the server will grade them against. */
type ExamStep = LessonStep & { bossIndex: number; skillTitle?: string };

export default function BossScreen() {
  const colors = useColors();
  const s = useS();
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  const { user } = useAuth();

  const [exam, setExam] = useState<BossExam | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [canCheck, setCanCheck] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const graderRef = useRef<(() => void) | null>(null);

  // Which composed indices were NOT answered right first time. A set, so a step
  // that comes round twice and is missed twice is still one missed question.
  const missed = useRef<Set<number>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    setFailure(null);
    setResult(null);
    missed.current = new Set();
    let alive = true;
    void fetchBossExam(String(unitId)).then((r) => {
      if (!alive) return;
      if (r.ok) {
        setExam(r.data);
        track('boss_start', { unitId: r.data.unitId, questions: r.data.questions });
      } else {
        setExam(null);
        setFailure(
          r.reason === 'offline' || r.reason === 'timeout'
            ? "A boss is put together fresh each time, so this one needs a connection."
            : r.reason === 'unauthenticated'
              ? 'Sign in again to sit this one.'
              : "This boss is not open yet. Finish the unit's lessons first.",
        );
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, [unitId]);

  useEffect(() => load(), [load]);

  // A Lesson shaped from the exam, so the run loop needs no special case. The
  // index is stamped on every step BEFORE the run sees it, because the run
  // requeues and reorders and position is therefore not identity.
  const lesson: Lesson | null = React.useMemo(() => {
    if (!exam) return null;
    const steps = exam.steps.map((s, i) => ({ ...(s as object), bossIndex: i })) as ExamStep[];
    return { steps, xpReward: exam.xp } as unknown as Lesson;
  }, [exam]);

  // Level 1: play the steps exactly as composed. Anything higher would hand them
  // back to the sampler, and the server would then grade answers to questions
  // that were never asked.
  const run = useRun(lesson, 1);

  const barWidth = useSharedValue(0);
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: withTiming(barWidth.value, { duration: duration.fill }) }],
  }));
  useEffect(() => { barWidth.value = run.progress; }, [run.progress, barWidth]);

  // Record a miss against the step that was actually on screen. `correct !== true`
  // rather than `correct === false` on purpose: a step the grader could not be
  // reached for was not proven either, and counting it as known would hand out
  // a pass for a question nobody answered.
  const lastSeen = useRef<string | null>(null);
  useEffect(() => {
    if (!run.checked || !run.step) return;
    const step = run.step as ExamStep;
    const key = `${run.position}:${step.bossIndex}`;
    if (lastSeen.current === key) return;
    lastSeen.current = key;
    if (run.correct !== true) missed.current.add(step.bossIndex);
  }, [run.checked, run.correct, run.step, run.position]);

  // Submit once, when the run ends.
  const sent = useRef(false);
  useEffect(() => {
    if (!run.done || sent.current || !exam) return;
    sent.current = true;
    setSubmitting(true);
    const firstTryCorrect: number[] = [];
    for (let i = 0; i < exam.questions; i++) if (!missed.current.has(i)) firstTryCorrect.push(i);

    void (async () => {
      const r = await submitBossResult(exam.unitId, exam.seed, firstTryCorrect);
      if (r.ok) {
        setResult(r.data);
        track('boss_result', {
          unitId: exam.unitId,
          passed: r.data.passed,
          ratio: Math.round(r.data.ratio * 100),
        });
        // XP the server granted goes on the same ledger a lesson writes to, so
        // the profile total is one number rather than two that disagree.
        //
        // Read fresh rather than folded into a value held from before the exam:
        // a run takes minutes, and another device may have written in between.
        // The server is what makes this safe to add without double-counting, as
        // `xp` is non-zero only on the sitting that actually cleared the unit.
        if (r.data.xp > 0 && user?.uid) {
          const current = await loadProgress(user.uid);
          await saveProgress(user.uid, { ...current, xp: (current.xp ?? 0) + r.data.xp });
        }
      } else {
        setFailure(
          r.reason === 'offline' || r.reason === 'timeout'
            ? 'Your answers could not be sent. Check your connection and sit it again.'
            : 'Your answers could not be scored just now.',
        );
      }
      setSubmitting(false);
    })();
  }, [run.done, exam, user?.uid]);

  const registerGrader = useCallback((g: (() => void) | null) => { graderRef.current = g; }, []);

  const retry = useCallback(() => {
    sent.current = false;
    run.retry();
    load();
  }, [run, load]);

  if (loading || submitting) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.ink} />
        <Text style={s.body}>{submitting ? 'Marking your paper' : 'Setting the questions'}</Text>
      </View>
    );
  }

  if (result) {
    return (
      <BossResult
        unitTitle={exam?.title ?? ''}
        result={result}
        onDone={() => goBack('/home')}
        onRetry={retry}
      />
    );
  }

  if (failure || !lesson || run.total === 0) {
    return (
      <View style={s.center}>
        <Text style={s.bigTitle}>Not right now</Text>
        <Text style={s.body}>{failure ?? 'This boss could not be put together.'}</Text>
        <Button label="Back to the path" onPress={() => goBack('/home')} style={{ marginTop: space.lg }} />
      </View>
    );
  }

  const explanation = (run.step as { explanation?: string } | null)?.explanation ?? '';
  const skill = (run.step as ExamStep | null)?.skillTitle;

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <Pressable onPress={() => goBack('/home')} hitSlop={12} accessibilityLabel="Leave boss" accessibilityRole="button">
          <Close size={22} />
        </Pressable>
        <View
          style={s.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: run.total, now: Math.round(run.progress * run.total) }}
        >
          <Animated.View style={[s.fill, barStyle]} />
        </View>
        {/* No hearts meter. There is nothing to spend, and showing a resource
            this screen cannot consume would read as a threat that is not real. */}
        <View style={s.bossChip}>
          <Text style={s.bossChipText}>BOSS</Text>
        </View>
      </View>

      {!!skill && <Text style={s.skillHint} numberOfLines={1}>{skill}</Text>}

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" scrollEnabled={!drawing}>
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

      <View style={s.bottom}>
        {run.checked && (
          <View style={[s.banner, run.correct ? s.bannerGood : s.bannerBad]}>
            <Text style={s.bannerTitle}>{run.correct ? 'Correct' : 'Not quite'}</Text>
            {!!explanation && <Text style={s.bannerBody}>{explanation}</Text>}
          </View>
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

const useS = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.cream },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.cream, padding: space.xl, gap: space.sm,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md,
  },
  track: {
    flex: 1, height: 14, borderRadius: 7, ...curve, backgroundColor: colors.surface,
    borderWidth: 2, borderColor: colors.ink, overflow: 'hidden',
  },
  fill: { height: '100%', width: '100%', backgroundColor: colors.red, transformOrigin: 'left' },
  // Red rather than gold, and lettered rather than iconed: the one place in the
  // app where the bar is not the usual colour, so the screen announces itself.
  bossChip: {
    borderWidth: 2, borderColor: colors.red, backgroundColor: colors.redSoft,
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
  },
  bossChipText: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 1.5, color: colors.ink },
  skillHint: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 2,
    color: colors.inkMute, paddingHorizontal: space.lg, marginBottom: space.xs,
    textTransform: 'uppercase',
  },
  content: { padding: space.lg, paddingBottom: space.xxl * 2 },
  bottom: { backgroundColor: colors.cream },
  banner: { paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 2.5 },
  bannerGood: { backgroundColor: colors.greenSoft, borderTopColor: colors.greenDeep },
  bannerBad: { backgroundColor: colors.redSoft, borderTopColor: colors.red },
  bannerTitle: { fontFamily: font.black, fontSize: type.body, color: colors.ink },
  bannerBody: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    marginTop: 4, lineHeight: 20,
  },
  actions: { padding: space.lg, paddingBottom: space.xl, backgroundColor: colors.cream },
  bigTitle: {
    fontFamily: font.black, fontSize: type.title, color: colors.ink,
    letterSpacing: -1, textAlign: 'center',
  },
  body: {
    fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft,
    textAlign: 'center', marginTop: space.sm, lineHeight: 22, maxWidth: 320,
  },
}));
