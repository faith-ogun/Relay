import React from 'react';
import { Image, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles } from '../theme/theme';

// The exact ground the launch artwork is painted on, sampled from the file
// rather than taken from the brand tokens. `colors.cream` is a yellower cream
// and the two sit 2.7 dE apart, which is far enough that butting them against
// each other shows as a band across the screen.
const GROUND = '#fcf8f5';

/**
 * The launch image, held while the app works out where you belong.
 *
 * This is the same artwork the iOS launch storyboard shows, fitted the same way
 * and positioned the same way, so the moment the JS bundle takes over there is
 * nothing to see: no jump, no fade, no second wordmark. That continuity is the
 * point, and it is also why nothing here animates. The screen before it is a
 * still image, so motion would announce the seam rather than cover it.
 */
export const BrandSplash: React.FC = () => {
  const s = useS();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // The root layout insets every screen from the top so back buttons clear the
  // Dynamic Island. The splash has no controls and is deliberately full bleed,
  // so it steps back out of that inset and covers the window edge to edge, the
  // way the launch storyboard does. Without this the artwork would start a
  // status bar lower than it did a frame earlier, and the strip above it would
  // be the shell's cream rather than the artwork's.
  return (
      <View style={[s.screen, { top: -insets.top, width, height }]}>
        <Image
          source={require('../../assets/brand/splash-screen.png')}
          style={s.art}
          // scaleAspectFit, matching the storyboard. The artwork's own ground runs
          // to all four edges and GROUND matches it exactly, so the fitted bands
          // read as more of the same cream rather than as letterboxing, and the
          // face and the wordmark survive every screen shape uncropped.
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="Ohmlet"
        />
      </View>
    );
};

const useS = makeStyles((colors) => ({
  screen: { position: 'absolute', left: 0, backgroundColor: GROUND },
  art: { width: '100%', height: '100%' },
}));
