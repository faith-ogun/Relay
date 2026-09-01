import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, PHASES } from "../theme";
import { NUNITO } from "../font";
import { TaskChip, TimelineRail } from "../components/Brand";
import { riseIn, fade } from "../anim";

export const PhaseScene: React.FC<{ index: number }> = ({ index }) => {
  const frame = useCurrentFrame();
  const p = PHASES[index];

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        fontFamily: NUNITO,
        padding: "96px 130px 84px",
        justifyContent: "space-between",
      }}
    >
      {/* header row: kicker + date */}
      <div>
        <div
          style={{
            ...riseIn(frame, 0, 20),
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: 2, color: COLORS.blue }}>
            {p.tag}
          </span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: COLORS.muted,
              background: COLORS.panel2,
              border: `2px solid ${COLORS.line}`,
              borderRadius: 999,
              padding: "5px 16px",
            }}
          >
            {p.date}
          </span>
        </div>

        <div
          style={{
            ...riseIn(frame, 10, 22),
            fontSize: 76,
            fontWeight: 900,
            color: COLORS.ink,
            marginTop: 18,
            lineHeight: 1.05,
          }}
        >
          {p.title}
        </div>

        <div
          style={{
            ...riseIn(frame, 20, 22),
            fontSize: 34,
            fontWeight: 600,
            color: COLORS.inkSoft,
            marginTop: 16,
            maxWidth: 1400,
            lineHeight: 1.3,
          }}
        >
          {p.lead}
        </div>

        {/* task chips */}
        <div style={{ opacity: fade(frame, 34, 20), display: "flex", gap: 12, marginTop: 30, flexWrap: "wrap" }}>
          {p.tasks.map((t) => (
            <TaskChip key={t} label={t} />
          ))}
        </div>

        {/* the three points */}
        <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 18 }}>
          {p.points.map((pt, i) => (
            <div
              key={pt}
              style={{
                ...riseIn(frame, 48 + i * 12, 22),
                display: "flex",
                alignItems: "center",
                gap: 18,
                fontSize: 32,
                fontWeight: 700,
                color: COLORS.ink,
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  background: COLORS.yellow,
                  border: `2px solid ${COLORS.ink}`,
                  flexShrink: 0,
                  transform: "rotate(45deg)",
                }}
              />
              {pt}
            </div>
          ))}
        </div>
      </div>

      {/* the journey rail */}
      <div style={{ opacity: fade(frame, 20, 24) }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: COLORS.faint,
            marginBottom: 18,
          }}
        >
          Phase {index + 1} of {PHASES.length}
        </div>
        <TimelineRail count={PHASES.length} active={index} />
      </div>
    </AbsoluteFill>
  );
};
