import type { ViewStyle } from 'react-native';

// ── Elevation ──
//
// One shadow token was used for everything, so every surface sat at the same
// height and nothing was foreground. A single mid-blur shadow also reads as
// pasted-on rather than physical.
//
// Two rules underneath this file:
//
//   1. A resting surface gets TWO shadow layers. The tight one is contact
//      shadow, which glues the object to the ground; the wide one is ambient
//      occlusion. The eye reads the pair as an object and a single layer as a
//      sticker.
//   2. The chunky pressables get a HARD plate with zero blur, never a blur.
//      Mixing soft and hard on one element looks undecided.
//
// `boxShadow` is used rather than the legacy shadow* props because those are
// silently ignored on Android except for shadowColor: shadowOffset, opacity and
// radius simply do nothing there, so the old token produced a crisp shadow on
// iOS and a grey smudge on Android. boxShadow is honoured on both under the New
// Architecture, which Expo 54 uses by default, and it takes an array so the two
// layers above are expressible at all.

export const elevation: Record<'flush'|'card'|'lifted'|'overlay', ViewStyle> = {
  /** Flush: list rows, backgrounds, inactive chrome. Value step only. */
  flush: {},

  /** A resting card. */
  card: {
    boxShadow: [
      { offsetX: 0, offsetY: 1, blurRadius: 2, color: 'rgba(20,24,31,0.10)' },
      { offsetX: 0, offsetY: 6, blurRadius: 16, color: 'rgba(20,24,31,0.06)' },
    ],
  },

  /** Lifted: the focused card, the current lesson. */
  lifted: {
    boxShadow: [
      { offsetX: 0, offsetY: 2, blurRadius: 4, color: 'rgba(20,24,31,0.12)' },
      { offsetX: 0, offsetY: 12, blurRadius: 28, color: 'rgba(20,24,31,0.10)' },
    ],
  },

  /** Sheets, modals, anything over the top of the app. */
  overlay: {
    boxShadow: [
      { offsetX: 0, offsetY: 4, blurRadius: 8, color: 'rgba(20,24,31,0.14)' },
      { offsetX: 0, offsetY: 24, blurRadius: 48, color: 'rgba(20,24,31,0.18)' },
    ],
  },
};

/**
 * The 1px lit edge along the inside top of a filled surface.
 *
 * Simulates a moulded bevel and costs nothing. It is the difference between a
 * yellow rectangle and something that looks pressable.
 */
export const innerLight: ViewStyle = {
  boxShadow: [
    { offsetX: 0, offsetY: 1, blurRadius: 0, color: 'rgba(255,255,255,0.5)', inset: true },
  ],
};

/**
 * Plate depth scales with border width, or the 3D form looks out of proportion.
 * Border 2 → 2, 2.5 → 3, 3 → 4, 4 → 6.
 */
export const plateFor = (borderWidth: number): number =>
  borderWidth <= 2 ? 2 : borderWidth <= 2.5 ? 3 : borderWidth <= 3 ? 4 : 6;
