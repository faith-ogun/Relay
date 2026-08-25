import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, curve, font, tracking, type } from '../theme/tokens';
import { innerLight, plateFor } from '../theme/elevation';
import { motion } from '../theme/motion';

type Variant = 'primary' | 'secondary';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
}

const BORDER = 3;
const PLATE = plateFor(BORDER);

/**
 * The Ohmlet button.
 *
 * Rebuilt because the previous one had three faults that each cost realism:
 *
 *   1. It carried BOTH the legacy shadow props and a plate, so iOS drew two
 *      shadows and Android drew a blurred grey smudge and raised the face above
 *      the plate in z-order. The plate IS the shadow; there is no second one.
 *   2. Both variants used an ink plate, so the variant did nothing and a black
 *      plate under a gold face read as a sticker rather than a moulded object.
 *      A coloured face gets its own hue's dark step.
 *   3. The plate had no border, so it read as two stacked rectangles instead of
 *      one form. The outline now runs around the whole thing.
 *
 * The invariant that makes it feel physical: total height never changes. The
 * face slides down INSIDE the plate, so nothing below it moves.
 *
 * Haptic fires on press IN, before the visual. Latency there is the whole
 * effect; firing it on release feels like a delayed echo.
 */
export const Button: React.FC<Props> = ({ label, onPress, variant = 'primary', disabled, style }) => {
  const depth = useSharedValue(0);
  const primary = variant === 'primary';

  const face = useAnimatedStyle(() => ({
    transform: [{ translateY: depth.value * PLATE }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        if (disabled) return;
        depth.value = withSpring(1, motion.press);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }}
      onPressOut={() => { depth.value = withSpring(0, motion.release); }}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={style}
    >
      <View
        style={[
          s.plate,
          primary ? s.platePrimary : s.plateSecondary,
          // A disabled button is already pressed down: no plate to fall into.
          disabled && s.plateDisabled,
        ]}
      >
        <Animated.View
          style={[
            s.face,
            primary ? s.facePrimary : s.faceSecondary,
            disabled && s.faceDisabled,
            !disabled && innerLight,
            face,
          ]}
        >
          <Text
            style={[
              s.label,
              primary ? s.labelPrimary : s.labelSecondary,
              disabled && s.labelDisabled,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </Animated.View>
      </View>
    </Pressable>
  );
};

const s = StyleSheet.create({
  plate: {
    borderRadius: 16, ...curve,
    borderWidth: BORDER,
    borderColor: colors.ink,
    paddingTop: PLATE,
    ...curve,
  },
  platePrimary: { backgroundColor: colors.goldPlate },
  plateSecondary: { backgroundColor: colors.inkSoft },
  plateDisabled: { backgroundColor: colors.inkFaint, borderColor: colors.inkMute, paddingTop: 0 },

  face: {
    // Concentric: outer radius minus the border, or the corners look pasted.
    borderRadius: 16 - BORDER,
    // Nunito's round glyphs sit high in the box, so the face is optically
    // centred rather than mathematically centred.
    paddingTop: 13,
    paddingBottom: 15,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...curve,
  },
  facePrimary: { backgroundColor: colors.gold },
  faceSecondary: { backgroundColor: colors.white },
  faceDisabled: { backgroundColor: colors.goldSoft },

  label: {
    fontFamily: font.extrabold,
    fontSize: type.bodyLg,
    letterSpacing: tracking.label,
  },
  labelPrimary: { color: colors.goldText },
  labelSecondary: { color: colors.ink },
  labelDisabled: { color: colors.inkMute },
});
