import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, CUTS } from "../theme";
import { NUNITO } from "../font";
import { riseIn } from "../anim";

export const Cut: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        fontFamily: NUNITO,
        padding: "96px 130px",
        justifyContent: "center",
      }}
    >
      <div style={{ ...riseIn(frame, 0, 20), fontSize: 26, fontWeight: 900, letterSpacing: 2, color: COLORS.blue }}>
        THE HONEST PART
      </div>
      <div
        style={{
          ...riseIn(frame, 10, 22),
          fontSize: 62,
          fontWeight: 900,
          color: COLORS.ink,
          marginTop: 12,
          lineHeight: 1.1,
        }}
      >
        What was cut, and cut on purpose
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginTop: 48,
        }}
      >
        {CUTS.map((c, i) => (
          <div
            key={c.label}
            style={{
              ...riseIn(frame, 30 + i * 12, 22),
              background: COLORS.panel,
              border: `2px solid ${COLORS.line}`,
              borderRadius: 18,
              padding: "24px 28px",
              display: "flex",
              alignItems: "baseline",
              gap: 14,
            }}
          >
            <span style={{ color: COLORS.faint, fontSize: 34, fontWeight: 900, lineHeight: 1 }}>
              &times;
            </span>
            <div>
              <span style={{ fontSize: 30, fontWeight: 900, color: COLORS.ink }}>{c.label}</span>
              <span style={{ fontSize: 28, fontWeight: 600, color: COLORS.muted }}>
                {": "}
                {c.detail}
              </span>
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
