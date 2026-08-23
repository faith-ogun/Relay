import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
  Easing, useAnimatedProps, useSharedValue, withRepeat, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Battery, Led, Resistor, Wire } from '../circuits/primitives';
import { colors } from '../../theme/tokens';

const ACircle = Animated.createAnimatedComponent(Circle);

const W = 300;
const H = 148;

// The loop the charges travel, as one closed path: across the top through the
// resistor and LED, down the right, back along the bottom, up the left. Points
// are sampled rather than measured off a Path so the motion stays exactly on
// the wires the schematic draws.
const TOP = 40;
const BOTTOM = 116;
const LEFT = 40;
const RIGHT = 262;

const BATT = 150;

const PERIMETER = 2 * (RIGHT - LEFT) + 2 * (BOTTOM - TOP);

/** Position at `t` (0..1) around the loop, travelling + to − the long way. */
function at(t: number): { x: number; y: number } {
  'worklet';
  const d = ((t % 1) + 1) % 1 * PERIMETER;
  const across = RIGHT - LEFT;
  const down = BOTTOM - TOP;
  if (d < across) return { x: LEFT + d, y: TOP };
  if (d < across + down) return { x: RIGHT, y: TOP + (d - across) };
  if (d < 2 * across + down) return { x: RIGHT - (d - across - down), y: BOTTOM };
  return { x: LEFT, y: BOTTOM - (d - 2 * across - down) };
}

const CHARGES = [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.84];

/**
 * A complete circuit with current visibly moving through it: charges leave the
 * battery, pass the resistor, cross the LED, and come back. It is the first
 * idea the curriculum teaches (one loop, one current, nothing is used up along
 * the way) and it is the one motion on the welcome screen.
 *
 * Distinct from the onboarding scenes on purpose: those show the product's
 * mechanics (camera, voice, twin), this shows the subject.
 */
export const CurrentLoopScene: React.FC = () => {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.linear }), -1, false);
  }, [t]);

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Wire x1={LEFT} y1={TOP} x2={RIGHT} y2={TOP} />
        <Wire x1={RIGHT} y1={TOP} x2={RIGHT} y2={BOTTOM} />
        <Wire x1={LEFT} y1={BOTTOM} x2={LEFT} y2={TOP} />
        {/* The bottom run breaks for the cell: a source interrupts the wire,
            it does not sit on top of one. */}
        <Wire x1={RIGHT} y1={BOTTOM} x2={BATT + 8} y2={BOTTOM} />
        <Wire x1={BATT} y1={BOTTOM} x2={LEFT} y2={BOTTOM} />

        <Battery x={BATT} y={BOTTOM} />
        <Resistor x={96} y={TOP} w={52} />
        <Led x={206} y={TOP} lit />

        <G>
          {CHARGES.map((offset, i) => (
            <Charge key={i} t={t} offset={offset} />
          ))}
        </G>
      </Svg>
    </View>
  );
};

/** One moving charge. Split out so each gets its own animated props worklet. */
const Charge: React.FC<{ t: SharedValue<number>; offset: number }> = ({ t, offset }) => {
  const props = useAnimatedProps(() => {
    const p = at(t.value + offset);
    return { cx: p.x, cy: p.y };
  });
  return <ACircle animatedProps={props} r={3.6} fill={colors.blueDeep} opacity={0.85} />;
};
