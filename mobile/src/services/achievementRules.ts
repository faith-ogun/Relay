// ── What it means for an achievement to be EARNED ────────────────────────────
//
// ONE definition, used by the web workspace and by the phone app, because the
// two read ONE learner. Two things live here, and they are the two ways a medal
// was being taken away from someone who had earned it.
//
// 1. EARNING IS AN EVENT, NOT A PROPERTY OF TODAY'S COUNTERS.
//
//    Every achievement used to be recomputed from live counters on every
//    render. That makes a medal exactly as permanent as the arithmetic behind
//    it, and the arithmetic moves: three separate counter corrections shipped
//    in a single day, and each one silently stripped medals from learners who
//    had genuinely earned them. So the server stamps the moment a condition is
//    first met (backend/live-bridge/app/achievements.py) and `isEarnedWith`
//    reads the stamp FIRST. A stamped achievement stays earned whatever the
//    counters do afterwards, including going to zero.
//
//    The live comparison stays as the second half of the OR, for two honest
//    reasons: a learner who crosses a threshold while offline sees the medal
//    immediately rather than after a round trip, and a locked card still needs
//    a real number to draw its progress ring with.
//
// 2. LESSON COUNTS ARE COUNTED IN AUTHORED LESSONS, NOT IN SESSIONS.
//
//    The 142 authored lessons are cut into 284 learner-sized sessions at build
//    time: part one keeps the authored id, later parts take a Roman numeral
//    suffix (`splitLesson`, frontend/components/ohmlet/data/lessons.ts). Two
//    metrics are counted in lessons and both were counting sessions:
//
//      units   "every lesson in this unit is done". After the cut, a learner
//              who had finished all 142 authored lessons had every part one
//              done and every part two untouched, so up to four unit medals
//              evaporated. This is the bug that started this file.
//      builds  the number of lessons completed. Counted in sessions, cutting
//              the corpus in two halves every threshold in the family.
//
//    A unit is complete when its AUTHORED lessons are done. How many sittings
//    an authored lesson was delivered in is a packaging decision, and packaging
//    must never move a learner's medals.
//
// This file is duplicated verbatim into frontend/services and
// mobile/src/services. The two apps are separate bundles with separate module
// resolvers, so a single module outside both would need a metro watchFolders
// entry and a vite fs.allow entry before either could import it.
// `mobile/scripts/check-achievement-rules.mjs` asserts the two copies are byte
// for byte identical and drives every rule below, so a divergence cannot be
// merged.

/** The minimum shape of a curriculum unit this file needs. Structural, so both
 *  surfaces' own CurriculumUnit satisfies it without importing anything. */
export interface ScopedUnit {
  skills: { lessons: { id: string }[] }[];
}

/** The minimum shape of an achievement: what it counts and how much of it. */
export interface EarnRule {
  id: string;
  metric: string;
  threshold: number;
}

/**
 * id -> the stamp the server wrote. Values are opaque here on purpose: the web
 * holds the whole entry (when, against what value) and only presence matters.
 */
export type EarnedAt = Readonly<Record<string, unknown>>;

/**
 * Roman numerals that mark a CONTINUATION of an authored lesson.
 *
 * 'I' is deliberately absent. Part one never carries a suffix, so an id ending
 * in " I" can only be a lesson genuinely titled that way, and reading it as a
 * second part would silently merge two unrelated lessons into one.
 */
export const CONTINUATION_NUMERALS: ReadonlySet<string> = new Set(['II', 'III', 'IV', 'V']);

/**
 * The AUTHORED lesson a session id belongs to.
 *
 * Resolved against the corpus itself rather than a lookup table, so it holds for
 * any corpus the app is rendering, including one authored after this code was
 * written and served to a client that has never seen it. Part one keeps the
 * authored id and maps to itself; a later part is `"<authored id> <numeral>"`
 * and maps to its head, but only when that head is genuinely a lesson in the
 * same corpus. Anything else is returned untouched, which is the right answer
 * for an id that was never split.
 */
export function authoredLessonId(lessonId: string, corpusIds: ReadonlySet<string>): string {
  const cut = lessonId.lastIndexOf(' ');
  if (cut <= 0) return lessonId;
  if (!CONTINUATION_NUMERALS.has(lessonId.slice(cut + 1))) return lessonId;
  const head = lessonId.slice(0, cut);
  return corpusIds.has(head) ? head : lessonId;
}

/** Every session id in a corpus. */
export function corpusLessonIds(units: readonly ScopedUnit[]): Set<string> {
  const ids = new Set<string>();
  for (const unit of units) {
    for (const skill of unit.skills ?? []) {
      for (const lesson of skill.lessons ?? []) ids.add(lesson.id);
    }
  }
  return ids;
}

/**
 * Completed session ids collapsed onto the authored lessons they belong to.
 *
 * An authored lesson counts as done once the learner has finished a session of
 * it. That is what makes the bar independent of the packaging: the same work
 * counts once whether it was delivered in one sitting or three, and a record
 * written before the cut (which names the authored lesson) reads identically to
 * one written after it (which names part one, the same id).
 */
export function authoredCompletions(
  completed: Iterable<string>,
  corpusIds: ReadonlySet<string>,
): Set<string> {
  const done = new Set<string>();
  for (const id of completed) done.add(authoredLessonId(id, corpusIds));
  return done;
}

/** How many units the learner has finished, counted in AUTHORED lessons. */
export function authoredUnitsCompleted(
  units: readonly ScopedUnit[],
  completed: ReadonlySet<string>,
): number {
  const corpusIds = corpusLessonIds(units);
  const done = authoredCompletions(completed, corpusIds);
  let count = 0;
  for (const unit of units) {
    const authored = new Set<string>();
    for (const skill of unit.skills ?? []) {
      for (const lesson of skill.lessons ?? []) authored.add(authoredLessonId(lesson.id, corpusIds));
    }
    if (authored.size === 0) continue;
    let whole = true;
    for (const id of authored) {
      if (!done.has(id)) { whole = false; break; }
    }
    if (whole) count += 1;
  }
  return count;
}

/**
 * How many AUTHORED lessons the learner has completed.
 *
 * Progress recorded against a corpus this client is not rendering still counts:
 * a learner may have finished lessons on a phone running a newer curriculum, and
 * refusing to count those would drop their total the moment they opened the web
 * app. Ids the corpus does not know are simply not collapsible, so they count as
 * themselves.
 */
export function authoredLessonsCompleted(
  units: readonly ScopedUnit[],
  completed: ReadonlySet<string>,
): number {
  return authoredCompletions(completed, corpusLessonIds(units)).size;
}

/**
 * Whether a learner holds an achievement.
 *
 * The stamp wins. `stats` is consulted only for something not yet in the record,
 * which is either a threshold crossed since the last sync or a client that has
 * not reached the server yet. Nothing here can ever return false for an id the
 * record contains, which is the whole promise: earned is earned.
 *
 * `stats` is taken as a plain object rather than a per-surface stats type so the
 * two copies of this file can stay byte for byte identical; a metric that is
 * absent, or is not a number, reads as not yet earned.
 */
export function isEarnedWith(rule: EarnRule, stats: object, earnedAt: EarnedAt = {}): boolean {
  if (earnedAt[rule.id]) return true;
  const value = (stats as Record<string, unknown>)[rule.metric];
  return typeof value === 'number' && value >= rule.threshold;
}

/**
 * Fold the server's stats into the client's, per metric, keeping the higher.
 *
 * Both sides are monotonic counters over the same learner seen from different
 * vantage points: the server sees a second device and the community tally, the
 * client sees this second's activity before it has been persisted. Taking the
 * max can therefore never erase work, and it means a locked card's progress ring
 * shows the best informed number available rather than whichever side answered.
 */
export function mergeStats<T extends object>(local: T, server: object | null | undefined): T {
  if (!server) return local;
  const out: Record<string, unknown> = { ...(local as Record<string, unknown>) };
  for (const [metric, value] of Object.entries(server as Record<string, unknown>)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const held = out[metric];
    out[metric] = typeof held === 'number' && held > value ? held : value;
  }
  return out as T;
}
