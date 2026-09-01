import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS } from "../theme";
import { NUNITO } from "../font";
import { riseIn } from "../anim";

const Pillar: React.FC<{ frame: number; delay: number; kicker: string; body: string }> = ({
  frame,
  delay,
  kicker,
  body,
}) => (
  <div
    style={{
      ...riseIn(frame, delay, 24),
      flex: 1,
      background: COLORS.panel,
      border: `2px solid ${COLORS.line}`,
      borderRadius: 22,
      padding: "34px 34px 38px",
    }}
  >
    <div
      style={{
        fontSize: 20,
        fontWeight: 900,
        letterSpacing: 1.5,
        color: COLORS.blue,
        marginBottom: 16,
      }}
    >
      {kicker}
    </div>
    <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.ink, lineHeight: 1.3 }}>
      {body}
    </div>
  </div>
);

export const WhatItIs: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        fontFamily: NUNITO,
        padding: "110px 130px",
        justifyContent: "center",
      }}
    >
      <div style={{ ...riseIn(frame, 0, 22), fontSize: 30, fontWeight: 800, color: COLORS.muted }}>
        What Ohmlet is
      </div>
      <div
        style={{
          ...riseIn(frame, 12, 24),
          fontSize: 58,
          fontWeight: 900,
          color: COLORS.ink,
          lineHeight: 1.15,
          maxWidth: 1500,
          marginTop: 14,
        }}
      >
        A voice and camera tutor that watches your real breadboard and corrects you as you build.
      </div>

      <div style={{ display: "flex", gap: 26, marginTop: 60 }}>
        <Pillar frame={frame} delay={40} kicker="IT SEES" body="Live camera on your bench: it checks parts and wiring." />
        <Pillar frame={frame} delay={54} kicker="IT TALKS" body="Real-time voice guidance, step by step, as you go." />
        <Pillar frame={frame} delay={68} kicker="IT REWARDS" body="XP, streaks, a 3D twin of the build you finished." />
      </div>
    </AbsoluteFill>
  );
};
