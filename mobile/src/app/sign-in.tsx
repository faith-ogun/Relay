import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View, Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { Button } from '../components/Button';
import { authErrorMessage, useAuth } from '../hooks/useAuth';
import { colors, font, radius, space, type } from '../theme/tokens';

export default function SignIn() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;               // in-flight guard: double-tap must not double-submit
    setBusy(true);
    setError(null);
    try {
      if (mode === 'in') await signIn(email, password);
      else await signUp(name, email, password);
      router.replace('/home');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const signUpMode = mode === 'up';

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.eyebrow}>OHMLET</Text>
        <Text style={s.title}>{signUpMode ? 'Start building.' : 'Welcome back.'}</Text>
        <Text style={s.sub}>
          {signUpMode
            ? 'Learn electronics by building real circuits, with a tutor that watches your bench.'
            : 'Pick up where you left off.'}
        </Text>

        <View style={s.form}>
          {signUpMode && (
            <Field label="Your name" value={name} onChangeText={setName} autoCapitalize="words" />
          )}
          <Field
            label="Email" value={email} onChangeText={setEmail}
            keyboardType="email-address" autoCapitalize="none" autoComplete="email"
          />
          <Field
            label="Password" value={password} onChangeText={setPassword}
            secureTextEntry autoComplete={signUpMode ? 'new-password' : 'current-password'}
          />

          {error && <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text>}

          <Button
            label={busy ? 'One moment…' : signUpMode ? 'Create account' : 'Log in'}
            onPress={submit}
            disabled={busy}
            style={{ marginTop: space.md }}
          />

          <Pressable
            onPress={() => { setMode(signUpMode ? 'in' : 'up'); setError(null); }}
            style={s.switch}
            accessibilityRole="button"
          >
            <Text style={s.switchText}>
              {signUpMode ? 'Already have an account? Log in' : "New here? Create an account"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const Field: React.FC<
  { label: string } & React.ComponentProps<typeof TextInput>
> = ({ label, ...rest }) => (
  <View style={{ marginBottom: space.md }}>
    <Text style={s.label}>{label}</Text>
    <TextInput
      style={s.input}
      placeholderTextColor={colors.inkSoft}
      accessibilityLabel={label}
      {...rest}
    />
  </View>
);

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  scroll: { padding: space.lg, paddingTop: space.xxl * 1.6, flexGrow: 1 },
  eyebrow: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 3,
    color: colors.inkSoft, marginBottom: space.sm,
  },
  title: { fontFamily: font.black, fontSize: type.display, color: colors.ink, letterSpacing: -0.8 },
  sub: {
    fontFamily: font.semibold, fontSize: type.body, color: colors.inkSoft,
    marginTop: space.sm, lineHeight: 22,
  },
  form: { marginTop: space.xl },
  label: {
    fontFamily: font.extrabold, fontSize: type.small, color: colors.ink, marginBottom: 6,
  },
  input: {
    borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm,
    backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: font.semibold, fontSize: type.body, color: colors.ink,
  },
  error: {
    fontFamily: font.bold, fontSize: type.small, color: colors.red, marginTop: space.xs,
  },
  switch: { marginTop: space.lg, alignItems: 'center', paddingVertical: space.sm },
  switchText: { fontFamily: font.bold, fontSize: type.small, color: colors.blueDeep },
});
