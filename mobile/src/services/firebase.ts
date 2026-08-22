// Firebase Auth for mobile. Same project as the web app, so an account created
// on either surface works on both, and the backend's per-user isolation applies
// unchanged (it derives the UID from the verified token, never from the client).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  // @ts-expect-error — exported by firebase/auth at runtime for RN, but absent
  // from the web-oriented type surface. Without it the session is lost on every
  // app restart, which is the single most common Expo + Firebase mistake.
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(config);

let auth: Auth;
try {
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  // Already initialised (Fast Refresh re-runs this module).
  auth = getAuth(app);
}

export { app, auth };

/**
 * The caller's ID token, or null. Resolves null rather than rejecting: every
 * service client awaits this outside its own try/catch, and a rejection here
 * left the web app's feed and plan lookup spinning forever.
 */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}
