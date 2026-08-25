import type { TextStyle } from 'react-native';

// Ohmlet brand tokens — mirrors frontend/tailwind.config.js exactly.
// The mobile app must be visually continuous with the web app, so these values
// are copied deliberately rather than approximated. If the web tokens change,
// change them here too.

// ── Colour ──
//
// Each brand hue carries a RAMP, not a single value. With one value per colour
// there is no way to express state or depth without reaching for opacity, and
// opacity over cream turns everything muddy.
//
// The rule that makes the chunky style work: the plate under a coloured face is
// that hue's 600, never black. A black plate under gold is the sticker look.
// Text on a coloured fill is that hue's 700, not black and not white: ink on
// gold reads as a warning sign, gold-700 on gold reads as expensive.
export const gold = {
  50: '#fffdf0', 100: '#fff6d6', 200: '#ffeaa3',
  400: '#facc2e', 500: '#f0bd0d', 600: '#c99a00', 700: '#8f6d00',
} as const;

export const inkRamp = {
  50: '#f7f7f8', 100: '#ebecee', 300: '#a8adb6',
  500: '#6b7280', 700: '#474d57', 800: '#262b33', 900: '#14181f',
} as const;

export const colors = {
  gold: '#facc2e',
  goldDeep: '#f5b800',
  goldSoft: '#fff6d6',
  /** The plate and the shadow for any gold surface. */
  goldPlate: '#c99a00',
  /** Text on gold. Ink on gold is a hazard stripe; this is not. */
  goldText: '#8f6d00',
  ink: '#14181f',
  inkSoft: '#474d57',
  inkMute: '#a8adb6',
  inkFaint: '#ebecee',
  red: '#ff6f5e',
  blue: '#549cf0',
  blueDeep: '#3e86e8',
  blueSoft: '#eaf2fe',
  green: '#84cc30',
  greenDeep: '#6fb519',
  cream: '#faf8f0',
  line: '#ece7db',
  white: '#ffffff',
} as const;

// The web app uses a `shadow-press` treatment: a hard offset shadow with no blur,
// which reads as a physical, pressable button. React Native has no direct
// equivalent, so it is composed from a border plus an offset shadow.
export const press = {
  shadowColor: colors.ink,
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 5,
} as const;

export const pressSmall = {
  ...press,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
} as const;

export const radius = { sm: 12, md: 16, lg: 22, xl: 28 } as const;
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

// Nunito is the brand font. Loaded at runtime in the root layout; these are the
// family names the loader registers.
export const font = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const;

// ── Type ──
//
// The old ramp went 34/26/20/15/13/11: ratios of about 1.3 all the way down,
// which is an almost-linear scale with no jump anywhere. Designed type has a
// CLIFF between display and body and then tight steps within the body region.
//
// Three things below matter more than the sizes:
//
//   1. Tracking is size-dependent and is not optional. Large type needs
//      NEGATIVE tracking, small type needs positive. Zero at every size is the
//      loudest "nobody set this" signal in a UI.
//   2. Line-height ratio SHRINKS as size grows. A 34px heading at 1.5 looks
//      like a paragraph.
//   3. Weight contrast beats size contrast in a chunky app. Body moves to 700
//      and headings to 800, so 400 should appear almost nowhere. This single
//      change does more than the rest of the ramp.
export const type = {
  display: 40,
  title: 28,
  heading: 20,
  /** Primary reading text. Was 15; 17 at weight 700 is the chunky-app body. */
  bodyLg: 17,
  body: 15,
  label: 14,
  small: 13,
  meta: 11,
} as const;

/** Line height per size. Ratio falls as size rises. */
export const leading = {
  display: 42,
  title: 32,
  heading: 26,
  bodyLg: 24,
  body: 22,
  label: 18,
  small: 18,
  meta: 14,
} as const;

/**
 * Optical tracking, roughly (16 - size) * 0.05 clamped to [-0.8, +1.0].
 * All-caps needs the high end or it is unreadable and looks unset.
 */
export const tracking = {
  display: -0.8,
  title: -0.4,
  heading: -0.1,
  bodyLg: 0,
  body: 0,
  label: 0.2,
  small: 0.1,
  /** Eyebrows and tab labels are uppercase, so they need the most. */
  meta: 0.9,
} as const;

/**
 * Anything that counts must use tabular figures, or the digits jitter as they
 * animate and it reads as a rendering bug. XP, streaks, timers, scores.
 */
export const tabular: { fontVariant: TextStyle['fontVariant'] } = {
  fontVariant: ['tabular-nums'],
};

/**
 * iOS superellipse corners. Circular arcs have a visible kink where the curve
 * meets the straight edge, and that kink is a subliminal "not a native app"
 * tell. Free, one property, iOS only; Android keeps circular arcs, which is
 * what Android users expect anyway.
 */
export const curve = { borderCurve: 'continuous' as const };


/**
 * One colour per unit, in curriculum order.
 *
 * The authored curriculum carries an `accent` of gold, blue, green or red, which
 * means twelve units share four colours and three of them look identical on the
 * path. Duolingo gives every unit its own identity for a reason: the colour IS
 * the wayfinding, and "the purple one" is how a learner remembers where they
 * are.
 *
 * Ordered so no two adjacent units are close in hue, and every one of them holds
 * white text at the weight the headers use.
 */
export const UNIT_COLORS: string[] = [
  '#e6b10f', // Foundations, brand gold deepened for contrast
  '#4888de', // On the Breadboard
  '#50a36e', // Sensors & Signals
  '#df7853', // Meet the Arduino
  '#8e62d0', // Inputs, Outputs & Code
  '#36a19a', // Capacitors, RC & Timing
  '#cb4e81', // Transistors & Switching
  '#6282d0', // Op-Amps & Signal Conditioning
  '#c08d34', // Filters, Oscillators & Signals
  '#45975e', // Power Supplies & Regulation
  '#7162d0', // Digital Logic & Embedded
  '#cf6548', // Comms, Motors & Robotics
];

/** The colour for unit `i`, wrapping if the curriculum ever grows past twelve. */
export const unitColor = (i: number): string => UNIT_COLORS[i % UNIT_COLORS.length];
