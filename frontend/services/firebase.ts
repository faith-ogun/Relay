// ── Firebase client init ──
//
// The Firebase WEB config is public by design. Google's docs are explicit that a
// Firebase web apiKey is NOT a secret: it only identifies the project to Google's
// servers. Real protection comes from Authentication authorized-domains and the
// Firestore security rules, not from hiding these values. So it is safe to commit
// them. Genuine secrets (service-account keys, Stripe keys) never live in the
// frontend — they belong in Secret Manager on the backend (task #46).
//
// Values can be overridden per-environment via VITE_FIREBASE_* env vars; the
// committed fallbacks are the live ohmlet-app web config so dev + prod work with
// no extra wiring.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getAnalytics, isSupported as analyticsIsSupported, type Analytics } from 'firebase/analytics';
import { analyticsAllowed } from './cookieConsent';

const env = import.meta.env as Record<string, string | undefined>;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyBoEnpxbscHVVA0dllrroKJXDkHNLNnenU',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'ohmlet-app.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'ohmlet-app',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'ohmlet-app.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '182102811288',
  appId: env.VITE_FIREBASE_APP_ID || '1:182102811288:web:500239165b61f10142e6ed',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'G-PGG053JZFR',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);

/**
 * The current user's Firebase ID token (a short-lived JWT), or null if signed
 * out. Sent as `Authorization: Bearer <token>` on backend calls so the server
 * can verify identity itself (#44). The SDK caches and refreshes it.
 */
export async function getIdToken(): Promise<string | null> {
  const u = auth.currentUser;
  return u ? u.getIdToken() : null;
}

export const googleProvider = new GoogleAuthProvider();
// Always let the user pick which Google account, even if one is already chosen.
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Analytics is browser-only and throws in unsupported contexts (SSR, some
// privacy modes), so initialise it lazily and never let it break the app.
// It is ALSO consent-gated (#37): calling getAnalytics() is what starts
// collection and sets the analytics cookies, so we never call it until the user
// has opted in. Before consent this returns null (and is not memoised, so it
// re-checks on the next call once the choice is made).
let analyticsPromise: Promise<Analytics | null> | null = null;
export function getOhmletAnalytics(): Promise<Analytics | null> {
  if (!analyticsAllowed()) return Promise.resolve(null);
  if (!analyticsPromise) {
    analyticsPromise = (async () => {
      try {
        if (typeof window !== 'undefined' && firebaseConfig.measurementId && (await analyticsIsSupported())) {
          return getAnalytics(firebaseApp);
        }
      } catch {
        /* analytics is best-effort; never throw */
      }
      return null;
    })();
  }
  return analyticsPromise;
}
