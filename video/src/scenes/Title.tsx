import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";
import { NUNITO } from "../font";
import { Wordmark } from "../components/Brand";
import { riseIn, pop, fade } from "../anim";

export const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wm = pop(frame, fps, 6);

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: NUNITO,
      }}
    >
      <div style={{ transform: `scale(${0.9 + wm * 0.1})`, opacity: wm }}>
        <Wordmark size={116} />
      </div>

      <div
        style={{
          ...riseIn(frame, 30, 26),
          marginTop: 40,
          fontSize: 40,
          fontWeight: 700,
          color: COLORS.inkSoft,
          maxWidth: 1200,
          textAlign: "center",
          lineHeight: 1.25,
        }}
      >
        The live AI lab tutor for building electronics.
      </div>

      <div
        style={{
          opacity: fade(frame, 60, 24),
          marginTop: 34,
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontSize: 26,
          fontWeight: 800,
          color: COLORS.ink,
          background: COLORS.yellowSoft,
          border: `2px solid ${COLORS.yellow}`,
          borderRadius: 999,
          padding: "10px 24px",
        }}
      >
        The build journey · February to August 2026
      </div>
    </AbsoluteFill>
  );
};
