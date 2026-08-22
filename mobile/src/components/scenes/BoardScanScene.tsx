import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing, useAnimatedProps, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme/tokens';

const ARect = Animated.createAnimatedComponent(Rect);
const ACircle = Animated.createAnimatedComponent(Circle);

const W = 280;
const H = 150;

/**
 * "Point your camera at the board": a breadboard with a scan sweeping down it,
 * and a component that lights up as the scan reaches it. It shows the actual
 * mechanic of the product — the tutor looking at your bench — rather than
 * decorating the space.
 */
export const BoardScanScene: React.FC = () => {
  const sweep = useSharedValue(0);
  const detect = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 0 }),
        withTiming(0, { duration: 700 }),
      ),
      -1,
      false,
    );
    // Fires as the sweep crosses the component, then fades.
    detect.value = withRepeat(
      withSequence(
        withDelay(1150, withTiming(1, { duration: 260 })),
        withTiming(1, { duration: 700 }),
        withTiming(0, { duration: 400 }),
        withTiming(0, { duration: 400 }),
      ),
      -1,
      false,
    );
  }, [sweep, detect]);

  const scanProps = useAnimatedProps(() => ({ y: 8 + sweep.value * (H - 30) }));
  const ringProps = useAnimatedProps(() => ({ opacity: detect.value, r: 16 + detect.value * 5 }));

  // Breadboard hole grid — drawn, not an image, so it stays crisp at any size.
  const holes: React.ReactNode[] = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 12; col += 1) {
      holes.push(
        <Circle
          key={`${row}-${col}`}
          cx={30 + col * 18}
          cy={38 + row * 22}
          r={2.6}
          fill={colors.ink}
          opacity={0.18}
        />,
      );
    }
  }

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="scan" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.blueDeep} stopOpacity="0" />
            <Stop offset="0.5" stopColor={colors.blueDeep} stopOpacity="0.35" />
            <Stop offset="1" stopColor={colors.blueDeep} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Board */}
        <Rect x={12} y={8} width={W - 24} height={H - 22} rx={14}
              fill={colors.white} stroke={colors.ink} strokeWidth={2.5} />
        {/* Centre channel */}
        <Line x1={24} y1={H / 2 - 3} x2={W - 24} y2={H / 2 - 3}
              stroke={colors.ink} strokeWidth={1.5} opacity={0.25} />
        <G>{holes}</G>

        {/* A resistor bridging the channel */}
        <Rect x={104} y={H / 2 - 16} width={34} height={11} rx={4}
              fill={colors.goldSoft} stroke={colors.ink} strokeWidth={2} />
        <Rect x={112} y={H / 2 - 16} width={4} height={11} fill={colors.ink} opacity={0.7} />
        <Rect x={120} y={H / 2 - 16} width={4} height={11} fill={colors.red} opacity={0.8} />

        {/* Detection ring over the resistor */}
        <ACircle cx={121} cy={H / 2 - 10} animatedProps={ringProps}
                 fill="none" stroke={colors.green} strokeWidth={2.5} />

        {/* The sweep */}
        <ARect x={12} width={W - 24} height={22} fill="url(#scan)" animatedProps={scanProps} />
      </Svg>
    </View>
  );
};
