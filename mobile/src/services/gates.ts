// ── Per-user gates: age assurance and the safety acknowledgement ──
//
// Both are keyed by uid, never by device. Ohmlet is used on shared phones and
// family iPads by design, and a device-global flag means the next person to sign
// in inherits an answer they never gave. That already caused two real defects on
// web: a safety acknowledgement skipped for someone who had never seen it, and
// an age answer inherited across accounts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from './config';
import { getIdToken } from './firebase';
import { CHILD_MODE_ENABLED, type AgeAssessment } from './ageModel';

const ageKey = (uid: string) => `ohmlet.age.v1:${uid}`;
const safetyKey = (uid: string) => `ohmlet.safetyAck.v1:${uid}`;

export interface StoredAge {
  birthYear: number;
  country: string;
  isMinor: boolean;
  ageStatus: string;
  assessedAt: string;
}

export async function readAge(uid: string | null | undefined): Promise<StoredAge | null> {
  if (!uid) return null;
  try {
    const raw = await AsyncStorage.getItem(ageKey(uid));
    return raw ? (JSON.parse(raw) as StoredAge) : null;
  } catch {
    return null;
  }
}

/**
 * Record the age locally and, when child mode is live, on the server too.
 *
 * The server is what actually gates the live tutor; this local copy only decides
 * whether to show the screen again. If the server call fails the answer is still
 * kept, because re-asking someone their age on every launch is its own harm.
 */
export async function submitAge(
  uid: string,
  birthYear: number,
  country: string,
  assessment: AgeAssessment,
): Promise<void> {
  const record: StoredAge = {
    birthYear,
    country,
    isMinor: assessment.isMinor,
    ageStatus: assessment.ageStatus,
    assessedAt: new Date().toISOString(),
  };
  try {
    await AsyncStorage.setItem(ageKey(uid), JSON.stringify(record));
  } catch {
    /* storage blocked: the screen shows again next launch, which is the safe way to fail */
  }

  if (!CHILD_MODE_ENABLED) return;
  try {
    const token = await getIdToken();
    if (!token) return;
    await fetch(`${API_BASE}/v1/consent/age`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ birthYear, country }),
    });
  } catch {
    /* offline: the local record stands and the server is told next time */
  }
}

export async function hasAcceptedSafety(uid: string | null | undefined): Promise<boolean> {
  if (!uid) return false;
  try {
    return (await AsyncStorage.getItem(safetyKey(uid))) === '1';
  } catch {
    return false;   // storage blocked: show it rather than skip it
  }
}

export async function acceptSafety(uid: string): Promise<void> {
  try {
    await AsyncStorage.setItem(safetyKey(uid), '1');
  } catch {
    /* worst case it is shown once more, which is the harmless direction */
  }
}

/** Clear both when an account is deleted from this device. */
export async function clearGates(uid: string | null | undefined): Promise<void> {
  if (!uid) return;
  try {
    await AsyncStorage.multiRemove([ageKey(uid), safetyKey(uid)]);
  } catch {
    /* nothing stored to clear */
  }
}
