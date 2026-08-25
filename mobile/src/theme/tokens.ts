// Ohmlet brand tokens — mirrors frontend/tailwind.config.js exactly.
// The mobile app must be visually continuous with the web app, so these values
// are copied deliberately rather than approximated. If the web tokens change,
// change them here too.

export const colors = {
  gold: '#facc2e',
  goldDeep: '#f5b800',
  goldSoft: '#fff6d6',
  ink: '#14181f',
  inkSoft: '#474d57',
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

// Aggressive size contrast, per the project's anti-slop typography rule.
export const type = {
  display: 34,
  title: 26,
  heading: 20,
  body: 15,
  small: 13,
  meta: 11,
} as const;


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
  '#f5b800', // Foundations, brand gold deepened for contrast
  '#3e86e8', // On the Breadboard
  '#4aa96c', // Sensors & Signals
  '#e8734a', // Meet the Arduino
  '#8c5bd8', // Inputs, Outputs & Code
  '#2fa8a0', // Capacitors, RC & Timing
  '#d4457f', // Transistors & Switching
  '#5b7fd8', // Op-Amps & Signal Conditioning
  '#c9902b', // Filters, Oscillators & Signals
  '#3f9d5c', // Power Supplies & Regulation
  '#6b5bd8', // Digital Logic & Embedded
  '#d8603f', // Comms, Motors & Robotics
];

/** The colour for unit `i`, wrapping if the curriculum ever grows past twelve. */
export const unitColor = (i: number): string => UNIT_COLORS[i % UNIT_COLORS.length];
