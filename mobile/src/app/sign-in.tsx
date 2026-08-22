import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import { Button } from '../components/Button';
import { AppleGlyph, GoogleGlyph, SocialButton } from '../components/SocialButton';
import { authErrorMessage, useAuth } from '../hooks/useAuth';
import {
  appleAvailable, googleConfigured, signInWithApple, signInWithGoogle,
} from '../services/socialAuth';
import { colors, font, radius, space, type } from '../theme/tokens';

type Busy = null | 'apple' | 'google' | 'email';

export default function SignIn() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [showEmail, setShowEmail] = useState(false);
  const [hasApple, setHasApple] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  useEffect(() => {
    let alive = true;
    appleAvailable().then((ok) => alive && setHasApple(ok));
    return () => { alive = false; };
  }, []);

  const signUpMode = mode === 'up';

  const afterSocial = (isNewUser: boolean) =>
    router.replace(isNewUser ? '/home' : '/home');

  const doApple = async () => {
    if (busy) return;
    setBusy('apple'); setError(null);
    const res = await signInWithApple();
    setBusy(null);
    if (res.ok) return afterSocial(res.isNewUser);
    if (!res.cancelled) setError(res.message);
  };

  const doGoogle = async () => {
    if (busy) return;
    setBusy('google'); setError(null);
    const res = await signInWithGoogle();
    setBusy(null);
    if (res.ok) return afterSocial(res.isNewUser);
    if (!res.cancelled) setError(res.message);
  };

  const doEmail = async () => {
    if (busy) return;
    setBusy('email'); setError(null);
    try {
      if (signUpMode) await signUp(name, email, password);
      else await signIn(email, password);
      router.replace('/home');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button">
          <Text style={s.backText}>‹ Back</Text>
        </Pressable>

        <Text style={s.eyebrow}>OHMLET</Text>
        <Text style={s.title}>{signUpMode ? 'Create your account.' : 'Welcome back.'}</Text>
        <Text style={s.sub}>
          {signUpMode ? 'Your progress, streak and builds sync across every device.' : 'Pick up where you left off.'}
        </Text>

        <View style={s.stack}>
          {/* Apple first: App Store guideline 4.8 requires Sign in with Apple
              wherever another third-party sign-in is offered. */}
          {hasApple && (
            <SocialButton
              tone="apple"
              label="Continue with Apple"
              glyph={<AppleGlyph />}
              onPress={doApple}
              busy={busy === 'apple'}
              disabled={!!busy && busy !== 'apple'}
            />
          )}

          {googleConfigured() && (
            <SocialButton
              tone="plain"
              label="Continue with Google"
              glyph={<GoogleGlyph />}
              onPress={doGoogle}
              busy={busy === 'google'}
              disabled={!!busy && busy !== 'google'}
            />
          )}

          {(hasApple || googleConfigured()) && (
            <View style={s.dividerRow}>
              <View style={s.rule} />
              <Text style={s.dividerText}>or</Text>
              <View style={s.rule} />
            </View>
          )}

          {!showEmail ? (
            <SocialButton
              tone="plain"
              label="Continue with email"
              onPress={() => setShowEmail(true)}
              disabled={!!busy}
            />
          ) : (
            <View>
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
              <Button
                label={busy === 'email' ? 'One moment…' : signUpMode ? 'Create account' : 'Log in'}
                onPress={doEmail}
                disabled={!!busy}
                style={{ marginTop: space.sm }}
              />
            </View>
          )}

          {error && <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text>}
        </View>

        <Pressable
          onPress={() => { setMode(signUpMode ? 'in' : 'up'); setError(null); }}
          style={s.switch}
          accessibilityRole="button"
        >
          <Text style={s.switchText}>
            {signUpMode ? 'Already have an account? Log in' : 'New here? Create an account'}
          </Text>
        </Pressable>

        <Text style={s.legal}>
          By continuing you agree to Ohmlet's Terms and Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const Field: React.FC<{ label: string } & React.ComponentProps<typeof TextInput>> = ({ label, ...rest }) => (
  <View style={{ marginBottom: space.md }}>
    <Text style={s.label}>{label}</Text>
    <TextInput style={s.input} placeholderTextColor={colors.inkSoft} accessibilityLabel={label} {...rest} />
  </View>
);

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  scroll: { padding: space.lg, paddingTop: space.xxl * 1.2, flexGrow: 1 },
  back: { paddingVertical: space.sm, alignSelf: 'flex-start' },
  backText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
  eyebrow: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.inkSoft, marginTop: space.md },
  title: { fontFamily: font.black, fontSize: type.display, color: colors.ink, letterSpacing: -0.8, marginTop: 4 },
  sub: { fontFamily: font.semibold, fontSize: type.body, color: colors.inkSoft, marginTop: space.sm, lineHeight: 22 },
  stack: { marginTop: space.xl, gap: space.sm },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.xs },
  rule: { flex: 1, height: 2, backgroundColor: colors.line, borderRadius: 1 },
  dividerText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
  label: { fontFamily: font.extrabold, fontSize: type.small, color: colors.ink, marginBottom: 6 },
  input: {
    borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.white,
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: font.semibold, fontSize: type.body, color: colors.ink,
  },
  error: { fontFamily: font.bold, fontSize: type.small, color: colors.red, marginTop: space.xs },
  switch: { marginTop: space.lg, alignItems: 'center', paddingVertical: space.sm },
  switchText: { fontFamily: font.bold, fontSize: type.small, color: colors.blueDeep },
  legal: {
    fontFamily: font.regular, fontSize: type.meta, color: colors.inkSoft,
    textAlign: 'center', marginTop: 'auto', paddingTop: space.lg, lineHeight: 16,
  },
});
