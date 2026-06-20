// ── useAuth — the real, Firebase-backed identity layer ──
//
// Wraps the app in an auth context. Everything that needs "who is signed in"
// reads from here. useIdentity() is a thin adapter on top so the existing
// { userId, isAdmin } consumers keep working unchanged.
//
// Admin: an email allowlist for now (shows the Author console + the dev plan
// switcher to the owner only). This gates the UI; server-side enforcement comes
// with a custom claim verified on the backend (tasks #44 / #56). The allowlist
// is not a secret — it is just a list of who the owners are.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';

const ADMIN_EMAILS = (
  (import.meta.env.VITE_OHMLET_ADMIN_EMAILS as string | undefined) ||
  'faithogun12@gmail.com,hello@ohmlet.org'
)
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const isAdminEmail = (email: string | null | undefined): boolean =>
  !!email && ADMIN_EMAILS.includes(email.toLowerCase());

/** Turn a Firebase auth error code into copy a person can act on. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return "That email and password don't match. Check them and try again.";
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try logging in instead.';
    case 'auth/weak-password':
      return 'Pick a password with at least 6 characters.';
    case 'auth/invalid-email':
      return "That doesn't look like a valid email address.";
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/network-request-failed':
      return 'Network problem. Check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export interface AuthValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (name: string, email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signUpEmail = useCallback(async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const displayName = name.trim();
    if (displayName) await updateProfile(cred.user, { displayName });
  }, []);

  const signInGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      isAdmin: isAdminEmail(user?.email),
      signInEmail,
      signUpEmail,
      signInGoogle,
      resetPassword,
      signOut,
    }),
    [user, loading, signInEmail, signUpEmail, signInGoogle, resetPassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}
