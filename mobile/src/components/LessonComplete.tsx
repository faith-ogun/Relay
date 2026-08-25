import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing, FadeInDown, useAnimatedProps, useAnimatedStyle, useDerivedValue,
  useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Button } from './Button';
import { colors, curve, font, leading, tabular, tracking, type } from '../theme/tokens';
import { elevation } from '../theme/elevation';
import { duration, motion, stagger } from '../theme/motion';

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
 */
export const LessonComplete: React.FC<{
  earnedXp: number;
  perfect: boolean;
  streak: number;
  streakExtended: boolean;
  onDone: () => void;
}> = ({ earnedXp, perfect, streak, streakExtended, onDone }) => {
  const reduced = useReducedMotion();
  const xp = useSharedValue(0);
  const pop = useSharedValue(1);
  const [ready, setReady] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (reduced) {
      xp.value = earnedXp;
      setReady(true);
      return;
    }
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
  }, [earnedXp, reduced, xp, pop]);

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

  return (
    <View style={s.screen}>
      <Animated.View entering={reduced ? undefined : FadeInDown.duration(320)} style={s.head}>
        <Text style={s.kicker}>{perfect ? 'FLAWLESS' : 'LESSON COMPLETE'}</Text>
      </Animated.View>

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
        <Button label="Back to the path" onPress={onDone} />
      </Animated.View>
    </View>
  );
};

const Stat: React.FC<{
  i: number; reduced: boolean; label: string; value: string; tint: string;
}> = ({ i, reduced, label, value, tint }) => (
  <Animated.View
    entering={reduced ? undefined : FadeInDown.delay(stagger(i + 1)).duration(300)}
    style={[s.stat, { borderColor: tint }]}
  >
    <Text style={[s.statValue, { color: tint }]} maxFontSizeMultiplier={1.2}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
  </Animated.View>
);

const s = StyleSheet.create({
  screen: {
    flex: 1, backgroundColor: colors.cream,
    alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8,
  },
  head: { alignItems: 'center' },
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
    backgroundColor: colors.white, paddingVertical: 16, alignItems: 'center',
    ...elevation.card,
  },
  statValue: { ...tabular, fontFamily: font.black, fontSize: type.heading },
  statLabel: {
    fontFamily: font.bold, fontSize: type.meta, color: colors.inkSoft,
    marginTop: 2, letterSpacing: tracking.meta,
  },
  footer: { alignSelf: 'stretch', marginTop: 32 },
});
