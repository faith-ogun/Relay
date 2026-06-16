// ── Curriculum spine: Units → Skills → Lessons ──
//
// The flat LESSON_CONTENT map (lessons.ts) holds the authored step content for
// each lesson. This file is the STRUCTURE above it: an ordered tree of units and
// skills that turns a pile of lessons into a Duolingo-style path that can scale
// to hundreds of lessons with real progression and prerequisites.
//
// Authored content is the spine (see content/CURRICULUM_AUTHORING.md). Every
// CurriculumLesson.id must match a key in LESSON_CONTENT; validateCurriculum()
// checks that invariant so a missing lesson is caught, not silently skipped.

import { LESSON_CONTENT } from './lessons';

export type CurriculumLevel = 'beginner' | 'intermediate' | 'advanced';
export type CurriculumAccent = 'gold' | 'blue' | 'green' | 'red';

export interface CurriculumLesson {
  /** Stable id, also the LESSON_CONTENT key. */
  id: string;
  title: string;
  summary: string;
  estMinutes: number;
}

export interface CurriculumSkill {
  id: string;
  title: string;
  description: string;
  /** lucide-react icon name (rendered by the UI layer). */
  icon: string;
  lessons: CurriculumLesson[];
}

export interface CurriculumUnit {
  id: string;
  title: string;
  subtitle: string;
  level: CurriculumLevel;
  accent: CurriculumAccent;
  skills: CurriculumSkill[];
}

export const CURRICULUM: CurriculumUnit[] = [
  {
    id: 'foundations',
    title: 'Foundations',
    subtitle: 'The physics behind every circuit',
    level: 'beginner',
    accent: 'gold',
    skills: [
      {
        id: 'voltage-current',
        title: 'Voltage & Current',
        description: 'What actually moves through a wire, and what pushes it.',
        icon: 'Zap',
        lessons: [
          { id: 'Voltage Basics', title: 'Voltage Basics', summary: 'Electrical pressure, measured in volts.', estMinutes: 8 },
          { id: 'Current Flow Intuition', title: 'Current Flow Intuition', summary: 'How current moves in series and parallel.', estMinutes: 12 },
        ],
      },
    ],
  },
  {
    id: 'breadboard',
    title: 'On the Breadboard',
    subtitle: 'Where ideas become real circuits',
    level: 'beginner',
    accent: 'blue',
    skills: [
      {
        id: 'breadboarding',
        title: 'Breadboarding',
        description: 'How the board connects, and how to wire it cleanly.',
        icon: 'Wrench',
        lessons: [
          { id: 'Breadboard Confidence Drill', title: 'Breadboard Confidence Drill', summary: 'Internal connections and clean placement.', estMinutes: 15 },
        ],
      },
    ],
  },
  {
    id: 'sensors',
    title: 'Sensors & Signals',
    subtitle: 'Make a circuit respond to the world',
    level: 'intermediate',
    accent: 'green',
    skills: [
      {
        id: 'reading-sensors',
        title: 'Reading Sensors',
        description: 'Turn light, heat, and motion into numbers you can trust.',
        icon: 'Gauge',
        lessons: [
          { id: 'Sensor Signal Sanity Checks', title: 'Sensor Signal Sanity Checks', summary: 'Verify sensor output before trusting it in code.', estMinutes: 18 },
        ],
      },
    ],
  },
];

// ── Helpers ──

export const allLessons = (): CurriculumLesson[] =>
  CURRICULUM.flatMap((unit) => unit.skills.flatMap((skill) => skill.lessons));

export const totalLessons = (): number => allLessons().length;

export const findLesson = (id: string): CurriculumLesson | undefined =>
  allLessons().find((lesson) => lesson.id === id);

/** Next unfinished lesson given a set of completed lesson ids (curriculum order). */
export const nextLesson = (completedIds: ReadonlySet<string>): CurriculumLesson | undefined =>
  allLessons().find((lesson) => !completedIds.has(lesson.id));

/**
 * Integrity check: every curriculum lesson must have authored content, and ids
 * must be unique. Returns problems (empty array = healthy). Call from a test or
 * dev tooling, not at import time.
 */
export const validateCurriculum = (): string[] => {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const lesson of allLessons()) {
    if (seen.has(lesson.id)) problems.push(`Duplicate lesson id: ${lesson.id}`);
    seen.add(lesson.id);
    if (!(lesson.id in LESSON_CONTENT)) problems.push(`Lesson "${lesson.id}" has no authored content in LESSON_CONTENT`);
  }
  return problems;
};
