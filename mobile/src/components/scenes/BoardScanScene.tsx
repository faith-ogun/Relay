import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing, interpolate, useAnimatedProps, useSharedValue, withDelay, withRepeat, withSequence,
  withTiming, type SharedValue,
} from 'react-native-reanimated';
import { colors } from '../../theme/tokens';

const ARect = Animated.createAnimatedComponent(Rect);
const AG = Animated.createAnimatedComponent(G);
const APath = Animated.createAnimatedComponent(Path);

const W = 300;
const H = 190;

// The three parts the tutor finds, in the order the sweep reaches them. Each
// gets a bracket that snaps on and a label, the way a real vision system draws
// its detections, rather than a single ring appearing on cue.
const FINDS = [
  { x: 62, y: 74, w: 58, h: 30, label: 'RESISTOR', at: 0.22 },
  { x: 136, y: 108, w: 44, h: 34, label: 'LED', at: 0.46 },
  { x: 202, y: 66, w: 62, h: 32, label: 'JUMPER', at: 0.70 },
];

/**
 * "Point your camera at the board."
 *
 * A viewfinder over a breadboard: the frame corners sit outside the board, a
 * sweep passes down it, and each component is bracketed and named as the sweep
 * reaches it, holding until the pass ends. It shows the product's actual
 * mechanic, and it reads as a camera rather than as a decorative bar sliding.
 */
export const BoardScanScene: React.FC = () => {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
        withDelay(900, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [t]);

  const sweep = useAnimatedProps(() => ({ y: 18 + t.value * (H - 58) }));

  const holes: React.ReactNode[] = [];
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 13; col += 1) {
      holes.push(
        <Circle key={`${row}-${col}`} cx={44 + col * 17} cy={56 + row * 20} r={2.4}
                fill={colors.ink} opacity={0.14} />,
      );
    }
  }

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="sweep" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.blueDeep} stopOpacity="0" />
            <Stop offset="0.55" stopColor={colors.blueDeep} stopOpacity="0.30" />
            <Stop offset="1" stopColor={colors.blueDeep} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Board */}
        <Rect x={28} y={30} width={W - 56} height={H - 66} rx={12}
              fill={colors.white} stroke={colors.ink} strokeWidth={2.5} />
        <Line x1={40} y1={H / 2 - 2} x2={W - 40} y2={H / 2 - 2}
              stroke={colors.ink} strokeWidth={1.4} opacity={0.2} />
        <G>{holes}</G>

        {/* Components on the board */}
        <Rect x={72} y={80} width={38} height={12} rx={4}
              fill={colors.goldSoft} stroke={colors.ink} strokeWidth={1.8} />
        <Rect x={82} y={80} width={3.5} height={12} fill={colors.ink} opacity={0.75} />
        <Rect x={90} y={80} width={3.5} height={12} fill={colors.red} opacity={0.8} />
        <Path d={`M 150 116 l 14 8 l -14 8 z`} fill={colors.gold} stroke={colors.ink} strokeWidth={1.8} strokeLinejoin="round" />
        <Path d={`M 212 76 q 20 -14 40 0`} fill="none" stroke={colors.blueDeep} strokeWidth={3} strokeLinecap="round" />

        <ARect x={28} width={W - 56} height={26} fill="url(#sweep)" animatedProps={sweep} />

        {FINDS.map((f) => <Detection key={f.label} t={t} find={f} />)}

        {/* Viewfinder corners, outside the board so it reads as the camera. */}
        {[[10, 12, 1, 1], [W - 10, 12, -1, 1], [10, H - 12, 1, -1], [W - 10, H - 12, -1, -1]].map(
          ([cx, cy, sx, sy], i) => (
            <Path
              key={i}
              d={`M ${cx} ${cy + 20 * sy} L ${cx} ${cy} L ${cx + 20 * sx} ${cy}`}
              stroke={colors.ink} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round"
            />
          ),
        )}
      </Svg>
    </View>
  );
};

/** One detection: a bracket that snaps on as the sweep passes, then holds. */
const Detection: React.FC<{ t: SharedValue<number>; find: (typeof FINDS)[number] }> = ({ t, find }) => {
  const props = useAnimatedProps(() => {
    // Ramps over a short window once the sweep reaches this component.
    const p = interpolate(t.value, [find.at, find.at + 0.09], [0, 1], 'clamp');
    return { opacity: p, transform: [{ scale: 0.9 + p * 0.1 }] };
  });
  const { x, y, w, h } = find;
  const arm = 9;
  const corners = [
    `M ${x} ${y + arm} L ${x} ${y} L ${x + arm} ${y}`,
    `M ${x + w - arm} ${y} L ${x + w} ${y} L ${x + w} ${y + arm}`,
    `M ${x + w} ${y + h - arm} L ${x + w} ${y + h} L ${x + w - arm} ${y + h}`,
    `M ${x + arm} ${y + h} L ${x} ${y + h} L ${x} ${y + h - arm}`,
  ];
  return (
    <AG animatedProps={props} origin={`${x + w / 2}, ${y + h / 2}`}>
      {corners.map((d, i) => (
        <Path key={i} d={d} stroke={colors.green} strokeWidth={2.6} fill="none"
              strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </AG>
  );
};
