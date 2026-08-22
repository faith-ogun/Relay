// The achievement catalogue, served from the backend like the curriculum, so a
// new achievement does not need an App Store review. Which ones are EARNED is
// computed on-device from the learner's own metrics — the catalogue is identical
// for everyone.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from './config';
import { getIdToken } from './firebase';

export type Tier = 'common' | 'rare' | 'epic' | 'legendary';

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  backText: string;
  /** Approximate share of users who hold it, for flavour on locked cards. */
  rarity: number;
  tier: Tier;
  bg: string;
  glowColor: string;
  metric: string;
  threshold: number;
  shape: string;
  art?: string;
}

const CACHE = 'ohmlet.achievements.v1';

export const TIER_LABEL: Record<Tier, string> = {
  common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary',
};

// Tier accents. Kept here rather than parsed from the web's CSS gradients,
// which are multi-stop and do not translate to a single React Native colour.
export const TIER_COLOR: Record<Tier, string> = {
  common: '#94a3b8', rare: '#60a5fa', epic: '#c084fc', legendary: '#fbbf24',
};

export async function getAchievements(): Promise<Achievement[]> {
  let cached: Achievement[] | null = null;
  try {
    const raw = await AsyncStorage.getItem(CACHE);
    if (raw) cached = JSON.parse(raw) as Achievement[];
  } catch { /* ignore */ }

  if (!API_BASE) return cached ?? [];
  const token = await getIdToken();
  if (!token) return cached ?? [];

  try {
    const res = await fetch(`${API_BASE}/v1/curriculum/achievements`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return cached ?? [];
    const data = await res.json();
    const list = (data?.achievements ?? []) as Achievement[];
    if (list.length) await AsyncStorage.setItem(CACHE, JSON.stringify(list)).catch(() => {});
    return list;
  } catch {
    return cached ?? [];
  }
}

export const isEarned = (a: Achievement, stats: Record<string, number>): boolean =>
  (stats[a.metric] ?? 0) >= a.threshold;

/** 0..1 toward the threshold, for the progress ring on a locked card. */
export const progressOf = (a: Achievement, stats: Record<string, number>): number =>
  a.threshold <= 0 ? 1 : Math.min(1, (stats[a.metric] ?? 0) / a.threshold);

/**
 * Metrics with no source on this client (currently only likes received, which
 * is server-side community data). A locked card for one of these says so
 * rather than showing a progress ring stuck at zero.
 */
export const UNTRACKED = new Set(['likes']);
