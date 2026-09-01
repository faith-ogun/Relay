import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold,
  Nunito_800ExtraBold, Nunito_900Black, useFonts,
} from '@expo-google-fonts/nunito';
import { AuthProvider } from '../hooks/useAuth';

import * as SystemUI from 'expo-system-ui';
import { View } from 'react-native';
import { ThemeProvider, useTheme } from '../theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Everything below the hardware.
 *
 * The inset is applied once here rather than in every screen. Each screen used
 * to guess with a fixed `paddingTop`, and on a phone with a Dynamic Island the
 * guess was too small: the back button sat under the clock and could not be
 * tapped, leaving a swipe as the only way out.
 */
function Shell() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();

  // The window BEHIND every screen. Without this the OS keeps painting its own
  // default white under a push transition and behind the keyboard, which is a
  // white flash on a dark app at exactly the moments a person is watching.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.cream).catch(() => {});
  }, [colors.cream]);

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.cream }}>
      {/* `light` means light CONTENT: a white clock and battery, which is what a
          dark page needs. Pinned at `dark` it was black on black. */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.cream },
          // `default` on iOS is the real UIKit push: interactive edge-swipe
          // back, parallax on the outgoing view, correct dimming. A hand-rolled
          // slide is strictly worse, and `slide_from_right` falls back to this
          // on iOS anyway.
          animation: 'default',
        }}
      >
        {/* Tab destinations are siblings, not a stack. A cross-fade between them
            reads as loading, because a fade is what a screen does while it is
            waiting, and iOS does not animate a tab switch at all.

            `gestureEnabled: false` is the important half, and it is here because
            of a bug reported 2026-09-01: opening Live and then swiping back
            landed on the SPLASH AND SIGN-IN SCREEN.

            The tab bar navigates with `router.replace`, so a tab root is the
            only entry in the stack and has nothing behind it. But iOS enables
            the interactive edge-swipe on every stack screen by default, so the
            gesture still fired and unwound past the tab root to the entry gate
            in `index.tsx`, which re-runs auth, re-reads the age gate and shows
            the brand splash for 1.4 seconds before redirecting. To a learner
            that is the app throwing them out to the login screen mid-session.

            A tab root has no "back", exactly as a real tab bar has no back, so
            the gesture is switched off on all six. `plans` was also missing from
            this list entirely, which is how it acquired both the wrong animation
            and the gesture the moment it was added on 2026-08-29.

            `mobile/scripts/check-tab-roots.mjs` fails if a tab in AppTabs is
            missing here or has the gesture enabled. */}
        <Stack.Screen name="home" options={{ animation: 'none', gestureEnabled: false }} />
        <Stack.Screen name="simulator" options={{ animation: 'none', gestureEnabled: false }} />
        <Stack.Screen name="live" options={{ animation: 'none', gestureEnabled: false }} />
        <Stack.Screen name="community" options={{ animation: 'none', gestureEnabled: false }} />
        <Stack.Screen name="plans" options={{ animation: 'none', gestureEnabled: false }} />
        <Stack.Screen name="profile" options={{ animation: 'none', gestureEnabled: false }} />
      </Stack>
    </View>
  );
}

/**
 * Inside the theme, so the splash comes down when the app is ready to be SEEN.
 *
 * `ThemeProvider` renders nothing until it has read the stored appearance, so
 * hiding the splash on fonts alone would uncover a blank window for however long
 * that read takes, and then paint the app. Mounting this under the provider
 * means "the theme is ready" is already true by the time the effect runs.
 */
function SplashGate({ ready }: { ready: boolean }) {
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  return ready ? <Shell /> : null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold,
    Nunito_800ExtraBold, Nunito_900Black,
  });

  return (
    <SafeAreaProvider>
      {/* Above AuthProvider: appearance is a device preference, not an account
          one, so it resolves before anyone is signed in and survives sign-out. */}
      <ThemeProvider>
        <AuthProvider>
          {/* Hidden on font error too, or a font CDN failure leaves the user
              staring at a splash screen forever with no way forward. */}
          <SplashGate ready={fontsLoaded || !!fontError} />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
