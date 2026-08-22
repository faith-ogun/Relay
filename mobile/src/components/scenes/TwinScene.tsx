import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { G, Line, Path, Rect } from 'react-native-svg';
import Animated, {
  Easing, useAnimatedProps, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme/tokens';

const AG = Animated.createAnimatedComponent(G);

const W = 280;
const H = 150;

/**
 * "You keep the build": an isometric wireframe of a finished circuit, rotating
 * slowly. Suggests the 3D twin without pretending to be a real render — an
 * honest illustration of the artifact rather than a fake screenshot of it.
 */
export const TwinScene: React.FC = () => {
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [spin]);

  // A slow yaw, expressed as a horizontal squash so it reads as 3D rotation
  // without needing a real projection matrix.
  const props = useAnimatedProps(() => {
    const angle = spin.value * Math.PI * 2;
    const scaleX = 0.55 + 0.45 * Math.abs(Math.cos(angle));
    return { transform: [{ translateX: W / 2 }, { scaleX }, { translateX: -W / 2 }] } as never;
  });

  const cx = W / 2;
  const cy = H / 2;

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <AG animatedProps={props}>
          {/* Isometric base plate */}
          <Path
            d={`M ${cx} ${cy + 34} L ${cx + 78} ${cy - 4} L ${cx} ${cy - 42} L ${cx - 78} ${cy - 4} Z`}
            fill={colors.goldSoft}
            stroke={colors.ink}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          {/* Depth edges */}
          <Line x1={cx - 78} y1={cy - 4} x2={cx - 78} y2={cy + 14} stroke={colors.ink} strokeWidth={2.5} />
          <Line x1={cx + 78} y1={cy - 4} x2={cx + 78} y2={cy + 14} stroke={colors.ink} strokeWidth={2.5} />
          <Path
            d={`M ${cx - 78} ${cy + 14} L ${cx} ${cy + 52} L ${cx + 78} ${cy + 14}`}
            fill="none" stroke={colors.ink} strokeWidth={2.5} strokeLinejoin="round"
          />
          {/* Components standing on the board */}
          <Rect x={cx - 30} y={cy - 26} width={26} height={10} rx={4}
                fill={colors.white} stroke={colors.ink} strokeWidth={2} />
          <Rect x={cx + 6} y={cy - 14} width={22} height={9} rx={4}
                fill={colors.blueSoft} stroke={colors.ink} strokeWidth={2} />
          <Line x1={cx - 4} y1={cy - 21} x2={cx + 6} y2={cy - 10}
                stroke={colors.red} strokeWidth={2.5} strokeLinecap="round" />
        </AG>
      </Svg>
    </View>
  );
};
