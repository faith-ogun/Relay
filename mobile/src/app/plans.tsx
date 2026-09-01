import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
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
import { packageFor, type Interval } from '../services/packageMatch';
import { font, radius, space, type, curve, type Colors } from '../theme/tokens';
import { makeStyles, useColors } from '../theme/theme';

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

/** Per-tier colour, resolved against the live palette rather than frozen at
 *  import: Free and Pro follow the theme, and Max is a slab that is dark in
 *  both because its gold and white were chosen against black. */
const toneFor = (colors: Colors): Record<Plan, {
  card: object; strip: object; stripText: object;
  text: object; muted: object; tick: string;
}> => ({
  free: {
    card: { backgroundColor: colors.surface, borderColor: colors.line },
    strip: { backgroundColor: colors.inkFaint },
    stripText: { color: colors.inkSoft },
    text: { color: colors.ink },
    muted: { color: colors.inkSoft },
    tick: colors.inkMute,
  },
  pro: {
    card: { backgroundColor: colors.goldSoft, borderColor: colors.ink },
    strip: { backgroundColor: colors.gold },
    stripText: { color: colors.onGold },
    text: { color: colors.ink },
    muted: { color: colors.goldText },
    tick: colors.goldDeep,
  },
  max: {
    card: { backgroundColor: colors.slab, borderColor: colors.slab },
    strip: { backgroundColor: colors.inkSoft },
    stripText: { color: colors.white },
    text: { color: colors.white },
    muted: { color: colors.inkMute },
    tick: colors.gold,
  },
});

const Tick: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24">
    <Path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke={color}
          strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/**
 * What the big number says.
 *
 * A store package always wins: it is the real, localised price, and for an
 * annual product `priceString` is the YEARLY total, so it is divided back to a
 * monthly figure to sit under the "/month" label. The fallback is in dollars
 * because dollars are what the pricing page publishes; it once rendered a euro
 * sign and the app quoted a currency the website never did.
 */
function priceLabel(
  pkg: Package | null,
  meta: (typeof PLAN_META)[Plan],
  interval: Interval,
): string {
  if (meta.priceMonthly === null) return 'Free';
  if (pkg) {
    const n = Number(pkg.priceString.replace(/[^0-9.]/g, ''));
    if (interval === 'annual' && Number.isFinite(n) && n > 0) {
      const symbol = pkg.priceString.replace(/[0-9.,\s]/g, '') || '$';
      return `${symbol}${(n / 12).toFixed(2)}`;
    }
    return pkg.priceString;
  }
  const fallback = interval === 'annual' ? meta.priceAnnualPerMonth : meta.priceMonthly;
  return `$${(fallback ?? meta.priceMonthly).toFixed(2)}`;
}

export default function Plans() {
  const colors = useColors();
  const s = useS();
  const { user } = useAuth();
  const { childSafe, resolved: childResolved } = useChildSafe();
  const { plan, minutesRemaining, unlimited, refresh } = usePlan();
  const [packages, setPackages] = useState<Package[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Annual first, deliberately: it is the better value and the one a learner is
  // least likely to find on their own. The web pricing page defaults the same way.
  const [interval, setInterval] = useState<Interval>('annual');

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
      <AppTabs active="plans">
        <ClosedForNow
          title="Plans are managed by a grown-up"
          body="Ohmlet does not take payments from an account that belongs to a minor. A parent or guardian can manage a plan from their own account."
        />
      </AppTabs>
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

      {/* Monthly or annual. Not a nicety: Apple has four products and without a
          way to reach the annual two, half the catalogue is unpurchasable and a
          reviewer looking for the $149.99 product cannot find where it is sold. */}
      <View style={s.toggle} accessibilityRole="radiogroup">
        {(['monthly', 'annual'] as const).map((it) => {
          const on = interval === it;
          return (
            <Pressable
              key={it}
              onPress={() => setInterval(it)}
              style={({ pressed }) => [s.toggleTab, on && s.toggleTabOn, pressed && s.toggleDown]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={it === 'annual' ? 'Annual billing, cheaper per month' : 'Monthly billing'}
            >
              <Text style={[s.toggleText, on && s.toggleTextOn]}>
                {it === 'annual' ? 'Annual' : 'Monthly'}
              </Text>
              {it === 'annual' && <View style={[s.saveTag, on && s.saveTagOn]}><Text style={s.saveText}>SAVE 50%</Text></View>}
            </Pressable>
          );
        })}
      </View>

      {/* Three cards, three different builds. The old screen used one white
          rectangle for all of them, so the only thing separating a free tier
          from a paid one was the words inside it. Pro is the hero (gold, lifted,
          flagged); Max is ink; Free is quiet. */}
      {ORDER.map((p) => {
        const meta = PLAN_META[p];
        const current = p === plan;
        const tone = toneFor(colors)[p];
        const pkg = packageFor(packages, p, interval);
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
                    {priceLabel(pkg, meta, interval)}
                    </Text>
                    {(pkg || meta.priceMonthly !== null) && (
                      <Text style={[s.pricePer, tone.muted]}>/month</Text>
                    )}
                  </View>
                  {/* The total that actually leaves the account. "Billed
                      annually" on its own gives the cadence and withholds the
                      amount, which is the half somebody needs to decide. */}
                  {interval === 'annual' && meta.priceAnnualTotal !== null && (
                    <Text style={[s.billedAt, tone.muted]}>
                      billed annually at {pkg ? pkg.priceString : `$${meta.priceAnnualTotal.toFixed(2)}`}
                    </Text>
                  )}
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

const useS = makeStyles((colors, th) => ({
  flex: { flex: 1, backgroundColor: colors.cream },
  scroll: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl },
  backLink: { paddingVertical: space.sm, alignSelf: 'flex-start' },
  backText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
  eyebrow: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.inkSoft, marginTop: space.md },
  title: { fontFamily: font.black, fontSize: type.display, color: colors.ink, letterSpacing: -0.8, marginTop: 4 },
  sub: { fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft, marginTop: space.sm, marginBottom: space.lg },
  card: {
    borderWidth: 2.5, borderRadius: radius.lg, ...curve,
    marginBottom: space.lg, overflow: 'hidden', ...th.elevation.card,
  },
  cardCurrent: { ...th.elevation.lifted },
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
  billedAt: { fontFamily: font.bold, fontSize: type.small, marginTop: 2 },
  toggle: {
    flexDirection: 'row', alignSelf: 'center', marginTop: space.md, marginBottom: space.xs,
    backgroundColor: colors.inkFaint, borderRadius: 999, padding: 3,
  },
  toggleTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999,
  },
  toggleTabOn: { backgroundColor: colors.ink },
  toggleDown: { transform: [{ scale: 0.97 }] },
  toggleText: { fontFamily: font.extrabold, fontSize: type.label, color: colors.inkSoft },
  toggleTextOn: { color: colors.onInk },
  saveTag: { backgroundColor: colors.goldPlate, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  saveTagOn: { backgroundColor: colors.gold },
  saveText: { fontFamily: font.black, fontSize: 9, letterSpacing: 0.4, color: colors.onGold },
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
}));
