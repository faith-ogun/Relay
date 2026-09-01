import React from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { curve, font, radius, space, tracking, type } from '../theme/tokens';
import { motion } from '../theme/motion';
import { makeStyles, useColors, useTheme, type ThemeMode } from '../theme/theme';

// ── Appearance ──
//
// A three-way choice shown in place rather than pushed behind a row, because
// the result of the choice IS the screen you are looking at: tapping Dark and
// watching the page turn over under your finger is the whole feedback, and a
// push transition throws it away.
//
// System is first and it is the default. Most people never touch this; the ones
// who do are choosing to override their phone, and an override reads as an
// override when the thing it overrides is what it sits beside.

const GLYPH = 20;

/** Day. A disc with rays, drawn on the same 24-grid as components/icons. */
const SunGlyph: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={GLYPH} height={GLYPH} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={4.4} fill={color} />
    <Path
      d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.9 1.9M16.7 16.7l1.9 1.9M18.6 5.4l-1.9 1.9M7.3 16.7l-1.9 1.9"
      stroke={color} strokeWidth={2.2} strokeLinecap="round"
    />
  </Svg>
);

/** Night. A crescent cut from a disc rather than drawn as a stroke, so it keeps
 *  the same optical weight as the sun beside it. */
const MoonGlyph: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={GLYPH} height={GLYPH} viewBox="0 0 24 24">
    <Path
      d="M20.4 14.7A8.6 8.6 0 0 1 9.3 3.6a8.9 8.9 0 1 0 11.1 11.1Z"
      fill={color} stroke={color} strokeWidth={2.2} strokeLinejoin="round"
    />
  </Svg>
);

/** Whatever the phone is doing. A handset, because that is the thing being
 *  deferred to. */
const DeviceGlyph: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={GLYPH} height={GLYPH} viewBox="0 0 24 24">
    <Rect x={6.4} y={2.6} width={11.2} height={18.8} rx={3} fill="none" stroke={color} strokeWidth={2.2} />
    <Path d="M10.4 18.2h3.2" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
  </Svg>
);

const OPTIONS: { mode: ThemeMode; label: string; Glyph: React.FC<{ color: string }> }[] = [
  { mode: 'system', label: 'System', Glyph: DeviceGlyph },
  { mode: 'light', label: 'Light', Glyph: SunGlyph },
  { mode: 'dark', label: 'Dark', Glyph: MoonGlyph },
];

const Segment: React.FC<{
  label: string;
  Glyph: React.FC<{ color: string }>;
  selected: boolean;
  onPress: () => void;
}> = ({ label, Glyph, selected, onPress }) => {
  const s = useSegment();
  const colors = useColors();
  const depth = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: depth.value * 2 }] }));

  return (
    <Pressable
      onPressIn={() => {
        depth.value = withSpring(1, motion.press);
        Haptics.selectionAsync().catch(() => {});
      }}
      onPressOut={() => { depth.value = withSpring(0, motion.release); }}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} appearance`}
      style={s.hit}
    >
      <Animated.View style={[s.seg, selected && s.segOn, face]}>
        <Glyph color={selected ? colors.onInk : colors.inkSoft} />
        <Text style={[s.label, selected && s.labelOn]} numberOfLines={1}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
};

/**
 * The appearance control. Stateless: the provider owns the choice, writes it to
 * the device, and every stylesheet in the app re-derives from it.
 */
export const AppearancePicker: React.FC = () => {
  const s = useStyles();
  const { mode, scheme, setMode } = useTheme();

  return (
    <View style={s.wrap}>
      <View style={s.track} accessibilityRole="radiogroup">
        {OPTIONS.map((o) => (
          <Segment
            key={o.mode}
            label={o.label}
            Glyph={o.Glyph}
            selected={mode === o.mode}
            onPress={() => setMode(o.mode)}
          />
        ))}
      </View>
      <Text style={s.caption}>
        {mode === 'system'
          ? `Following your phone, which is set to ${scheme}.`
          : `Always ${mode}, whatever your phone is set to.`}
      </Text>
    </View>
  );
};

const useStyles = makeStyles((colors, th) => ({
  wrap: { gap: space.sm },
  // One track holding three segments, not three separate pills: a segmented
  // control says "pick exactly one of these" in a way three buttons never do.
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 2, borderColor: colors.line, borderRadius: radius.md, ...curve,
    padding: 4, gap: 4,
    ...th.elevation.card,
  },
  caption: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    letterSpacing: tracking.small, paddingHorizontal: 2,
  },
}));

const useSegment = makeStyles((colors) => ({
  hit: { flex: 1 },
  seg: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: radius.sm, ...curve,
  },
  segOn: { backgroundColor: colors.ink },
  label: { fontFamily: font.black, fontSize: type.small, color: colors.inkSoft },
  labelOn: { color: colors.onInk },
}));
