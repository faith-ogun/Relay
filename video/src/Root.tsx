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
import { breadboarding } from "./lesson-film/lessons/breadboarding";
import { buildingCircuits } from "./lesson-film/lessons/building-circuits";
import { closedLoop } from "./lesson-film/lessons/closed-loop";
import { drivingLoads } from "./lesson-film/lessons/driving-loads";
import { ledsLimiting } from "./lesson-film/lessons/leds-limiting";
import { resistanceOhms } from "./lesson-film/lessons/resistance-ohms";
import { seriesParallel } from "./lesson-film/lessons/series-parallel";
import { switchesControl } from "./lesson-film/lessons/switches-control";
import { timeConstant } from "./lesson-film/lessons/time-constant";
import breadboardingTimings from "./lesson-film/timings/breadboarding.json";
import buildingCircuitsTimings from "./lesson-film/timings/building-circuits.json";
import closedLoopTimings from "./lesson-film/timings/closed-loop.json";
import drivingLoadsTimings from "./lesson-film/timings/driving-loads.json";
import ledsLimitingTimings from "./lesson-film/timings/leds-limiting.json";
import resistanceOhmsTimings from "./lesson-film/timings/resistance-ohms.json";
import seriesParallelTimings from "./lesson-film/timings/series-parallel.json";
import switchesControlTimings from "./lesson-film/timings/switches-control.json";
import timeConstantTimings from "./lesson-film/timings/time-constant.json";

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
  { lesson: breadboarding, timings: breadboardingTimings },
  { lesson: buildingCircuits, timings: buildingCircuitsTimings },
  { lesson: closedLoop, timings: closedLoopTimings },
  { lesson: drivingLoads, timings: drivingLoadsTimings },
  { lesson: ledsLimiting, timings: ledsLimitingTimings },
  { lesson: resistanceOhms, timings: resistanceOhmsTimings },
  { lesson: seriesParallel, timings: seriesParallelTimings },
  { lesson: switchesControl, timings: switchesControlTimings },
  { lesson: timeConstant, timings: timeConstantTimings },
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
