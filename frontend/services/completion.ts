// ── What finishing a lesson does to a learner's record ──────────────────────
//
// ONE definition of a completion, used by the web workspace and by the phone
// app, because the two write to ONE progress record.
//
// They used to disagree. The web recorded nothing at all when a run finished at
// or below the level already held: no XP, no streak, no daily goal, no write of
// any kind. A learner at 100% completion therefore could not keep a streak alive
// in the browser, while the same replay on their phone advanced it. Which
// surface they happened to open decided whether the streak survived the day.
//
// The rule, in full:
//
//   XP           paid only when the run reaches a level HIGHER than the one on
//                record. A first pass pays. A replay at or below the level held
//                pays nothing. Levelling up, Bronze to Silver or Silver to Gold,
//                pays whatever the caller worked out for that level.
//   level        never demoted: max(held, reached).
//   streak       advances on the first completion of a calendar day, replay or
//                not. Practice is the thing a streak is measuring. It BREAKS by
//                the passage of time rather than by any action, which is why
//                reading it needs `currentStreak` and not the stored number.
//   daily goal   DISTINCT lesson ids completed today. Replaying one easy lesson
//                five times must not fill a five lesson goal.
//   achievements not decided here. The once per lesson counters (perfect,
//                drawings) are gated by the caller on whether the lesson was
//                already completed BEFORE the run started, which is a reading
//                both surfaces take before they open a lesson.
//
// This file is duplicated verbatim into frontend/services and
// mobile/src/services. The two apps are separate bundles with separate module
// resolvers, so a single module outside both would need a metro watchFolders
// entry and a vite fs.allow entry before either could import it.
// `mobile/scripts/check-completion-rule.mjs` asserts the two copies are byte for
// byte identical and drives the rule through the whole table above, so a
// divergence cannot be merged.

/** The fields of a progress record that finishing a lesson touches. */
export interface CompletionRecord {
  /** lesson id -> level reached (1 bronze, 2 silver, 3 gold). Present means completed. */
  lessonLevels: Record<string, number>;
  xp: number;
  streak: number;
  /** Distinct lessons completed today. Derived from todayLessonIds, never a tally of attempts. */
  completedToday: number;
  /** Which lessons have counted toward today's goal. Cleared when the day turns. */
  todayLessonIds?: string[];
  /** UTC calendar day of the last completion, as YYYY-MM-DD. */
  lastActiveDate: string;
}

const DAY_MS = 86_400_000;

/**
 * The UTC calendar day a moment falls in.
 *
 * UTC deliberately, on both surfaces, because UTC has no daylight saving: the
 * day before a UTC day is always exactly 24 hours earlier. Subtracting a day in
 * local time and then formatting as UTC, which is what the web used to do, is
 * 23 or 25 hours across a clock change and can drop or repeat a day of streak.
 */
export const isoDay = (at: Date): string => at.toISOString().slice(0, 10);

/**
 * Record a finished lesson against a learner's progress. Pure: it returns a new
 * record and never writes anything. The caller persists the result.
 *
 * `at` is injectable so day boundaries can be driven deterministically by the
 * check script rather than waiting for midnight.
 */
export function applyCompletion<T extends CompletionRecord>(
  current: T,
  lessonId: string,
  xpGained: number,
  level = 1,
  at: Date = new Date(),
): T {
  const day = isoDay(at);
  const held = current.lessonLevels[lessonId] ?? 0;
  // Finishing a run is worth at least Bronze. A level of 0 would otherwise be
  // stored as "not completed" and hide a lesson the learner just cleared.
  const reached = Number.isFinite(level) ? Math.max(1, Math.trunc(level)) : 1;

  const sameDay = current.lastActiveDate === day;
  const yesterday = isoDay(new Date(at.getTime() - DAY_MS));
  // A gap of exactly one day keeps the streak. Anything longer restarts it. A
  // stored streak of 0 on a day that already has a completion is a record an
  // older build wrote, and 1 is the honest reading of it.
  const streak = sameDay
    ? current.streak || 1
    : current.lastActiveDate === yesterday
      ? current.streak + 1
      : 1;

  const idsToday = sameDay ? current.todayLessonIds ?? [] : [];
  const todayLessonIds = idsToday.includes(lessonId) ? idsToday : [...idsToday, lessonId];

  const payable = Number.isFinite(xpGained) ? Math.max(0, Math.trunc(xpGained)) : 0;
  const earned = reached > held ? payable : 0;

  const next: CompletionRecord = {
    lessonLevels: { ...current.lessonLevels, [lessonId]: Math.max(held, reached) },
    xp: current.xp + earned,
    streak,
    todayLessonIds,
    completedToday: todayLessonIds.length,
    lastActiveDate: day,
  };

  // The record carries fields this rule has no opinion about: the achievement
  // counters on the phone, the checkpoint ledger on both. They pass through
  // untouched. TypeScript cannot see that a T spread over a CompletionRecord is
  // still a T, which is what the assertion is for.
  return { ...current, ...next } as T;
}

/**
 * The streak as it stands RIGHT NOW, which is not always the number stored.
 *
 * A streak is the only counter in the product that decreases while nobody is
 * looking. Everything else changes because the learner did something; this
 * changes because they did not. `applyCompletion` can only run on a completion,
 * so it cannot be what breaks a streak: on the day the streak dies there is, by
 * definition, no completion to trigger it.
 *
 * Left to the stored number, a learner who missed a day and simply opened the
 * app saw the streak they used to have. It self-corrected the next time they
 * finished a lesson, which is far too late, and it corrected DOWNWARD at the
 * exact moment they had just done the work. A streak that cannot be broken is
 * not a streak, it is a counter with a flame on it, and once a learner notices
 * that, every other number in the app is worth less too.
 *
 * Today and yesterday both count as alive. Missing TODAY breaks nothing, because
 * today is not over: a learner who worked yesterday has until midnight UTC to
 * keep it. That is the at-risk state worth a nudge, not a reset. Anything older
 * is gone, and returns 0.
 */
export function currentStreak(
  record: Pick<CompletionRecord, 'streak' | 'lastActiveDate'>,
  at: Date = new Date(),
): number {
  const held = Number.isFinite(record.streak) ? Math.trunc(record.streak) : 0;
  if (held <= 0 || !record.lastActiveDate) return 0;
  const today = isoDay(at);
  const yesterday = isoDay(new Date(at.getTime() - DAY_MS));
  return record.lastActiveDate === today || record.lastActiveDate === yesterday ? held : 0;
}

/**
 * Whether the streak survives today only if the learner works today. True on the
 * day AFTER their last completion, and it is the only honest moment to say "your
 * streak ends tonight". Never true when the streak is already gone.
 */
export function streakAtRisk(
  record: Pick<CompletionRecord, 'streak' | 'lastActiveDate'>,
  at: Date = new Date(),
): boolean {
  return currentStreak(record, at) > 0 && record.lastActiveDate !== isoDay(at);
}

/**
 * How many DISTINCT lessons count toward today's goal, right now.
 *
 * The same shape of defect as `currentStreak`, and it was shipped in the same
 * place for the same reason: `completedToday` is written by a completion, so on
 * a day with no completion nothing rewrites it and yesterday's count stands. A
 * learner who did three lessons on Saturday opened the app on Monday to a daily
 * goal already showing 3 of 3, complete, with no work done.
 *
 * Worse than the streak, in one way. A stale streak flatters the learner; a
 * stale daily goal REMOVES the thing they were meant to do today. The ring is
 * already full, so there is nothing to close, and the single clearest reason to
 * open the app has quietly gone.
 *
 * The web workspace already guarded this inline while the phone did not, which
 * is precisely the split the shared rule exists to prevent. Both now call this.
 */
export function completedTodayNow(
  record: Pick<CompletionRecord, 'completedToday' | 'lastActiveDate' | 'todayLessonIds'>,
  at: Date = new Date(),
): number {
  if (record.lastActiveDate !== isoDay(at)) return 0;
  // `todayLessonIds` is the truth and `completedToday` is its length, so prefer
  // the list where it exists. A record written before the list was introduced
  // has the number alone.
  const ids = record.todayLessonIds;
  if (Array.isArray(ids)) return ids.length;
  const n = record.completedToday;
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

/** The lessons that have counted toward today's goal, or none if the day turned. */
export function todayLessonIdsNow(
  record: Pick<CompletionRecord, 'lastActiveDate' | 'todayLessonIds'>,
  at: Date = new Date(),
): string[] {
  if (record.lastActiveDate !== isoDay(at)) return [];
  return record.todayLessonIds ?? [];
}
