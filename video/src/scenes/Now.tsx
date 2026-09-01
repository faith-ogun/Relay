import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS } from "../theme";
import { NUNITO } from "../font";
import { TaskChip } from "../components/Brand";
import { riseIn } from "../anim";

const LeftCard: React.FC<{ frame: number; delay: number; task: string; title: string; body: string }> = ({
  frame,
  delay,
  task,
  title,
  body,
}) => (
  <div
    style={{
      ...riseIn(frame, delay, 24),
      flex: 1,
      background: COLORS.bg,
      border: `3px solid ${COLORS.yellow}`,
      borderRadius: 22,
      padding: "32px 34px 36px",
      boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
    }}
  >
    <TaskChip label={task} />
    <div style={{ fontSize: 38, fontWeight: 900, color: COLORS.ink, marginTop: 18 }}>{title}</div>
    <div style={{ fontSize: 28, fontWeight: 600, color: COLORS.muted, marginTop: 10, lineHeight: 1.3 }}>
      {body}
    </div>
  </div>
);

export const Now: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        fontFamily: NUNITO,
        padding: "104px 130px",
        justifyContent: "center",
      }}
    >
      <div style={{ ...riseIn(frame, 0, 20), fontSize: 26, fontWeight: 900, letterSpacing: 2, color: COLORS.green }}>
        WHERE WE ARE NOW
      </div>
      <div
        style={{
          ...riseIn(frame, 10, 22),
          fontSize: 60,
          fontWeight: 900,
          color: COLORS.ink,
          marginTop: 12,
          lineHeight: 1.12,
          maxWidth: 1500,
        }}
      >
        Feature-complete and safety-complete. Two things left to earn.
      </div>

      <div style={{ display: "flex", gap: 26, marginTop: 56 }}>
        <LeftCard
          frame={frame}
          delay={34}
          task="#79"
          title="The twin-share page"
          body="Backend is live. The branded public page is the last build step."
        />
        <LeftCard
          frame={frame}
          delay={50}
          task="#64"
          title="Stripe go-live"
          body="Everything works in test mode. Flip it to live, and it takes real money."
        />
      </div>
    </AbsoluteFill>
  );
};
