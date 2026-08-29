import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { InfinityMark } from './icons';
import { formatWait, useHeartsCountdown } from '../hooks/useHearts';
import { useChildSafe } from '../hooks/useChildSafe';
import { track } from '../services/analytics';
import { colors, font, tabular } from '../theme/tokens';

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
 * Drawn at 32pt, up from 22, and before that 17 for the line glyphs they
 * replaced. Painted art needs the points to read: at 17 the resistor bands on
 * the XP coin turned to mush.
 *
 * The 32 is what removing the boxes bought. Each stat used to sit in a bordered
 * white pill with a caption under the number, and between the border, the
 * padding and the word XP there was no room for the artwork to be anything but
 * small. Faith asked for the Duolingo treatment: no container, no caption, and
 * let the icon and the number do the talking. The caption was never carrying
 * meaning the icon did not already carry, and the border was carrying none at
 * all.
 *
 * Two things the container WAS carrying, now moved rather than dropped: the goal
 * turning green when met (the number turns green, and its icon stops being
 * dimmed), and hearts being empty (the icon dims and the count becomes a
 * countdown). The third thing, the caption, was the only real loss, and it was a
 * loss for screen readers rather than for eyes: every stat now carries an
 * explicit accessibilityLabel, which none of them but hearts had before, because
 * "2070" on its own is not a stat.
 */
const STAT_ART = {
  xp: require('../../assets/stats/xp.png'),
  streak: require('../../assets/stats/streak.png'),
  hearts: require('../../assets/stats/hearts.png'),
  goal: require('../../assets/stats/goal.png'),
} as const;

const ICON = 32;

/**
 * XP, short enough to fit beside a 32pt icon in a quarter of the bar.
 *
 * The arithmetic, because it is the whole reason this exists: on a 430pt phone
 * the strip has 398pt inside its padding, four stats share it evenly at ~99pt
 * each, and the icon and its gap take 37 of those. That leaves ~62pt, and a
 * tabular digit of Nunito Black at 20pt is about 12pt wide. Five digits fit.
 * Six do not, and 100,000 XP is a number a committed learner reaches rather
 * than a hypothetical.
 *
 * It only bites at 20pt. At the 14pt the number used to be drawn at, inside its
 * box, this was not a problem, which is exactly the kind of thing that makes a
 * purely cosmetic change stop being purely cosmetic.
 */
const shortXp = (n: number): string => {
  if (n < 10_000) return String(n);
  // 12.4K up to 99.9K, then 100K: three significant figures either way, so the
  // width never grows past five characters.
  const band = (v: number, suffix: string) =>
    (v < 100 ? `${v.toFixed(1)}` : `${Math.round(v)}`) + suffix;
  // Rounded, not raw. 999,999 is under a million but rounds to 1000K, and
  // "1000K" is not a thing anyone writes; it promotes to 1.0M.
  const k = n / 1000;
  if (Math.round(k) < 1000) return band(k, 'K');
  return band(n / 1_000_000, 'M');
};

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
const HeartsStat: React.FC = () => {
  const { hearts, unlimited, loaded, nextIn, empty } = useHeartsCountdown();
  // A minor cannot self-purchase (#96): they get the count, not a doorway to
  // a paywall.
  const { childSafe } = useChildSafe();
  // Nothing, not a blank slot. If the hearts service is unreachable this state
  // is permanent, and an empty gap in the strip would read as broken for the
  // whole session; the other three simply take the space.
  if (!loaded) return null;

  if (unlimited) {
    return (
      <View style={s.stat} accessible accessibilityLabel="Unlimited hearts">
        <StatIcon name="hearts" />
        <InfinityMark size={22} color={colors.goldText} />
      </View>
    );
  }

  const label = empty ? `Out of hearts, next in ${formatWait(nextIn)}` : `${hearts ?? 0} hearts`;
  const body = (
    <>
      <StatIcon name="hearts" dim={empty} />
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
    return <View style={s.stat} accessible accessibilityLabel={label}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => { track('hearts_paywall_view'); router.push('/plans'); }}
      style={({ pressed }) => [s.stat, pressed && s.statPressed]}
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
  const done = Math.min(doneToday, dailyGoal);
  return (
    <View style={s.strip}>
      {/* Every stat says out loud what its caption used to say on screen. A
          screen reader reading "2070" and moving on is not reading a stat.
          `accessible` is what makes the label take effect: a View is not an
          accessibility element on its own, and without it VoiceOver walks
          straight past the label to the number underneath. The old hearts
          Views had exactly that bug; it did not matter while the caption was
          on screen, and it would have mattered from today. */}
      {/* The label carries the FULL number; only the drawn one is shortened.
          "12.4K XP" read aloud is a rounding, and a screen reader should not be
          told a different number from the one the learner has. */}
      <View style={s.stat} accessible accessibilityLabel={`${xp} XP`}>
        <StatIcon name="xp" />
        <Text style={s.value} maxFontSizeMultiplier={1.15} numberOfLines={1}>{shortXp(xp)}</Text>
      </View>
      <View
        style={s.stat}
        accessible
        accessibilityLabel={streak === 0 ? 'No streak yet' : `${streak} day streak`}
      >
        <StatIcon name="streak" dim={streak === 0} />
        <Text style={[s.value, streak > 0 && { color: colors.red }]} maxFontSizeMultiplier={1.15}>
          {streak}
        </Text>
      </View>
      <HeartsStat />
      <View
        style={s.stat}
        accessible
        accessibilityLabel={
          met
            ? `Daily goal met, ${done} of ${dailyGoal} lessons`
            : `${done} of ${dailyGoal} lessons towards today's goal`
        }
      >
        <StatIcon name="goal" dim={!met} />
        <Text style={[s.value, met && { color: colors.greenDeep }]} maxFontSizeMultiplier={1.15}>
          {done}/{dailyGoal}
        </Text>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  strip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 2, paddingBottom: 12,
  },
  /**
   * No border, no fill, no shadow. `flex: 1` still shares the width evenly, so
   * the four sit where they always did; what has gone is everything that was
   * drawing a box around them.
   */
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  statPressed: { transform: [{ scale: 0.94 }] },
  icon: { width: ICON, height: ICON },
  // Not greyscale: the art is the brand. Flattened enough that a spent
  // stat reads as spent without becoming a different picture.
  iconDim: { opacity: 0.38 },
  value: { ...tabular, fontFamily: font.black, fontSize: 20, color: colors.ink, letterSpacing: -0.4 },
  // The countdown can be as wide as "14m 30s", so it stays small enough to fit
  // beside a 32pt icon in a quarter of the bar.
  valueWait: { fontSize: 12, color: colors.inkSoft, letterSpacing: 0.2 },
});
