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
        id: 'circuits-current',
        title: 'Circuits & Current',
        description: 'What a circuit is, what flows through it, and what blocks it.',
        icon: 'Zap',
        lessons: [
          { id: 'The Closed Loop', title: 'The Closed Loop', summary: 'Current only flows around a complete loop.', estMinutes: 8 },
          { id: 'Conductors and Insulators', title: 'Conductors & Insulators', summary: 'What lets current through, and what stops it.', estMinutes: 8 },
          { id: 'Voltage Basics', title: 'Voltage Basics', summary: 'Electrical pressure, measured in volts.', estMinutes: 8 },
          { id: 'Current Flow Intuition', title: 'Current Flow Intuition', summary: 'How current moves in series and parallel.', estMinutes: 12 },
        ],
      },
      {
        id: 'resistance-ohms',
        title: 'Resistance & Ohm\'s Law',
        description: 'The one equation that ties voltage, current, and resistance together.',
        icon: 'Gauge',
        lessons: [
          { id: 'What Resistance Is', title: 'What Resistance Is', summary: 'Opposition to current, measured in ohms.', estMinutes: 8 },
          { id: 'Resistors and Ohm\'s Law', title: 'Resistors & Ohm\'s Law', summary: 'V = I × R, and using it to limit current.', estMinutes: 12 },
          { id: 'Reading Resistor Color Codes', title: 'Reading Color Codes', summary: 'Decode the coloured bands on a resistor.', estMinutes: 10 },
          { id: 'Power and Heat', title: 'Power & Heat', summary: 'P = V × I, and why parts get warm.', estMinutes: 10 },
        ],
      },
      {
        id: 'leds-limiting',
        title: 'LEDs & Current Limiting',
        description: 'Light something up without burning it out.',
        icon: 'Zap',
        lessons: [
          { id: 'LEDs and Polarity', title: 'LEDs & Polarity', summary: 'One-way valves that always need a resistor.', estMinutes: 12 },
          { id: 'Powering an LED Safely', title: 'Powering an LED Safely', summary: 'Choose the resistor; predict survive, dim, or burn.', estMinutes: 12 },
        ],
      },
      {
        id: 'series-parallel',
        title: 'Series, Parallel & Measuring',
        description: 'Connecting parts, and reading what your circuit is doing.',
        icon: 'Wrench',
        lessons: [
          { id: 'Series vs Parallel', title: 'Series vs Parallel', summary: 'Same current vs split current; same vs divided voltage.', estMinutes: 12 },
          { id: 'Measuring Your Circuit', title: 'Measuring Your Circuit', summary: 'Predict and read voltage and current with a meter.', estMinutes: 12 },
        ],
      },
      {
        id: 'foundations-check',
        title: 'Unit Checkpoint',
        description: 'Prove the foundations before moving to the breadboard.',
        icon: 'Trophy',
        lessons: [
          { id: 'Unit 1 Checkpoint', title: 'Unit 1 Checkpoint', summary: 'A mixed test of everything in Foundations.', estMinutes: 10 },
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
        title: 'The Breadboard',
        description: 'How the board connects, and how to wire it cleanly.',
        icon: 'Wrench',
        lessons: [
          { id: 'Breadboard Confidence Drill', title: 'Breadboard Confidence Drill', summary: 'Internal connections and clean placement.', estMinutes: 15 },
          { id: 'Power Rails', title: 'Power Rails', summary: 'The + and − bus rails that feed the board.', estMinutes: 8 },
          { id: 'Jumper Wires', title: 'Jumper Wires', summary: 'Bridging points with clean solid-core wire.', estMinutes: 8 },
        ],
      },
      {
        id: 'building-circuits',
        title: 'Building Circuits',
        description: 'Translate a schematic into a working build.',
        icon: 'Cpu',
        lessons: [
          { id: 'From Schematic to Breadboard', title: 'Schematic to Breadboard', summary: 'Read a schematic and lay it out for real.', estMinutes: 10 },
          { id: 'Build a Series LED Circuit', title: 'Build a Series LED', summary: 'Wire your first working loop.', estMinutes: 12 },
          { id: 'Build a Parallel Circuit', title: 'Build a Parallel Circuit', summary: 'Two branches, one resistor each.', estMinutes: 12 },
        ],
      },
      {
        id: 'switches-control',
        title: 'Switches & Control',
        description: 'Open and close the loop on demand.',
        icon: 'Zap',
        lessons: [
          { id: 'Switches in a Circuit', title: 'Switches in a Circuit', summary: 'A controlled break in the loop.', estMinutes: 10 },
        ],
      },
      {
        id: 'debugging-safety',
        title: 'Debugging & Safety',
        description: 'Spot the faults that kill a circuit.',
        icon: 'Gauge',
        lessons: [
          { id: 'Short Circuits and Safety', title: 'Short Circuits & Safety', summary: 'What a short is, why it is dangerous, and how to avoid it.', estMinutes: 12 },
          { id: 'Common Wiring Mistakes', title: 'Common Wiring Mistakes', summary: 'Reversed LEDs, missing resistors, shorts.', estMinutes: 10 },
          { id: 'Debugging a Dead Circuit', title: 'Debugging a Dead Circuit', summary: 'Work the loop in order to find the fault.', estMinutes: 12 },
        ],
      },
      {
        id: 'breadboard-check',
        title: 'Unit Checkpoint',
        description: 'Prove you can build and debug on the board.',
        icon: 'Trophy',
        lessons: [
          { id: 'Unit 2 Checkpoint', title: 'Unit 2 Checkpoint', summary: 'A mixed test of everything on the breadboard.', estMinutes: 10 },
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
        id: 'variable-resistance',
        title: 'Variable Resistance',
        description: 'Components whose resistance changes with the world.',
        icon: 'Gauge',
        lessons: [
          { id: 'Potentiometers', title: 'Potentiometers', summary: 'A resistor you can turn by hand.', estMinutes: 10 },
          { id: 'The LDR', title: 'The LDR', summary: 'Resistance that drops in light.', estMinutes: 10 },
          { id: 'Thermistors', title: 'Thermistors', summary: 'Resistance that changes with temperature.', estMinutes: 8 },
        ],
      },
      {
        id: 'reading-sensors',
        title: 'Reading Sensors',
        description: 'Turn changing resistance into numbers you can trust.',
        icon: 'Cpu',
        lessons: [
          { id: 'The Voltage Divider', title: 'The Voltage Divider', summary: 'Split a voltage, then turn it into a sensor.', estMinutes: 14 },
          { id: 'Divider as a Sensor', title: 'Divider as a Sensor', summary: 'Swap a fixed resistor for an LDR.', estMinutes: 12 },
          { id: 'Analog vs Digital', title: 'Analog vs Digital', summary: 'Continuous signals and the 0 to 1023 reading.', estMinutes: 10 },
          { id: 'Sensor Signal Sanity Checks', title: 'Sensor Signal Sanity Checks', summary: 'Verify sensor output before trusting it.', estMinutes: 18 },
        ],
      },
      {
        id: 'light-alarm',
        title: 'The Light-Activated Alarm',
        description: 'Sense, decide, act: build the flagship.',
        icon: 'Lightbulb',
        lessons: [
          { id: 'Planning the Light Alarm', title: 'Planning the Alarm', summary: 'Sense, decide, act: the system shape.', estMinutes: 10 },
          { id: 'Setting the Threshold', title: 'Setting the Threshold', summary: 'Where to draw the on/off line.', estMinutes: 10 },
          { id: 'Wiring the Light Alarm', title: 'Wiring the Alarm', summary: 'Bring the whole build together.', estMinutes: 14 },
        ],
      },
      {
        id: 'sensors-check',
        title: 'Unit Checkpoint',
        description: 'Prove you can sense the world and act on it.',
        icon: 'Trophy',
        lessons: [
          { id: 'Unit 3 Checkpoint', title: 'Unit 3 Checkpoint', summary: 'A mixed test of sensors, signals, and the alarm.', estMinutes: 10 },
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
