// ── Lesson leveling: Bronze → Silver → Gold ──
//
// Duolingo's "do the circle 5 times" mechanic, adapted for a SKILL app. The next
// lesson unlocks after a single pass (Bronze) — no forced grinding — but a learner
// can replay any lesson to level it up for more XP and real mastery. Each level is
// harder, so the SAME authored content yields ~3x the engagement hours without
// authoring 3x the lessons.
//
//   Bronze (1): the lesson as authored (teach + practice).
//   Silver (2): teach steps dropped, remaining steps + their options shuffled.
//   Gold   (3): same pure-recall run as Silver, but with fewer hearts.

import type { AuthoredStep, LessonStep } from './lessons';

export type LessonLevel = 0 | 1 | 2 | 3; // 0 = not started
export const MAX_LEVEL = 3 as const;

export interface LevelMeta {
  name: string;
  /** medal / ring colour */
  color: string;
  /** soft background tint for chips */
  soft: string;
}

export const LEVEL_META: Record<1 | 2 | 3, LevelMeta> = {
  1: { name: 'Bronze', color: '#c17a3f', soft: '#f6e7d6' },
  2: { name: 'Silver', color: '#8d97a3', soft: '#eef1f4' },
  3: { name: 'Gold', color: '#e3a91b', soft: '#fbeec2' },
};

/** Hearts allotted for an attempt at the given level (Gold is less forgiving). */
export const heartsForLevel = (level: number): number => (level >= 3 ? 2 : 3);

/** XP awarded for reaching a level: full for Bronze, half each for Silver/Gold. */
export const xpForLevel = (baseXp: number, level: number): number =>
  level <= 1 ? baseXp : Math.max(5, Math.round(baseXp * 0.5));

/** The level a learner is attempting next, given their current level (caps at Gold). */
export const nextAttemptLevel = (current: number): number => Math.min(MAX_LEVEL, (current || 0) + 1);

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const CHOICE_TYPES = new Set(['multiple_choice', 'predict_reading', 'predict_behavior', 'choose_resistor']);

/** Shuffle a choice step's options and remap its correct index. Other steps pass through. */
function shuffleStepOptions(step: LessonStep): LessonStep {
  if (!CHOICE_TYPES.has(step.type)) return step;
  const s = step as LessonStep & { options: string[]; correct: number };
  const order = shuffle(s.options.map((_, i) => i));
  const options = order.map((i) => s.options[i]);
  const correct = order.indexOf(s.correct);
  return { ...step, options, correct } as LessonStep;
}

// How many questions a single run shows when a lesson has a deep pool.
export const RUN_SIZE = 8;
// A lesson needs more than this many questions to count as a "pool" worth sampling.
const POOL_THRESHOLD = RUN_SIZE + 2;

// Tier preference order by level: which difficulty to draw from first.
const TIER_ORDER: Record<number, Difficulty[]> = {
  1: [1, 2, 3],
  2: [2, 3, 1],
  3: [3, 2, 1],
};
type Difficulty = 1 | 2 | 3;

const difficultyOf = (s: AuthoredStep): Difficulty => (s.difficulty === 2 || s.difficulty === 3 ? s.difficulty : 1);

/**
 * Build the step list for a given level.
 *
 * Small / legacy lessons (few questions): Bronze plays as authored; Silver/Gold
 * strip teach steps and shuffle the practice + options for a harder recall run.
 *
 * Deep, tiered lessons (a real question pool): each level draws a DIFFERENT,
 * harder slice — Bronze favours easy questions, Gold the hardest — so replays
 * feel like new, escalating challenges rather than the same set reshuffled.
 */
export function buildLeveledSteps(steps: AuthoredStep[], level: number): LessonStep[] {
  const teach = steps.filter((s) => s.type === 'teach');
  const graded = steps.filter((s) => s.type !== 'teach');

  // Deep pool → sample a tiered slice.
  if (graded.length >= POOL_THRESHOLD) {
    const byTier: Record<Difficulty, AuthoredStep[]> = { 1: [], 2: [], 3: [] };
    for (const s of graded) byTier[difficultyOf(s)].push(s);
    const order = TIER_ORDER[Math.min(3, Math.max(1, level))];
    const picked: AuthoredStep[] = [];
    for (const tier of order) {
      for (const s of shuffle(byTier[tier])) {
        if (picked.length >= RUN_SIZE) break;
        picked.push(s);
      }
      if (picked.length >= RUN_SIZE) break;
    }
    const run = shuffle(picked).map(shuffleStepOptions);
    // Bronze keeps a little teaching up front; Silver/Gold are pure recall.
    return level <= 1 ? [...teach.slice(0, 2), ...run] : run;
  }

  // Small lesson fallback.
  if (level <= 1) return steps;
  if (graded.length < 2) return steps;
  return shuffle(graded).map(shuffleStepOptions);
}
