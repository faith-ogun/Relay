import { useCallback } from 'react';
import type React from 'react';
import type { XpEvent } from '../types';

const todayISO = () => new Date().toISOString().slice(0, 10);

type UseXpArgs = {
  xpEvents: XpEvent[];
  weekProgress: boolean[];
  setXpEvents: React.Dispatch<React.SetStateAction<XpEvent[]>>;
  setWeekProgress: React.Dispatch<React.SetStateAction<boolean[]>>;
  setLastActiveDate: React.Dispatch<React.SetStateAction<string>>;
};

/**
 * XP + streak engine. XP/level are fully derived from the persisted event
 * log; recording an event also marks today active for the streak. The
 * persisted slices (xpEvents/weekProgress/lastActiveDate) stay in the parent
 * so the shared persistence effect keeps owning them — this hook computes the
 * derived values and provides the single pushXpEvent entry point.
 */
export function useXp({ xpEvents, weekProgress, setXpEvents, setWeekProgress, setLastActiveDate }: UseXpArgs) {
  // ── XP fully derived from persisted events ──
  const xp = xpEvents.reduce((sum, e) => sum + e.xp, 0);
  const level = Math.max(1, Math.floor(xp / 140));
  const streakCount = weekProgress.filter(Boolean).length;

  const pushXpEvent = useCallback((type: XpEvent['type'], xpValue: number, detail?: string) => {
    const event: XpEvent = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      xp: xpValue,
      timestamp: new Date().toISOString(),
      detail,
    };
    setXpEvents((prev) => [event, ...prev].slice(0, 500)); // cap at 500 events

    // Mark today as active for streak
    const today = todayISO();
    const dayIndex = new Date().getDay(); // 0=Sun, 1=Mon ... 6=Sat
    // weekProgress is [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    const idx = dayIndex === 0 ? 6 : dayIndex - 1;
    setWeekProgress((prev) => {
      const next = [...prev];
      next[idx] = true;
      return next;
    });
    setLastActiveDate(today);
  }, [setXpEvents, setWeekProgress, setLastActiveDate]);

  return { xp, level, streakCount, pushXpEvent };
}
