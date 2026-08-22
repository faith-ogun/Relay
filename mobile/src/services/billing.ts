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

/**
 * Initialise RevenueCat if it can possibly work here. Safe to call repeatedly;
 * never throws. Returns why it is unavailable when it is, so the UI can say
 * something true rather than silently showing a dead button.
 */
export async function initBilling(appUserId?: string): Promise<BillingState> {
  if (state) return state;

  if (isExpoGo) return (state = { status: 'expo-go' });
  if (!apiKey) return (state = { status: 'unconfigured' });

  try {
    const mod = await import('react-native-purchases');
    purchases = mod.default;
    await purchases.configure({ apiKey, appUserID: appUserId ?? null });
    return (state = { status: 'ready' });
  } catch (e) {
    return (state = { status: 'error', message: e instanceof Error ? e.message : 'unknown' });
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
