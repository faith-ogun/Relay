import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { InfinityMark } from './icons';
import { formatWait, useHeartsCountdown } from '../hooks/useHearts';
import { useChildSafe } from '../hooks/useChildSafe';
import { track } from '../services/analytics';
import { colors, font, curve, tabular } from '../theme/tokens';

/**
 * The three numbers that say how you are doing, in a strip across the top.
 *
 * Compact on purpose: it is context, not content. Home used to open with a
 * greeting and three large stat cards before anything you could act on, which
 * put the least useful thing in the most valuable space.
 */
const Flame: React.FC<{ lit: boolean }> = ({ lit }) => (
  <Svg width={17} height={17} viewBox="0 0 24 24">
    <Path d="M12 2.5c3.4 3 5 5.6 5 8.2a5 5 0 0 1-10 0c0-1.3.5-2.6 1.6-4 .2 1.6.9 2.5 1.9 2.8-.4-2.6.1-5 1.5-7z"
          fill={lit ? colors.red : 'none'} stroke={lit ? colors.red : colors.inkSoft}
          strokeWidth={1.8} strokeLinejoin="round" />
  </Svg>
);

const Bolt: React.FC = () => (
  <Svg width={17} height={17} viewBox="0 0 24 24">
    <Path d="M13.5 2.5 5.5 13.5h5L9.5 21.5l8.5-11.5h-5.2z"
          fill={colors.gold} stroke={colors.ink} strokeWidth={1.6} strokeLinejoin="round" />
  </Svg>
);

const Target: React.FC<{ done: boolean }> = ({ done }) => (
  <Svg width={17} height={17} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={8.5} fill="none" stroke={done ? colors.greenDeep : colors.inkSoft} strokeWidth={1.9} />
    <Circle cx={12} cy={12} r={3.4} fill={done ? colors.greenDeep : 'none'}
            stroke={done ? colors.greenDeep : colors.inkSoft} strokeWidth={1.9} />
  </Svg>
);

const HeartGlyph: React.FC<{ full: boolean }> = ({ full }) => (
  <Svg width={17} height={17} viewBox="0 0 24 24">
    <Path d="M12 20.5S3.5 15.4 3.5 9.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.6c0 5.8-8.5 10.9-8.5 10.9z"
          fill={full ? colors.red : 'none'} stroke={full ? colors.red : colors.inkMute}
          strokeWidth={1.9} strokeLinejoin="round" />
  </Svg>
);

/**
 * Hearts in the strip are a single count, not the three glyphs the lesson shows.
 * Here they are one number among four; there they are the thing being spent, and
 * the difference in treatment is the difference between context and content.
 */
const HeartsPill: React.FC = () => {
  const { hearts, unlimited, loaded, nextIn, empty } = useHeartsCountdown();
  // A minor cannot self-purchase (#96): they get the count, not a doorway to
  // a paywall.
  const { childSafe } = useChildSafe();
  if (!loaded) return <View style={[s.pill, s.pillIdle]} />;

  if (unlimited) {
    return (
      <View style={[s.pill, s.pillGold]} accessibilityLabel="Unlimited hearts">
        <HeartGlyph full />
        <InfinityMark size={16} color={colors.goldText} />
      </View>
    );
  }

  const label = empty ? `Out of hearts, next in ${formatWait(nextIn)}` : `${hearts ?? 0} hearts`;
  const body = (
    <>
      <HeartGlyph full={!empty} />
      <Text
        style={[s.value, empty ? s.valueWait : { color: colors.red }]}
        maxFontSizeMultiplier={1.2}
        numberOfLines={1}
      >
        {empty ? formatWait(nextIn) || '--' : hearts ?? 0}
      </Text>
    </>
  );

  if (childSafe) {
    return (
      <View style={[s.pill, empty && s.pillEmpty]} accessibilityLabel={label}>{body}</View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => { track('hearts_paywall_view'); router.push('/plans'); }}
      style={({ pressed }) => [s.pill, empty && s.pillEmpty, pressed && s.pillPressed]}
    >
      {body}
    </Pressable>
  );
};

export const StatStrip: React.FC<{
  xp: number;
  streak: number;
  doneToday: number;
  dailyGoal: number;
}> = ({ xp, streak, doneToday, dailyGoal }) => {
  const met = doneToday >= dailyGoal;
  return (
    <View style={s.strip}>
      <View style={s.pill}><Bolt /><Text style={s.value} maxFontSizeMultiplier={1.2}>{xp}</Text></View>
      <View style={s.pill}>
        <Flame lit={streak > 0} />
        <Text style={[s.value, streak > 0 && { color: colors.red }]} maxFontSizeMultiplier={1.2}>{streak}</Text>
      </View>
      <HeartsPill />
      <View style={[s.pill, met && s.pillDone]}>
        <Target done={met} />
        <Text style={[s.value, met && { color: colors.greenDeep }]} maxFontSizeMultiplier={1.2}>
          {Math.min(doneToday, dailyGoal)}/{dailyGoal}
        </Text>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  strip: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 10 },
  pill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 2, borderColor: colors.line, borderRadius: 999, ...curve,
    backgroundColor: colors.white, paddingVertical: 7,
  },
  pillDone: { borderColor: colors.greenDeep, backgroundColor: '#eef7e0' },
  pillGold: { borderColor: colors.goldPlate, backgroundColor: colors.goldSoft },
  pillEmpty: { borderColor: colors.inkFaint, backgroundColor: colors.inkFaint },
  pillPressed: { transform: [{ scale: 0.97 }] },
  // Holds the slot while the first hearts fetch lands, so the strip does not
  // reflow under the reader's eye a beat after the screen appears.
  pillIdle: { borderColor: colors.line, backgroundColor: colors.white },
  value: { ...tabular, fontFamily: font.black, fontSize: 14, color: colors.ink },
  valueWait: { fontSize: 12, color: colors.inkSoft, letterSpacing: 0.2 },
});
