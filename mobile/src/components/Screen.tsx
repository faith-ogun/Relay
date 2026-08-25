import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '../theme/tokens';

/**
 * A screen that knows where the hardware is.
 *
 * Every screen used to hardcode `paddingTop: space.xxl`, which is a guess. On a
 * phone with a Dynamic Island that guess is too small, so the back button sat
 * underneath the clock and could not be tapped: the only way back was a swipe,
 * which not everyone reaches for.
 *
 * `react-native-safe-area-context` was already a dependency and simply never
 * used. This wraps it so no screen has to think about it again, and so a device
 * with different insets is handled rather than approximated.
 */
export const Screen: React.FC<{
  children: React.ReactNode;
  /** Extra padding below the safe inset, on top of the default. */
  topExtra?: number;
  /** Set when the screen sits above a tab bar that already handles the bottom. */
  ignoreBottom?: boolean;
  style?: ViewStyle;
}> = ({ children, topExtra = 0, ignoreBottom = false, style }) => {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        s.screen,
        {
          paddingTop: insets.top + space.sm + topExtra,
          paddingBottom: ignoreBottom ? 0 : insets.bottom,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
});
