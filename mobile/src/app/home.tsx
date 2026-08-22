import React from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { colors, font, pressSmall, radius, space, type } from '../theme/tokens';
import { API_BASE } from '../services/config';

export default function Home() {
  const { displayName, signOut } = useAuth();

  const leave = async () => {
    await signOut();
    router.replace('/sign-in');
  };

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.scroll}>
      <View style={s.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>TODAY</Text>
          {/* Real name, never a hardcoded one. */}
          <Text style={s.title}>Welcome back, {displayName}.</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardKicker}>NEXT UP</Text>
        <Text style={s.cardTitle}>Light-Activated Alarm</Text>
        <Text style={s.cardBody}>
          Build a voltage divider with an LDR and trigger an LED or buzzer when the light drops.
          Twenty minutes, six parts.
        </Text>
        <Button label="Start building" onPress={() => {}} style={{ marginTop: space.md }} />
      </View>

      <Text style={s.sectionHeading}>Coming next</Text>
      <Text style={s.note}>
        The live tutor, the lesson runner, and the paywall are being wired to the same backend the
        web app already uses. This screen is the shell they mount into.
      </Text>

      <View style={s.debug}>
        <Text style={s.debugLabel}>BACKEND</Text>
        <Text style={s.debugValue}>{API_BASE ? 'connected' : 'not configured'}</Text>
      </View>

      <Pressable onPress={leave} style={s.signOut} accessibilityRole="button">
        <Text style={s.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  scroll: { padding: space.lg, paddingTop: space.xxl * 1.4, paddingBottom: space.xxl },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  eyebrow: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.inkSoft },
  title: {
    fontFamily: font.black, fontSize: type.title, color: colors.ink,
    letterSpacing: -0.6, marginTop: 4,
  },
  card: {
    marginTop: space.lg, backgroundColor: colors.white, borderWidth: 2.5,
    borderColor: colors.ink, borderRadius: radius.lg, padding: space.lg, ...pressSmall,
  },
  cardKicker: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 2, color: colors.inkSoft },
  cardTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink, marginTop: 6 },
  cardBody: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    marginTop: 6, lineHeight: 20,
  },
  sectionHeading: {
    fontFamily: font.black, fontSize: type.heading, color: colors.ink, marginTop: space.xl,
  },
  note: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    marginTop: 6, lineHeight: 20,
  },
  debug: {
    marginTop: space.xl, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', borderWidth: 2, borderColor: colors.line,
    borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: colors.white,
  },
  debugLabel: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 2, color: colors.inkSoft },
  debugValue: { fontFamily: font.bold, fontSize: type.small, color: colors.ink },
  signOut: { marginTop: space.xl, alignItems: 'center', paddingVertical: space.sm },
  signOutText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
});
