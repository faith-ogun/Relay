import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import Animated, {
  Easing, useAnimatedProps, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { useColors } from '../../theme/theme';

const ARect = Animated.createAnimatedComponent(Rect);

const W = 280;
const H = 150;
// Deterministic heights, not random: a seeded-looking waveform that reads as
// speech, and renders identically every time.
const BARS = [0.30, 0.55, 0.85, 0.45, 1.0, 0.65, 0.35, 0.75, 0.5, 0.9, 0.4, 0.6, 0.25];

const Bar: React.FC<{ index: number; peak: number }> = ({ index, peak }) => {
  const colors = useColors();
  const level = useSharedValue(0.18);

  useEffect(() => {
    level.value = withDelay(
      index * 65,
      withRepeat(
        withSequence(
          withTiming(peak, { duration: 420, easing: Easing.out(Easing.quad) }),
          withTiming(0.18, { duration: 520, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [index, peak, level]);

  const maxH = 92;
  const props = useAnimatedProps(() => {
    const h = maxH * level.value;
    return { height: h, y: H / 2 - h / 2 };
  });

  return (
    <ARect
      x={22 + index * 19}
      width={10}
      rx={5}
      fill={index % 3 === 0 ? colors.gold : colors.blueDeep}
      animatedProps={props}
    />
  );
};

/**
 * "Ask out loud": a live voice waveform. The bars stagger so it reads as speech
 * rather than an equaliser, and two colours keep it from looking mechanical.
 */
export const VoiceScene: React.FC = () => (
  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {BARS.map((peak, i) => (
        <Bar key={i} index={i} peak={peak} />
      ))}
    </Svg>
  </View>
);
