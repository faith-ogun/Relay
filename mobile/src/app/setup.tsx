import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button } from '../components/Button';
import {
  BENCH_NOTE, DEFAULT_PROFILE, saveProfile,
  type Bench, type DailyGoal, type Experience, type Goal, type LearnerProfile,
} from '../services/learnerProfile';
import { colors, font, pressSmall, radius, space, type } from '../theme/tokens';

/**
 * Setup: four questions between the tour and the account.
 *
 * Modelled on the pattern Duolingo and Mimo both use, because it works: a short
 * run of single-question screens with a progress bar, each answer one tap, the
 * whole thing over before it feels like a form. It also gives the person a
 * moment of investment before they are asked for an email.
 *
 * Every question here changes something they will see on Home. See
 * `learnerProfile.ts` for where each answer lands. Nothing is asked that we do
 * not act on.
 */

type Choice<T> = { value: T; label: string; sub?: string };

const EXPERIENCE: Choice<Experience>[] = [
  { value: 'none', label: 'None at all', sub: 'Never wired anything up' },
  { value: 'some', label: 'A little', sub: 'Followed a tutorial or two' },
  { value: 'lots', label: 'Quite a lot', sub: 'I build things already' },
];

const BENCH: Choice<Bench>[] = [
  { value: 'kit', label: 'An Arduino starter kit', sub: 'Board, breadboard, components' },
  { value: 'parts', label: 'Some loose components', sub: 'Bits and pieces to hand' },
  { value: 'none', label: 'Nothing yet', sub: 'Just me and my phone' },
];

const GOALS: Choice<Goal>[] = [
  { value: 'first-circuit', label: 'Build my first working circuit' },
  { value: 'habit', label: 'Build a habit, a bit each day' },
  { value: 'arduino', label: 'Get confident with Arduino' },
  { value: 'course', label: 'Keep up with a course I am taking' },
];

const DAILY: Choice<DailyGoal>[] = [
  { value: 1, label: '1 lesson', sub: 'About 5 minutes' },
  { value: 2, label: '2 lessons', sub: 'About 10 minutes' },
  { value: 3, label: '3 lessons', sub: 'About 15 minutes' },
  { value: 5, label: '5 lessons', sub: 'About 25 minutes' },
];

const STEPS = 5;   // intro + four questions

export default function Setup() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<LearnerProfile>({ ...DEFAULT_PROFILE });
  const [touched, setTouched] = useState<Set<number>>(new Set());
  const fade = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      fade.setValue(0);
      Animated.timing(fade, {
        toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
      return () => undefined;
    }, [fade]),
  );

  const advance = (to: number) => {
    Animated.timing(fade, {
      toValue: 0, duration: 130, easing: Easing.in(Easing.quad), useNativeDriver: true,
    }).start(() => {
      setStep(to);
      Animated.timing(fade, {
        toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
    });
  };

  const back = () => (step === 0 ? router.back() : advance(step - 1));

  const finish = async () => {
    await saveProfile({ ...draft, completedAt: new Date().toISOString() });
    router.replace('/sign-in');
  };

  const next = () => (step === STEPS - 1 ? void finish() : advance(step + 1));

  // The intro has nothing to answer; a question needs a tap before Continue
  // lights up, so nobody skips past a question by reflex and gets a default.
  const canContinue = step === 0 || touched.has(step);

  const pick = <T,>(key: keyof LearnerProfile, value: T) => {
    setDraft((prev) => ({ ...prev, [key]: value }) as LearnerProfile);
    setTouched((prev) => new Set(prev).add(step));
  };

  const body = useMemo(() => {
    switch (step) {
      case 0:
        return (
          <Intro />
        );
      case 1:
        return (
          <Question
            title="How much electronics have you done?"
            sub="This only sets where we suggest you start. You can go anywhere in the path."
            options={EXPERIENCE}
            selected={draft.experience}
            onSelect={(v) => pick('experience', v)}
          />
        );
      case 2:
        return (
          <Question
            title="What have you got to build with?"
            sub="The live tutor watches a real board. Lessons work either way."
            options={BENCH}
            selected={draft.bench}
            onSelect={(v) => pick('bench', v)}
            footnote={BENCH_NOTE[draft.bench]}
          />
        );
      case 3:
        return (
          <Question
            title="What are you here for?"
            options={GOALS}
            selected={draft.goal}
            onSelect={(v) => pick('goal', v)}
          />
        );
      default:
        return (
          <Question
            title="How much do you want to do a day?"
            sub="Your streak counts against this. Pick something you will actually hit."
            options={DAILY}
            selected={draft.dailyGoal}
            onSelect={(v) => pick('dailyGoal', v)}
          />
        );
    }
  }, [step, draft]);

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <Pressable onPress={back} style={s.topButton} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10}>
          <Text style={s.backGlyph}>‹</Text>
        </Pressable>
        <View style={s.progress} accessibilityRole="progressbar"
              accessibilityLabel={`Step ${step + 1} of ${STEPS}`}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <View key={i} style={[s.progressSeg, i <= step && s.progressSegOn]} />
          ))}
        </View>
        <View style={s.topButton} />
      </View>

      <Animated.View style={[s.body, { opacity: fade }]}>{body}</Animated.View>

      <View style={s.footer}>
        <Button
          label={step === STEPS - 1 ? 'Done' : 'Continue'}
          onPress={next}
          disabled={!canContinue}
        />
      </View>
    </View>
  );
}

const Intro: React.FC = () => (
  <View style={s.intro}>
    <Image
      source={require('../../assets/brand/mascot-point.png')}
      style={s.mascot}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel=""
    />
    <View style={s.bubble}>
      <Text style={s.bubbleText}>
        Four quick questions and I will set your path up.
      </Text>
    </View>
  </View>
);

interface QuestionProps<T> {
  title: string;
  sub?: string;
  options: Choice<T>[];
  selected: T;
  onSelect: (value: T) => void;
  footnote?: string;
}

function Question<T extends string | number>({
  title, sub, options, selected, onSelect, footnote,
}: QuestionProps<T>) {
  return (
    <View style={s.question}>
      <Text style={s.qTitle}>{title}</Text>
      {!!sub && <Text style={s.qSub}>{sub}</Text>}

      <View style={s.options}>
        {options.map((opt) => {
          const on = opt.value === selected;
          return (
            <Pressable
              key={String(opt.value)}
              onPress={() => onSelect(opt.value)}
              style={[s.option, on && s.optionOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <View style={[s.radio, on && s.radioOn]}>
                {on && <View style={s.radioDot} />}
              </View>
              <View style={s.optionText}>
                <Text style={[s.optionLabel, on && s.optionLabelOn]}>{opt.label}</Text>
                {!!opt.sub && <Text style={s.optionSub}>{opt.sub}</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>

      {!!footnote && <Text style={s.footnote}>{footnote}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream, paddingTop: space.xxl * 1.3 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: space.lg, paddingBottom: space.md,
  },
  topButton: { minWidth: 44, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { fontFamily: font.black, fontSize: 30, lineHeight: 32, color: colors.ink },
  progress: { flex: 1, flexDirection: 'row', gap: 5 },
  progressSeg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.line },
  progressSegOn: { backgroundColor: colors.ink },

  body: { flex: 1, paddingHorizontal: space.lg },
  footer: { paddingHorizontal: space.lg, paddingBottom: space.xl, paddingTop: space.sm },

  intro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  mascot: { width: 150, height: 150 },
  bubble: {
    borderWidth: 2.5, borderColor: colors.ink, borderRadius: radius.lg,
    backgroundColor: colors.white, paddingHorizontal: space.lg, paddingVertical: space.md,
    maxWidth: 320, ...pressSmall,
  },
  bubbleText: {
    fontFamily: font.bold, fontSize: type.body, color: colors.ink,
    textAlign: 'center', lineHeight: 24,
  },

  question: { flex: 1, paddingTop: space.md },
  qTitle: {
    fontFamily: font.black, fontSize: type.title, color: colors.ink,
    letterSpacing: -0.6, lineHeight: type.title * 1.15,
  },
  qSub: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    marginTop: space.sm, lineHeight: 20,
  },
  options: { marginTop: space.lg, gap: space.sm },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    borderWidth: 2.5, borderColor: colors.line, borderRadius: radius.md,
    backgroundColor: colors.white, paddingVertical: 14, paddingHorizontal: space.md,
  },
  optionOn: { borderColor: colors.ink, backgroundColor: colors.goldSoft, ...pressSmall },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: colors.ink },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },
  optionText: { flex: 1 },
  optionLabel: { fontFamily: font.bold, fontSize: type.body, color: colors.ink },
  optionLabelOn: { fontFamily: font.black },
  optionSub: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 2 },
  footnote: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    marginTop: space.md, lineHeight: 19,
  },
});
