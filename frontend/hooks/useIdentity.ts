import { useMemo } from 'react';
import { useAuth } from './useAuth';

/**
 * useIdentity — who the current user is, and whether they're an admin.
 *
 * Now backed by Firebase Auth (#29). It adapts the auth context to the
 * { userId, isAdmin } shape the workspace already consumes, so nothing
 * downstream changed when real auth replaced the localStorage placeholder.
 *
 *   userId  — the signed-in user's cryptographic Firebase UID (empty if signed
 *             out; the workspace is auth-gated so consumers only run with a user).
 *   isAdmin — true only for the owner email allowlist (Author console + dev plan
 *             switcher). Client-side gate for the UI; server-side enforcement is
 *             a custom claim verified on the backend (#44 / #56).
 *
 * Admin preview: append `?as=guest` to the URL to see the non-admin experience
 * (the override can only DOWNGRADE an admin, never grant admin to anyone else).
 */

const VIEW_KEY = 'ohmlet-view-as';

export interface Identity {
  userId: string;
  isAdmin: boolean;
}

export function useIdentity(): Identity {
  const { user, isAdmin } = useAuth();

  return useMemo(() => {
    let view: string | null = null;
    try {
      const as = new URLSearchParams(window.location.search).get('as');
      if (as === 'guest' || as === 'admin') {
        localStorage.setItem(VIEW_KEY, as);
        view = as;
      } else {
        view = localStorage.getItem(VIEW_KEY);
      }
    } catch {
      /* ignore */
    }

    const effectiveAdmin = isAdmin && view !== 'guest';
    return { userId: user?.uid ?? '', isAdmin: effectiveAdmin };
  }, [user?.uid, isAdmin]);
}
