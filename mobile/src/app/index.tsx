import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../theme/tokens';

/** Entry gate: wait for auth to resolve, then route. */
export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream }}>
        <ActivityIndicator color={colors.goldDeep} />
      </View>
    );
  }

  return <Redirect href={user ? '/home' : '/sign-in'} />;
}
