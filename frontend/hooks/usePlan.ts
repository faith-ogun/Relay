// ── usePlan — the client view of the user's entitlements ──
//
// For now the plan lives in localStorage so the gating is real and testable
// today (and a dev switcher can flip it). When billing lands, the plan comes
// from the user record (set by the Stripe webhook) instead — only this hook
// changes, every <FeatureGate> keeps working.

import { useCallback, useEffect, useState } from 'react';
import {
  LIVE_MINUTES_PER_DAY,
  isBetaFeature,
  planHas,
  type Feature,
  type Plan,
} from '../components/ohmlet/entitlements';

// Storage is keyed per user so the admin and a guest in the same browser do not
// share a plan or a daily live budget. When billing lands, the plan moves to the
// user record (set by the Stripe webhook) and only the source here changes.
const planKey = (userId: string) => `ohmlet.plan.${userId}`;
const liveKey = (userId: string) => `ohmlet.live.${userId}`;

const today = () => new Date().toISOString().slice(0, 10);

const readPlan = (userId: string): Plan => {
  const v = (typeof localStorage !== 'undefined' && localStorage.getItem(planKey(userId))) as Plan | null;
  return v === 'pro' || v === 'max' ? v : 'free';
};

const readLiveSeconds = (userId: string): number => {
  try {
    const raw = localStorage.getItem(liveKey(userId));
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { date: string; seconds: number };
    return parsed.date === today() ? parsed.seconds : 0;
  } catch {
    return 0;
  }
};

export interface UsePlan {
  plan: Plan;
  setPlan: (plan: Plan) => void;
  can: (feature: Feature) => boolean;
  isBeta: (feature: Feature) => boolean;
  liveCapMinutes: number;
  liveSecondsUsed: number;
  liveMinutesRemaining: number;
  canGoLive: boolean;
  consumeLiveSeconds: (seconds: number) => void;
}

export function usePlan(userId = 'anon'): UsePlan {
  const [plan, setPlanState] = useState<Plan>(() => readPlan(userId));
  const [liveSecondsUsed, setLiveSecondsUsed] = useState<number>(() => readLiveSeconds(userId));

  // Re-read when the user identity changes (e.g. switching admin ↔ guest).
  useEffect(() => {
    setPlanState(readPlan(userId));
    setLiveSecondsUsed(readLiveSeconds(userId));
  }, [userId]);

  // Keep plan in sync across tabs / the dev switcher.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === planKey(userId)) setPlanState(readPlan(userId));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [userId]);

  const setPlan = useCallback((next: Plan) => {
    localStorage.setItem(planKey(userId), next);
    setPlanState(next);
  }, [userId]);

  const consumeLiveSeconds = useCallback((seconds: number) => {
    setLiveSecondsUsed((prev) => {
      const next = prev + seconds;
      localStorage.setItem(liveKey(userId), JSON.stringify({ date: today(), seconds: next }));
      return next;
    });
  }, [userId]);

  const can = useCallback((feature: Feature) => planHas(plan, feature), [plan]);

  const liveCapMinutes = LIVE_MINUTES_PER_DAY[plan];
  const liveMinutesRemaining = liveCapMinutes === Infinity ? Infinity : Math.max(0, liveCapMinutes - liveSecondsUsed / 60);
  const canGoLive = can('live') && liveMinutesRemaining > 0;

  return {
    plan,
    setPlan,
    can,
    isBeta: isBetaFeature,
    liveCapMinutes,
    liveSecondsUsed,
    liveMinutesRemaining,
    canGoLive,
    consumeLiveSeconds,
  };
}
