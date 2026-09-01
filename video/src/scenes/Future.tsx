import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, FUTURE } from "../theme";
import { NUNITO } from "../font";
import { riseIn } from "../anim";

export const Future: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        fontFamily: NUNITO,
        padding: "84px 130px",
        justifyContent: "center",
      }}
    >
      <div style={{ ...riseIn(frame, 0, 20), fontSize: 26, fontWeight: 900, letterSpacing: 2, color: COLORS.blue }}>
        WHERE IT IS GOING
      </div>
      <div
        style={{
          ...riseIn(frame, 10, 22),
          fontSize: 60,
          fontWeight: 900,
          color: COLORS.ink,
          marginTop: 12,
          lineHeight: 1.1,
        }}
      >
        Turn it on, then spread it
      </div>

      <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 16 }}>
        {FUTURE.map((f, i) => (
          <div
            key={f.title}
            style={{
              ...riseIn(frame, 28 + i * 12, 22),
              display: "flex",
              alignItems: "center",
              gap: 26,
              background: COLORS.panel,
              border: `2px solid ${COLORS.line}`,
              borderRadius: 18,
              padding: "22px 28px",
            }}
          >
            <span
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: COLORS.ink,
                background: COLORS.yellowSoft,
                border: `2px solid ${COLORS.yellow}`,
                borderRadius: 12,
                padding: "8px 16px",
                minWidth: 150,
                textAlign: "center",
                whiteSpace: "nowrap",
              }}
            >
              {f.tasks}
            </span>
            <div>
              <span style={{ fontSize: 34, fontWeight: 900, color: COLORS.ink }}>{f.title}</span>
              <span style={{ fontSize: 30, fontWeight: 600, color: COLORS.muted }}>
                {"  "}
                {f.detail}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          ...riseIn(frame, 90, 24),
          marginTop: 36,
          fontSize: 30,
          fontWeight: 800,
          color: COLORS.inkSoft,
          lineHeight: 1.3,
        }}
      >
        A consumer subscription, a paywall, and a viral share loop, all built. It can charge a learner
        the day Stripe goes live.
      </div>
    </AbsoluteFill>
  );
};
