// ── Lesson levelling: Bronze, Silver, Gold ──
//
// The phone's copy of the web's progression, so a learner alternating surfaces
// sees one ladder rather than two. Before this file existed the phone always ran
// a lesson at Bronze and recorded it as Bronze, so a Gold earned in the browser
// came back as Bronze the next time the phone saved, and a phone-only learner
// could never leave Bronze at all.
//
//   Bronze (1): the lesson as authored, teach steps and practice.
//   Silver (2): teach steps dropped, the remaining steps and their options shuffled.
//   Gold   (3): the same pure recall run, drawn from the hardest questions first.
//
// Everything below the rule marker is byte for byte identical to
// frontend/components/ohmlet/data/levels.ts. Only the two lines above the marker
// differ, because the step types come from a different module on each surface.

import type { LessonStep } from './types';

/**
 * A step as authored. The served corpus tags 964 of its 2355 steps with the
 * difficulty tier the pool sampler draws from; an untagged step reads as tier 1.
 */
export type AuthoredStep = LessonStep & { difficulty?: Difficulty };

// ── The rule (identical on both surfaces; guarded by mobile/scripts/check-lesson-levels.mjs) ──

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

// Hearts used to be allotted per level here (Gold got two, the rest three).
// They are now an account resource the server owns (services/hearts.ts), so a
// per-run allowance would contradict the pool it is meant to draw from. Gold
// stays harder through its steps, which is where the difficulty belongs.

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
  const s = step as LessonStep & { options: string[]; correct: number; optionImages?: string[] };
  // meter/bands steps are graded by their widget, not the option list, so never shuffle them.
  if ((s as { meter?: unknown }).meter || (s as { bands?: unknown }).bands) return step;
  const order = shuffle(s.options.map((_, i) => i));
  const options = order.map((i) => s.options[i]);
  const correct = order.indexOf(s.correct);
  const next = { ...step, options, correct } as LessonStep & { optionImages?: string[] };
  // Keep optionImages aligned with their options through the shuffle (else the
  // picture under each label desyncs).
  if (Array.isArray(s.optionImages)) next.optionImages = order.map((i) => s.optionImages![i]);
  return next;
}

// How many questions a single run shows when a lesson has a deep pool. A clean
// Duolingo run is ~15 questions; wrong answers requeue on top of this in the runner.
export const RUN_SIZE = 15;
// A lesson needs more than this many questions to count as a "pool" worth sampling
// (otherwise the whole authored set is the run).
const POOL_THRESHOLD = RUN_SIZE + 2;

const DRAW_TYPES = new Set(['draw_circuit', 'draw_fix']);

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
 * harder slice: Bronze favours easy questions, Gold the hardest, so replays
 * feel like new, escalating challenges rather than the same set reshuffled.
 */
export function buildLeveledSteps(steps: AuthoredStep[], level: number): LessonStep[] {
  const teach = steps.filter((s) => s.type === 'teach');
  const graded = steps.filter((s) => s.type !== 'teach');

  // Deep pool → sample a tiered slice.
  if (graded.length >= POOL_THRESHOLD) {
    // Drawing steps are the embodied hero: pin them into every run so a learner
    // always meets the canvas, then fill the rest of the slice by tier.
    const draws = graded.filter((s) => DRAW_TYPES.has(s.type));
    const rest = graded.filter((s) => !DRAW_TYPES.has(s.type));
    const byTier: Record<Difficulty, AuthoredStep[]> = { 1: [], 2: [], 3: [] };
    for (const s of rest) byTier[difficultyOf(s)].push(s);
    const order = TIER_ORDER[Math.min(3, Math.max(1, level))];
    const picked: AuthoredStep[] = draws.slice(0, RUN_SIZE);
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
