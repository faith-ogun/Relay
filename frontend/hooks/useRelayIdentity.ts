import { useMemo } from 'react';

const STORAGE_KEY = 'relay-user-id';

const makeGuestId = () => {
  return `guest-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
};

export function useRelayIdentity(defaultUserId?: string) {
  return useMemo(() => {
    const explicit = (defaultUserId || '').trim();
    if (explicit) return explicit;

    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing && existing.trim()) return existing;
      const generated = makeGuestId();
      localStorage.setItem(STORAGE_KEY, generated);
      return generated;
    } catch {
      return makeGuestId();
    }
  }, [defaultUserId]);
}

