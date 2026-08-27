import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOhmletUserState } from './useOhmletUserState';
import { onMetric, type CountedMetric } from '../services/achievementEvents';
import {
  readCachedEarned,
  syncAchievements,
  type AchievementRecord,
  type EarnedEntry,
  type FailReason,
} from '../services/achievements';
import { isEarnedWith, mergeStats, type EarnRule } from '../services/achievementRules';

// Counters behind the achievements that xp/streak/builds/units do not cover.
//
// Persisted under the state key 'metrics', which resolves to its own server
// document at /v1/state/{uid}/metrics. That is what makes the claim below true;
// it was not always. The key originally namespaced localStorage only, and both
// this hook and the workspace's 'progress' hook PUT the same unkeyed document,
// where the write is a full replace: whichever saved last owned the document
// and the other record was destroyed. Opening this page could wipe a learner's
// XP, streak and lesson levels.
//
// With the key in the path the two records are isolated, so their saves cannot
// overwrite each other, and the counters follow the user rather than the device
// so a second device does not reset them.
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

// ── Earned-ness, which is a RECORD and not a calculation ─────────────────────

export interface EarnedAchievements {
  /** achievement id -> the server's stamp. Presence means earned, forever. */
  earnedAt: Record<string, EarnedEntry>;
  /** The client's stats folded with the server's, per metric, keeping the higher. */
  stats: Record<string, number | undefined>;
  /** Ids stamped by the sync this session, for the ceremony. Empty on a backfill. */
  newlyEarned: string[];
  /** False until the first answer (cached or served) is in hand. */
  ready: boolean;
  /** Why the record could not be reached, if it could not. */
  error: FailReason | null;
  /** Ask again after a failure. A no-op while a sync is already in flight. */
  retry: () => void;
}

/**
 * The learner's durable achievements, and the stats to draw progress with.
 *
 * Reads the server's record (backend/live-bridge/app/achievements.py), which is
 * the ONLY thing that decides whether something has been earned. A locally
 * satisfied condition that is not yet stamped still renders as earned, so a
 * threshold crossed offline lights up at once, and the next sync makes it
 * permanent.
 *
 * The record is never narrowed here. Ids come from three places, all of them
 * additive: this device's cache, the server's answer, and the live comparison.
 * There is no code path that removes one.
 */
export function useEarnedAchievements(
  rules: readonly EarnRule[],
  stats: Record<string, number | undefined>,
): EarnedAchievements {
  // Seeded from the cache so a cold start with no network shows the case the
  // learner left, rather than a wall of locked cards that fills in a second later.
  const [cached] = useState<Record<string, EarnedEntry>>(() => readCachedEarned());
  const [record, setRecord] = useState<AchievementRecord | null>(null);
  const [error, setError] = useState<FailReason | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Questions already asked. Bounds the traffic: one sync per distinct set of
  // unstamped-but-satisfied ids, so a server whose view of a counter lags this
  // client's cannot be asked the same question on every render.
  const asked = useRef<Set<string>>(new Set());
  // The last attempt that has actually reached the network. Without it the reply
  // to the first sync would trigger a second one, because it changes the record,
  // which empties the pending set, which is itself a question never asked.
  const dispatched = useRef(-1);
  const alive = useRef(true);
  // Re-armed on mount, not only cleared on unmount: React runs effects twice in
  // development, and a flag that is only ever set false would stay false for the
  // life of the component and drop every reply.
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const earnedAt = useMemo(
    () => ({ ...cached, ...(record?.earned ?? {}) }),
    [cached, record],
  );

  const merged = useMemo(() => mergeStats(stats, record?.stats), [stats, record]);

  // Anything true right now that the record does not yet hold. That set is both
  // the reason to sync and the key that stops us syncing about it twice.
  const pending = useMemo(
    () => rules.filter((r) => !earnedAt[r.id] && isEarnedWith(r, merged)).map((r) => r.id).sort(),
    [rules, earnedAt, merged],
  );

  useEffect(() => {
    const question = `${attempt}:${pending.join(',')}`;
    if (asked.current.has(question)) return;
    // The record has to be fetched at least once, so the first request of an
    // attempt always goes out even with nothing pending. After that, only a
    // genuinely new satisfied-but-unstamped set is worth another round trip.
    if (dispatched.current === attempt && pending.length === 0) return;
    asked.current.add(question);
    dispatched.current = attempt;
    void syncAchievements().then((result) => {
      if (!alive.current) return;
      if (result.ok) {
        setRecord(result.data);
        setError(null);
      } else {
        setError(result.reason);
      }
    });
  }, [pending, attempt]);

  const retry = useCallback(() => {
    // Bumping the attempt is what makes this do anything: the question that
    // failed is otherwise remembered as asked, and after a failure the pending
    // set is exactly what it was.
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return {
    earnedAt,
    stats: merged,
    // A backfill is the record catching up with a learner who already had these,
    // so it is not something to celebrate at them.
    newlyEarned: record && !record.backfilled ? record.newlyEarned : [],
    ready: record !== null || Object.keys(cached).length > 0 || error !== null,
    error,
    retry,
  };
}
