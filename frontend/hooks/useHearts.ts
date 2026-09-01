import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  getHeartsSnapshot,
  refreshHearts,
  secondsToNextHeart,
  spendHeart,
  subscribeHearts,
  type Hearts,
} from '../services/hearts';

/**
 * The learner's heart balance, with a live countdown to the next one.
 *
 * The countdown is recomputed from wall-clock time each tick rather than
 * decremented, so a tab left in the background does not come back still
 * promising a heart that landed twenty minutes ago.
 */
/**
 * The learner's heart balance.
 *
 * Deliberately does NOT tick. The lesson runner needs the balance to know
 * whether to show the wall and nothing else; if the balance carried a
 * one-second countdown with it, the whole runner — canvas, step body and all —
 * would re-render once a second for as long as a heart was regenerating.
 * Anything that displays the countdown uses useHeartsCountdown, which confines
 * the tick to the component drawing it.
 */
export function useHearts() {
  const state = useSyncExternalStore<Hearts | null>(subscribeHearts, getHeartsSnapshot);

  useEffect(() => { void refreshHearts(); }, []);

  const spend = useCallback((key: string) => spendHeart(key), []);

  return {
    hearts: state?.hearts ?? null,
    max: state?.max ?? null,
    unlimited: state?.unlimited ?? false,
    loaded: state != null,
    empty: !!state && !state.unlimited && (state.hearts ?? 1) <= 0,
    regenSeconds: state?.regenSeconds ?? null,
    refresh: refreshHearts,
    spend,
  };
}

/**
 * The balance plus a live countdown to the next heart.
 *
 * Recomputed from wall-clock time each tick rather than decremented, so a tab
 * left in the background does not come back still promising a heart that landed
 * twenty minutes ago.
 */
export function useHeartsCountdown() {
  const base = useHearts();
  const snapshot = useSyncExternalStore<Hearts | null>(subscribeHearts, getHeartsSnapshot);
  const [nextIn, setNextIn] = useState<number | null>(() => secondsToNextHeart());

  const waiting = !!snapshot && !snapshot.unlimited && snapshot.nextHeartInSeconds != null;

  useEffect(() => {
    if (!waiting) { setNextIn(null); return; }
    setNextIn(secondsToNextHeart());
    const id = window.setInterval(() => {
      const left = secondsToNextHeart();
      setNextIn(left);
      if (left != null && left <= 0) void refreshHearts();
    }, 1000);
    return () => window.clearInterval(id);
  }, [waiting, snapshot]);

  return {
    ...base,
    nextIn,
    regenProgress:
      nextIn == null || !base.regenSeconds
        ? null
        : Math.min(1, Math.max(0, 1 - nextIn / base.regenSeconds)),
  };
}

/** "1h 24m" / "12m 05s" — a wait, phrased the way someone reads a wait. */
export function formatWait(seconds: number | null): string {
  if (seconds == null) return '';
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}
