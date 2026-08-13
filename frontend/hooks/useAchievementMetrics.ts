import { useCallback, useEffect } from 'react';
import { useOhmletUserState } from './useOhmletUserState';
import { onMetric, type CountedMetric } from '../services/achievementEvents';

// Counters behind the achievements that xp/streak/builds/units do not cover.
// Persisted in their OWN state document (key 'metrics') rather than inside the
// progress envelope, so the two saves cannot race each other, and synced per
// user rather than per device so a second device does not reset them.
export interface MetricCounters extends Record<string, unknown> {
  liveSessions: number;
  drawings: number;
  perfect: number;
  twins: number;
  posts: number;
  comments: number;
  challenges: number;
  leagueWins: number;
  /** ISO week already credited as a league win, so one week counts once. */
  lastLeagueWeek: string;
}

const DEFAULTS: MetricCounters = {
  liveSessions: 0,
  drawings: 0,
  perfect: 0,
  twins: 0,
  posts: 0,
  comments: 0,
  challenges: 0,
  leagueWins: 0,
  lastLeagueWeek: '',
};

export function useAchievementMetrics(userId: string) {
  const { state, updateState, ready } = useOhmletUserState<MetricCounters>({
    userId,
    key: 'metrics',
    defaults: DEFAULTS,
  });

  const bump = useCallback(
    (metric: CountedMetric, amount = 1) => {
      // Updater form: two events in the same tick must not read the same stale
      // count and lose one.
      updateState((prev) => ({ [metric]: (Number(prev[metric]) || 0) + amount }) as Partial<MetricCounters>);
    },
    [updateState],
  );

  // Single listener: emitters stay decoupled and there is one writer.
  useEffect(() => {
    if (!ready) return; // do not count into defaults before the real values load
    return onMetric((metric, amount) => bump(metric, amount));
  }, [ready, bump]);

  /**
   * Credit a top-three weekly finish exactly once per league week. Called with
   * the week id the leaderboard reports, so re-renders and revisits within the
   * same week cannot inflate it.
   */
  const creditLeagueWin = useCallback(
    (week: string, rank: number | null) => {
      if (!ready || !week || !rank || rank > 3) return;
      if (state.lastLeagueWeek === week) return;
      updateState({ lastLeagueWeek: week, leagueWins: (state.leagueWins ?? 0) + 1 });
    },
    [ready, state.lastLeagueWeek, state.leagueWins, updateState],
  );

  return { metrics: state, ready, creditLeagueWin };
}
