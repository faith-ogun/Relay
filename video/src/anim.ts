import { interpolate, spring } from "remotion";

// Fade + rise in, clamped both ends. delay/dur in frames.
export const riseIn = (frame: number, delay = 0, dur = 24) => {
  const t = interpolate(frame, [delay, delay + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { opacity: t, transform: `translateY(${(1 - t) * 22}px)` };
};

// A spring pop for elements that should arrive with weight.
export const pop = (frame: number, fps: number, delay = 0) =>
  spring({ frame: frame - delay, fps, config: { damping: 16, mass: 0.7 } });

// Simple clamped fade.
export const fade = (frame: number, delay = 0, dur = 20) =>
  interpolate(frame, [delay, delay + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
