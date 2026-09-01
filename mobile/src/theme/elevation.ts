import type { ViewStyle } from 'react-native';
import type { Colors } from './tokens';

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
//
// ── Why this is a function of the palette ──
//
// A shadow is a colour, so it belongs to the theme like any other. A translucent
// ink shadow over a light page is a soft grey; the same shadow over a dark page
// is nothing at all, because ink is near-white there and a white shadow is a
// glow. On dark the cast shadows go to real black and get heavier, since the
// contrast available under a card is much smaller and a timid shadow reads as no
// shadow. Consumers never call this directly: `makeStyles` hands the resolved
// set to every style factory as its second argument.

export interface Depth {
  /** flush | card | lifted | overlay. A resting surface, in four heights. */
  elevation: Record<'flush' | 'card' | 'lifted' | 'overlay', ViewStyle>;
  /** The 1px lit edge along the inside top of a filled surface. */
  innerLight: ViewStyle;
  /** The hard offset plate under a pressable. */
  press: ViewStyle;
  /** The same plate, shallower, for a small control. */
  pressSmall: ViewStyle;
}

/**
 * `rgba()` from a palette hex.
 *
 * Exported as `withAlpha` from the theme because a translucent brand colour is
 * the one place a component is tempted to type `rgba(250,204,46,0.16)` by hand,
 * and a hand-typed colour is one the theme can never reach again.
 */
export const alpha = (hex: string, a: number): string => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export const depthFor = (colors: Colors, scheme: 'light' | 'dark'): Depth => {
  // The colour a cast shadow is made of. On light that is the ink; on dark ink
  // is near-white, and a near-white shadow is a halo, so it goes to true black.
  const cast = scheme === 'dark' ? '#000000' : colors.ink;
  // Dark grounds swallow shadows: there is far less room between a #171b24 card
  // and a #0f1219 page than between white and cream, so the same opacities are
  // invisible. These are roughly 3x.
  const k = scheme === 'dark' ? 3 : 1;

  return {
    elevation: {
      /** Flush: list rows, backgrounds, inactive chrome. Value step only. */
      flush: {},

      /** A resting card. */
      card: {
        boxShadow: [
          { offsetX: 0, offsetY: 1, blurRadius: 2, color: alpha(cast, 0.1 * k) },
          { offsetX: 0, offsetY: 6, blurRadius: 16, color: alpha(cast, 0.06 * k) },
        ],
      },

      /** Lifted: the focused card, the current lesson. */
      lifted: {
        boxShadow: [
          { offsetX: 0, offsetY: 2, blurRadius: 4, color: alpha(cast, 0.12 * k) },
          { offsetX: 0, offsetY: 12, blurRadius: 28, color: alpha(cast, 0.1 * k) },
        ],
      },

      /** Sheets, modals, anything over the top of the app. */
      overlay: {
        boxShadow: [
          { offsetX: 0, offsetY: 4, blurRadius: 8, color: alpha(cast, 0.14 * k) },
          { offsetX: 0, offsetY: 24, blurRadius: 48, color: alpha(cast, Math.min(0.18 * k, 0.55)) },
        ],
      },
    },

    /**
     * The 1px lit edge along the inside top of a filled surface.
     *
     * Simulates a moulded bevel and costs nothing. It is the difference between
     * a yellow rectangle and something that looks pressable. On dark it drops to
     * a whisper: a half-opacity white line that reads as a bevel over gold is a
     * hard white stripe over a near-black card.
     */
    innerLight: {
      boxShadow: [
        {
          offsetX: 0, offsetY: 1, blurRadius: 0, inset: true,
          color: scheme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.5)',
        },
      ],
    },

    // The web app uses a `shadow-press` treatment: a hard offset shadow with no
    // blur, which reads as a physical, pressable button. React Native has no
    // direct equivalent, so it is composed from a border plus an offset shadow.
    //
    // The colour is `plate`, not ink. On dark, ink is near-white and a
    // near-white hard shadow under every button turns the app into a light-up
    // sign; plate is the darkest value in the palette instead, so the pressable
    // edge still reads against the page.
    press: {
      shadowColor: colors.plate,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 5,
    },

    pressSmall: {
      shadowColor: colors.plate,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
  };
};

/**
 * Plate depth scales with border width, or the 3D form looks out of proportion.
 * Border 2 → 2, 2.5 → 3, 3 → 4, 4 → 6.
 */
export const plateFor = (borderWidth: number): number =>
  borderWidth <= 2 ? 2 : borderWidth <= 2.5 ? 3 : borderWidth <= 3 ? 4 : 6;
