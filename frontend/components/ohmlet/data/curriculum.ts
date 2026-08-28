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
//
// THREE corpora live here, and the distinction matters:
//
//   AUTHORED_CURRICULUM  what a human wrote: 142 lessons of 15-20 steps. What
//                        the linter lints and the author console reviews.
//   SESSION_CURRICULUM   the same lessons cut into learner-sized sessions
//                        (lessons.ts owns the cut). The BUNDLED offline copy.
//   CURRICULUM           what the app is rendering RIGHT NOW. Starts as the
//                        bundled sessions and is replaced by the corpus the
//                        backend serves as soon as that arrives. A live binding:
//                        importers see the swap, and subscribeCurriculum() tells
//                        React when to re-render.
//
// The web used to render AUTHORED_CURRICULUM while the backend served the cut
// corpus to mobile, so the two surfaces showed materially different paths off
// one shared progress record. CURRICULUM is what closes that.

import {
  LESSON_CONTENT,
  SESSION_CONTENT,
  SESSION_PARTS,
  originLessonId,
  type LessonEntry,
} from './lessons';

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

/**
 * The authored path: one node per authored lesson, exactly as written.
 * Lint, the author console and the export script work against this. Learners
 * never see it directly: they see CURRICULUM, the session-cut corpus below.
 */
export const AUTHORED_CURRICULUM: CurriculumUnit[] = [
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
          { id: 'The Closed Loop', title: 'The Closed Loop', summary: 'Current only flows around a complete loop.', estMinutes: 10 },
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
          { id: 'Powering an LED Safely', title: 'Powering an LED Safely', summary: 'Calculate the resistor; predict the current.', estMinutes: 14 },
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
  {
    id: 'arduino',
    title: 'Meet the Arduino',
    subtitle: 'Bring your circuits to life with code',
    level: 'intermediate',
    accent: 'gold',
    skills: [
      {
        id: 'what-arduino',
        title: 'What an Arduino Is',
        description: 'The tiny computer that runs your circuit.',
        icon: 'Cpu',
        lessons: [
          { id: 'What Is a Microcontroller', title: 'What Is a Microcontroller', summary: 'A small programmable computer on a chip.', estMinutes: 8 },
          { id: 'The Arduino Pins', title: 'The Arduino Pins', summary: 'Digital, analog, and power pins.', estMinutes: 8 },
          { id: 'The Sketch: setup and loop', title: 'The Sketch: setup & loop', summary: 'Runs once, then runs forever.', estMinutes: 8 },
        ],
      },
      {
        id: 'first-sketch',
        title: 'Your First Sketch',
        description: 'Write code that drives a pin.',
        icon: 'Cpu',
        lessons: [
          { id: 'Naming Pins with Variables', title: 'Naming Pins', summary: 'const int LED = 13, and why.', estMinutes: 8 },
          { id: 'pinMode and Outputs', title: 'pinMode & Outputs', summary: 'Tell a pin its direction.', estMinutes: 8 },
          { id: 'digitalWrite: On and Off', title: 'digitalWrite: On & Off', summary: 'Drive a pin HIGH or LOW.', estMinutes: 8 },
          { id: 'Blink', title: 'Blink', summary: 'The hello-world of hardware.', estMinutes: 12 },
        ],
      },
      {
        id: 'talk-debug',
        title: 'Talking & Debugging',
        description: 'See what your code is doing, and fix it.',
        icon: 'Gauge',
        lessons: [
          { id: 'The Serial Monitor', title: 'The Serial Monitor', summary: 'Let the Arduino print to your screen.', estMinutes: 10 },
          { id: 'Uploading Your Code', title: 'Uploading Your Code', summary: 'From computer to chip.', estMinutes: 8 },
          { id: 'Reading Errors', title: 'Reading Errors', summary: 'Semicolons, braces, and first errors first.', estMinutes: 10 },
        ],
      },
      {
        id: 'arduino-check',
        title: 'Unit Checkpoint',
        description: 'Prove you can write and upload a sketch.',
        icon: 'Trophy',
        lessons: [
          { id: 'Unit 4 Checkpoint', title: 'Unit 4 Checkpoint', summary: 'A mixed test of Arduino basics.', estMinutes: 10 },
        ],
      },
    ],
  },
  {
    id: 'inputs-outputs',
    title: 'Inputs, Outputs & Code',
    subtitle: 'Read the world and act on it in software',
    level: 'advanced',
    accent: 'red',
    skills: [
      {
        id: 'reading-inputs',
        title: 'Reading Inputs',
        description: 'Buttons, pull resistors, and clean signals.',
        icon: 'Zap',
        lessons: [
          { id: 'Reading a Button', title: 'Reading a Button', summary: 'digitalRead and INPUT pins.', estMinutes: 10 },
          { id: 'Pull-up and Pull-down Resistors', title: 'Pull-up & Pull-down', summary: 'Fix the floating-pin problem.', estMinutes: 12 },
          { id: 'Debouncing a Button', title: 'Debouncing a Button', summary: 'One press, not five.', estMinutes: 8 },
        ],
      },
      {
        id: 'analog-pwm',
        title: 'Analog & PWM',
        description: 'Read sensors and fake analog output in code.',
        icon: 'Gauge',
        lessons: [
          { id: 'analogRead in Code', title: 'analogRead in Code', summary: 'Turn a sensor voltage into 0 to 1023.', estMinutes: 10 },
          { id: 'analogWrite and PWM', title: 'analogWrite & PWM', summary: 'Dim and fade with pulse-width modulation.', estMinutes: 10 },
          { id: 'Making Sound with tone()', title: 'Making Sound', summary: 'Drive a buzzer with tone().', estMinutes: 8 },
        ],
      },
      {
        id: 'code-alarm',
        title: 'Code the Light Alarm',
        description: 'Make the Arduino run the build you wired.',
        icon: 'Lightbulb',
        lessons: [
          { id: 'if: Making Decisions', title: 'if: Making Decisions', summary: 'Run code only when a condition is true.', estMinutes: 10 },
          { id: 'Coding the Light Alarm', title: 'Coding the Alarm', summary: 'analogRead, if, digitalWrite: the full sketch.', estMinutes: 14 },
          { id: 'Calibrating in Code', title: 'Calibrating in Code', summary: 'Tune the threshold with the Serial Monitor.', estMinutes: 10 },
        ],
      },
      {
        id: 'inputs-check',
        title: 'Unit Checkpoint',
        description: 'Prove you can code inputs, outputs, and the alarm.',
        icon: 'Trophy',
        lessons: [
          { id: 'Unit 5 Checkpoint', title: 'Unit 5 Checkpoint', summary: 'A mixed test of inputs, outputs, and alarm code.', estMinutes: 10 },
        ],
      },
      {
        id: 'foundations-gateway',
        title: 'Foundations Gateway',
        description: 'A cumulative exam across Units 1–5. Prove the foundations before the analog core.',
        icon: 'Trophy',
        lessons: [
          { id: 'Gateway Exam: Foundations', title: 'Gateway Exam: Foundations', summary: 'Cumulative test across everything so far.', estMinutes: 15 },
        ],
      },
    ],
  },
  {
    id: 'capacitors-rc',
    title: 'Capacitors, RC & Timing',
    subtitle: 'Store charge, shape signals, make time',
    level: 'intermediate',
    accent: 'blue',
    skills: [
      {
        id: 'meet-capacitor',
        title: 'Meet the Capacitor',
        description: 'What stores charge, how it is measured, and how to wire it.',
        icon: 'Zap',
        lessons: [
          { id: 'What a Capacitor Does', title: 'What a Capacitor Does', summary: 'Stores charge; resists a change in voltage.', estMinutes: 10 },
          { id: 'Farads and Capacitor Values', title: 'Farads & Values', summary: 'F, µF, nF, pF, and reading them.', estMinutes: 10 },
          { id: 'Capacitor Types and Polarity', title: 'Types & Polarity', summary: 'Ceramic vs electrolytic; mind the stripe.', estMinutes: 10 },
        ],
      },
      {
        id: 'rc-charging',
        title: 'Charging & the Time Constant',
        description: 'How an RC circuit charges, and the one number that times it.',
        icon: 'Gauge',
        lessons: [
          { id: 'Charging Through a Resistor', title: 'Charging Through a Resistor', summary: 'The gradual charging curve.', estMinutes: 12 },
          { id: 'The Time Constant', title: 'The Time Constant', summary: 'τ = R × C, 63%, and five taus.', estMinutes: 14 },
          { id: 'Calculating RC Timing', title: 'Calculating RC Timing', summary: 'Design a delay; mind the farad conversion.', estMinutes: 14 },
        ],
      },
      {
        id: 'caps-at-work',
        title: 'Capacitors at Work',
        description: 'Smoothing, coupling, and filtering real signals.',
        icon: 'Wrench',
        lessons: [
          { id: 'Smoothing and Decoupling', title: 'Smoothing & Decoupling', summary: 'Steady the supply; bypass a chip.', estMinutes: 12 },
          { id: 'Coupling and Blocking DC', title: 'Coupling & Blocking DC', summary: 'Pass the wiggle, block the level.', estMinutes: 12 },
          { id: 'The RC Low-Pass Filter', title: 'The RC Low-Pass Filter', summary: 'Cutoff frequency and smoothing noise.', estMinutes: 14 },
        ],
      },
      {
        id: 'timing-555',
        title: 'Timing & the 555',
        description: 'Turn RC into delays, oscillators, and the classic timer chip.',
        icon: 'Cpu',
        lessons: [
          { id: 'RC Timing in Practice', title: 'RC Timing in Practice', summary: 'Delays, debounce, fades; RC vs code.', estMinutes: 12 },
          { id: 'The 555 Timer', title: 'The 555 Timer', summary: 'Astable and monostable, set by RC.', estMinutes: 14 },
        ],
      },
      {
        id: 'capacitors-check',
        title: 'Unit Checkpoint',
        description: 'Prove you can size, place, and time with capacitors.',
        icon: 'Trophy',
        lessons: [
          { id: 'Unit 6 Checkpoint', title: 'Unit 6 Checkpoint', summary: 'A mixed test of capacitors, RC, and timing.', estMinutes: 10 },
        ],
      },
    ],
  },
  {
    id: 'transistors',
    title: 'Transistors & Switching',
    subtitle: 'Let a weak signal command a strong load',
    level: 'intermediate',
    accent: 'green',
    skills: [
      {
        id: 'the-transistor',
        title: 'The Transistor',
        description: 'A small current that controls a big one.',
        icon: 'Cpu',
        lessons: [
          { id: 'What a Transistor Is', title: 'What a Transistor Is', summary: 'Base, collector, emitter; the control valve.', estMinutes: 10 },
          { id: 'The Transistor as a Switch', title: 'The Transistor as a Switch', summary: 'Cutoff and saturation: fully off, fully on.', estMinutes: 12 },
          { id: 'Current Gain (Beta)', title: 'Current Gain (Beta)', summary: 'β = Ic / Ib, and designing for the minimum.', estMinutes: 12 },
        ],
      },
      {
        id: 'driving-loads',
        title: 'Driving Loads',
        description: 'Size the drive and place the switch.',
        icon: 'Gauge',
        lessons: [
          { id: 'Sizing the Base Resistor', title: 'Sizing the Base Resistor', summary: 'Rb = (Vpin − 0.7) / Ib; force saturation.', estMinutes: 14 },
          { id: 'Low-Side vs High-Side Switching', title: 'Low-Side vs High-Side', summary: 'Where the transistor sits, and why.', estMinutes: 12 },
          { id: 'Switching Bigger Loads', title: 'Switching Bigger Loads', summary: 'Power transistors, MOSFETs, heat, ratings.', estMinutes: 12 },
        ],
      },
      {
        id: 'inductive-protection',
        title: 'Inductive Loads & Protection',
        description: 'Tame the spike from coils, relays, and motors.',
        icon: 'Wrench',
        lessons: [
          { id: 'Back-EMF from Coils', title: 'Back-EMF from Coils', summary: 'Why a switched-off coil bites back.', estMinutes: 12 },
          { id: 'The Flyback Diode', title: 'The Flyback Diode', summary: 'A safe path for the spike; orientation matters.', estMinutes: 12 },
          { id: 'Drive the Relay', title: 'Drive the Relay', summary: 'Capstone: switch a 12V coil from a 5V pin.', estMinutes: 18 },
        ],
      },
      {
        id: 'transistor-variety',
        title: 'Transistor Variety',
        description: 'MOSFETs, and the two BJT polarities.',
        icon: 'Zap',
        lessons: [
          { id: 'MOSFETs vs BJTs', title: 'MOSFETs vs BJTs', summary: 'Voltage control, low on-resistance, power.', estMinutes: 12 },
          { id: 'NPN vs PNP', title: 'NPN vs PNP', summary: 'Mirror images; low-side vs high-side.', estMinutes: 10 },
        ],
      },
      {
        id: 'transistors-check',
        title: 'Unit Checkpoint',
        description: 'Prove you can drive a real load safely.',
        icon: 'Trophy',
        lessons: [
          { id: 'Unit 7 Checkpoint', title: 'Unit 7 Checkpoint', summary: 'A mixed test of transistors and switching.', estMinutes: 10 },
        ],
      },
    ],
  },
  {
    id: 'op-amps',
    title: 'Op-Amps & Signal Conditioning',
    subtitle: 'Amplify, compare, and clean up real signals',
    level: 'advanced',
    accent: 'red',
    skills: [
      {
        id: 'opamp-basics',
        title: 'The Op-Amp',
        description: 'A huge-gain amplifier and the rules that tame it.',
        icon: 'Cpu',
        lessons: [
          { id: 'What an Op-Amp Is', title: 'What an Op-Amp Is', summary: 'Two inputs, one output, enormous gain.', estMinutes: 12 },
          { id: 'The Golden Rules', title: 'The Golden Rules', summary: 'Inputs equal, inputs draw no current.', estMinutes: 14 },
          { id: 'Negative Feedback', title: 'Negative Feedback', summary: 'Feed the output back to set the gain.', estMinutes: 12 },
        ],
      },
      {
        id: 'opamp-amplifiers',
        title: 'The Amplifier Circuits',
        description: 'The three workhorse op-amp configurations.',
        icon: 'Gauge',
        lessons: [
          { id: 'The Non-Inverting Amplifier', title: 'Non-Inverting Amp', summary: 'Gain = 1 + Rf/Rg, in phase.', estMinutes: 14 },
          { id: 'The Inverting Amplifier', title: 'Inverting Amp', summary: 'Gain = −Rf/Rin, the virtual ground.', estMinutes: 14 },
          { id: 'The Voltage Follower', title: 'The Voltage Follower', summary: 'Gain 1: the buffer that stops loading.', estMinutes: 12 },
        ],
      },
      {
        id: 'opamp-comparators',
        title: 'Comparing & Switching',
        description: 'Turn an analog level into a clean decision.',
        icon: 'Zap',
        lessons: [
          { id: 'The Comparator', title: 'The Comparator', summary: 'Which input is higher? A 1-bit decision.', estMinutes: 12 },
          { id: 'Adding Hysteresis', title: 'Adding Hysteresis', summary: 'Two thresholds: the Schmitt trigger.', estMinutes: 14 },
        ],
      },
      {
        id: 'opamp-real-world',
        title: 'Real Op-Amps & Conditioning',
        description: 'Limits, single supplies, and prepping a sensor.',
        icon: 'Wrench',
        lessons: [
          { id: 'Real Op-Amp Limits', title: 'Real Op-Amp Limits', summary: 'Offset, slew rate, bandwidth, rails.', estMinutes: 12 },
          { id: 'Single-Supply Op-Amps', title: 'Single-Supply Op-Amps', summary: 'Bias to mid-rail with no negative supply.', estMinutes: 12 },
          { id: 'Conditioning a Sensor Signal', title: 'Conditioning a Sensor', summary: 'Buffer, amplify, level-shift for the ADC.', estMinutes: 14 },
        ],
      },
      {
        id: 'opamps-check',
        title: 'Unit Checkpoint',
        description: 'Prove you can amplify, compare, and condition.',
        icon: 'Trophy',
        lessons: [
          { id: 'Unit 8 Checkpoint', title: 'Unit 8 Checkpoint', summary: 'A mixed test of op-amps and signal conditioning.', estMinutes: 10 },
        ],
      },
    ],
  },
  {
    id: 'filters-oscillators',
    title: 'Filters, Oscillators & Signals',
    subtitle: 'Shape signals by frequency and generate your own',
    level: 'advanced',
    accent: 'blue',
    skills: [
      {
        id: 'signals',
        title: 'Signals & AC',
        description: 'Waveforms, frequency, and how to measure AC.',
        icon: 'Gauge',
        lessons: [
          { id: 'Signals and Waveforms', title: 'Signals & Waveforms', summary: 'Sine, square, triangle; f = 1/T.', estMinutes: 12 },
          { id: 'Measuring AC Voltage', title: 'Measuring AC Voltage', summary: 'Peak, peak-to-peak, and RMS.', estMinutes: 14 },
          { id: 'Thinking in Frequencies', title: 'Thinking in Frequencies', summary: 'A signal as a sum of frequencies.', estMinutes: 12 },
        ],
      },
      {
        id: 'filters',
        title: 'Filters',
        description: 'Keep some frequencies, reject others.',
        icon: 'Wrench',
        lessons: [
          { id: 'High-Pass and Low-Pass', title: 'High-Pass & Low-Pass', summary: 'Two mirror-image RC filters.', estMinutes: 14 },
          { id: 'The Cutoff Frequency', title: 'The Cutoff Frequency', summary: 'fc = 1/(2πRC) and the −3dB point.', estMinutes: 14 },
          { id: 'Decibels and Roll-Off', title: 'Decibels & Roll-Off', summary: 'dB ratios and −20dB/decade.', estMinutes: 12 },
          { id: 'Band-Pass and Notch Filters', title: 'Band-Pass & Notch', summary: 'Select or reject a band; bandwidth.', estMinutes: 12 },
        ],
      },
      {
        id: 'resonance-oscillators',
        title: 'Resonance & Oscillators',
        description: 'Tuned circuits and signals that generate themselves.',
        icon: 'Zap',
        lessons: [
          { id: 'Resonance and LC Circuits', title: 'Resonance & LC', summary: 'f = 1/(2π√(LC)); tuning a radio.', estMinutes: 12 },
          { id: 'What an Oscillator Is', title: 'What an Oscillator Is', summary: 'Amplifier + positive feedback.', estMinutes: 12 },
          { id: 'The Relaxation Oscillator', title: 'Relaxation Oscillator', summary: 'RC + threshold = a square wave.', estMinutes: 14 },
          { id: 'Reading a Waveform', title: 'Reading a Waveform', summary: 'The scope: volts, time, frequency.', estMinutes: 12 },
        ],
      },
      {
        id: 'filters-check',
        title: 'Unit Checkpoint',
        description: 'Prove you can shape and generate signals.',
        icon: 'Trophy',
        lessons: [
          { id: 'Unit 9 Checkpoint', title: 'Unit 9 Checkpoint', summary: 'A mixed test of filters, oscillators, and signals.', estMinutes: 10 },
        ],
      },
    ],
  },
  {
    id: 'power-supplies',
    title: 'Power Supplies & Regulation',
    subtitle: 'Turn a messy input into a clean, steady rail',
    level: 'advanced',
    accent: 'gold',
    skills: [
      {
        id: 'making-dc',
        title: 'Making Clean DC',
        description: 'Why regulate, and how AC becomes smooth DC.',
        icon: 'Zap',
        lessons: [
          { id: 'Why Regulate', title: 'Why Regulate', summary: 'Circuits need a steady, clean voltage.', estMinutes: 10 },
          { id: 'From AC to DC', title: 'From AC to DC', summary: 'Half-wave, full-wave, and the bridge.', estMinutes: 12 },
          { id: 'Smoothing the DC', title: 'Smoothing the DC', summary: 'Reservoir caps and ripple.', estMinutes: 12 },
        ],
      },
      {
        id: 'linear-regulation',
        title: 'Linear Regulation',
        description: 'References, fixed regulators, and their heat.',
        icon: 'Gauge',
        lessons: [
          { id: 'The Zener Reference', title: 'The Zener Reference', summary: 'A diode that holds a voltage; size the resistor.', estMinutes: 12 },
          { id: 'The Linear Regulator', title: 'The Linear Regulator', summary: 'The 7805 and the dropout voltage.', estMinutes: 14 },
          { id: 'Linear Regulator Heat', title: 'Linear Regulator Heat', summary: 'P = (Vin − Vout) × Iout.', estMinutes: 12 },
        ],
      },
      {
        id: 'switching-regulation',
        title: 'Switching & Choosing',
        description: 'Efficient converters, and which to pick.',
        icon: 'Cpu',
        lessons: [
          { id: 'Switching Regulators', title: 'Switching Regulators', summary: 'Buck, boost, and high efficiency.', estMinutes: 14 },
          { id: 'Linear vs Switching', title: 'Linear vs Switching', summary: 'Efficiency vs noise and simplicity.', estMinutes: 12 },
          { id: 'A Clean Supply', title: 'A Clean Supply', summary: 'Bulk caps, decoupling, and ground.', estMinutes: 12 },
        ],
      },
      {
        id: 'power-check',
        title: 'Unit Checkpoint',
        description: 'Prove you can design a clean, safe supply.',
        icon: 'Trophy',
        lessons: [
          { id: 'Unit 10 Checkpoint', title: 'Unit 10 Checkpoint', summary: 'A mixed test of power supplies and regulation.', estMinutes: 10 },
        ],
      },
      {
        id: 'analog-gateway',
        title: 'Analog Core Gateway',
        description: 'A cumulative exam across Units 6–10. Prove the analog core before digital & embedded.',
        icon: 'Trophy',
        lessons: [
          { id: 'Gateway Exam: Analog Core', title: 'Gateway Exam: Analog Core', summary: 'Cumulative test of the whole analog core.', estMinutes: 15 },
        ],
      },
    ],
  },
  {
    id: 'digital-logic',
    title: 'Digital Logic & Embedded',
    subtitle: 'From bits and gates to the peripherals inside a microcontroller',
    level: 'advanced',
    accent: 'blue',
    skills: [
      {
        id: 'numbers-and-levels',
        title: 'Numbers & Logic Levels',
        description: 'How digital represents and reads values.',
        icon: 'Binary',
        lessons: [
          { id: 'Binary and Hex', title: 'Binary and Hex', summary: 'Counting in base-2, grouping into hex.', estMinutes: 12 },
          { id: 'Logic Levels and Noise Margin', title: 'Logic Levels & Noise', summary: 'HIGH/LOW thresholds and why digital resists noise.', estMinutes: 12 },
          { id: 'Analog to Digital and Back', title: 'Analog to Digital', summary: 'ADC, DAC, quantisation, and resolution.', estMinutes: 12 },
        ],
      },
      {
        id: 'logic-gates',
        title: 'Logic Gates',
        description: 'The building blocks of every digital circuit.',
        icon: 'Cpu',
        lessons: [
          { id: 'The Basic Gates', title: 'The Basic Gates', summary: 'AND, OR, NOT and their truth tables.', estMinutes: 12 },
          { id: 'NAND, NOR, XOR', title: 'NAND, NOR, XOR', summary: 'Inverted gates and the universal NAND/NOR.', estMinutes: 12 },
          { id: 'Combinational Logic', title: 'Combinational Logic', summary: 'Gates combined: the half adder.', estMinutes: 14 },
          { id: 'Boolean Rules and De Morgan', title: 'Boolean & De Morgan', summary: 'The algebra of logic and the two laws.', estMinutes: 14 },
        ],
      },
      {
        id: 'memory-and-sequencing',
        title: 'Memory & Sequencing',
        description: 'Circuits that remember, clocked by time.',
        icon: 'Clock',
        lessons: [
          { id: 'Flip-Flops and Latches', title: 'Flip-Flops & Latches', summary: 'The SR latch and D flip-flop as 1-bit memory.', estMinutes: 14 },
          { id: 'The Clock and Sequential Logic', title: 'The Clock', summary: 'Clock edges and sequential vs combinational.', estMinutes: 12 },
          { id: 'Counters and Registers', title: 'Counters & Registers', summary: 'Counting pulses and storing bits.', estMinutes: 12 },
        ],
      },
      {
        id: 'embedded-bridge',
        title: 'The Embedded Bridge',
        description: 'From logic chips to microcontroller peripherals.',
        icon: 'Microchip',
        lessons: [
          { id: 'The 74HC Logic Family', title: 'The 74HC Family', summary: 'CMOS logic chips and mandatory decoupling.', estMinutes: 12 },
          { id: 'GPIO, Timers and Interrupts', title: 'GPIO & Interrupts', summary: 'Pins, PWM timers, interrupts vs polling.', estMinutes: 14 },
          { id: 'Serial Buses: UART, I2C, SPI', title: 'Serial Buses', summary: 'UART, I2C and SPI: what each is and when.', estMinutes: 14 },
        ],
      },
      {
        id: 'rtos-basics',
        title: 'Tasks and the RTOS',
        description: 'Real-time scheduling, safe sharing between tasks, and the priority inversion bug that grounded a Mars rover.',
        icon: 'Cog',
        lessons: [
          { id: 'Superloop or RTOS', title: 'Superloop or RTOS', summary: 'What a scheduler buys you, and what each task\'s stack costs in RAM.', estMinutes: 14 },
          { id: 'The Preemptive Scheduler', title: 'The Preemptive Scheduler', summary: 'Task states, the tick, and why a task should block instead of spin.', estMinutes: 14 },
          { id: 'Mutex, Semaphore, Queue', title: 'Mutex, Semaphore, Queue', summary: 'Three tools for sharing data and hardware between tasks, and when each is right.', estMinutes: 15 },
          { id: 'Priority Inversion', title: 'Priority Inversion', summary: 'The Mars Pathfinder bug, and the fix that saved it: priority inheritance.', estMinutes: 16 },
        ],
      },
      {
        id: 'volatile-and-isrs',
        title: 'Interrupts and volatile',
        description: 'How a microcontroller reacts to hardware events, and why the volatile keyword alone does not make shared data safe.',
        icon: 'Zap',
        lessons: [
          { id: 'What an Interrupt Actually Is', title: 'What an Interrupt Actually Is', summary: 'Hardware events, latency and jitter, and the rules that keep a handler short and safe.', estMinutes: 14 },
          { id: 'Volatile and What It Really Means', title: 'Volatile and What It Really Means', summary: 'Stopping the compiler from caching a value, and the atomicity guarantee it does not give you.', estMinutes: 14 },
          { id: 'Atomicity and the Torn Read', title: 'Atomicity and the Torn Read', summary: 'Why a 32-bit counter on an 8-bit chip needs a critical section, not just volatile.', estMinutes: 15 },
          { id: 'Getting Data Out of an ISR', title: 'Getting Data Out of an ISR', summary: 'Flags, a single-producer ring buffer, and debouncing without ever blocking in the handler.', estMinutes: 15 },
        ],
      },
      {
        id: 'clock-domains',
        title: 'Timing and Clock Domains',
        description: 'The margins that cap a clock\'s speed, and what breaks when two clocks meet.',
        icon: 'Gauge',
        lessons: [
          { id: 'Setup and Hold Time', title: 'Setup & Hold', summary: 'The stability window every input needs around a clock edge, and why hold violations are the nastier kind.', estMinutes: 14 },
          { id: 'What Limits the Clock', title: 'Clock Speed Limits', summary: 'Clock-to-Q, logic delay and setup time stack up to cap the fastest clock a design can run.', estMinutes: 14 },
          { id: 'Metastability', title: 'Metastability', summary: 'The undefined output a timing violation can produce, and why the risk never quite reaches zero.', estMinutes: 14 },
          { id: 'Crossing Clock Domains', title: 'Crossing Clock Domains', summary: 'Why unrelated clocks guarantee a violation eventually, and the synchroniser, handshake and Grey code fixes.', estMinutes: 16 },
        ],
      },
      {
        id: 'digital-check',
        title: 'Unit Checkpoint',
        description: 'Prove you can reason about digital logic and embedded peripherals.',
        icon: 'Trophy',
        lessons: [
          { id: 'Unit 11 Checkpoint', title: 'Unit 11 Checkpoint', summary: 'A mixed test of digital logic and embedded basics.', estMinutes: 10 },
        ],
      },
    ],
  },
  {
    id: 'comms-motors-robotics',
    title: 'Comms, Motors & Robotics',
    subtitle: 'Driving motors, sensing the world, and closing the loop on a robot',
    level: 'advanced',
    accent: 'blue',
    skills: [
      {
        id: 'driving-motors',
        title: 'Driving Motors',
        description: 'Switching, powering, and reversing real motors safely.',
        icon: 'Cog',
        lessons: [
          { id: 'DC Motors and Drivers', title: 'DC Motors & Drivers', summary: 'How a DC motor works and why a pin cannot drive it.', estMinutes: 13 },
          { id: 'Powering Motors Safely', title: 'Powering Motors Safely', summary: 'Separate supply, common ground, decoupling.', estMinutes: 13 },
          { id: 'The H-Bridge', title: 'The H-Bridge', summary: 'Four switches to reverse a motor, brake vs coast.', estMinutes: 13 },
        ],
      },
      {
        id: 'speed-and-precision',
        title: 'Speed & Precision',
        description: 'Controlling how fast and how far a motor turns.',
        icon: 'Gauge',
        lessons: [
          { id: 'PWM Motor Speed Control', title: 'PWM Speed Control', summary: 'Duty cycle sets the average voltage and speed.', estMinutes: 13 },
          { id: 'Servo Motors', title: 'Servo Motors', summary: 'Position control via pulse width, the Servo library.', estMinutes: 13 },
          { id: 'Stepper Motors', title: 'Stepper Motors', summary: 'Coils in sequence for precise, counted steps.', estMinutes: 13 },
        ],
      },
      {
        id: 'robot-sensing-comms',
        title: 'Robot Sensing & Comms',
        description: 'Measuring the world and talking to modules.',
        icon: 'Radar',
        lessons: [
          { id: 'Distance Sensing', title: 'Distance Sensing', summary: 'Ultrasonic time-of-flight and IR reflectance.', estMinutes: 13 },
          { id: 'Talking to Modules', title: 'Talking to Modules', summary: 'Reading sensors and drivers over I2C, SPI, UART.', estMinutes: 13 },
        ],
      },
      {
        id: 'robot-control',
        title: 'Robot Control',
        description: 'Sense, decide, act, and close the loop with feedback.',
        icon: 'Bot',
        lessons: [
          { id: 'The Robot Control Loop', title: 'The Control Loop', summary: 'Sense-decide-act scaled up, polling vs interrupts.', estMinutes: 14 },
          { id: 'Closing the Loop with Feedback', title: 'Closing the Loop', summary: 'Open vs closed loop, encoders beat dead reckoning.', estMinutes: 14 },
          { id: 'The Line-Follower', title: 'The Line-Follower', summary: 'Capstone: IR sensors, threshold, differential drive.', estMinutes: 17 },
        ],
      },
      {
        id: 'can-bus',
        title: 'The CAN Bus',
        description: 'How a hundred car modules share one bus with no master, and what happens when it fails.',
        icon: 'Cpu',
        lessons: [
          { id: 'Why CAN Has No Master', title: 'Why CAN Has No Master', summary: 'Multi-master, message-addressed, and differential signaling on a twisted pair.', estMinutes: 14 },
          { id: 'Winning Arbitration', title: 'Winning Arbitration', summary: 'Non-destructive bitwise arbitration: the clever part, bit by bit.', estMinutes: 14 },
          { id: 'The Wire and the Frame', title: 'The Wire and the Frame', summary: 'Termination, bit rate versus bus length, and the CAN frame.', estMinutes: 15 },
          { id: 'When the Bus Goes Wrong', title: 'When the Bus Goes Wrong', summary: 'Error frames, error counters, and the three fault states.', estMinutes: 15 },
        ],
      },
      {
        id: 'sensor-fusion',
        title: 'Fusing Sensors',
        description: 'Combine noisy, disagreeing sensors into one estimate you can trust.',
        icon: 'Clock',
        lessons: [
          { id: 'One Sensor Is Never Enough', title: 'One Sensor Is Never Enough', summary: 'Why an accelerometer alone is noisy and a gyroscope alone drifts.', estMinutes: 14 },
          { id: 'The Complementary Filter', title: 'The Complementary Filter', summary: 'Blend both sensors with one line of code and one tunable number.', estMinutes: 14 },
          { id: 'Kalman Without the Matrices', title: 'Kalman Without the Matrices', summary: 'Predict, then correct: the idea behind a filter that tunes itself.', estMinutes: 16 },
          { id: 'Odometry and Drift', title: 'Odometry and Drift', summary: 'Wheel encoders still drift, and why dead reckoning needs a reference.', estMinutes: 15 },
        ],
      },
      {
        id: 'brushless-and-foc',
        title: 'Brushless Motors and FOC',
        description: 'Electronic commutation, rotor sensing, six-step drive, and the field-oriented control that makes torque smooth.',
        icon: 'Cpu',
        lessons: [
          { id: 'Going Brushless', title: 'Going Brushless', summary: 'Remove the brushes and something else must decide which coils fire, and when.', estMinutes: 13 },
          { id: 'Sensing Rotor Position', title: 'Sensing Rotor Position', summary: 'Hall sensors, encoders, and back-EMF: three ways to know where the rotor is.', estMinutes: 14 },
          { id: 'Six-Step Commutation', title: 'Six-Step Commutation', summary: 'Two phases driven, one floating: simple, cheap, and it ripples.', estMinutes: 13 },
          { id: 'Field-Oriented Control', title: 'Field-Oriented Control', summary: 'Hold the angle at 90 degrees continuously, and torque stops rippling.', estMinutes: 16 },
        ],
      },
      {
        id: 'robotics-check',
        title: 'Unit Checkpoint',
        description: 'Prove you can reason about motors, sensing, and robot control.',
        icon: 'Trophy',
        lessons: [
          { id: 'Unit 12 Checkpoint', title: 'Unit 12 Checkpoint', summary: 'A mixed test of comms, motors, and robotics.', estMinutes: 10 },
        ],
      },
    ],
  },
];

// ── The bundled session corpus ──

/**
 * Content version of the bundled corpus, mirroring the stamp the backend serves
 * at /v1/curriculum/version. GENERATED by scripts/export-curriculum.mjs from the
 * exact same bytes it writes into backend/live-bridge/app/curriculum_data, so do
 * not edit it by hand. If it disagrees with the server's stamp the bundled copy
 * is stale and the server's corpus wins; scripts/check-curriculum-parity.mjs
 * fails the build when the two drift apart.
 */
export const BUNDLED_CURRICULUM_VERSION = 'fd7efe04087d1ec5';

/** Mirror the session cut into the unit, skill and lesson index. */
function toSessionUnits(units: CurriculumUnit[]): CurriculumUnit[] {
  return units.map((unit) => ({
    ...unit,
    skills: unit.skills.map((skill) => ({
      ...skill,
      lessons: skill.lessons.flatMap((meta): CurriculumLesson[] => {
        const parts = SESSION_PARTS.get(meta.id);
        if (!parts || parts.length < 2) return [meta];
        const total = parts.reduce((n, p) => n + p.entry.steps.length, 0);
        return parts.map((part) => ({
          ...meta,
          id: part.id,
          title: `${meta.title} ${part.numeral}`,
          estMinutes: Math.max(2, Math.round(((meta.estMinutes ?? 8) * part.entry.steps.length) / total)),
        }));
      }),
    })),
  }));
}

/**
 * The bundled offline copy of the path: the authored lessons cut into sessions.
 * Identical to what the backend serves at BUNDLED_CURRICULUM_VERSION.
 */
export const SESSION_CURRICULUM: CurriculumUnit[] = toSessionUnits(AUTHORED_CURRICULUM);

// ── The active corpus (what the app renders) ──
//
// A tiny store rather than a plain constant, because the corpus the learner sees
// is whatever the backend is serving, and that answer arrives after first paint.
// The path must never flash empty waiting for it, so the bundled copy renders
// immediately and the served copy replaces it in place.

/** Where the corpus currently on screen came from. */
export type CurriculumSource = 'bundled' | 'cache' | 'server';

export interface CurriculumSnapshot {
  units: CurriculumUnit[];
  version: string;
  source: CurriculumSource;
}

let snapshot: CurriculumSnapshot = {
  units: SESSION_CURRICULUM,
  version: BUNDLED_CURRICULUM_VERSION,
  source: 'bundled',
};

/**
 * The path the app is rendering. A live binding: installCurriculum swaps it and
 * every module that imported it sees the new array on its next read. Components
 * read it during render and are re-rendered by subscribeCurriculum, so a swap
 * can never be observed halfway through a render pass.
 */
export let CURRICULUM: CurriculumUnit[] = snapshot.units;

const listeners = new Set<() => void>();

/**
 * Subscribe to corpus changes. Pairs with getCurriculumSnapshot for React's
 * useSyncExternalStore. Returns an unsubscribe function.
 */
export function subscribeCurriculum(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/**
 * The current corpus, as one stable object. Its identity changes only on an
 * install, which is exactly what useSyncExternalStore needs to decide whether
 * to re-render.
 */
export function getCurriculumSnapshot(): CurriculumSnapshot {
  return snapshot;
}

/**
 * Replace the corpus on screen. Called by services/curriculum.ts once the
 * backend has answered; nothing else should call it.
 *
 * A no-op when the incoming corpus is the one already installed, so a background
 * refresh that finds nothing new cannot cause a re-render.
 */
export function installCurriculum(units: CurriculumUnit[], version: string, source: CurriculumSource): void {
  if (!units.length) return;
  if (snapshot.units === units && snapshot.version === version && snapshot.source === source) return;
  snapshot = { units, version, source };
  CURRICULUM = units;
  for (const listener of listeners) listener();
}

// ── Lesson bodies ──
//
// Bodies are addressed BY VERSION, never by id alone. The session cut kept part
// one's id, so "The Closed Loop" names a 20-step lesson before the cut and an
// 8-step session after it: an id on its own cannot say which corpus it belongs
// to. Keying by version makes a content change a guaranteed miss rather than a
// comparison something can get wrong.

const bodies = new Map<string, LessonEntry>();
const bodyKey = (version: string, id: string) => `${version} ${id}`;

/** Record a lesson body the backend served, against the version it stamped. */
export function installLessonContent(version: string, id: string, entry: LessonEntry): void {
  bodies.set(bodyKey(version, id), entry);
}

/**
 * The body for a lesson at a given version, if this client already holds it.
 * Synchronous, so a lesson whose content is already in hand opens with no
 * loading state at all.
 *
 * The bundled corpus answers only for BUNDLED_CURRICULUM_VERSION. That is the
 * rule that makes stale bundled content impossible to serve by accident: it is
 * not merely preferred less, it is not addressable at any other version.
 */
export function peekLessonContent(id: string, version: string): LessonEntry | undefined {
  const held = bodies.get(bodyKey(version, id));
  if (held) return held;
  return version === BUNDLED_CURRICULUM_VERSION ? SESSION_CONTENT[id] : undefined;
}

// ── Path helpers (all read the ACTIVE corpus) ──

export const allLessons = (): CurriculumLesson[] =>
  CURRICULUM.flatMap((unit) => unit.skills.flatMap((skill) => skill.lessons));

export const totalLessons = (): number => allLessons().length;

export const findLesson = (id: string): CurriculumLesson | undefined =>
  allLessons().find((lesson) => lesson.id === id);

/** The same lookup against the AUTHORED path, for the review console: an author
 *  reviews the lesson they wrote, not the halves a learner sits through. */
export const findAuthoredLesson = (id: string): CurriculumLesson | undefined =>
  AUTHORED_CURRICULUM.flatMap((u) => u.skills.flatMap((sk) => sk.lessons)).find((lesson) => lesson.id === id);

/** Next unfinished lesson given a set of completed lesson ids (curriculum order). */
export const nextLesson = (completedIds: ReadonlySet<string>): CurriculumLesson | undefined =>
  allLessons().find((lesson) => !completedIds.has(lesson.id));

/**
 * Rigor of a lesson, DERIVED from its authored content (so it never drifts from
 * the lessons themselves). 'calc' = the learner will do real maths here: it has a
 * resistor-sizing step, a numeric prediction, or a fill-blank whose answer is a
 * number. The path shows a calculator glyph on these so the difficulty ramp is
 * visible (task #42). null = conceptual.
 *
 * Read from the AUTHORED lesson rather than the session, so both halves of a cut
 * lesson carry the same badge: the promise is "this topic involves calculation",
 * and which half happens to hold the numeric step is an artefact of where it was
 * cut. It also means the badge resolves for a served corpus whose bodies this
 * client has not downloaded yet.
 */
export type LessonRigor = 'calc' | null;
const numericAnswer = (s: string): boolean => /[0-9]/.test(s);
export const lessonRigor = (id: string): LessonRigor => {
  const origin = originLessonId(id);
  const content = origin ? LESSON_CONTENT[origin] : undefined;
  if (!content) return null;
  // A resistor-sizing step is always real design maths -> calc. Otherwise require
  // calculation to be a THEME (>= 2 numeric-prediction / numeric-blank steps), so a
  // lone incidental number does not flag a conceptual lesson. Keeps the badge a
  // meaningful "brace for maths" signal rather than noise.
  let numericSteps = 0;
  for (const step of content.steps) {
    if (step.type === 'choose_resistor') return 'calc';
    if (step.type === 'predict_reading') numericSteps += 1;
    else if (step.type === 'fill_blank' && numericAnswer(step.answer)) numericSteps += 1;
  }
  return numericSteps >= 2 ? 'calc' : null;
};

/**
 * Integrity check: every AUTHORED lesson must have authored content, and ids
 * must be unique. Returns problems (empty array = healthy). Call from a test or
 * dev tooling, not at import time.
 */
export const validateCurriculum = (): string[] => {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const unit of AUTHORED_CURRICULUM) {
    for (const skill of unit.skills) {
      for (const lesson of skill.lessons) {
        if (seen.has(lesson.id)) problems.push(`Duplicate lesson id: ${lesson.id}`);
        seen.add(lesson.id);
        if (!(lesson.id in LESSON_CONTENT)) {
          problems.push(`Lesson "${lesson.id}" has no authored content in LESSON_CONTENT`);
        }
      }
    }
  }
  return problems;
};
