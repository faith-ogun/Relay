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

export const Root: React.FC = () => (
  <Composition
    id="OhmletJourney"
    component={JourneyVideo}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
