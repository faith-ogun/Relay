// ── Child mode: age assurance, mirrored from the web model ──
//
// Ported deliberately rather than reinvented. The consent ages below are law,
// not preference, and two surfaces disagreeing about who counts as a minor is
// the kind of divergence that is invisible until a regulator asks.
// Source of truth: frontend/components/ohmlet/childmode/ageModel.ts and
// metadata/decisions/2026-07-11_child-mode-design-and-compliance.md.
//
// The values here are UI hints only. The real gate is a server custom claim, so
// nothing in this file can be tampered with to unlock the live tutor.

/** Ships dark until KWS is wired and the solicitor has signed off (#99, #100). */
export const CHILD_MODE_ENABLED =
  String(process.env.EXPO_PUBLIC_OHMLET_CHILD_MODE ?? '').toLowerCase() === 'true';

/** Digital age of consent by ISO-3166 alpha-2 (GDPR Art 8 member-state choice). */
export const CONSENT_AGE_BY_COUNTRY: Record<string, number> = {
  IE: 16, DE: 16, NL: 16, LU: 16, HR: 16, LT: 16,
  AT: 14, BG: 14, CY: 14, IT: 14, ES: 14,
  CZ: 15, FR: 15, GR: 15, SI: 15,
  BE: 13, DK: 13, EE: 13, FI: 13, LV: 13, MT: 13, PT: 13, PL: 13, SE: 13, NO: 13,
  GB: 13,
  US: 13,
};

export const DEFAULT_CONSENT_AGE = 16;
export const COPPA_AGE = 13;
export const CHILD_PROTECTION_AGE = 18;

export type AgeStatus = 'adult' | 'minor_pending_consent' | 'minor_consented' | 'blocked';

export interface AgeAssessment {
  isMinor: boolean;
  coppa: boolean;
  consentAge: number;
  ageStatus: AgeStatus;
  age: number;
}

export function consentAgeFor(country: string): number {
  return CONSENT_AGE_BY_COUNTRY[country.toUpperCase()] ?? DEFAULT_CONSENT_AGE;
}

/**
 * Assess a birth YEAR, not a full date of birth: the year is enough to apply the
 * rule and is the least personal data that answers the question.
 */
export function assessAge(birthYear: number, country: string, thisYear: number): AgeAssessment {
  const age = thisYear - birthYear;
  const consentAge = consentAgeFor(country);
  const isMinor = age < consentAge;
  return {
    age,
    consentAge,
    isMinor,
    coppa: age < COPPA_AGE,
    ageStatus: isMinor ? 'minor_pending_consent' : 'adult',
  };
}

/** The oldest and youngest years the picker offers. */
export const EARLIEST_BIRTH_YEAR = (thisYear: number) => thisYear - 100;
export const LATEST_BIRTH_YEAR = (thisYear: number) => thisYear - 4;
