import { genConfig, type AvatarFullConfig } from 'react-nice-avatar';

// ── Ohmlet avatar config (#avatar) ──
//
// We build on react-nice-avatar (MIT): a customizable, layered-SVG flat avatar
// rendered as a React component. We store a small, values-only, versioned config
// per user (tiny + forward-compatible), constrain colours to brand tokens so every
// avatar stays on-palette (anti-slop), and add an Ohmlet "prop" layer (lab
// cosmetics) on top — some of which unlock via XP/achievements.

export type OhmletProp = 'goggles' | 'boltBand' | 'visor';

export interface OhmletAvatarConfig extends AvatarFullConfig {
  /** Schema version, for future migrations. */
  v: 1;
  /** Optional Ohmlet brand accessory layered above the face. */
  prop?: OhmletProp | null;
}

// Brand-constrained palettes (kept on-token so avatars never clash with the UI).
export const SKIN_COLORS = ['#f8d9b6', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#fce0d4'];
export const HAIR_COLORS = ['#0a0a0a', '#3b2417', '#6b4423', '#b5651d', '#d9a066', '#e8e4da', '#f3e515', '#549cf0', '#ff6f5e'];
export const SHIRT_COLORS = ['#f3e515', '#14201e', '#ff6f5e', '#549cf0', '#84cc30', '#faf8f0', '#7c5cff'];
export const BG_COLORS = ['#fff6d6', '#e9eef5', '#f2fae4', '#fff1ef', '#eef6ff', '#f3effe', '#faf8f0'];

// Option sets the editor exposes (mirrors react-nice-avatar's variants).
export const OPTIONS = {
  sex: ['man', 'woman'] as const,
  faceColor: SKIN_COLORS,
  earSize: ['small', 'big'] as const,
  hairStyle: ['normal', 'thick', 'mohawk', 'womanLong', 'womanShort'] as const,
  hairColor: HAIR_COLORS,
  hatStyle: ['none', 'beanie', 'turban'] as const,
  eyeStyle: ['circle', 'oval', 'smile'] as const,
  eyeBrowStyle: ['up', 'upWoman'] as const,
  glassesStyle: ['none', 'round', 'square'] as const,
  noseStyle: ['short', 'long', 'round'] as const,
  mouthStyle: ['laugh', 'smile', 'peace'] as const,
  shirtStyle: ['hoody', 'short', 'polo'] as const,
  shirtColor: SHIRT_COLORS,
  bgColor: BG_COLORS,
  prop: [null, 'goggles', 'boltBand', 'visor'] as const,
};

// Ohmlet props that must be earned (others are free). Gated server-side too.
export const LOCKED_PROPS: Record<OhmletProp, { requirement: string }> = {
  goggles: { requirement: 'Finish your first build' },
  boltBand: { requirement: 'Reach a 7-day streak' },
  visor: { requirement: 'Earn 5,000 XP' },
};

// A friendly, on-brand default so a new user starts with a real avatar, not blank.
export function defaultAvatar(seed?: string): OhmletAvatarConfig {
  const base = genConfig(seed || `ohmlet-${Math.random().toString(36).slice(2)}`);
  return {
    ...base,
    faceColor: SKIN_COLORS[0],
    hairColor: HAIR_COLORS[0],
    shirtColor: '#f3e515',
    bgColor: '#fff6d6',
    isGradient: false,
    hatStyle: 'none',
    glassesStyle: 'none',
    v: 1,
    prop: null,
  };
}

/** Coerce any stored value into a valid config (defensive for old/partial data). */
export function normalizeAvatar(value: unknown): OhmletAvatarConfig {
  if (!value || typeof value !== 'object') return defaultAvatar();
  const v = value as Partial<OhmletAvatarConfig>;
  return { ...defaultAvatar(), ...v, v: 1 };
}
