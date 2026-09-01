// ── usePlan — the client view of the user's entitlements ──
//
// For now the plan lives in localStorage so the gating is real and testable
// today (and a dev switcher can flip it). When billing lands, the plan comes
// from the user record (set by the Stripe webhook) instead — only this hook
// changes, every <FeatureGate> keeps working.

import { useCallback, useEffect, useState } from 'react';
import {
  LIVE_MINUTES_PER_MONTH,
  isBetaFeature,
  planHas,
  type Feature,
  type Plan,
} from '../components/ohmlet/entitlements';
import { fetchMe, setMyPlan } from '../services/account';

// Storage is keyed per user so the admin and a guest in the same browser do not
// share a plan or a daily live budget. When billing lands, the plan moves to the
// user record (set by the Stripe webhook) and only the source here changes.
const planKey = (userId: string) => `ohmlet.plan.${userId}`;

/**
 * Same-tab plan changes.
 *
 * usePlan is called independently by the sidebar, Interview Mode, the live tutor
 * and others, and each call has its own useState. The only cross-instance signal
 * was the `storage` event — which browsers do NOT fire in the document that wrote
 * the value. So switching plan in the sidebar updated the sidebar and nothing
 * else, and Interview Mode went on showing its paywall to a Max subscriber until
 * a full reload. A plain event target fixes it without a state library.
 */
const planBus = new EventTarget();
const broadcast = (userId: string, plan: Plan) => {
  planBus.dispatchEvent(new CustomEvent('plan', { detail: { userId, plan } }));
};
const liveKey = (userId: string) => `ohmlet.live.${userId}`;

// The live budget resets monthly (the caps are per month). This local value is
// only an instant-paint cache; /v1/me is the source of truth.
const period = () => new Date().toISOString().slice(0, 7); // YYYY-MM

const readPlan = (userId: string): Plan => {
  const v = (typeof localStorage !== 'undefined' && localStorage.getItem(planKey(userId))) as Plan | null;
  return v === 'pro' || v === 'max' ? v : 'free';
};

const readLiveSeconds = (userId: string): number => {
  try {
    const raw = localStorage.getItem(liveKey(userId));
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { period?: string; seconds: number };
    return parsed.period === period() ? parsed.seconds : 0;
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
  // The localStorage value is just an instant-paint cache; the server is the
  // source of truth for the plan (#56), so reconcile as soon as /v1/me answers.
  useEffect(() => {
    let cancelled = false;
    setPlanState(readPlan(userId));
    setLiveSecondsUsed(readLiveSeconds(userId));
    void fetchMe().then((me) => {
      if (cancelled || !me) return; // signed out / backend unreachable -> keep cache
      setPlanState(me.plan);
      broadcast(userId, me.plan);
      try {
        localStorage.setItem(planKey(userId), me.plan);
      } catch {
        /* ignore */
      }
      if (typeof me.liveSecondsUsedThisMonth === 'number') setLiveSecondsUsed(me.liveSecondsUsedThisMonth);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Keep plan in sync across tabs (storage) and within this one (planBus).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === planKey(userId)) setPlanState(readPlan(userId));
    };
    const onBus = (e: Event) => {
      const d = (e as CustomEvent<{ userId: string; plan: Plan }>).detail;
      if (d?.userId === userId) setPlanState(d.plan);
    };
    window.addEventListener('storage', onStorage);
    planBus.addEventListener('plan', onBus);
    return () => {
      window.removeEventListener('storage', onStorage);
      planBus.removeEventListener('plan', onBus);
    };
  }, [userId]);

  const setPlan = useCallback((next: Plan) => {
    const previous = plan;
    localStorage.setItem(planKey(userId), next); // optimistic cache
    setPlanState(next);
    broadcast(userId, next);
    // Persist server-side. The backend only honours this for an admin (the dev
    // switcher); in production Stripe writes the plan.
    void setMyPlan(next).then((confirmed) => {
      // A null here means the write was REFUSED or failed — a 403 for a
      // non-admin, or a 5xx. Silently keeping the optimistic value is how the
      // sidebar ended up reading "Max plan" while the server said "pro" and
      // Interview Mode stayed locked: the switch looked like it worked, and the
      // next page load quietly undid it. Roll back and say so instead.
      const settled = confirmed ?? previous;
      if (settled !== next) {
        setPlanState(settled);
        broadcast(userId, settled);
        try {
          localStorage.setItem(planKey(userId), settled);
        } catch {
          /* ignore */
        }
        if (!confirmed) {
          console.warn(`[ohmlet] plan change to "${next}" was refused by the server; still on "${settled}".`);
        }
      }
    });
  }, [userId, plan]);

  const consumeLiveSeconds = useCallback((seconds: number) => {
    setLiveSecondsUsed((prev) => {
      const next = prev + seconds;
      localStorage.setItem(liveKey(userId), JSON.stringify({ period: period(), seconds: next }));
      return next;
    });
  }, [userId]);

  const can = useCallback((feature: Feature) => planHas(plan, feature), [plan]);

  const liveCapMinutes = LIVE_MINUTES_PER_MONTH[plan];
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
