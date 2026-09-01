import { useCallback, useEffect, useState } from 'react';
import type { AgeProfile } from './ageModel';

// The age/consent profile is persisted PER USER and kept separate from the
// gamification state blob (different sensitivity + access rules; the DPIA calls
// for a distinct, access-restricted consent record). For now this is a local
// mirror; the durable, server-side source of truth (a dedicated Firestore record
// + Firebase custom claims) lands with the consent backend in step 2.

const keyFor = (userId: string) => `ohmlet.ageProfile.${userId || 'anon'}`;

export function readAgeProfile(userId: string): AgeProfile | null {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? (JSON.parse(raw) as AgeProfile) : null;
  } catch {
    return null;
  }
}

export function useAgeProfile(userId: string) {
  const [ageProfile, setProfile] = useState<AgeProfile | null>(() => readAgeProfile(userId));

  useEffect(() => {
    setProfile(readAgeProfile(userId));
  }, [userId]);

  const setAgeProfile = useCallback(
    (profile: AgeProfile) => {
      setProfile(profile);
      try {
        localStorage.setItem(keyFor(userId), JSON.stringify(profile));
      } catch {
        /* private mode / quota: the server flag will govern once wired */
      }
    },
    [userId],
  );

  return { ageProfile, setAgeProfile };
}
