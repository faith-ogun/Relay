import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { InfinityMark } from './icons';
import { formatWait, useHeartsCountdown } from '../hooks/useHearts';
import { useChildSafe } from '../hooks/useChildSafe';
import { track } from '../services/analytics';
import { colors, font, curve, radius, tabular } from '../theme/tokens';
import { elevation } from '../theme/elevation';

/**
 * The three numbers that say how you are doing, in a strip across the top.
 *
 * Compact on purpose: it is context, not content. Home used to open with a
 * greeting and three large stat cards before anything you could act on, which
 * put the least useful thing in the most valuable space.
 */
/**
 * The stat icons are painted artwork, not line glyphs.
 *
 * They used to be four small SVG paths drawn here: a flame, a bolt, two
 * circles, a heart. Correct, generic, and indistinguishable from any icon pack
 * you could install. Faith's words: "they look like the generic, if you got a
 * package online and you got those icons". The set that replaced them carries
 * the electronics idea into every one, which is the thing a generic pack cannot
 * do: the XP coin is a hexagon with a resistor across its base, the streak flame
 * has a resistor for a mouth, the heart is lit by an LED, and the goal ring is a
 * circuit node with a check at its centre.
 *
 * Drawn at 22pt rather than the 17pt the line glyphs used. Painted art needs the
 * extra points to read: at 17 the resistor bands on the XP coin turn to mush.
 */
const STAT_ART = {
  xp: require('../../assets/stats/xp.png'),
  streak: require('../../assets/stats/streak.png'),
  hearts: require('../../assets/stats/hearts.png'),
  goal: require('../../assets/stats/goal.png'),
} as const;

const ICON = 22;

const StatIcon: React.FC<{
  name: keyof typeof STAT_ART;
  /** Drawn flat when the stat is at zero, so the strip still reads at a glance. */
  dim?: boolean;
}> = ({ name, dim }) => (
  <Image
    source={STAT_ART[name]}
    style={[s.icon, dim && s.iconDim]}
    resizeMode="contain"
    accessibilityIgnoresInvertColors
  />
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
  // Nothing, not a blank pill. If the hearts service is unreachable this state
  // is permanent, and an empty pill in the strip would read as broken for the
  // whole session; the other three simply take the space.
  if (!loaded) return null;

  if (unlimited) {
    return (
      <View style={[s.pill, s.pillGold]} accessibilityLabel="Unlimited hearts">
        <StatIcon name="hearts" />
        <View style={s.stack}>
          <InfinityMark size={17} color={colors.goldText} />
          <Text style={s.caption} maxFontSizeMultiplier={1.1}>HEARTS</Text>
        </View>
      </View>
    );
  }

  const label = empty ? `Out of hearts, next in ${formatWait(nextIn)}` : `${hearts ?? 0} hearts`;
  const body = (
    <>
      <StatIcon name="hearts" dim={empty} />
      <View style={s.stack}>
      <Text
        style={[s.value, empty ? s.valueWait : { color: colors.red }]}
        maxFontSizeMultiplier={1.2}
        numberOfLines={1}
      >
        {empty ? formatWait(nextIn) || '--' : hearts ?? 0}
      </Text>
      <Text style={s.caption} maxFontSizeMultiplier={1.1}>{empty ? 'BACK IN' : 'HEARTS'}</Text>
      </View>
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
      <View style={s.pill}>
        <StatIcon name="xp" />
        <View style={s.stack}>
          <Text style={s.value} maxFontSizeMultiplier={1.15}>{xp}</Text>
          <Text style={s.caption} maxFontSizeMultiplier={1.1}>XP</Text>
        </View>
      </View>
      <View style={s.pill}>
        <StatIcon name="streak" dim={streak === 0} />
        <View style={s.stack}>
          <Text style={[s.value, streak > 0 && { color: colors.red }]} maxFontSizeMultiplier={1.15}>{streak}</Text>
          <Text style={s.caption} maxFontSizeMultiplier={1.1}>{streak === 1 ? 'DAY' : 'DAYS'}</Text>
        </View>
      </View>
      <HeartsPill />
      <View style={[s.pill, met && s.pillDone]}>
        <StatIcon name="goal" dim={!met} />
        <View style={s.stack}>
          <Text style={[s.value, met && { color: colors.greenDeep }]} maxFontSizeMultiplier={1.15}>
            {Math.min(doneToday, dailyGoal)}/{dailyGoal}
          </Text>
          <Text style={s.caption} maxFontSizeMultiplier={1.1}>GOAL</Text>
        </View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  strip: { flexDirection: 'row', gap: 7, paddingHorizontal: 16, paddingBottom: 12 },
  pill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 2, borderColor: colors.line, borderRadius: radius.md, ...curve,
    backgroundColor: colors.white, paddingVertical: 8, paddingHorizontal: 4,
    ...elevation.card,
  },
  icon: { width: ICON, height: ICON },
  // Not greyscale: the art is the brand. Flattened enough that a spent
  // stat reads as spent without becoming a different picture.
  iconDim: { opacity: 0.38 },
  stack: { minWidth: 0 },
  caption: {
    fontFamily: font.extrabold, fontSize: 9, letterSpacing: 0.6,
    color: colors.inkMute, textTransform: 'uppercase', marginTop: -1,
  },
  pillDone: { borderColor: colors.greenDeep, backgroundColor: '#eef7e0' },
  pillGold: { borderColor: colors.goldPlate, backgroundColor: colors.goldSoft },
  pillEmpty: { borderColor: colors.inkFaint, backgroundColor: colors.inkFaint },
  pillPressed: { transform: [{ scale: 0.97 }] },
  value: { ...tabular, fontFamily: font.black, fontSize: 14, color: colors.ink },
  valueWait: { fontSize: 12, color: colors.inkSoft, letterSpacing: 0.2 },
});
