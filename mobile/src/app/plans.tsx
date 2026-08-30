import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Image } from 'expo-image';
import { track } from '../services/analytics';
import { useAuth } from '../hooks/useAuth';
import { useChildSafe } from '../hooks/useChildSafe';
import { ClosedForNow } from '../components/ClosedForNow';
import { AppTabs } from '../components/AppTabs';
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


/**
 * Per-tier visual identity.
 *
 * Free is quiet, Pro is the hero on gold, Max is ink. Structural difference, not
 * a colour swap: swapping one card for another has to be obvious at a glance, or
 * the screen is three identical rectangles with different words in them — which
 * is what it was.
 */
/** Tier artwork. Only the paid tiers get an illustration: giving Free one too
 *  would flatten the hierarchy the images exist to create. */
const ART: Partial<Record<Plan, number>> = {
  pro: require('../../assets/brand/plan-pro.png'),
  max: require('../../assets/brand/plan-max.png'),
};

const TONE: Record<Plan, {
  card: object; strip: object; stripText: object;
  text: object; muted: object; tick: string;
}> = {
  free: {
    card: { backgroundColor: colors.white, borderColor: colors.line },
    strip: { backgroundColor: colors.inkFaint },
    stripText: { color: colors.inkSoft },
    text: { color: colors.ink },
    muted: { color: colors.inkSoft },
    tick: colors.inkMute,
  },
  pro: {
    card: { backgroundColor: colors.goldSoft, borderColor: colors.ink },
    strip: { backgroundColor: colors.gold },
    stripText: { color: colors.ink },
    text: { color: colors.ink },
    muted: { color: colors.goldText },
    tick: colors.goldDeep,
  },
  max: {
    card: { backgroundColor: colors.ink, borderColor: colors.ink },
    strip: { backgroundColor: colors.inkSoft },
    stripText: { color: colors.white },
    text: { color: colors.white },
    muted: { color: colors.inkMute },
    tick: colors.gold,
  },
};

const Tick: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24">
    <Path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke={color}
          strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/**
 * The store package that buys a given tier.
 *
 * RevenueCat identifiers are configured by us, so matching on the tier name is
 * the contract. A tier with no package shows why it cannot be bought rather than
 * a button that does nothing.
 */
function packageFor(packages: Package[] | null, plan: Plan): Package | null {
  if (!packages) return null;
  return packages.find((pkg) =>
    `${pkg.id} ${pkg.title}`.toLowerCase().includes(plan)) ?? null;
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
    // A tab, since 2026-08-29, so the bar stays under it and the back link is
    // gone: a tab has no "back", it has five siblings one tap away.
    <AppTabs active="plans">
      <ScrollView style={s.flex} contentContainerStyle={s.scroll}>
      <Text style={s.eyebrow}>PLANS</Text>
      <Text style={s.title}>More time on the bench.</Text>
      <Text style={s.sub}>
        {unlimited
          ? 'You have unlimited live tutoring.'
          : `You have ${minutesRemaining ?? 0} minutes of live tutoring left this month.`}
      </Text>

      {/* Three cards, three different builds. The old screen used one white
          rectangle for all of them, so the only thing separating a free tier
          from a paid one was the words inside it. Pro is the hero (gold, lifted,
          flagged); Max is ink; Free is quiet. */}
      {ORDER.map((p) => {
        const meta = PLAN_META[p];
        const current = p === plan;
        const tone = TONE[p];
        const pkg = packageFor(packages, p);
        return (
          <View key={p} style={[s.card, tone.card, current && s.cardCurrent]}>
            <View style={[s.strip, tone.strip]}>
              <Text style={[s.stripText, tone.stripText]}>
                {current ? 'YOUR PLAN' : p === 'pro' ? 'MOST POPULAR' : meta.tagline.toUpperCase()}
              </Text>
            </View>

            <View style={s.cardBody}>
              {/* Art sits beside the TITLE, not beside the perks: the perk lines
                  are long, and squeezing them into the leftover 180pt would
                  wrap every one of them onto three lines. */}
              <View style={s.headRow}>
                <View style={s.headText}>
                  <Text style={[s.cardTitle, tone.text]}>{meta.label}</Text>
                  <View style={s.priceWrap}>
                    <Text style={[s.price, tone.text]}>
                      {/* The store package is the real, localised price and always wins. This
                        fallback shows only until it loads, and it is in DOLLARS because
                        that is the currency the pricing page publishes. It used to render
                        a euro sign, so the app quoted a currency the website never did. */}
                    {pkg ? pkg.priceString : meta.priceMonthly === null ? 'Free' : `$${meta.priceMonthly}`}
                    </Text>
                    {(pkg || meta.priceMonthly !== null) && (
                      <Text style={[s.pricePer, tone.muted]}>
                        /{pkg && periodLabel(pkg.period) ? periodLabel(pkg.period) : 'month'}
                      </Text>
                    )}
                  </View>
                  <Text style={[s.cardBlurb, tone.muted]}>{meta.blurb}</Text>
                </View>
                {!!ART[p] && (
                  <Image
                    source={ART[p]}
                    style={s.art}
                    contentFit="contain"
                    accessible={false}
                    transition={0}
                  />
                )}
              </View>

              <View style={s.perks}>
                {meta.perks.map((perk) => (
                  <View key={perk} style={s.perkRow}>
                    <Tick color={tone.tick} />
                    <Text style={[s.perkText, tone.text]}>{perk}</Text>
                  </View>
                ))}
              </View>

              {/* The action lives ON the tier it buys. It used to sit in a
                  separate block underneath all three, so a card described
                  something with no way to act on it. */}
              {!current && (
                pkg ? (
                  <Button
                    label={busy === pkg.id ? 'One moment…' : `Get ${meta.label}`}
                    onPress={() => void buy(pkg.id)}
                    disabled={!!busy}
                    style={{ marginTop: space.md }}
                  />
                ) : (
                  <Text style={[s.cardNotice, tone.muted]}>
                    {unavailable ?? 'Not available to buy here yet.'}
                  </Text>
                )
              )}
            </View>
          </View>
        );
      })}

      <View style={s.buyBlock}>
        {packages === null && <ActivityIndicator color={colors.goldDeep} />}

        {/* Guideline 3.1.2 wants the length and renewal terms on the paywall
            itself, not only in App Store Connect. */}
        {(packages ?? []).map((pkg) => (
          !!periodLabel(pkg.period) && (
            <Text key={pkg.id} style={s.terms}>
              {pkg.title}: {pkg.priceString} per {periodLabel(pkg.period)}, renews automatically
              until cancelled. Cancel any time in your Apple ID settings.
            </Text>
          )
        ))}

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
    </AppTabs>
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
    borderWidth: 2.5, borderRadius: radius.lg, ...curve,
    marginBottom: space.lg, overflow: 'hidden', ...elevation.card,
  },
  cardCurrent: { ...elevation.lifted },
  strip: { paddingHorizontal: space.md, paddingVertical: 7 },
  stripText: { fontFamily: font.black, fontSize: 10, letterSpacing: 2 },
  cardBody: { padding: space.md },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  headText: { flex: 1, minWidth: 0 },
  // Both paid tiers share the slot, so the two cards line up when scrolled
  // past each other. Height follows the taller of the two source images.
  art: { width: 130, height: 134, marginTop: -6, marginRight: -6 },
  cardTitle: { fontFamily: font.black, fontSize: type.title, letterSpacing: -0.6 },
  priceWrap: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 2 },
  price: { fontFamily: font.black, fontSize: type.heading, letterSpacing: -0.4 },
  pricePer: { fontFamily: font.bold, fontSize: type.small, marginBottom: 2 },
  cardBlurb: { fontFamily: font.bold, fontSize: type.small, marginTop: 2 },
  cardNotice: { fontFamily: font.semibold, fontSize: type.small, marginTop: space.md, lineHeight: 18 },
  perks: { marginTop: space.md, gap: 9 },
  perkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  perkText: { fontFamily: font.bold, fontSize: type.small, flex: 1, lineHeight: 19 },
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
