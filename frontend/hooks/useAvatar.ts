import { useCallback, useEffect, useState } from 'react';
import { defaultAvatar, normalizeAvatar, type OhmletAvatarConfig } from '../components/ohmlet/avatar/avatarConfig';

// ── useAvatar (#avatar) ──
//
// The user's avatar config. v1 persists to localStorage per user (like usePlan),
// so it is instant and survives reloads on this device. Cross-device sync to the
// Firestore profile, and serving avatars for other users (community feed,
// leaderboard), are documented follow-ups; the render + config layer is already
// shared, so those are wiring, not redesign.

const key = (userId: string) => `ohmlet.avatar.${userId || 'anon'}`;

export function useAvatar(userId: string) {
  const [config, setConfig] = useState<OhmletAvatarConfig>(() => {
    try {
      const raw = localStorage.getItem(key(userId));
      return raw ? normalizeAvatar(JSON.parse(raw)) : defaultAvatar(userId);
    } catch {
      return defaultAvatar(userId);
    }
  });

  // Re-load when the user changes.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key(userId));
      setConfig(raw ? normalizeAvatar(JSON.parse(raw)) : defaultAvatar(userId));
    } catch {
      setConfig(defaultAvatar(userId));
    }
  }, [userId]);

  const save = useCallback(
    (next: OhmletAvatarConfig) => {
      setConfig(next);
      try {
        localStorage.setItem(key(userId), JSON.stringify(next));
      } catch {
        /* storage blocked: avatar stays for this session */
      }
    },
    [userId],
  );

  return { config, save };
}
