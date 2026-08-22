import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, font, pressSmall, radius, type } from '../theme/tokens';

type Variant = 'primary' | 'secondary';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
}

/**
 * The Ohmlet button. The web app uses a hard offset shadow that collapses on
 * press, so the control reads as physically pushed rather than just tinted.
 * Reproduced here by animating the button down by the shadow offset while
 * fading the shadow out, which is the closest RN equivalent.
 */
export const Button: React.FC<Props> = ({ label, onPress, variant = 'primary', disabled, style }) => {
  const depth = useRef(new Animated.Value(0)).current;

  const set = (to: number) =>
    Animated.spring(depth, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 0 }).start();

  const translateY = depth.interpolate({ inputRange: [0, 1], outputRange: [0, 3] });
  const primary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => set(1)}
      onPressOut={() => set(0)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={style}
    >
      <Animated.View
        style={[
          styles.base,
          primary ? styles.primary : styles.secondary,
          disabled && styles.disabled,
          { transform: [{ translateY }] },
        ]}
      >
        <Text style={[styles.label, primary ? styles.labelPrimary : styles.labelSecondary]}>
          {label}
        </Text>
      </Animated.View>
      {/* Static shadow plate sits behind, so the face appears to press into it. */}
      <View style={[styles.plate, primary ? styles.platePrimary : styles.plateSecondary]} pointerEvents="none" />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    ...pressSmall,
  },
  primary: { backgroundColor: colors.gold },
  secondary: { backgroundColor: colors.white },
  disabled: { opacity: 0.55 },
  plate: {
    position: 'absolute',
    left: 0, right: 0, top: 3, bottom: -3,
    borderRadius: radius.md,
    zIndex: 1,
  },
  platePrimary: { backgroundColor: colors.ink },
  plateSecondary: { backgroundColor: colors.ink },
  label: { fontFamily: font.black, fontSize: type.body, letterSpacing: 0.2 },
  labelPrimary: { color: colors.ink },
  labelSecondary: { color: colors.ink },
});
