import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  interpolate, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { Lock } from './icons';
import { TIER_COLOR, TIER_LABEL, type Achievement, type Tier } from '../services/achievements';
import { colors, curve, font, radius, space, type } from '../theme/tokens';
import { elevation } from '../theme/elevation';
import { duration } from '../theme/motion';

/**
 * One achievement, big, and it turns over.
 *
 * The inspector used to be a sheet of text. A card that flips is the same
 * information and a different thing entirely: the back is the reward for earning
 * it, so revealing it should cost a gesture rather than arriving with the panel.
 *
 * Two halves are stacked and counter-rotated rather than using backfaceVisibility,
 * which is unreliable across React Native versions and silently shows both faces
 * at once when it fails. Rotating the container and hiding by opacity at the
 * midpoint is boring and always correct.
 */

const FACE_W = 260;
const FACE_H = 340;

export const AchievementCard: React.FC<{
  achievement: Achievement;
  earned: boolean;
  /** 0..1 toward the threshold, for the locked back. */
  progress: number;
  progressLabel: string;
}> = ({ achievement: a, earned, progress, progressLabel }) => {
  const flip = useSharedValue(0);

  // A new card always opens face up, or tapping through the grid inherits the
  // last card's flipped state and shows a stranger's back.
  useEffect(() => { flip.value = 0; }, [a.id, flip]);

  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
    opacity: flip.value < 0.5 ? 1 : 0,
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
    opacity: flip.value < 0.5 ? 0 : 1,
  }));

  const tint = TIER_COLOR[a.tier as Tier] ?? colors.line;

  return (
    <View style={s.wrap}>
      <Pressable
        onPress={() => { flip.value = withTiming(flip.value < 0.5 ? 1 : 0, { duration: duration.smooth }); }}
        accessibilityRole="button"
        accessibilityLabel={`${a.title}. ${earned ? 'Unlocked' : 'Locked'}. Tap to turn the card over.`}
        style={s.stage}
      >
        <Animated.View style={[s.face, { borderColor: tint }, front]}>
          <View style={[s.tier, { backgroundColor: tint }]}>
            <Text style={s.tierText}>{TIER_LABEL[a.tier as Tier]?.toUpperCase()}</Text>
          </View>
          {!!a.art && (
            <Image
              source={{ uri: a.art }}
              style={[s.art, !earned && s.artLocked]}
              contentFit="contain"
              cachePolicy="disk"
              accessible={false}
            />
          )}
          {!earned && (
            <View style={s.lockBadge}><Lock size={18} /></View>
          )}
          <Text style={[s.title, !earned && s.titleLocked]} numberOfLines={2}>{a.title}</Text>
        </Animated.View>

        <Animated.View style={[s.face, s.faceBack, { borderColor: tint }, back]}>
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
      </Pressable>

      {/* The blurb lives under the card, not on it: it is what the achievement
          asks of you, and it should stay readable while the card turns. */}
      <Text style={s.desc}>{a.desc}</Text>
      <Text style={s.hint}>Tap the card to turn it over</Text>
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { alignItems: 'center' },
  stage: { width: FACE_W, height: FACE_H },
  face: {
    position: 'absolute', width: FACE_W, height: FACE_H,
    backgroundColor: colors.white, borderWidth: 3,
    borderRadius: radius.xl, ...curve, padding: space.md,
    alignItems: 'center', justifyContent: 'center', ...elevation.overlay,
    backfaceVisibility: 'hidden',
  },
  faceBack: { backgroundColor: colors.ink, justifyContent: 'flex-start', paddingTop: space.xl },
  tier: {
    position: 'absolute', top: 12, alignSelf: 'center',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, ...curve,
  },
  tierText: { fontFamily: font.black, fontSize: 9, letterSpacing: 2, color: colors.white },
  art: { width: 170, height: 170 },
  artLocked: { opacity: 0.3 },
  lockBadge: {
    position: 'absolute', top: FACE_H / 2 - 20, alignSelf: 'center',
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white,
    borderWidth: 2.5, borderColor: colors.inkMute,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    position: 'absolute', bottom: 18, left: space.md, right: space.md,
    fontFamily: font.black, fontSize: type.heading, color: colors.ink,
    textAlign: 'center', letterSpacing: -0.4,
  },
  titleLocked: { color: colors.inkSoft },
  backTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.white, textAlign: 'center' },
  backStory: {
    fontFamily: font.semibold, fontSize: type.body, color: colors.inkFaint,
    textAlign: 'center', marginTop: space.md, lineHeight: 23,
  },
  backLocked: {
    fontFamily: font.black, fontSize: type.title, color: colors.white,
    textAlign: 'center', marginTop: space.lg,
  },
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
