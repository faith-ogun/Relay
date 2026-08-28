import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  type SharedValue,
  useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import { Button } from './Button';
import type { BossResult as Result } from '../services/bosses';
import { colors, curve, font, radius, space, tabular, type } from '../theme/tokens';
import { duration } from '../theme/motion';

/**
 * The result of a unit exam.
 *
 * Deliberately NOT built like LessonComplete. That screen is a celebration and
 * has one number on it; this is a report card, and its job is to answer "what do
 * I go and fix?" So the hierarchy is score first, then a row per skill sorted
 * weakest first, and the weakest row is the loudest thing under the score.
 *
 * The bars are the point. A learner who fails at 70% needs to see instantly that
 * four skills were fine and one was not, rather than reading five percentages
 * and doing the comparison themselves.
 */

const RING = 132;
const STROKE = 14;
const R = (RING - STROKE) / 2;
const C = 2 * Math.PI * R;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const BossResult: React.FC<{
  unitTitle: string;
  result: Result;
  onDone: () => void;
  onRetry: () => void;
}> = ({ unitTitle, result, onDone, onRetry }) => {
  const { passed, correct, total, ratio, xp, firstClear, skills, passRatio, attempts } = result;
  const accent = passed ? colors.greenDeep : colors.red;

  // The arc draws itself from zero, so the score arrives rather than appearing.
  const sweep = useSharedValue(0);
  const bars = useSharedValue(0);
  const cardIn = useSharedValue(0);

  useEffect(() => {
    cardIn.value = withTiming(1, { duration: duration.smooth });
    sweep.value = withDelay(160, withTiming(ratio, { duration: 900 }));
    bars.value = withDelay(520, withTiming(1, { duration: 620 }));
  }, [ratio, sweep, bars, cardIn]);

  const ringStyle = useAnimatedStyle(() => ({ opacity: cardIn.value }));
  // useAnimatedProps, not useAnimatedStyle: strokeDashoffset is an SVG
  // ATTRIBUTE, and driving it through the style prop silently does nothing on
  // native even though it type-checks against a loose cast.
  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - sweep.value) }));

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.kicker}>{unitTitle.toUpperCase()}</Text>
        <Text style={[s.verdict, { color: accent }]}>
          {passed ? 'Unit cleared' : 'Not cleared yet'}
        </Text>

        <Animated.View style={[s.ringWrap, ringStyle]}>
          <Svg width={RING} height={RING}>
            <Circle
              cx={RING / 2} cy={RING / 2} r={R}
              stroke={colors.inkFaint} strokeWidth={STROKE} fill="none"
            />
            <AnimatedCircle
              cx={RING / 2} cy={RING / 2} r={R}
              stroke={accent} strokeWidth={STROKE} fill="none"
              strokeLinecap="round"
              strokeDasharray={`${C} ${C}`}
              // Rotated so the arc starts at twelve o'clock rather than three.
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              animatedProps={arcProps}
            />
          </Svg>
          <View style={s.ringCentre} pointerEvents="none">
            <Text style={[s.score, tabular]}>{correct}</Text>
            <Text style={s.scoreOf}>of {total}</Text>
          </View>
        </Animated.View>

        <Text style={s.line}>
          {passed
            ? firstClear
              ? `You needed ${Math.round(passRatio * 100)}%. The next unit is open.`
              : 'Already cleared, so this sitting pays no XP.'
            : `You need ${Math.round(passRatio * 100)}% to clear this unit. Bosses cost no hearts, so take it again whenever you like.`}
        </Text>

        {firstClear && xp > 0 && (
          <View style={s.xpPill}>
            <Text style={[s.xpText, tabular]}>+{xp} XP</Text>
          </View>
        )}

        <Text style={s.sectionTitle}>How each skill went</Text>
        <Text style={s.sectionNote}>
          {passed ? 'Weakest first.' : 'Weakest first. Start at the top.'}
        </Text>

        <View style={s.rows}>
          {skills.map((row, i) => (
            <SkillRow key={row.skillId} row={row} index={i} progress={bars} />
          ))}
        </View>
      </ScrollView>

      <View style={s.actions}>
        {passed ? (
          <Button label="Back to the path" onPress={onDone} />
        ) : (
          <>
            <Button label="Try again" onPress={onRetry} />
            <Button label="Back to the path" variant="secondary" onPress={onDone} />
          </>
        )}
        {attempts > 1 && (
          <Text style={s.attempts}>
            {attempts} attempt{attempts === 1 ? '' : 's'}
          </Text>
        )}
      </View>
    </View>
  );
};

const SkillRow: React.FC<{
  row: Result['skills'][number];
  index: number;
  progress: SharedValue<number>;
}> = ({ row, index, progress }) => {
  const share = row.asked ? row.correct / row.asked : 0;
  // Three bands rather than a gradient: a learner reads "fine / shaky / go back"
  // faster than they read a hue.
  const tone = share >= 0.8 ? colors.greenDeep : share >= 0.5 ? colors.goldDeep : colors.red;

  // The stagger lives in the delay, not in a per-row timing: every bar reads
  // the same shared clock, so they stay in step however many skills there are.
  const fill = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, progress.value * (1 + index * 0.18) - index * 0.18));
    return { width: `${t * share * 100}%` };
  });

  return (
    <View style={s.row}>
      <View style={s.rowHead}>
        <Text style={s.rowTitle} numberOfLines={1}>{row.title}</Text>
        <Text style={[s.rowScore, tabular, { color: tone }]}>
          {row.correct}/{row.asked}
        </Text>
      </View>
      <View style={s.bar}>
        <Animated.View style={[s.barFill, { backgroundColor: tone }, fill]} />
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: space.lg, paddingBottom: space.xl, alignItems: 'center' },

  kicker: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 3,
    color: colors.inkMute, marginTop: space.lg,
  },
  verdict: {
    fontFamily: font.black, fontSize: type.title, letterSpacing: -0.8,
    marginTop: 4, textAlign: 'center',
  },

  ringWrap: { marginTop: space.lg, alignItems: 'center', justifyContent: 'center' },
  ringCentre: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  score: { fontFamily: font.black, fontSize: 42, color: colors.ink, letterSpacing: -1.5 },
  scoreOf: { fontFamily: font.bold, fontSize: type.small, color: colors.inkMute, marginTop: -4 },

  line: {
    fontFamily: font.bold, fontSize: type.label, color: colors.inkSoft,
    textAlign: 'center', marginTop: space.md, lineHeight: 21, maxWidth: 320,
  },
  xpPill: {
    marginTop: space.md, backgroundColor: colors.goldSoft,
    borderWidth: 2, borderColor: colors.goldPlate,
    borderRadius: 999, paddingHorizontal: space.md, paddingVertical: 6,
  },
  xpText: { fontFamily: font.black, fontSize: type.body, color: colors.goldText },

  sectionTitle: {
    fontFamily: font.black, fontSize: type.heading, color: colors.ink,
    alignSelf: 'flex-start', marginTop: space.xl, letterSpacing: -0.4,
  },
  sectionNote: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkMute,
    alignSelf: 'flex-start', marginTop: 2,
  },

  rows: { alignSelf: 'stretch', marginTop: space.md, gap: space.md },
  row: {
    backgroundColor: colors.white, borderRadius: radius.md, ...curve,
    borderWidth: 2, borderColor: colors.line,
    paddingHorizontal: space.md, paddingVertical: space.sm,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  rowTitle: { flex: 1, fontFamily: font.bold, fontSize: type.label, color: colors.ink },
  rowScore: { fontFamily: font.black, fontSize: type.label },
  bar: {
    height: 8, borderRadius: 4, backgroundColor: colors.inkFaint,
    marginTop: space.sm, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4 },

  actions: { padding: space.lg, paddingTop: space.sm, gap: space.sm },
  attempts: {
    fontFamily: font.semibold, fontSize: type.meta, color: colors.inkMute,
    textAlign: 'center', marginTop: 2,
  },
});
