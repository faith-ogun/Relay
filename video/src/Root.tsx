import React from "react";
import { AbsoluteFill, Composition, Sequence } from "remotion";
import { COLORS, FPS, SCENES, PHASES, TOTAL_FRAMES } from "./theme";
import { Title } from "./scenes/Title";
import { WhatItIs } from "./scenes/WhatItIs";
import { PhaseScene } from "./scenes/PhaseScene";
import { Cut } from "./scenes/Cut";
import { Now } from "./scenes/Now";
import { Future } from "./scenes/Future";
import { Close } from "./scenes/Close";
import { Film, totalFrames } from "./lesson-film/Film";
import { FPS as LESSON_FPS } from "./lesson-film/palette";
import { analogPwm } from "./lesson-film/lessons/analog-pwm";
import { breadboarding } from "./lesson-film/lessons/breadboarding";
import { buildingCircuits } from "./lesson-film/lessons/building-circuits";
import { capsAtWork } from "./lesson-film/lessons/caps-at-work";
import { closedLoop } from "./lesson-film/lessons/closed-loop";
import { codeAlarm } from "./lesson-film/lessons/code-alarm";
import { debuggingSafety } from "./lesson-film/lessons/debugging-safety";
import { drivingLoads } from "./lesson-film/lessons/driving-loads";
import { firstSketch } from "./lesson-film/lessons/first-sketch";
import { ledsLimiting } from "./lesson-film/lessons/leds-limiting";
import { lightAlarm } from "./lesson-film/lessons/light-alarm";
import { meetCapacitor } from "./lesson-film/lessons/meet-capacitor";
import { readingInputs } from "./lesson-film/lessons/reading-inputs";
import { readingSensors } from "./lesson-film/lessons/reading-sensors";
import { resistanceOhms } from "./lesson-film/lessons/resistance-ohms";
import { seriesParallel } from "./lesson-film/lessons/series-parallel";
import { switchesControl } from "./lesson-film/lessons/switches-control";
import { talkDebug } from "./lesson-film/lessons/talk-debug";
import { timeConstant } from "./lesson-film/lessons/time-constant";
import { variableResistance } from "./lesson-film/lessons/variable-resistance";
import { whatArduino } from "./lesson-film/lessons/what-arduino";
import analogPwmTimings from "./lesson-film/timings/analog-pwm.json";
import breadboardingTimings from "./lesson-film/timings/breadboarding.json";
import buildingCircuitsTimings from "./lesson-film/timings/building-circuits.json";
import capsAtWorkTimings from "./lesson-film/timings/caps-at-work.json";
import closedLoopTimings from "./lesson-film/timings/closed-loop.json";
import codeAlarmTimings from "./lesson-film/timings/code-alarm.json";
import debuggingSafetyTimings from "./lesson-film/timings/debugging-safety.json";
import drivingLoadsTimings from "./lesson-film/timings/driving-loads.json";
import firstSketchTimings from "./lesson-film/timings/first-sketch.json";
import ledsLimitingTimings from "./lesson-film/timings/leds-limiting.json";
import lightAlarmTimings from "./lesson-film/timings/light-alarm.json";
import meetCapacitorTimings from "./lesson-film/timings/meet-capacitor.json";
import readingInputsTimings from "./lesson-film/timings/reading-inputs.json";
import readingSensorsTimings from "./lesson-film/timings/reading-sensors.json";
import resistanceOhmsTimings from "./lesson-film/timings/resistance-ohms.json";
import seriesParallelTimings from "./lesson-film/timings/series-parallel.json";
import switchesControlTimings from "./lesson-film/timings/switches-control.json";
import talkDebugTimings from "./lesson-film/timings/talk-debug.json";
import timeConstantTimings from "./lesson-film/timings/time-constant.json";
import variableResistanceTimings from "./lesson-film/timings/variable-resistance.json";
import whatArduinoTimings from "./lesson-film/timings/what-arduino.json";

// The full journey video. Scenes laid out in order; each phase is its own Sequence.
const JourneyVideo: React.FC = () => {
  const blocks: { key: string; dur: number; el: React.ReactNode }[] = [
    { key: "title", dur: SCENES.title, el: <Title /> },
    { key: "whatItIs", dur: SCENES.whatItIs, el: <WhatItIs /> },
    ...PHASES.map((_, i) => ({
      key: `phase-${i}`,
      dur: SCENES.phase,
      el: <PhaseScene index={i} />,
    })),
    { key: "cut", dur: SCENES.cut, el: <Cut /> },
    { key: "now", dur: SCENES.now, el: <Now /> },
    { key: "future", dur: SCENES.future, el: <Future /> },
    { key: "close", dur: SCENES.close, el: <Close /> },
  ];

  let from = 0;
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {blocks.map((b) => {
        const node = (
          <Sequence key={b.key} from={from} durationInFrames={b.dur} name={b.key}>
            {b.el}
          </Sequence>
        );
        from += b.dur;
        return node;
      })}
    </AbsoluteFill>
  );
};

/**
 * The lesson films.
 *
 * Two shapes each, and only two: 1080x1920 for the phone, 1920x1080 for the web.
 * No 720p ladder, because a preview rung is a rendering cost paid on every
 * version for a quality nobody chooses.
 *
 * Duration is COMPUTED from the measured narration rather than declared, so a
 * script edit reflows the film instead of silently truncating the last scene.
 */
const LESSONS = [
  { lesson: analogPwm, timings: analogPwmTimings },
  { lesson: breadboarding, timings: breadboardingTimings },
  { lesson: buildingCircuits, timings: buildingCircuitsTimings },
  { lesson: capsAtWork, timings: capsAtWorkTimings },
  { lesson: closedLoop, timings: closedLoopTimings },
  { lesson: codeAlarm, timings: codeAlarmTimings },
  { lesson: debuggingSafety, timings: debuggingSafetyTimings },
  { lesson: drivingLoads, timings: drivingLoadsTimings },
  { lesson: firstSketch, timings: firstSketchTimings },
  { lesson: ledsLimiting, timings: ledsLimitingTimings },
  { lesson: lightAlarm, timings: lightAlarmTimings },
  { lesson: meetCapacitor, timings: meetCapacitorTimings },
  { lesson: readingInputs, timings: readingInputsTimings },
  { lesson: readingSensors, timings: readingSensorsTimings },
  { lesson: resistanceOhms, timings: resistanceOhmsTimings },
  { lesson: seriesParallel, timings: seriesParallelTimings },
  { lesson: switchesControl, timings: switchesControlTimings },
  { lesson: talkDebug, timings: talkDebugTimings },
  { lesson: timeConstant, timings: timeConstantTimings },
  { lesson: variableResistance, timings: variableResistanceTimings },
  { lesson: whatArduino, timings: whatArduinoTimings },
];

const SHAPES = [
  { suffix: "Phone", width: 1080, height: 1920 },
  { suffix: "Web", width: 1920, height: 1080 },
];

export const Root: React.FC = () => (
  <>
    <Composition
      id="OhmletJourney"
      component={JourneyVideo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
    {LESSONS.flatMap(({ lesson, timings }) =>
      SHAPES.map((shape) => (
        <Composition
          key={`${lesson.id}-${shape.suffix}`}
          id={`Lesson-${lesson.id}-${shape.suffix}`}
          component={Film as React.FC<Record<string, unknown>>}
          defaultProps={{ lesson, timings } as unknown as Record<string, unknown>}
          durationInFrames={totalFrames(timings)}
          fps={LESSON_FPS}
          width={shape.width}
          height={shape.height}
        />
      )),
    )}
  </>
);
