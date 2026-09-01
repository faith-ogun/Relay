// RevenueCat, loaded lazily so the app still runs in Expo Go.
//
// react-native-purchases ships native code, so it cannot run in Expo Go — a
// top-level import crashes the app on launch. Faith checks progress on her
// phone via Expo Go, so the whole app must stay runnable there even though
// purchases themselves need a development build. Hence: no static import,
// and every entry point degrades to a clear, honest state instead of throwing.

import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Expo Go sets appOwnership to 'expo'; a dev build or store build leaves it null. */
export const isExpoGo = Constants.appOwnership === 'expo';

const iosKey = (process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '').trim();
const androidKey = (process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '').trim();
const apiKey = Platform.OS === 'ios' ? iosKey : androidKey;

export type BillingState =
  | { status: 'ready' }
  | { status: 'expo-go' }        // running in Expo Go: purchases unavailable by design
  | { status: 'unconfigured' }   // no RevenueCat key yet
  | { status: 'error'; message: string };

let purchases: typeof import('react-native-purchases').default | null = null;
let state: BillingState | null = null;
/** The uid RevenueCat is currently configured against, or null while anonymous. */
let identifiedAs: string | null = null;

/** RevenueCat's prefix for an id it invented because we gave it none. */
export const ANONYMOUS_PREFIX = '$RCAnonymousID:';

/**
 * Initialise RevenueCat if it can possibly work here. Safe to call repeatedly;
 * never throws. Returns why it is unavailable when it is, so the UI can say
 * something true rather than silently showing a dead button.
 *
 * Pass the uid whenever it is known. `configure()` is ONE-SHOT: calling it again
 * with an id does nothing, and this function memoises `state`, so an early call
 * made before sign-in resolved would otherwise pin the session anonymous for its
 * whole life. `logIn()` is the documented way to attach an identity afterwards,
 * and it aliases any purchase already made under the anonymous id onto the real
 * one, so nothing bought in that window is lost.
 *
 * This matters more than it looks. The webhook refuses an event whose
 * `app_user_id` starts with `$RCAnonymousID:`, because a purchase it cannot
 * attribute cannot be granted to anybody. Without the logIn below, the App Store
 * charges the card and the learner stays on the free tier's 60 minutes.
 */
export async function initBilling(appUserId?: string): Promise<BillingState> {
  if (state) {
    if (state.status === 'ready' && appUserId && appUserId !== identifiedAs) {
      await identify(appUserId);
    }
    return state;
  }

  if (isExpoGo) return (state = { status: 'expo-go' });
  if (!apiKey) return (state = { status: 'unconfigured' });

  try {
    const mod = await import('react-native-purchases');
    purchases = mod.default;
    await purchases.configure({ apiKey, appUserID: appUserId ?? null });
    identifiedAs = appUserId ?? null;
    return (state = { status: 'ready' });
  } catch (e) {
    return (state = { status: 'error', message: e instanceof Error ? e.message : 'unknown' });
  }
}

/**
 * Attach a uid to an already-configured session. Failure is not fatal here: the
 * next call retries, and `purchasePackage` refuses to take money while the id is
 * still anonymous, so a failure delays a purchase rather than losing one.
 */
async function identify(appUserId: string): Promise<void> {
  if (!purchases) return;
  try {
    await purchases.logIn(appUserId);
    identifiedAs = appUserId;
  } catch {
    // Left un-identified on purpose. The purchase guard is the backstop.
  }
}

/** Current billing availability without re-initialising. */
export function billingState(): BillingState {
  return state ?? (isExpoGo ? { status: 'expo-go' } : { status: 'unconfigured' });
}

/** Plain-language explanation for the UI. Never leaks a stack trace to a learner. */
export function billingUnavailableReason(s: BillingState): string | null {
  switch (s.status) {
    case 'ready': return null;
    case 'expo-go': return 'Purchases need the full app. This is a preview build.';
    case 'unconfigured': return 'Plans are not available just yet.';
    case 'error': return 'Plans could not be loaded. Please try again shortly.';
  }
}


// ── Offerings and purchase ──
//
// Prices are NEVER hardcoded. App Store Connect owns them, RevenueCat reports
// them, and they differ by storefront and currency. A hardcoded price would be
// wrong for most of the world and would drift the moment it changed.

export interface Package {
  id: string;
  /** Localised, storefront-correct price string, e.g. "£12.99". */
  priceString: string;
  /** 'monthly' | 'annual' | other, from RevenueCat's package type. */
  period: string;
  title: string;
}

export async function getOfferings(): Promise<Package[]> {
  const s = await initBilling();
  if (s.status !== 'ready' || !purchases) return [];
  try {
    const offerings = await purchases.getOfferings();
    const current = offerings.current;
    if (!current) return [];
    return current.availablePackages.map((pkg) => ({
      id: pkg.identifier,
      priceString: pkg.product.priceString,
      period: pkg.packageType,
      title: pkg.product.title,
    }));
  } catch {
    return [];
  }
}

export type PurchaseResult =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; message: string };

export async function purchasePackage(packageId: string): Promise<PurchaseResult> {
  const s = await initBilling();
  if (s.status !== 'ready' || !purchases) {
    return { ok: false, cancelled: false, message: billingUnavailableReason(s) ?? 'Unavailable.' };
  }

  // Refuse rather than take money that cannot be attributed. An anonymous id
  // means the webhook will receive the purchase, fail to match it to an account
  // and grant nothing, leaving a paying learner on the free cap with no error
  // anywhere they can see. A blocked purchase is recoverable; that is not.
  try {
    const appUserId = await purchases.getAppUserID();
    if (appUserId.startsWith(ANONYMOUS_PREFIX)) {
      return {
        ok: false,
        cancelled: false,
        message: 'Sign in first, so your plan lands on your account.',
      };
    }
  } catch {
    return { ok: false, cancelled: false, message: 'Plans could not be loaded. Please try again shortly.' };
  }

  try {
    const offerings = await purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find((p) => p.identifier === packageId);
    if (!pkg) return { ok: false, cancelled: false, message: 'That plan is not available right now.' };
    await purchases.purchasePackage(pkg);
    return { ok: true };
  } catch (e) {
    const err = e as { userCancelled?: boolean };
    if (err?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, cancelled: false, message: 'The purchase did not complete.' };
  }
}

/** Restore prior purchases. Apple requires this to be reachable in-app. */
export async function restorePurchases(): Promise<boolean> {
  const s = await initBilling();
  if (s.status !== 'ready' || !purchases) return false;
  try {
    await purchases.restorePurchases();
    return true;
  } catch {
    return false;
  }
}
