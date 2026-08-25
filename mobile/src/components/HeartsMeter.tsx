import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { Heart, InfinityMark } from './icons';
import { formatWait, useHeartsCountdown } from '../hooks/useHearts';
import { useChildSafe } from '../hooks/useChildSafe';
import { colors, curve, font, type } from '../theme/tokens';
import { motion } from '../theme/motion';

/**
 * The heart balance, as discrete glyphs rather than a number.
 *
 * "3" is a readout; three hearts is a quantity you can feel shrinking, and the
 * one that empties gets a beat of its own — the whole point of a scarce resource
 * is that losing one is an event. Above the free cap this would be a silly row
 * of pips, but the cap is three, so it never is.
 *
 * Pro and Max show an infinity mark instead. The meter is the single place a
 * paying learner is reminded, every lesson, what the money removed.
 */

const Pip: React.FC<{ filled: boolean }> = ({ filled }) => {
  const scale = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    // Only the transition animates. Without this guard every pip would punch
    // on mount, which reads as a glitch rather than a loss.
    if (first.current) { first.current = false; return; }
    if (!filled) {
      scale.value = withSequence(
        withSpring(1.35, motion.press),
        withSpring(1, motion.reward),
      );
    }
  }, [filled, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <Heart
        size={17}
        color={filled ? colors.red : colors.inkMute}
        filled={filled}
      />
    </Animated.View>
  );
};

export const HeartsMeter: React.FC<{ onPress?: () => void }> = ({ onPress: requested }) => {
  const { hearts, max, unlimited, loaded, nextIn, empty } = useHeartsCountdown();
  const { childSafe } = useChildSafe();
  // A minor cannot self-purchase (#96), so the meter must not be a doorway to
  // a paywall for them. Without the handler it renders as plain status.
  const onPress = childSafe ? undefined : requested;

  // Nothing, not a blank pill. If the hearts service is unreachable this state
  // is permanent, and a reserved-but-empty slot would read as broken for the
  // whole session. The one-frame reflow when hearts arrive is the cheaper cost.
  if (!loaded) return null;

  if (unlimited) {
    return (
      <View style={[s.pill, s.pillGold]} accessibilityLabel="Unlimited hearts">
        <Heart size={16} color={colors.goldText} filled />
        <InfinityMark size={18} color={colors.goldText} />
      </View>
    );
  }

  const cap = max ?? 3;
  const left = hearts ?? cap;

  // Empty swaps the pips for the wait. Three grey hearts and a timer beside
  // them would be saying the same thing twice.
  if (empty) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`Out of hearts. Next heart in ${formatWait(nextIn)}`}
        style={({ pressed }) => [s.pill, s.pillEmpty, pressed && onPress ? s.pressed : null]}
      >
        <Heart size={16} color={colors.inkMute} filled={false} />
        <Text style={s.wait}>{formatWait(nextIn) || '--'}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${left} of ${cap} hearts left`}
      style={({ pressed }) => [s.pill, pressed && onPress ? s.pressed : null]}
    >
      {Array.from({ length: cap }, (_, i) => (
        <Pip key={i} filled={i < left} />
      ))}
    </Pressable>
  );
};

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderWidth: 2, borderColor: colors.ink, borderRadius: 999, ...curve,
    backgroundColor: colors.white, paddingHorizontal: 9, paddingVertical: 3,
  },
  pillGold: { backgroundColor: colors.goldSoft, borderColor: colors.goldPlate, gap: 4 },
  pillEmpty: { backgroundColor: colors.inkFaint, borderColor: colors.inkMute, gap: 5 },
  pressed: { transform: [{ scale: 0.96 }] },
  wait: {
    fontFamily: font.black, fontSize: type.meta, color: colors.inkSoft,
    letterSpacing: 0.3, fontVariant: ['tabular-nums'],
  },
});
