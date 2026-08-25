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
import { colors, space } from '../theme/tokens';
import { View } from 'react-native';

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
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.cream }}>
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
            waiting, and iOS does not animate a tab switch at all. */}
        <Stack.Screen name="home" options={{ animation: 'none' }} />
        <Stack.Screen name="simulator" options={{ animation: 'none' }} />
        <Stack.Screen name="live" options={{ animation: 'none' }} />
        <Stack.Screen name="community" options={{ animation: 'none' }} />
        <Stack.Screen name="profile" options={{ animation: 'none' }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold,
    Nunito_800ExtraBold, Nunito_900Black,
  });

  useEffect(() => {
    // Hide the splash on font error too, otherwise a font CDN failure leaves the
    // user staring at a splash screen forever with no way forward.
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Shell />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
