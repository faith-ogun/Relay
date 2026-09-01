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

/**
 * The palette, twice.
 *
 * Every key exists in both themes and `darkColors` is typed as `Colors`, so a
 * token added to one and forgotten in the other is a compile error rather than a
 * transparent hole on somebody's phone.
 *
 * Two families invert their MEANING rather than simply darkening, and getting
 * that wrong is what makes a dark theme look like a bug:
 *
 *   `-deep`  means "more contrast than the base". On a light ground that is
 *            darker; on a dark ground it is LIGHTER. `goldDeep` going darker on
 *            dark would make every hover and pressed state vanish into the page.
 *   `-soft`  is a tint wash behind content. On light it is a pale version of the
 *            hue; on dark it has to be a DEEP version, or a "soft" background
 *            becomes the brightest thing on the screen.
 *
 * The gold itself does not move. It is the brand, it was chosen against the
 * mascot, and it reads on both grounds. Everything around it moves.
 *
 * The values match `frontend/styles.css` channel for channel, so the phone and
 * the web read as the same product. One deliberate difference: on the web the
 * page is `canvas` and `cream` is a tinted band on top of it, while here `cream`
 * IS the page and `surface` is the raised card on top of it. So mobile `cream`
 * takes the web's `canvas` values on dark, and the ordering that actually
 * matters holds on both surfaces: the raised card is LIGHTER than the ground
 * behind it on dark, and darker than it on light.
 */
export interface Colors {
  gold: string;
  goldDeep: string;
  goldSoft: string;
  /** The plate and the shadow for any gold surface. */
  goldPlate: string;
  /** Gold-voiced text on a NEUTRAL or gold-soft ground: an XP figure, an
   *  eyebrow on a gold-tinted card. It follows the theme, because the ground
   *  under it does. */
  goldText: string;
  /** Text and glyphs sitting ON the gold fill itself. Gold is the one colour
   *  that does not move, so neither does this. Splitting it off `goldText` is
   *  what stops a "SAVE 50%" tag going pale-gold-on-gold in dark mode. */
  onGold: string;
  ink: string;
  inkSoft: string;
  inkMute: string;
  inkFaint: string;
  red: string;
  /** The wash behind a wrong answer or a destructive warning. */
  redSoft: string;
  /** Text on `redSoft`. */
  redText: string;
  blue: string;
  blueDeep: string;
  blueSoft: string;
  green: string;
  greenDeep: string;
  /** The wash behind a right answer. */
  greenSoft: string;
  /** Text on `greenSoft`. */
  greenText: string;
  /** The page, and any well recessed INTO a card. */
  cream: string;
  line: string;

  // ── The tokens that sort out what "white" and "ink" meant ──────────────
  //
  // 109 places wrote `backgroundColor: colors.surface` and 48 wrote
  // `color: colors.white`, and they did not mean the same thing. The same is
  // true of `colors.ink` as a fill. Sorting them is the difference between a
  // dark theme and an unreadable one.

  /** Literal white. Foreground on anything dark in EVERY theme: a saturated
   *  brand fill, the camera stage, video, 3D. Never a background. */
  white: string;
  /** The raised card. White on light, so every `bg: white` that meant "a card"
   *  changes nothing in light mode and is the whole fix in dark mode. */
  surface: string;
  /** A panel that is dark in BOTH themes: the camera stage, the serial console,
   *  the video player, the Max tier card. They carry gold and green accents
   *  chosen against black, and inverting them destroys what they are for. On
   *  dark it goes DARKER than the card behind it so it still reads as inset. */
  slab: string;
  /** Foreground for a fill painted in `ink`. Ink INVERTS, so plain `white` on it
   *  becomes white-on-white the instant the theme flips. This pair always
   *  contrasts: active pills, numbered badges, solid buttons, radio dots. */
  onInk: string;
  /**
   * Foreground on a `slab`, or on any surface that is dark in BOTH themes.
   *
   * Distinct from `onInk`, which INVERTS because `ink` inverts. A slab does not
   * move, so its foreground must not either. The sandbox ruler chips are the
   * case that found this: their background is a fixed dark wash and their text
   * was `cream`, so in dark mode the row labels on the breadboard turned dark on
   * dark and the F1 / A2 / GND names became unreadable. The board itself is a
   * physical white breadboard and never changes; neither should anything printed
   * on top of it.
   */
  onSlab: string;
  /** The hard offset shadow under a pressable. Ink on light; it has to change on
   *  dark or the plate disappears into the ground it is sitting on, and every
   *  button in the app goes flat. */
  plate: string;
  /** The black wash under chrome floating on media. Fixed, same reason as
   *  `white`: it is dark in every theme by definition. */
  scrim: string;
}

export const lightColors: Colors = {
  gold: '#facc2e',
  goldDeep: '#f5b800',
  goldSoft: '#fff6d6',
  goldPlate: '#c99a00',
  goldText: '#8f6d00',
  onGold: '#8f6d00',
  ink: '#14181f',
  inkSoft: '#474d57',
  inkMute: '#a8adb6',
  inkFaint: '#ebecee',
  red: '#ff6f5e',
  redSoft: '#fdece8',
  redText: '#a33122',
  blue: '#549cf0',
  blueDeep: '#3e86e8',
  blueSoft: '#eaf2fe',
  green: '#84cc30',
  greenDeep: '#6fb519',
  greenSoft: '#eef7e0',
  greenText: '#3f6b0d',
  cream: '#faf8f0',
  line: '#ece7db',
  white: '#ffffff',
  surface: '#ffffff',
  slab: '#14181f',
  onInk: '#ffffff',
  onSlab: '#ffffff',
  plate: '#14181f',
  scrim: '#000000',
};

export const darkColors: Colors = {
  gold: '#facc2e',
  goldDeep: '#ffd84d',
  goldSoft: '#2a2410',
  goldPlate: '#b8890a',
  goldText: '#ffdf6b',
  onGold: '#8f6d00',
  ink: '#eef0f4',
  inkSoft: '#b3b9c4',
  inkMute: '#767d8a',
  inkFaint: '#232833',
  red: '#ff8577',
  redSoft: '#3a1f1a',
  redText: '#ffb3a8',
  blue: '#6fadf5',
  blueDeep: '#8bc0ff',
  blueSoft: '#16233a',
  green: '#9ade4a',
  greenDeep: '#b0e86a',
  greenSoft: '#1e2a12',
  greenText: '#c3ef88',
  cream: '#0f1219',
  line: '#262b36',
  white: '#ffffff',
  surface: '#171b24',
  slab: '#0c0f15',
  onInk: '#0f1219',
  onSlab: '#ffffff',
  plate: '#05070b',
  scrim: '#000000',
};

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
