import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from '../services/firebase';

interface AuthValue {
  user: User | null;
  loading: boolean;
  displayName: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

/** Firebase error codes turned into copy a person can act on. */
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
    case 'auth/network-request-failed':
      return 'Network problem. Check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumped whenever the profile changes, so displayName recomputes. Firebase
  // mutates the SAME user object in place, so without this the memo never
  // re-runs and the header keeps showing the raw email for the whole session.
  const [profileVersion, setProfileVersion] = useState(0);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    setLoading(false);
  }), []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const displayName = name.trim();
    if (displayName) {
      await updateProfile(cred.user, { displayName });
      setProfileVersion((v) => v + 1);
    }
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
  }, []);

  const displayName = useMemo(
    () => user?.displayName || user?.email?.split('@')[0] || 'Learner',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, profileVersion],
  );

  const value = useMemo<AuthValue>(
    () => ({ user, loading, displayName, signIn, signUp, signOut }),
    [user, loading, displayName, signIn, signUp, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useAuth(): AuthValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}
