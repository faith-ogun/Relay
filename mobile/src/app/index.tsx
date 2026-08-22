import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { hasSeenOnboarding } from '../services/firstRun';
import { colors } from '../theme/tokens';

/**
 * Entry gate.
 *
 *   signed in                  -> home
 *   signed out, first launch   -> welcome (then the tour, then auth)
 *   signed out, been here      -> straight to auth
 *
 * The tour is not re-shown after a sign-out: it introduces the product, and the
 * person has already met it.
 */
export default function Index() {
  const { user, loading } = useAuth();
  const [seenTour, setSeenTour] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    hasSeenOnboarding().then((seen) => alive && setSeenTour(seen));
    return () => { alive = false; };
  }, []);

  if (loading || seenTour === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream }}>
        <ActivityIndicator color={colors.goldDeep} />
      </View>
    );
  }

  if (user) return <Redirect href="/home" />;
  return <Redirect href={seenTour ? '/sign-in' : '/welcome'} />;
}
