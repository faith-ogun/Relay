import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { Button } from './Button';
import { formatWait, useHeartsCountdown } from '../hooks/useHearts';
import { useChildSafe } from '../hooks/useChildSafe';
import { usePlan } from '../hooks/usePlan';
import { track } from '../services/analytics';
import { colors, curve, font, radius, space, type } from '../theme/tokens';
import { elevation } from '../theme/elevation';
import { motion } from '../theme/motion';

/**
 * The wall a Free learner hits when the pool empties.
 *
 * Two jobs, in this order: make the wait legible, and make the way past it
 * obvious. A bare "come back later" is the version of this screen that people
 * uninstall over — so the ring shows the next heart actually arriving, and the
 * moment it lands the screen becomes a way back into the lesson rather than a
 * dead end someone has to navigate out of.
 *
 * The ring is driven by the same one-second tick as the label. A countdown is
 * a clock; it is allowed to tick, and nothing here is smooth enough at 60fps to
 * be worth an animation loop running for an hour and a half.
 */

const RING = 132;
const STROKE = 10;
const R = (RING - STROKE) / 2;
const C = 2 * Math.PI * R;

export const OutOfHearts: React.FC<{
  /** Shown once a heart has landed. Null hides the resume action entirely,
   *  which is right when this screen is a gate rather than a failure. */
  onResume?: () => void;
  resumeLabel?: string;
  onLeave: () => void;
  leaveLabel?: string;
}> = ({ onResume, resumeLabel = 'Try again', onLeave, leaveLabel = 'Leave lesson' }) => {
  const { nextIn, regenProgress, empty, hearts } = useHeartsCountdown();
  const { childSafe } = useChildSafe();
  const { plan } = usePlan();

  // Never pitch a plan to someone who cannot buy it. A minor cannot
  // self-purchase (#96), and Max is the top tier, so both get the wait and
  // no offer rather than a button that leads nowhere they can go.
  const canUpsell = !childSafe && plan !== 'max';

  useEffect(() => { track('hearts_depleted'); }, []);

  const enter = useSharedValue(0);
  useEffect(() => { enter.value = withSpring(1, motion.enter); }, [enter]);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.86 + enter.value * 0.14 }],
  }));
  const copyStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 14 }],
  }));

  const bodyEnter = useSharedValue(0);
  useEffect(() => { bodyEnter.value = withDelay(90, withSpring(1, motion.enter)); }, [bodyEnter]);
  const actionStyle = useAnimatedStyle(() => ({
    opacity: bodyEnter.value,
    transform: [{ translateY: (1 - bodyEnter.value) * 18 }],
  }));

  const refilled = !empty && (hearts ?? 0) > 0;
  const progress = regenProgress ?? 0;

  return (
    <View style={s.screen}>
      <Animated.View style={[s.ringWrap, ringStyle]}>
        <Svg width={RING} height={RING}>
          <Circle
            cx={RING / 2} cy={RING / 2} r={R}
            stroke={colors.inkFaint} strokeWidth={STROKE} fill="none"
          />
          <Circle
            cx={RING / 2} cy={RING / 2} r={R}
            stroke={refilled ? colors.green : colors.red}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${C} ${C}`}
            strokeDashoffset={C * (1 - (refilled ? 1 : progress))}
            // Start the arc at twelve o'clock rather than three.
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
        <View style={s.ringCore}>
          <Svg width={44} height={44} viewBox="0 0 24 24">
            <Path
              d="M12 20.5S3.5 15.4 3.5 9.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.6c0 5.8-8.5 10.9-8.5 10.9z"
              fill={refilled ? colors.red : 'none'}
              stroke={refilled ? colors.red : colors.inkMute}
              strokeWidth={2.2}
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </Animated.View>

      <Animated.View style={[s.copy, copyStyle]}>
        <Text style={s.title}>{refilled ? 'You have a heart' : 'Out of hearts'}</Text>
        <Text style={s.body}>
          {refilled
            ? 'Pick up where you left off. The questions you missed come back first.'
            : 'Hearts come back on their own. Nothing you have learned is lost, and your streak is safe.'}
        </Text>
        {!refilled && (
          <View style={s.timer}>
            <Text style={s.timerLabel}>NEXT HEART IN</Text>
            <Text style={s.timerValue}>{formatWait(nextIn) || '--'}</Text>
          </View>
        )}
      </Animated.View>

      <Animated.View style={[s.actions, actionStyle]}>
        {refilled && onResume ? (
          <Button label={resumeLabel} onPress={onResume} />
        ) : canUpsell ? (
          <Pressable
            onPress={() => {
              track('hearts_paywall_view');
              router.push('/plans');
            }}
            accessibilityRole="button"
            style={({ pressed }) => [s.upsell, pressed && s.upsellPressed]}
          >
            <Text style={s.upsellTitle}>Never run out</Text>
            <Text style={s.upsellBody}>
              Pro and Max have unlimited hearts, so a wrong answer costs you nothing but the
              time it takes to understand it.
            </Text>
            <Text style={s.upsellCta}>See plans</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onLeave} style={s.quiet} accessibilityRole="button">
          <Text style={s.quietText}>{leaveLabel}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const s = StyleSheet.create({
  screen: {
    flex: 1, backgroundColor: colors.cream,
    alignItems: 'center', justifyContent: 'center', padding: space.xl,
  },
  ringWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ringCore: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  copy: { alignItems: 'center', marginTop: space.lg },
  title: {
    fontFamily: font.black, fontSize: type.title, color: colors.ink,
    letterSpacing: -0.8, textAlign: 'center',
  },
  body: {
    fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft,
    textAlign: 'center', marginTop: space.sm, lineHeight: 22, maxWidth: 320,
  },
  timer: { alignItems: 'center', marginTop: space.lg },
  timerLabel: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 2.4,
    color: colors.inkMute,
  },
  timerValue: {
    fontFamily: font.black, fontSize: type.display, color: colors.ink,
    letterSpacing: -1.5, fontVariant: ['tabular-nums'], marginTop: 2,
  },
  actions: { alignSelf: 'stretch', marginTop: space.xl, alignItems: 'center' },
  // Deliberately not the standard card: this is an offer, so it carries the
  // gold surface the rest of the lesson never uses.
  upsell: {
    alignSelf: 'stretch',
    backgroundColor: colors.goldSoft,
    borderWidth: 2, borderColor: colors.goldPlate,
    borderRadius: radius.lg, ...curve,
    padding: space.lg,
    ...elevation.card,
  },
  upsellPressed: { transform: [{ translateY: 2 }], ...elevation.flush },
  upsellTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink, letterSpacing: -0.4 },
  upsellBody: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.goldText,
    marginTop: 6, lineHeight: 19,
  },
  upsellCta: {
    fontFamily: font.black, fontSize: type.label, color: colors.ink,
    marginTop: space.md, letterSpacing: 0.2,
  },
  quiet: { marginTop: space.md, paddingVertical: space.sm },
  quietText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
});
