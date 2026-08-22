import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold,
  Nunito_800ExtraBold, Nunito_900Black, useFonts,
} from '@expo-google-fonts/nunito';
import { AuthProvider } from '../hooks/useAuth';
import { colors } from '../theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

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
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.cream },
          animation: 'fade',
        }}
      />
    </AuthProvider>
  );
}
