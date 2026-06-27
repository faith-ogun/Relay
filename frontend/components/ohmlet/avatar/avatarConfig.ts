import { genConfig, type AvatarFullConfig } from 'react-nice-avatar';

// ── Ohmlet avatar config ──
//
// Built on react-nice-avatar (MIT): a customizable, layered-SVG flat avatar. We
// store a small, versioned, values-only config per user. Colours are constrained
// to a wide, inclusive palette; gendered library values are surfaced with neutral,
// descriptive labels (see LABELS); and we add four independent "lab gear" overlay
// slots (head/eyes/face/neck) so accessories stack into a real lab look. The gear
// SVGs are calibrated to the avatar's geometry (see OhmletAvatar).

export type HeadGear = 'hardHat' | 'earDefenders';
export type EyeGear = 'goggles';
export type FaceGear = 'mask';
export type NeckGear = 'labCoat';

export interface OhmletAvatarConfig extends AvatarFullConfig {
  v: 2;
  headGear?: HeadGear | null;
  eyeGear?: EyeGear | null;
  faceGear?: FaceGear | null;
  neckGear?: NeckGear | null;
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
  headGear: { hardHat: 'Hard hat', earDefenders: 'Ear defenders' } as Record<string, string>,
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
  headGear: [null, 'hardHat', 'earDefenders'] as const,
  eyeGear: [null, 'goggles'] as const,
  faceGear: [null, 'mask'] as const,
  neckGear: [null, 'labCoat'] as const,
};

// Lab gear that must be earned. Others are free. (Editor + server gate on this.)
export const LOCKED_GEAR: Partial<Record<string, { requirement: string }>> = {
  hardHat: { requirement: 'Finish your first build' },
  labCoat: { requirement: 'Reach a 7-day streak' },
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
    headGear: null,
    eyeGear: null,
    faceGear: null,
    neckGear: null,
  };
}

/** Coerce stored data (incl. the old v1 `prop` field) into a valid v2 config. */
export function normalizeAvatar(value: unknown): OhmletAvatarConfig {
  if (!value || typeof value !== 'object') return defaultAvatar();
  const v = value as Record<string, unknown>;
  const out = { ...defaultAvatar(), ...(v as Partial<OhmletAvatarConfig>), v: 2 as const };
  // Migrate v1 `prop` (goggles | boltBand | visor) into the new slots.
  if (v.prop === 'goggles' || v.prop === 'visor') out.eyeGear = 'goggles';
  delete (out as Record<string, unknown>).prop;
  return out;
}
