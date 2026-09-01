import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";
import { NUNITO } from "../font";
import { Wordmark } from "../components/Brand";
import { riseIn, pop } from "../anim";

export const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wm = pop(frame, fps, 4);
  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        fontFamily: NUNITO,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ transform: `scale(${0.92 + wm * 0.08})`, opacity: wm }}>
        <Wordmark size={104} />
      </div>
      <div
        style={{
          ...riseIn(frame, 26, 26),
          marginTop: 40,
          fontSize: 42,
          fontWeight: 800,
          color: COLORS.ink,
          textAlign: "center",
          maxWidth: 1300,
          lineHeight: 1.25,
        }}
      >
        From a live-tutor idea to a shippable product.
      </div>
      <div
        style={{
          ...riseIn(frame, 50, 24),
          marginTop: 26,
          fontSize: 30,
          fontWeight: 800,
          color: COLORS.muted,
          letterSpacing: 1,
        }}
      >
        ohmlet.org
      </div>
    </AbsoluteFill>
  );
};
