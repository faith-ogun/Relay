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
import { brushlessAndFoc } from "./lesson-film/lessons/brushless-and-foc";
import { buildingCircuits } from "./lesson-film/lessons/building-circuits";
import { canBus } from "./lesson-film/lessons/can-bus";
import { capsAtWork } from "./lesson-film/lessons/caps-at-work";
import { clockDomains } from "./lesson-film/lessons/clock-domains";
import { circuitsCurrent } from "./lesson-film/lessons/circuits-current";
import { codeAlarm } from "./lesson-film/lessons/code-alarm";
import { debuggingSafety } from "./lesson-film/lessons/debugging-safety";
import { drivingLoads } from "./lesson-film/lessons/driving-loads";
import { drivingMotors } from "./lesson-film/lessons/driving-motors";
import { embeddedBridge } from "./lesson-film/lessons/embedded-bridge";
import { filters } from "./lesson-film/lessons/filters";
import { firstSketch } from "./lesson-film/lessons/first-sketch";
import { inductiveProtection } from "./lesson-film/lessons/inductive-protection";
import { ledsLimiting } from "./lesson-film/lessons/leds-limiting";
import { lightAlarm } from "./lesson-film/lessons/light-alarm";
import { linearRegulation } from "./lesson-film/lessons/linear-regulation";
import { logicGates } from "./lesson-film/lessons/logic-gates";
import { makingDc } from "./lesson-film/lessons/making-dc";
import { meetCapacitor } from "./lesson-film/lessons/meet-capacitor";
import { memoryAndSequencing } from "./lesson-film/lessons/memory-and-sequencing";
import { numbersAndLevels } from "./lesson-film/lessons/numbers-and-levels";
import { opampAmplifiers } from "./lesson-film/lessons/opamp-amplifiers";
import { opampBasics } from "./lesson-film/lessons/opamp-basics";
import { opampComparators } from "./lesson-film/lessons/opamp-comparators";
import { opampRealWorld } from "./lesson-film/lessons/opamp-real-world";
import { readingInputs } from "./lesson-film/lessons/reading-inputs";
import { readingSensors } from "./lesson-film/lessons/reading-sensors";
import { resistanceOhms } from "./lesson-film/lessons/resistance-ohms";
import { resonanceOscillators } from "./lesson-film/lessons/resonance-oscillators";
import { robotControl } from "./lesson-film/lessons/robot-control";
import { robotSensingComms } from "./lesson-film/lessons/robot-sensing-comms";
import { rtosBasics } from "./lesson-film/lessons/rtos-basics";
import { sensorFusion } from "./lesson-film/lessons/sensor-fusion";
import { seriesParallel } from "./lesson-film/lessons/series-parallel";
import { signals } from "./lesson-film/lessons/signals";
import { speedAndPrecision } from "./lesson-film/lessons/speed-and-precision";
import { switchesControl } from "./lesson-film/lessons/switches-control";
import { switchingRegulation } from "./lesson-film/lessons/switching-regulation";
import { talkDebug } from "./lesson-film/lessons/talk-debug";
import { theTransistor } from "./lesson-film/lessons/the-transistor";
import { rcCharging } from "./lesson-film/lessons/rc-charging";
import { timing555 } from "./lesson-film/lessons/timing-555";
import { transistorVariety } from "./lesson-film/lessons/transistor-variety";
import { variableResistance } from "./lesson-film/lessons/variable-resistance";
import { volatileAndIsrs } from "./lesson-film/lessons/volatile-and-isrs";
import { whatArduino } from "./lesson-film/lessons/what-arduino";
import analogPwmTimings from "./lesson-film/timings/analog-pwm.json";
import breadboardingTimings from "./lesson-film/timings/breadboarding.json";
import brushlessAndFocTimings from "./lesson-film/timings/brushless-and-foc.json";
import buildingCircuitsTimings from "./lesson-film/timings/building-circuits.json";
import canBusTimings from "./lesson-film/timings/can-bus.json";
import capsAtWorkTimings from "./lesson-film/timings/caps-at-work.json";
import clockDomainsTimings from "./lesson-film/timings/clock-domains.json";
import circuitsCurrentTimings from "./lesson-film/timings/circuits-current.json";
import codeAlarmTimings from "./lesson-film/timings/code-alarm.json";
import debuggingSafetyTimings from "./lesson-film/timings/debugging-safety.json";
import drivingLoadsTimings from "./lesson-film/timings/driving-loads.json";
import drivingMotorsTimings from "./lesson-film/timings/driving-motors.json";
import embeddedBridgeTimings from "./lesson-film/timings/embedded-bridge.json";
import filtersTimings from "./lesson-film/timings/filters.json";
import firstSketchTimings from "./lesson-film/timings/first-sketch.json";
import inductiveProtectionTimings from "./lesson-film/timings/inductive-protection.json";
import ledsLimitingTimings from "./lesson-film/timings/leds-limiting.json";
import lightAlarmTimings from "./lesson-film/timings/light-alarm.json";
import linearRegulationTimings from "./lesson-film/timings/linear-regulation.json";
import logicGatesTimings from "./lesson-film/timings/logic-gates.json";
import makingDcTimings from "./lesson-film/timings/making-dc.json";
import meetCapacitorTimings from "./lesson-film/timings/meet-capacitor.json";
import memoryAndSequencingTimings from "./lesson-film/timings/memory-and-sequencing.json";
import numbersAndLevelsTimings from "./lesson-film/timings/numbers-and-levels.json";
import opampAmplifiersTimings from "./lesson-film/timings/opamp-amplifiers.json";
import opampBasicsTimings from "./lesson-film/timings/opamp-basics.json";
import opampComparatorsTimings from "./lesson-film/timings/opamp-comparators.json";
import opampRealWorldTimings from "./lesson-film/timings/opamp-real-world.json";
import readingInputsTimings from "./lesson-film/timings/reading-inputs.json";
import readingSensorsTimings from "./lesson-film/timings/reading-sensors.json";
import resistanceOhmsTimings from "./lesson-film/timings/resistance-ohms.json";
import resonanceOscillatorsTimings from "./lesson-film/timings/resonance-oscillators.json";
import robotControlTimings from "./lesson-film/timings/robot-control.json";
import robotSensingCommsTimings from "./lesson-film/timings/robot-sensing-comms.json";
import rtosBasicsTimings from "./lesson-film/timings/rtos-basics.json";
import sensorFusionTimings from "./lesson-film/timings/sensor-fusion.json";
import seriesParallelTimings from "./lesson-film/timings/series-parallel.json";
import signalsTimings from "./lesson-film/timings/signals.json";
import speedAndPrecisionTimings from "./lesson-film/timings/speed-and-precision.json";
import switchesControlTimings from "./lesson-film/timings/switches-control.json";
import switchingRegulationTimings from "./lesson-film/timings/switching-regulation.json";
import talkDebugTimings from "./lesson-film/timings/talk-debug.json";
import theTransistorTimings from "./lesson-film/timings/the-transistor.json";
import rcChargingTimings from "./lesson-film/timings/rc-charging.json";
import timing555Timings from "./lesson-film/timings/timing-555.json";
import transistorVarietyTimings from "./lesson-film/timings/transistor-variety.json";
import variableResistanceTimings from "./lesson-film/timings/variable-resistance.json";
import volatileAndIsrsTimings from "./lesson-film/timings/volatile-and-isrs.json";
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
  { lesson: brushlessAndFoc, timings: brushlessAndFocTimings },
  { lesson: buildingCircuits, timings: buildingCircuitsTimings },
  { lesson: canBus, timings: canBusTimings },
  { lesson: capsAtWork, timings: capsAtWorkTimings },
  { lesson: clockDomains, timings: clockDomainsTimings },
  { lesson: circuitsCurrent, timings: circuitsCurrentTimings },
  { lesson: codeAlarm, timings: codeAlarmTimings },
  { lesson: debuggingSafety, timings: debuggingSafetyTimings },
  { lesson: drivingLoads, timings: drivingLoadsTimings },
  { lesson: drivingMotors, timings: drivingMotorsTimings },
  { lesson: embeddedBridge, timings: embeddedBridgeTimings },
  { lesson: filters, timings: filtersTimings },
  { lesson: firstSketch, timings: firstSketchTimings },
  { lesson: inductiveProtection, timings: inductiveProtectionTimings },
  { lesson: ledsLimiting, timings: ledsLimitingTimings },
  { lesson: lightAlarm, timings: lightAlarmTimings },
  { lesson: linearRegulation, timings: linearRegulationTimings },
  { lesson: logicGates, timings: logicGatesTimings },
  { lesson: makingDc, timings: makingDcTimings },
  { lesson: meetCapacitor, timings: meetCapacitorTimings },
  { lesson: memoryAndSequencing, timings: memoryAndSequencingTimings },
  { lesson: numbersAndLevels, timings: numbersAndLevelsTimings },
  { lesson: opampAmplifiers, timings: opampAmplifiersTimings },
  { lesson: opampBasics, timings: opampBasicsTimings },
  { lesson: opampComparators, timings: opampComparatorsTimings },
  { lesson: opampRealWorld, timings: opampRealWorldTimings },
  { lesson: readingInputs, timings: readingInputsTimings },
  { lesson: readingSensors, timings: readingSensorsTimings },
  { lesson: resistanceOhms, timings: resistanceOhmsTimings },
  { lesson: resonanceOscillators, timings: resonanceOscillatorsTimings },
  { lesson: robotControl, timings: robotControlTimings },
  { lesson: robotSensingComms, timings: robotSensingCommsTimings },
  { lesson: rtosBasics, timings: rtosBasicsTimings },
  { lesson: sensorFusion, timings: sensorFusionTimings },
  { lesson: seriesParallel, timings: seriesParallelTimings },
  { lesson: signals, timings: signalsTimings },
  { lesson: speedAndPrecision, timings: speedAndPrecisionTimings },
  { lesson: switchesControl, timings: switchesControlTimings },
  { lesson: switchingRegulation, timings: switchingRegulationTimings },
  { lesson: talkDebug, timings: talkDebugTimings },
  { lesson: theTransistor, timings: theTransistorTimings },
  { lesson: rcCharging, timings: rcChargingTimings },
  { lesson: timing555, timings: timing555Timings },
  { lesson: transistorVariety, timings: transistorVarietyTimings },
  { lesson: variableResistance, timings: variableResistanceTimings },
  { lesson: volatileAndIsrs, timings: volatileAndIsrsTimings },
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
