import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import { useAuth } from '../hooks/useAuth';
import { usePlan } from '../hooks/usePlan';
import { deleteMyAccount, fetchMyData } from '../services/privacy';
import { clearLocalState } from '../services/progress';
import { clearProfile } from '../services/learnerProfile';
import { colors, font, pressSmall, radius, space, type } from '../theme/tokens';

const LEGAL_BASE = 'https://ohmlet.org';

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  max: 'Max',
};

/**
 * Account and privacy.
 *
 * Account deletion is here because App Store review guideline 5.1.1(v) requires
 * an app that offers account creation to offer deletion from inside the app: a
 * link to the website or an email address is an automatic rejection. It is also
 * simply the right of a user under GDPR Art. 17.
 *
 * Deletion is typed-to-confirm rather than a second "are you sure" tap. It is
 * irreversible and takes the learner's whole history with it, so the friction is
 * the point.
 */
export default function Account() {
  const { user, displayName, signOut } = useAuth();
  const plan = usePlan();
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');

  const canDelete = typed.trim().toUpperCase() === 'DELETE';

  const exportData = async () => {
    setBusy('export');
    const result = await fetchMyData();
    setBusy(null);
    if (!result.ok) {
      Alert.alert(
        'Could not build your export',
        result.reason === 'offline'
          ? 'You appear to be offline. Try again when you have a connection.'
          : 'Something went wrong. Please try again, or contact support if it keeps happening.',
      );
      return;
    }
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const file = new File(Paths.cache, `ohmlet-data-${stamp}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify(result.data, null, 2));
      // Imported here rather than at module scope. A missing native module
      // throws on import, which would take down the whole Account screen and
      // with it the only route to account deletion. The export is the optional
      // part; deletion must never be unreachable.
      try {
        const Sharing = await import('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
          return;
        }
      } catch {
        /* fall through to the path alert */
      }
      Alert.alert('Export ready', `Your data was saved to:\n\n${file.uri}`);
    } catch {
      Alert.alert('Could not save your export', 'Please try again.');
    }
  };

  const confirmDelete = async () => {
    setBusy('delete');
    const result = await deleteMyAccount();
    setBusy(null);
    if (!result.ok) {
      Alert.alert(
        'Could not delete your account',
        result.reason === 'offline'
          ? 'You appear to be offline. Nothing has been deleted. Try again when you have a connection.'
          : 'Nothing has been deleted. Please try again, or contact support.',
      );
      return;
    }
    // The server has already revoked every session. Clear what this device kept
    // so the next person to open the app does not inherit any of it, including
    // the setup answers, which describe a person as much as their progress does.
    await Promise.all([clearLocalState(user?.uid), clearProfile()]);
    await signOut().catch(() => undefined);
    router.replace('/welcome');
  };

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.scroll}>
      <Pressable onPress={() => router.back()} style={s.backLink} accessibilityRole="button">
        <Text style={s.backText}>‹ Back</Text>
      </Pressable>

      <Text style={s.kicker}>ACCOUNT</Text>
      <Text style={s.name}>{displayName || 'Builder'}</Text>
      {!!user?.email && <Text style={s.email}>{user.email}</Text>}

      <View style={s.planCard}>
        <Text style={s.planLabel}>CURRENT PLAN</Text>
        <Text style={s.planName}>{PLAN_LABEL[plan.plan] ?? 'Free'}</Text>
        <Pressable onPress={() => router.push('/plans')} accessibilityRole="button">
          <Text style={s.planLink}>See plans</Text>
        </Pressable>
      </View>

      <Text style={s.section}>YOUR DATA</Text>
      <Pressable
        onPress={exportData}
        disabled={busy !== null}
        style={[s.action, busy === 'export' && s.actionBusy]}
        accessibilityRole="button"
      >
        <View style={s.actionText}>
          <Text style={s.actionTitle}>Download my data</Text>
          <Text style={s.actionSub}>
            Everything we hold: progress, posts, comments, league standings, twins.
          </Text>
        </View>
        {busy === 'export' && <ActivityIndicator color={colors.goldDeep} />}
      </Pressable>

      <Text style={s.section}>LEGAL</Text>
      <Pressable onPress={() => Linking.openURL(`${LEGAL_BASE}/privacy`)} style={s.action} accessibilityRole="link">
        <View style={s.actionText}><Text style={s.actionTitle}>Privacy policy</Text></View>
        <Text style={s.chevron}>›</Text>
      </Pressable>
      <Pressable onPress={() => Linking.openURL(`${LEGAL_BASE}/terms`)} style={s.action} accessibilityRole="link">
        <View style={s.actionText}><Text style={s.actionTitle}>Terms of service</Text></View>
        <Text style={s.chevron}>›</Text>
      </Pressable>
      <Pressable onPress={() => Linking.openURL(`${LEGAL_BASE}/support`)} style={s.action} accessibilityRole="link">
        <View style={s.actionText}><Text style={s.actionTitle}>Support</Text></View>
        <Text style={s.chevron}>›</Text>
      </Pressable>

      <Pressable
        onPress={async () => { await signOut(); router.replace('/welcome'); }}
        style={s.signOut}
        accessibilityRole="button"
      >
        <Text style={s.signOutText}>Sign out</Text>
      </Pressable>

      <View style={s.danger}>
        <Text style={s.dangerTitle}>Delete account</Text>
        <Text style={s.dangerBody}>
          This erases your progress, streak, XP, achievements, community posts and comments, league
          standings, interview reports and 3D twins, and cancels any subscription. It cannot be
          undone.
        </Text>
        <Text style={s.dangerBody}>
          Records we are legally required to keep are the exception: payment and tax records held by
          our payment processor, and any moderation reports you filed, which stay as an audit trail
          with your identity removed.
        </Text>

        {!confirming ? (
          <Pressable onPress={() => setConfirming(true)} style={s.dangerButton} accessibilityRole="button">
            <Text style={s.dangerButtonText}>Delete my account</Text>
          </Pressable>
        ) : (
          <View style={s.confirmBlock}>
            <Text style={s.confirmLabel}>Type DELETE to confirm</Text>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="DELETE"
              placeholderTextColor={colors.inkSoft}
              style={s.confirmInput}
              accessibilityLabel="Type DELETE to confirm account deletion"
            />
            <Pressable
              onPress={confirmDelete}
              disabled={!canDelete || busy !== null}
              style={[s.dangerButton, !canDelete && s.dangerButtonOff]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canDelete }}
            >
              {busy === 'delete'
                ? <ActivityIndicator color={colors.white} />
                : <Text style={s.dangerButtonText}>Permanently delete</Text>}
            </Pressable>
            <Pressable onPress={() => { setConfirming(false); setTyped(''); }} accessibilityRole="button">
              <Text style={s.cancel}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  scroll: { padding: space.lg, paddingBottom: space.xxl, gap: 2 },
  backLink: { paddingVertical: space.sm },
  backText: { fontFamily: font.bold, fontSize: type.body, color: colors.blueDeep },
  kicker: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 2.5, color: colors.blueDeep },
  name: { fontFamily: font.black, fontSize: type.title, color: colors.ink, marginTop: 4, letterSpacing: -0.5 },
  email: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 2 },

  planCard: {
    marginTop: space.lg, borderWidth: 2.5, borderColor: colors.ink, borderRadius: radius.lg,
    backgroundColor: colors.goldSoft, padding: space.md, ...pressSmall,
  },
  planLabel: { fontFamily: font.black, fontSize: 9, letterSpacing: 1.6, color: colors.inkSoft },
  planName: { fontFamily: font.black, fontSize: type.heading, color: colors.ink, marginTop: 2 },
  planLink: { fontFamily: font.bold, fontSize: type.small, color: colors.blueDeep, marginTop: 6 },

  section: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 2, color: colors.inkSoft,
    marginTop: space.xl, marginBottom: space.sm,
  },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    borderWidth: 2, borderColor: colors.line, borderRadius: radius.md,
    backgroundColor: colors.white, padding: space.md, marginBottom: 8,
  },
  actionBusy: { opacity: 0.6 },
  actionText: { flex: 1 },
  actionTitle: { fontFamily: font.bold, fontSize: type.body, color: colors.ink },
  actionSub: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 2, lineHeight: 18 },
  chevron: { fontFamily: font.black, fontSize: type.heading, color: colors.inkSoft },

  signOut: { marginTop: space.xl, alignSelf: 'center', paddingVertical: space.md },
  signOutText: { fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft },

  danger: {
    marginTop: space.xl, borderWidth: 2.5, borderColor: colors.red, borderRadius: radius.lg,
    backgroundColor: '#fdece8', padding: space.md, gap: space.sm,
  },
  dangerTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink },
  dangerBody: { fontFamily: font.semibold, fontSize: type.small, color: colors.ink, lineHeight: 19 },
  dangerButton: {
    marginTop: space.sm, backgroundColor: colors.red, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center',
  },
  dangerButtonOff: { opacity: 0.45 },
  dangerButtonText: { fontFamily: font.black, fontSize: type.body, color: colors.white },
  confirmBlock: { gap: space.sm },
  confirmLabel: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 1.4, color: colors.ink },
  confirmInput: {
    borderWidth: 2.5, borderColor: colors.ink, borderRadius: radius.md, backgroundColor: colors.white,
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: font.black, fontSize: type.body,
    color: colors.ink, letterSpacing: 2,
  },
  cancel: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft, textAlign: 'center', paddingVertical: 8 },
});
