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

import type { LessonStep } from './lessons';

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

/**
 * Build the step list for a given level. Bronze returns the lesson as authored;
 * Silver/Gold strip the teach steps and shuffle the practice steps + their options
 * so a replay is a fresh, harder pure-recall run, not a memorised sequence.
 */
export function buildLeveledSteps(steps: LessonStep[], level: number): LessonStep[] {
  if (level <= 1) return steps;
  const practice = steps.filter((s) => s.type !== 'teach');
  // Guard: if a lesson is almost all teaching, keep the original rather than empty it.
  if (practice.length < 2) return steps;
  return shuffle(practice).map(shuffleStepOptions);
}
