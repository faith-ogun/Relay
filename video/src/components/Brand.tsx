import React from "react";
import { COLORS } from "../theme";
import { NUNITO } from "../font";

// The lightning bolt integrated into the O of OHMLET — a ring with a bolt inside.
export const BoltO: React.FC<{ size: number; ink?: string; bolt?: string }> = ({
  size,
  ink = COLORS.ink,
  bolt = COLORS.yellow,
}) => {
  const s = size;
  const stroke = s * 0.15;
  return (
    <svg width={s} height={s} viewBox="0 0 100 100" style={{ display: "block" }}>
      <circle
        cx={50}
        cy={50}
        r={50 - (stroke * 100) / s / 2}
        fill="none"
        stroke={ink}
        strokeWidth={(stroke * 100) / s}
      />
      <path
        d="M56 20 L34 54 L48 54 L44 80 L68 44 L52 44 Z"
        fill={bolt}
        stroke={ink}
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </svg>
  );
};

// The OHMLET wordmark — bolt-O followed by the letters.
export const Wordmark: React.FC<{ size?: number; ink?: string }> = ({
  size = 84,
  ink = COLORS.ink,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.06 }}>
    <BoltO size={size} ink={ink} />
    <span
      style={{
        fontFamily: NUNITO,
        fontWeight: 900,
        fontSize: size,
        letterSpacing: -size * 0.02,
        color: ink,
        lineHeight: 1,
      }}
    >
      HMLET
    </span>
  </div>
);

// A small pill for a task number (or a stretch label like "iter 002 - 006").
export const TaskChip: React.FC<{ label: string }> = ({ label }) => {
  const isTask = label.trim().startsWith("#");
  return (
    <span
      style={{
        fontFamily: NUNITO,
        fontWeight: 800,
        fontSize: 24,
        color: isTask ? COLORS.ink : COLORS.muted,
        background: isTask ? COLORS.yellowSoft : COLORS.panel2,
        border: `2px solid ${isTask ? COLORS.yellow : COLORS.line}`,
        borderRadius: 999,
        padding: "6px 16px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
};

// The horizontal journey rail — 7 nodes, the active one lit, past ones filled.
export const TimelineRail: React.FC<{ count: number; active: number }> = ({
  count,
  active,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 0,
      width: 1160,
    }}
  >
    {Array.from({ length: count }).map((_, i) => {
      const past = i < active;
      const isActive = i === active;
      const dot = isActive ? 26 : 16;
      const color = isActive ? COLORS.yellow : past ? COLORS.ink : COLORS.line;
      return (
        <React.Fragment key={i}>
          <div
            style={{
              width: dot,
              height: dot,
              borderRadius: 999,
              background: color,
              border: isActive ? `4px solid ${COLORS.ink}` : "none",
              flexShrink: 0,
              boxShadow: isActive ? "0 4px 14px rgba(243,229,21,0.6)" : "none",
            }}
          />
          {i < count - 1 && (
            <div
              style={{
                flex: 1,
                height: 4,
                background: i < active ? COLORS.ink : COLORS.line,
                borderRadius: 2,
              }}
            />
          )}
        </React.Fragment>
      );
    })}
  </div>
);
