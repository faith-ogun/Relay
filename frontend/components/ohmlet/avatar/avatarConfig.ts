import { genConfig, type AvatarFullConfig } from 'react-nice-avatar';

// ── Ohmlet avatar config ──
//
// Built on react-nice-avatar (MIT): a customizable, layered-SVG flat avatar. We
// store a small, versioned, values-only config per user. Colours are constrained
// to a wide, inclusive palette, and gendered library values are surfaced with
// neutral, descriptive labels (see LABELS).

export interface OhmletAvatarConfig extends AvatarFullConfig {
  v: 2;
}

// Inclusive, descriptive labels for the library's (gendered) option values.
export const LABELS = {
  sex: { man: 'Tapered', woman: 'Round' } as Record<string, string>,
  hairStyle: { normal: 'Cropped', thick: 'Thick', mohawk: 'Mohawk', womanLong: 'Long', womanShort: 'Bob' } as Record<string, string>,
  eyeBrowStyle: { up: 'Natural', upWoman: 'Arched' } as Record<string, string>,
  earSize: { small: 'Small', big: 'Large' } as Record<string, string>,
  eyeStyle: { circle: 'Round', oval: 'Almond', smile: 'Happy' } as Record<string, string>,
  glassesStyle: { none: 'None', round: 'Round', square: 'Square' } as Record<string, string>,
  noseStyle: { short: 'Button', long: 'Long', round: 'Round' } as Record<string, string>,
  mouthStyle: { laugh: 'Grin', smile: 'Smile', peace: 'Soft' } as Record<string, string>,
  shirtStyle: { hoody: 'Hoodie', short: 'Tee', polo: 'Collar' } as Record<string, string>,
  hatStyle: { none: 'None', beanie: 'Beanie', turban: 'Wrap' } as Record<string, string>,
};

// Wide, inclusive palettes (kept on a curated set so avatars stay tasteful).
export const SKIN_COLORS = [
  '#ffe0c4', '#ffd1a3', '#f8c08a', '#eaa96b', '#d98e4f', '#c1733b',
  '#a45a2c', '#854a28', '#6a3b20', '#4e2c18', '#f3d4c8', '#3a2418',
];
export const HAIR_COLORS = [
  '#0a0a0a', '#241712', '#3b2417', '#5a3a22', '#7a4a2b', '#a55c2b',
  '#c87b3a', '#d9a066', '#e8d6ad', '#bfc3c7', '#7c5cff', '#549cf0',
  '#2bb673', '#f3e515', '#ff6f5e', '#ec4899',
];
export const SHIRT_COLORS = [
  '#f3e515', '#14201e', '#ff6f5e', '#549cf0', '#84cc30', '#7c5cff',
  '#ec4899', '#f5b800', '#0f766e', '#faf8f0', '#334155', '#fb923c',
];
export const BG_COLORS = [
  '#fff6d6', '#e9eef5', '#f2fae4', '#fff1ef', '#eef6ff', '#f3effe',
  '#faf8f0', '#fde9d0', '#dcf2ef', '#fce7f3', '#e2e8f0', '#1f2937',
];

export const OPTIONS = {
  sex: ['woman', 'man'] as const, // surfaced as face shape: Round / Tapered
  faceColor: SKIN_COLORS,
  earSize: ['small', 'big'] as const,
  hairStyle: ['normal', 'thick', 'mohawk', 'womanLong', 'womanShort'] as const,
  hairColor: HAIR_COLORS,
  hatStyle: ['none', 'beanie', 'turban'] as const,
  hatColor: ['#14201e', '#ff6f5e', '#549cf0', '#84cc30', '#f3e515', '#7c5cff', '#faf8f0'],
  eyeStyle: ['circle', 'oval', 'smile'] as const,
  eyeBrowStyle: ['up', 'upWoman'] as const,
  glassesStyle: ['none', 'round', 'square'] as const,
  noseStyle: ['short', 'long', 'round'] as const,
  mouthStyle: ['laugh', 'smile', 'peace'] as const,
  shirtStyle: ['hoody', 'short', 'polo'] as const,
  shirtColor: SHIRT_COLORS,
  bgColor: BG_COLORS,
};

export function defaultAvatar(seed?: string): OhmletAvatarConfig {
  const base = genConfig(seed || `ohmlet-${Math.random().toString(36).slice(2)}`);
  return {
    ...base,
    faceColor: SKIN_COLORS[2],
    hairColor: HAIR_COLORS[2],
    shirtColor: '#f3e515',
    bgColor: '#fff6d6',
    isGradient: false,
    hatStyle: 'none',
    glassesStyle: 'none',
    v: 2,
  };
}

/** Coerce stored data into a valid v2 config (defensive for old/partial data). */
export function normalizeAvatar(value: unknown): OhmletAvatarConfig {
  if (!value || typeof value !== 'object') return defaultAvatar();
  const v = value as Record<string, unknown>;
  const out = { ...defaultAvatar(), ...(v as Partial<OhmletAvatarConfig>), v: 2 as const };
  // Drop retired lab-gear fields if present in older stored data.
  for (const k of ['prop', 'headGear', 'eyeGear', 'faceGear', 'neckGear']) delete (out as Record<string, unknown>)[k];
  return out;
}
