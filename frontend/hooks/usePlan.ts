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

const PLAN_KEY = 'ohmlet.plan';
const LIVE_KEY = 'ohmlet.live';

const today = () => new Date().toISOString().slice(0, 10);

const readPlan = (): Plan => {
  const v = (typeof localStorage !== 'undefined' && localStorage.getItem(PLAN_KEY)) as Plan | null;
  return v === 'pro' || v === 'max' ? v : 'free';
};

const readLiveSeconds = (): number => {
  try {
    const raw = localStorage.getItem(LIVE_KEY);
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

export function usePlan(): UsePlan {
  const [plan, setPlanState] = useState<Plan>(readPlan);
  const [liveSecondsUsed, setLiveSecondsUsed] = useState<number>(readLiveSeconds);

  // Keep plan in sync across tabs / the dev switcher.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PLAN_KEY) setPlanState(readPlan());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPlan = useCallback((next: Plan) => {
    localStorage.setItem(PLAN_KEY, next);
    setPlanState(next);
  }, []);

  const consumeLiveSeconds = useCallback((seconds: number) => {
    setLiveSecondsUsed((prev) => {
      const next = prev + seconds;
      localStorage.setItem(LIVE_KEY, JSON.stringify({ date: today(), seconds: next }));
      return next;
    });
  }, []);

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
