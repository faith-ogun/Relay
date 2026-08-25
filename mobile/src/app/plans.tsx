import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { track } from '../services/analytics';
import { goBack } from '../services/nav';
import { useAuth } from '../hooks/useAuth';
import { useChildSafe } from '../hooks/useChildSafe';
import { ClosedForNow } from '../components/ClosedForNow';
import { Button } from '../components/Button';
import { usePlan } from '../hooks/usePlan';
import {
  billingState, billingUnavailableReason, getOfferings, initBilling,
  purchasePackage, restorePurchases, type Package,
} from '../services/billing';
import { PLAN_META, type Plan } from '../services/entitlements';
import { colors, font, radius, space, type, curve } from '../theme/tokens';
import { elevation } from '../theme/elevation';

const ORDER: Plan[] = ['free', 'pro', 'max'];

/** RevenueCat's package type spelled the way a person would say it. */
function periodLabel(period: string): string {
  switch (period.toUpperCase()) {
    case 'MONTHLY': return 'month';
    case 'ANNUAL': return 'year';
    case 'WEEKLY': return 'week';
    case 'SIX_MONTH': return 'six months';
    case 'THREE_MONTH': return 'three months';
    case 'TWO_MONTH': return 'two months';
    default: return '';   // lifetime and one-off packages do not renew
  }
}

export default function Plans() {
  const { user } = useAuth();
  const { childSafe, resolved: childResolved } = useChildSafe();
  const { plan, minutesRemaining, unlimited, refresh } = usePlan();
  const [packages, setPackages] = useState<Package[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (childSafe) return;
      // The uid matters: RevenueCat assigns an anonymous id without it, and
      // the webhook then has no way to map a purchase back to the account. The
      // learner would pay and stay on the free cap.
      await initBilling(user?.uid);
      const pkgs = await getOfferings();
      if (alive) setPackages(pkgs);
    })();
    return () => { alive = false; };
  }, [childSafe, user?.uid]);

  // Child mode (#94): refuse even when reached directly, since hiding a row on
  // Home is not a control.
  if (childResolved && childSafe) {
    return (
      <ClosedForNow
        title="Plans are managed by a grown-up"
        body="Ohmlet does not take payments from an account that belongs to a minor. A parent or guardian can manage a plan from their own account."
      />
    );
  }

  const unavailable = billingUnavailableReason(billingState());

  const buy = async (id: string) => {
    setBusy(id); setNote(null);
    track('checkout_start', { packageId: id });
    const res = await purchasePackage(id);
    setBusy(null);
    if (res.ok) {
      // The entitlement is granted server-side via the RevenueCat webhook, so
      // re-read rather than assuming the purchase already landed.
      await refresh();
      setNote('You’re upgraded. Enjoy the extra bench time.');
      return;
    }
    if (!res.cancelled) setNote(res.message);
  };

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.scroll}>
      <Pressable onPress={() => goBack('/home')} style={s.backLink} accessibilityRole="button">
        <Text style={s.backText}>‹ Back</Text>
      </Pressable>

      <Text style={s.eyebrow}>PLANS</Text>
      <Text style={s.title}>More time on the bench.</Text>
      <Text style={s.sub}>
        {unlimited
          ? 'You have unlimited live tutoring.'
          : `You have ${minutesRemaining ?? 0} minutes of live tutoring left this month.`}
      </Text>

      {ORDER.map((p) => {
        const meta = PLAN_META[p];
        const current = p === plan;
        return (
          <View key={p} style={[s.card, current && s.cardCurrent]}>
            <View style={s.cardTop}>
              <Text style={s.cardTitle}>{meta.label}</Text>
              {current && <View style={s.badge}><Text style={s.badgeText}>YOUR PLAN</Text></View>}
            </View>
            <Text style={s.cardBlurb}>{meta.blurb}</Text>
            <View style={s.perks}>
              {meta.perks.map((perk) => (
                <View key={perk} style={s.perkRow}>
                  <View style={s.tick} />
                  <Text style={s.perkText}>{perk}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}

      <View style={s.buyBlock}>
        {packages === null ? (
          <ActivityIndicator color={colors.goldDeep} />
        ) : unavailable ? (
          // Never a dead button: say why, in words a learner understands.
          <View style={s.notice}>
            <Text style={s.noticeTitle}>Upgrading isn't available here</Text>
            <Text style={s.noticeBody}>{unavailable}</Text>
          </View>
        ) : packages.length === 0 ? (
          <View style={s.notice}>
            <Text style={s.noticeTitle}>No plans to show yet</Text>
            <Text style={s.noticeBody}>Plans are still being set up. Check back shortly.</Text>
          </View>
        ) : (
          packages.map((pkg) => (
            <View key={pkg.id} style={{ marginBottom: space.md }}>
              <Button
                label={busy === pkg.id ? 'One moment…' : `${pkg.title} — ${pkg.priceString}`}
                onPress={() => void buy(pkg.id)}
                disabled={!!busy}
              />
              {/* Guideline 3.1.2 wants the length and the renewal terms on the
                  paywall itself, not only in App Store Connect. */}
              {!!periodLabel(pkg.period) && (
                <Text style={s.terms}>
                  {pkg.priceString} per {periodLabel(pkg.period)}, renews automatically until
                  cancelled. Cancel any time in your Apple ID settings.
                </Text>
              )}
            </View>
          ))
        )}

        {!!note && <Text style={s.note}>{note}</Text>}

        {/* Guideline 3.1.2 requires functional links to both from the paywall.
            Their absence is a rejection, not a warning. */}
        <View style={s.legalRow}>
          <Pressable onPress={() => Linking.openURL('https://ohmlet.org/terms')} accessibilityRole="link">
            <Text style={s.legalLink}>Terms of Use</Text>
          </Pressable>
          <Text style={s.legalDot}>·</Text>
          <Pressable onPress={() => Linking.openURL('https://ohmlet.org/privacy')} accessibilityRole="link">
            <Text style={s.legalLink}>Privacy Policy</Text>
          </Pressable>
        </View>

        {/* Apple requires restore to be reachable in-app. */}
        <Pressable
          onPress={async () => {
            setNote(null);
            const ok = await restorePurchases();
            if (ok) await refresh();
            setNote(ok ? 'Purchases restored.' : 'Nothing to restore on this account.');
          }}
          style={s.restore}
          accessibilityRole="button"
        >
          <Text style={s.restoreText}>Restore purchases</Text>
        </Pressable>

        <Text style={s.legal}>
          Subscriptions renew automatically until cancelled. Manage or cancel any time in your
          App Store account settings.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  scroll: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl },
  backLink: { paddingVertical: space.sm, alignSelf: 'flex-start' },
  backText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
  eyebrow: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.inkSoft, marginTop: space.md },
  title: { fontFamily: font.black, fontSize: type.display, color: colors.ink, letterSpacing: -0.8, marginTop: 4 },
  sub: { fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft, marginTop: space.sm, marginBottom: space.lg },
  card: {
    backgroundColor: colors.white, borderWidth: 2, borderColor: colors.line,
    borderRadius: radius.lg, ...curve, padding: space.lg, marginBottom: space.md,
  },
  cardCurrent: { borderColor: colors.ink, borderWidth: 2.5, ...elevation.card },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink },
  badge: {
    backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.ink,
    borderRadius: 999, ...curve, paddingHorizontal: 10, paddingVertical: 3,
  },
  badgeText: { fontFamily: font.black, fontSize: type.meta, color: colors.ink, letterSpacing: 1 },
  cardBlurb: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 4 },
  perks: { marginTop: space.md, gap: 8 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tick: {
    width: 10, height: 10, borderRadius: 3, ...curve, backgroundColor: colors.gold,
    borderWidth: 1.5, borderColor: colors.ink, transform: [{ rotate: '45deg' }],
  },
  perkText: { fontFamily: font.semibold, fontSize: type.small, color: colors.ink, flex: 1 },
  buyBlock: { marginTop: space.md },
  notice: {
    backgroundColor: colors.blueSoft, borderWidth: 2, borderColor: colors.blueDeep,
    borderRadius: radius.md, ...curve, padding: space.md,
  },
  noticeTitle: { fontFamily: font.black, fontSize: type.small, color: colors.ink },
  noticeBody: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 4, lineHeight: 20 },
  note: { fontFamily: font.bold, fontSize: type.small, color: colors.ink, marginTop: space.sm, textAlign: 'center' },
  terms: {
    fontFamily: font.semibold, fontSize: type.meta, color: colors.inkSoft,
    marginTop: 6, lineHeight: 16, textAlign: 'center',
  },
  legalRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: space.sm, marginTop: space.md,
  },
  legalLink: { fontFamily: font.bold, fontSize: type.small, color: colors.blueDeep },
  legalDot: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
  restore: { marginTop: space.md, alignItems: 'center', paddingVertical: space.sm },
  restoreText: { fontFamily: font.bold, fontSize: type.small, color: colors.blueDeep },
  legal: {
    fontFamily: font.regular, fontSize: type.meta, color: colors.inkSoft,
    textAlign: 'center', marginTop: space.md, lineHeight: 16,
  },
});
