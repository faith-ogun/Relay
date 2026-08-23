import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing, useAnimatedProps, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme/tokens';

const APath = Animated.createAnimatedComponent(Path);

const W = 300;
const H = 180;
const CX = W / 2;
const CY = H / 2 + 14;

// ── Geometry, in model space ────────────────────────────────────────────────
// The previous version faked rotation by squashing a flat drawing horizontally,
// which reads as a shape being squeezed rather than an object turning. This is
// a real rotation: model-space points are rotated about Y and projected, so the
// far edge genuinely shortens while the near edge lengthens, and components
// pass in front of and behind each other.

type P3 = [number, number, number];

const BOARD_W = 78;
const BOARD_D = 50;
const BOARD_T = 7;

/** Board corners, top face then bottom face. */
const BOARD: P3[] = [
  [-BOARD_W, 0, -BOARD_D], [BOARD_W, 0, -BOARD_D], [BOARD_W, 0, BOARD_D], [-BOARD_W, 0, BOARD_D],
  [-BOARD_W, BOARD_T, -BOARD_D], [BOARD_W, BOARD_T, -BOARD_D], [BOARD_W, BOARD_T, BOARD_D], [-BOARD_W, BOARD_T, BOARD_D],
];

/** Components standing on the board: [centre, width, height, depth, colour]. */
const PARTS: Array<{ at: P3; w: number; h: number; d: number; fill: string }> = [
  { at: [-40, 0, -16], w: 26, h: 12, d: 9, fill: colors.goldSoft },
  { at: [6, 0, 10], w: 12, h: 18, d: 12, fill: colors.gold },
  { at: [46, 0, -6], w: 20, h: 9, d: 9, fill: colors.blueSoft },
];

/** Half the sway, in radians (32 degrees). */
const SWAY = (32 * Math.PI) / 180;

const SIN30 = 0.5;
const COS30 = 0.8660254;

function project(p: P3, angle: number): [number, number] {
  'worklet';
  const [x, y, z] = p;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const rx = x * c - z * s;
  const rz = x * s + z * c;
  return [CX + (rx - rz) * COS30, CY + (rx + rz) * SIN30 - y];
}

function poly(points: P3[], angle: number): string {
  'worklet';
  let d = '';
  for (let i = 0; i < points.length; i += 1) {
    const [sx, sy] = project(points[i], angle);
    d += `${i === 0 ? 'M' : 'L'} ${sx.toFixed(2)} ${sy.toFixed(2)} `;
  }
  return `${d}Z`;
}

function boxPaths(at: P3, w: number, h: number, d: number, angle: number): string {
  'worklet';
  const [x, y, z] = at;
  const hw = w / 2;
  const hd = d / 2;
  const top: P3[] = [
    [x - hw, y + h, z - hd], [x + hw, y + h, z - hd], [x + hw, y + h, z + hd], [x - hw, y + h, z + hd],
  ];
  const front: P3[] = [
    [x - hw, y, z + hd], [x + hw, y, z + hd], [x + hw, y + h, z + hd], [x - hw, y + h, z + hd],
  ];
  const side: P3[] = [
    [x + hw, y, z + hd], [x + hw, y, z - hd], [x + hw, y + h, z - hd], [x + hw, y + h, z + hd],
  ];
  return `${poly(top, angle)} ${poly(front, angle)} ${poly(side, angle)}`;
}

/**
 * "You keep the build": the finished circuit as a turning solid.
 *
 * Deliberately a clean wireframe-and-fill rather than a pretend render. It is an
 * honest illustration of the artifact, not a fake screenshot of one, and it
 * matches the flat-colour language the rest of the app uses.
 */
export const TwinScene: React.FC = () => {
  const t = useSharedValue(0);

  useEffect(() => {
    // A sway, not a turntable. Under isometric projection a full revolution
    // passes through 45 and 135 degrees, where the board's edges align with the
    // projection axes and the whole thing collapses into a flat rectangle for a
    // beat. Staying inside +/-32 degrees keeps it reading as a solid the whole
    // way through, and a slow ease at each end feels considered rather than
    // mechanical.
    t.value = withRepeat(
      withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [t]);

  const angleOf = (v: number) => {
    'worklet';
    return (v * 2 - 1) * SWAY;
  };

  const topFace = useAnimatedProps(() => ({
    d: poly([BOARD[4], BOARD[5], BOARD[6], BOARD[7]], angleOf(t.value)),
  }));

  const sides = useAnimatedProps(() => {
    const a = angleOf(t.value);
    // Front and right slabs give the board thickness. Which two faces are
    // visible changes as it turns, but drawing both and letting the top face
    // cover the hidden one keeps it cheap and correct-looking.
    const front = poly([BOARD[3], BOARD[2], BOARD[6], BOARD[7]], a);
    const right = poly([BOARD[2], BOARD[1], BOARD[5], BOARD[6]], a);
    const back = poly([BOARD[1], BOARD[0], BOARD[4], BOARD[5]], a);
    const left = poly([BOARD[0], BOARD[3], BOARD[7], BOARD[4]], a);
    return { d: `${front} ${right} ${back} ${left}` };
  });

  const parts = useAnimatedProps(() => {
    const a = angleOf(t.value);
    let d = '';
    for (let i = 0; i < PARTS.length; i += 1) {
      const p = PARTS[i];
      d += `${boxPaths(p.at, p.w, p.h, p.d, a)} `;
    }
    return { d };
  });

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <APath animatedProps={sides} fill={colors.line} stroke={colors.ink}
               strokeWidth={2.4} strokeLinejoin="round" />
        <APath animatedProps={topFace} fill={colors.white} stroke={colors.ink}
               strokeWidth={2.4} strokeLinejoin="round" />
        <APath animatedProps={parts} fill={colors.gold} fillOpacity={0.9} stroke={colors.ink}
               strokeWidth={2.2} strokeLinejoin="round" />
      </Svg>
    </View>
  );
};
