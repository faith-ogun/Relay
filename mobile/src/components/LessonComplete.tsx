import React, { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import Animated, {
  Easing, FadeInDown, useAnimatedProps, useAnimatedStyle, useDerivedValue,
  useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Button } from './Button';
import { LEVEL_META, MAX_LEVEL } from '../lesson/levels';
import { curve, font, leading, tabular, tracking, type } from '../theme/tokens';
import { duration, motion, stagger } from '../theme/motion';
import { makeStyles, useColors } from '../theme/theme';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * The end of a lesson.
 *
 * Previously the XP total simply appeared as static text, so finishing felt like
 * nothing happened. Research across Duolingo, Mimo, Brilliant and Sololearn
 * found all four ship a post-lesson sequence and this app shipped none, which is
 * a likelier cause of the app feeling unfinished than any missing feature.
 *
 * The sequence: the number counts up, the stats stagger in behind it, and a
 * success haptic lands on arrival. Total under a second and a half, because a
 * celebration that outstays its welcome becomes a thing to tap past.
 *
 * The counter is an animated TextInput, not a Text. There is no animated Text
 * with animated CONTENT in Reanimated, and driving a number through
 * `runOnJS(setState)` costs a full render per frame. `defaultValue` is set
 * alongside `text` because the shadow node measures its intrinsic width from
 * what React committed, so a growing number is otherwise truncated with an
 * ellipsis.
 *
 * The medal is the level, and it is struck rather than shown: it drops in
 * over-scale and settles with the reward spring, and the level's name is stamped
 * under it. Bronze, Silver and Gold are the same three the web awards, from the
 * same table, so a learner alternating surfaces sees one ladder.
 *
 * A replay at or below the level already held pays no XP, so this screen does
 * not promise any. It says what the replay DID do instead: the streak is kept
 * and the day's goal has moved.
 */
export const LessonComplete: React.FC<{
  /** What this level is worth. Only shown when the run actually earned it. */
  earnedXp: number;
  /** False on a replay at or below the level already on record. */
  paysXp: boolean;
  /** 1 Bronze, 2 Silver, 3 Gold. */
  level: number;
  perfect: boolean;
  streak: number;
  streakExtended: boolean;
  onDone: () => void;
}> = ({ earnedXp, paysXp, level, perfect, streak, streakExtended, onDone }) => {
  const colors = useColors();
  const s = useS();
  const reduced = useReducedMotion();
  const xp = useSharedValue(0);
  const pop = useSharedValue(1);
  const medal = useSharedValue(reduced ? 1 : 0);
  const [ready, setReady] = useState(false);
  const fired = useRef(false);

  const tier = Math.min(MAX_LEVEL, Math.max(1, Math.trunc(level) || 1)) as 1 | 2 | 3;
  const meta = LEVEL_META[tier];
  const nextTier = tier < MAX_LEVEL ? LEVEL_META[(tier + 1) as 2 | 3] : null;

  useEffect(() => {
    if (reduced) {
      xp.value = earnedXp;
      medal.value = 1;
      setReady(true);
      return;
    }
    // The medal lands FIRST, then the number counts under it. Reversed, the
    // count finishes into an empty space and the medal reads as an afterthought.
    medal.value = withSequence(
      withSpring(1.08, motion.reward),
      withSpring(1, motion.release),
    );
    xp.value = withTiming(earnedXp, {
      duration: duration.count,
      easing: Easing.out(Easing.cubic),
    });
    // The pop lands as the count finishes, so the two read as one event.
    pop.value = withDelay(
      duration.count - 120,
      withSequence(withSpring(1.12, motion.reward), withSpring(1, motion.release)),
    );
    const t = setTimeout(() => setReady(true), duration.count);
    return () => clearTimeout(t);
  }, [earnedXp, reduced, xp, pop, medal]);

  // Haptics once, on arrival. A success note, then a heavier thump behind it,
  // which is what a reward feels like rather than a notification.
  useEffect(() => {
    if (!ready || fired.current) return;
    fired.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const t = setTimeout(() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }, 120);
    return () => clearTimeout(t);
  }, [ready]);

  const shown = useDerivedValue(() => `${Math.round(xp.value)}`);
  const counter = useAnimatedProps(() => ({
    text: shown.value,
    defaultValue: shown.value,
  }) as never);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const medalStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: medal.value },
      { rotate: `${(1 - medal.value) * -14}deg` },
    ],
    opacity: Math.min(1, medal.value * 2),
  }));

  return (
    <View style={s.screen}>
      <Animated.View
        style={[s.medal, { backgroundColor: meta.color }, medalStyle]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Svg width={34} height={34} viewBox="0 0 24 24">
          <Path d="M13.2 2 4.4 13.4h5.7L8.8 22l8.8-11.4h-5.7z" fill={meta.soft} />
        </Svg>
      </Animated.View>

      <Animated.View
        entering={reduced ? undefined : FadeInDown.delay(stagger(1)).duration(320)}
        style={[s.tierPill, { backgroundColor: meta.soft, borderColor: meta.color }]}
      >
        <Text style={s.tierText} maxFontSizeMultiplier={1.2}>
          {meta.name.toUpperCase()} {paysXp ? 'EARNED' : 'HELD'}
        </Text>
      </Animated.View>

      {perfect && (
        <Animated.View entering={reduced ? undefined : FadeInDown.duration(320)} style={s.head}>
          <Text style={s.kicker}>FLAWLESS</Text>
        </Animated.View>
      )}

      {paysXp ? (
        <Animated.View style={[s.xpBlock, popStyle]}>
          <Text style={s.plus}>+</Text>
          <AnimatedTextInput
            animatedProps={counter}
            editable={false}
            caretHidden
            style={s.xp}
            maxFontSizeMultiplier={1.15}
          />
          <Text style={s.xpUnit}>XP</Text>
        </Animated.View>
      ) : (
        <Animated.View
          entering={reduced ? undefined : FadeInDown.delay(stagger(2)).duration(320)}
          style={s.keptBlock}
        >
          <Text style={s.keptTitle} maxFontSizeMultiplier={1.2}>Streak kept</Text>
          <Text style={s.keptBody} maxFontSizeMultiplier={1.3}>
            This one is already banked, so it pays no more XP. It still counts toward today.
          </Text>
        </Animated.View>
      )}

      <View style={s.stats}>
        <Stat
          i={0} reduced={reduced}
          label="Accuracy"
          value={perfect ? '100%' : 'Cleared'}
          tint={perfect ? colors.greenDeep : colors.blueDeep}
        />
        <Stat
          i={1} reduced={reduced}
          label={streakExtended ? 'Streak extended' : 'Streak'}
          value={`${streak}`}
          tint={colors.red}
        />
      </View>

      <Animated.View
        entering={reduced ? undefined : FadeInDown.delay(stagger(3)).duration(320)}
        style={s.footer}
      >
        <Text style={s.nextUp} maxFontSizeMultiplier={1.3}>
          {nextTier
            ? `Replay this lesson to reach ${nextTier.name}.`
            : 'Every level of this one is yours.'}
        </Text>
        <Button label="Back to the path" onPress={onDone} />
      </Animated.View>
    </View>
  );
};

const Stat: React.FC<{
  i: number; reduced: boolean; label: string; value: string; tint: string;
}> = ({ i, reduced, label, value, tint }) => {
  const s = useS();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(stagger(i + 1)).duration(300)}
      style={[s.stat, { borderColor: tint }]}
    >
      <Text style={[s.statValue, { color: tint }]} maxFontSizeMultiplier={1.2}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </Animated.View>
  );
};

const useS = makeStyles((colors, th) => ({
  screen: {
    flex: 1, backgroundColor: colors.cream,
    alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8,
  },
  head: { alignItems: 'center' },
  // The medal, struck in the level's metal with the brand bolt cut out of it.
  // Plate rather than blur, which is the treatment every raised surface in this
  // app uses; a soft shadow here would read as pasted on.
  medal: {
    width: 92, height: 92, borderRadius: 46, ...curve,
    borderWidth: 3, borderColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
    ...th.press,
  },
  tierPill: {
    marginTop: 18, borderWidth: 2, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  tierText: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: tracking.meta,
    color: colors.ink,
  },
  keptBlock: { alignItems: 'center', marginTop: 18, maxWidth: 300 },
  keptTitle: {
    fontFamily: font.black, fontSize: type.title, color: colors.ink,
    letterSpacing: tracking.title,
  },
  keptBody: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    textAlign: 'center', marginTop: 6, lineHeight: 20,
  },
  nextUp: {
    fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft,
    textAlign: 'center', marginBottom: 14,
  },
  kicker: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: tracking.meta,
    color: colors.blueDeep,
  },
  xpBlock: { flexDirection: 'row', alignItems: 'baseline', gap: 2, marginTop: 4 },
  plus: {
    fontFamily: font.black, fontSize: type.title, color: colors.goldText,
    letterSpacing: tracking.title,
  },
  xp: {
    ...tabular,
    fontFamily: font.black,
    fontSize: type.display,
    lineHeight: leading.display,
    letterSpacing: tracking.display,
    color: colors.ink,
    padding: 0,
    minWidth: 70,
    textAlign: 'center',
  },
  xpUnit: {
    fontFamily: font.black, fontSize: type.heading, color: colors.goldText,
    marginLeft: 4,
  },
  stats: { flexDirection: 'row', gap: 12, marginTop: 24 },
  stat: {
    flex: 1, borderWidth: 3, borderRadius: 20, ...curve,
    backgroundColor: colors.surface, paddingVertical: 16, alignItems: 'center',
    ...th.elevation.card,
  },
  statValue: { ...tabular, fontFamily: font.black, fontSize: type.heading },
  statLabel: {
    fontFamily: font.bold, fontSize: type.meta, color: colors.inkSoft,
    marginTop: 2, letterSpacing: tracking.meta,
  },
  footer: { alignSelf: 'stretch', marginTop: 32 },
}));
