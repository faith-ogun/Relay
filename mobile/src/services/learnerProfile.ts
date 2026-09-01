// ── Learner profile: the answers from the setup questions ──
//
// Every question here changes something the learner will actually see. That is
// the whole selection rule: a question whose answer goes nowhere is a survey
// wearing a product's clothes, and it costs the one thing onboarding cannot
// spare, which is the person's patience before they have seen any value.
//
// Where each answer lands is noted on its type below. If a future question has
// nowhere to land, it does not get asked.

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Drives the "start further along" offer on Home. */
export type Experience = 'none' | 'some' | 'lots';

/** Drives the live-tutor copy: the tutor needs a real board to watch. */
export type Bench = 'kit' | 'parts' | 'none';

/** Drives how Home frames the next action. */
export type Goal = 'first-circuit' | 'habit' | 'arduino' | 'course';

/** The daily lesson target, shown and counted against on Home. */
export type DailyGoal = 1 | 2 | 3 | 5;

export interface LearnerProfile {
  experience: Experience;
  bench: Bench;
  goal: Goal;
  dailyGoal: DailyGoal;
  /** ISO date the setup was completed, so it is never re-asked. */
  completedAt: string;
}

const KEY = 'ohmlet.learnerProfile.v1';

export const DEFAULT_PROFILE: LearnerProfile = {
  experience: 'none',
  bench: 'none',
  goal: 'first-circuit',
  dailyGoal: 1,
  completedAt: '',
};

export async function loadProfile(): Promise<LearnerProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LearnerProfile>;
    // Merged over the defaults so a profile saved by an older build, before a
    // field existed, still loads instead of throwing at a missing key.
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return null;
  }
}

export async function saveProfile(profile: LearnerProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* storage blocked: the setup simply asks again next launch */
  }
}

export async function clearProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* nothing stored to clear */
  }
}

/** How Home frames the next lesson, given the stated goal. */
export const GOAL_FRAMING: Record<Goal, string> = {
  'first-circuit': 'TOWARD YOUR FIRST CIRCUIT',
  habit: 'TODAY’S SESSION',
  arduino: 'TOWARD ARDUINO',
  course: 'TOWARD YOUR COURSE',
};

/** What the live tutor can do for you, given what is on your bench. */
export const BENCH_NOTE: Record<Bench, string> = {
  kit: 'Camera + voice on your real bench',
  parts: 'Camera + voice on whatever you have to hand',
  none: 'Needs a board to watch. Lessons work without one.',
};
