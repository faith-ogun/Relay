import { useMemo } from 'react';

/**
 * useIdentity — who the current user is, and whether they're an admin.
 *
 * This is the INTERIM identity layer (pre-auth). It resolves a stable per-browser
 * user id and an admin flag, so progress can be persisted per-user and the dev
 * plan switcher can be gated to admins only.
 *
 * Security note: a localStorage id is SEPARATION, not authenticated SECURITY — it
 * is not verified, so it cannot stop a determined person from setting another id.
 * Real security arrives with Firebase Auth (task #29): a cryptographic UID plus
 * server-side ID-token verification, at which point this hook swaps its source
 * from localStorage to the signed-in user and `isAdmin` becomes a custom claim.
 * Everything that consumes { userId, isAdmin } keeps working unchanged.
 *
 * Admins: ids listed in VITE_OHMLET_ADMIN_IDS (comma-separated), or, if that is
 * unset, VITE_OHMLET_DEFAULT_USER_ID. On a deployed build with neither set, every
 * visitor is a guest and nobody sees the plan switcher. To preview the guest
 * experience locally, add `?as=guest` to the URL (`?as=admin` switches back).
 */

const GUEST_KEY = 'ohmlet-user-id';
const VIEW_KEY = 'ohmlet-view-as';

const adminIds = (
  (import.meta.env.VITE_OHMLET_ADMIN_IDS as string | undefined) ||
  (import.meta.env.VITE_OHMLET_DEFAULT_USER_ID as string | undefined) ||
  ''
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const primaryAdmin = adminIds[0];

const makeGuestId = () => `guest-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;

const resolveGuestId = (): string => {
  try {
    const existing = localStorage.getItem(GUEST_KEY);
    if (existing && existing.trim()) return existing;
    const generated = makeGuestId();
    localStorage.setItem(GUEST_KEY, generated);
    return generated;
  } catch {
    return makeGuestId();
  }
};

export interface Identity {
  userId: string;
  isAdmin: boolean;
}

export function useIdentity(): Identity {
  return useMemo(() => {
    // Read (and persist) an optional ?as=guest|admin view override.
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

    // Admin only when an admin id is configured and we're not previewing as guest.
    if (primaryAdmin && view !== 'guest') {
      return { userId: primaryAdmin, isAdmin: true };
    }
    return { userId: resolveGuestId(), isAdmin: false };
  }, []);
}
