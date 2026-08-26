import React, { useCallback, useEffect, useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Lock } from './icons';
import { TIER_COLOR, TIER_LABEL, type Achievement, type Tier } from '../services/achievements';
import { colors, curve, font, radius, space, type } from '../theme/tokens';
import { elevation } from '../theme/elevation';
import { duration, motion } from '../theme/motion';

/**
 * One achievement as a collectible card, and it moves like one.
 *
 * The art IS the face. It used to sit inside a bordered panel, which made it a
 * picture of a card rather than a card: the frame told you where the real edge
 * was and the illusion went with it. The painted PNGs are 3:4 and composed to
 * bleed, so they fill it.
 *
 * Tilt follows the finger the way the web version follows the pointer, at the
 * same 14 degrees. A card that only responds on release feels like a button; one
 * that leans while the finger moves feels like an object being held.
 */

const AImage = Animated.createAnimatedComponent(Image);

const CARD_W = 272;
const CARD_H = Math.round(CARD_W / 0.75);   // the art's own 3:4
const MAX_TILT = 14;
/** A drag beyond this stops being a tap, so tilting never flips by accident. */
const TAP_SLOP = 8;

export const AchievementCard: React.FC<{
  achievement: Achievement;
  earned: boolean;
  progress: number;
  progressLabel: string;
}> = ({ achievement: a, earned, progress, progressLabel }) => {
  const flip = useSharedValue(0);
  // Finger position over the card, 0..1 on each axis, centred when untouched.
  const px = useSharedValue(0.5);
  const py = useSharedValue(0.5);
  const held = useSharedValue(0);

  useEffect(() => { flip.value = 0; }, [a.id, flip]);

  const size = useRef({ w: CARD_W, h: CARD_H });
  const moved = useRef(0);

  const toggle = useCallback(() => {
    flip.value = withTiming(flip.value < 0.5 ? 1 : 0, { duration: duration.smooth });
  }, [flip]);

  const track = useCallback((x: number, y: number) => {
    px.value = Math.min(1, Math.max(0, x / size.current.w));
    py.value = Math.min(1, Math.max(0, y / size.current.h));
  }, [px, py]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        moved.current = 0;
        held.value = withTiming(1, { duration: duration.snappy });
        track(e.nativeEvent.locationX, e.nativeEvent.locationY);
      },
      onPanResponderMove: (e, g) => {
        moved.current = Math.abs(g.dx) + Math.abs(g.dy);
        track(e.nativeEvent.locationX, e.nativeEvent.locationY);
      },
      onPanResponderRelease: () => {
        // Settling back to flat is the only springy thing here: a card released
        // should rock, not snap.
        held.value = withTiming(0, { duration: duration.smooth });
        px.value = withSpring(0.5, motion.release);
        py.value = withSpring(0.5, motion.release);
        if (moved.current < TAP_SLOP) toggle();
      },
      onPanResponderTerminate: () => {
        held.value = withTiming(0, { duration: duration.smooth });
        px.value = withSpring(0.5, motion.release);
        py.value = withSpring(0.5, motion.release);
      },
    }),
  ).current;

  const stage = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateY: `${(px.value - 0.5) * MAX_TILT}deg` },
      { rotateX: `${(0.5 - py.value) * MAX_TILT}deg` },
      { scale: 1 + held.value * 0.02 },
    ],
  }));

  const front = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
    opacity: flip.value < 0.5 ? 1 : 0,
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
    opacity: flip.value < 0.5 ? 0 : 1,
  }));

  // The gloss travels with the finger, which is what sells foil.
  const gloss = useAnimatedStyle(() => ({
    opacity: held.value * (earned ? 0.55 : 0.2),
    transform: [{ translateX: interpolate(px.value, [0, 1], [-CARD_W * 0.6, CARD_W * 0.6]) }],
  }));

  const tint = TIER_COLOR[a.tier as Tier] ?? colors.line;

  return (
    <View style={s.wrap}>
      <Animated.View
        style={[s.stage, stage]}
        {...pan.panHandlers}
        onLayout={(e) => { size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; }}
        accessibilityRole="button"
        accessibilityLabel={`${a.title}. ${earned ? 'Unlocked' : 'Locked'}. Tap to turn the card over.`}
      >
        <Animated.View style={[s.face, front]}>
          {!!a.art && (
            <AImage
              source={{ uri: a.art }}
              style={[s.art, !earned && s.artLocked]}
              contentFit="cover"
              cachePolicy="disk"
              accessible={false}
            />
          )}

          {/* A band of light that slides across as the card leans. */}
          <Animated.View style={[s.glossWrap, gloss]} pointerEvents="none">
            <Svg width={CARD_W * 0.7} height={CARD_H}>
              <Defs>
                <LinearGradient id="g" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0%" stopColor="#fff" stopOpacity="0" />
                  <Stop offset="50%" stopColor="#fff" stopOpacity="0.75" />
                  <Stop offset="100%" stopColor="#fff" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect width={CARD_W * 0.7} height={CARD_H} fill="url(#g)" />
            </Svg>
          </Animated.View>

          <View style={[s.tier, { backgroundColor: tint }]} pointerEvents="none">
            <Text style={s.tierText}>{TIER_LABEL[a.tier as Tier]?.toUpperCase()}</Text>
          </View>

          {!earned && (
            <View style={s.lockBadge} pointerEvents="none"><Lock size={20} /></View>
          )}

          {/* The name sits on the art, over a scrim, the way a card is printed. */}
          <View style={s.nameplate} pointerEvents="none">
            <Text style={s.title} numberOfLines={2}>{a.title}</Text>
          </View>
        </Animated.View>

        <Animated.View style={[s.face, s.faceBack, back]}>
          <Text style={s.backTitle}>{a.title}</Text>
          {earned ? (
            <Text style={s.backStory}>{a.backText}</Text>
          ) : (
            <>
              <Text style={s.backLocked}>{progressLabel}</Text>
              <View style={s.track}>
                <View style={[s.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: tint }]} />
              </View>
            </>
          )}
          <Text style={s.backRarity}>About {a.rarity}% of learners hold this.</Text>
        </Animated.View>
      </Animated.View>

      <Text style={s.desc}>{a.desc}</Text>
      <Text style={s.hint}>Drag to tilt it, tap to turn it over</Text>
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { alignItems: 'center' },
  stage: { width: CARD_W, height: CARD_H },
  face: {
    position: 'absolute', width: CARD_W, height: CARD_H,
    borderRadius: radius.lg, ...curve, overflow: 'hidden',
    backgroundColor: colors.ink, ...elevation.overlay,
    backfaceVisibility: 'hidden',
  },
  faceBack: { padding: space.lg, paddingTop: space.xl, alignItems: 'center' },
  art: { position: 'absolute', width: '100%', height: '100%' },
  artLocked: { opacity: 0.34 },
  glossWrap: { position: 'absolute', top: 0, bottom: 0, left: CARD_W * 0.15 },
  tier: {
    position: 'absolute', top: 12, left: 12,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, ...curve,
  },
  tierText: { fontFamily: font.black, fontSize: 9, letterSpacing: 1.8, color: colors.white },
  lockBadge: {
    position: 'absolute', top: 12, right: 12,
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', ...elevation.card,
  },
  nameplate: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: space.md, paddingTop: space.xl, paddingBottom: space.md,
    backgroundColor: 'rgba(10,12,16,0.62)',
  },
  title: {
    fontFamily: font.black, fontSize: type.heading, color: colors.white,
    textAlign: 'center', letterSpacing: -0.3,
  },
  backTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.white, textAlign: 'center' },
  backStory: {
    fontFamily: font.semibold, fontSize: type.body, color: colors.inkFaint,
    textAlign: 'center', marginTop: space.md, lineHeight: 23,
  },
  backLocked: { fontFamily: font.black, fontSize: type.title, color: colors.white, textAlign: 'center', marginTop: space.lg },
  track: {
    height: 10, borderRadius: 5, ...curve, marginTop: space.md,
    alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden',
  },
  fill: { height: '100%' },
  backRarity: {
    position: 'absolute', bottom: 18, left: space.md, right: space.md,
    fontFamily: font.bold, fontSize: type.small, color: colors.inkMute, textAlign: 'center',
  },
  desc: {
    fontFamily: font.bold, fontSize: type.body, color: colors.white,
    textAlign: 'center', marginTop: space.lg, lineHeight: 22, maxWidth: 320,
  },
  hint: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 2,
    color: 'rgba(255,255,255,0.55)', marginTop: space.md,
  },
});
