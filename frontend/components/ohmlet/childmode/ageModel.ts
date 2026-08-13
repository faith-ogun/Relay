import { readLocal, userKey, writeLocal } from '../../../services/localState';

// ── Child mode: age + parental-consent domain model (task #94) ──
//
// Foundation for compliant minors' access. Full design + citations:
// metadata/decisions/2026-07-11_child-mode-design-and-compliance.md.
//
// Invariants encoded here:
//  - Neutral age assurance: we take a birth YEAR (data-minimised, not a full DOB)
//    and compute the applicable consent age PER COUNTRY, never a leading yes/no.
//  - Ireland's digital-consent age is 16 (DPA 2018 s.31); EU states range 13-16;
//    US COPPA treats under-13 specially. A "minor" is anyone below their country's
//    applicable consent age; under-13 additionally raises the COPPA overlay.
//  - The live tutor (camera/mic/AI) MUST stay gated server-side until a parent's
//    consent is verified. These types are the shared contract for that gate; the
//    values here are UI hints only — the real gate is a server custom claim.

/** Feature flag: child mode ships dark until configured + DPIA/solicitor sign-off. */
export const CHILD_MODE_ENABLED =
  String(import.meta.env?.VITE_OHMLET_CHILD_MODE ?? '').toLowerCase() === 'true';

/**
 * Digital age of consent by ISO-3166 alpha-2 (GDPR Art 8 member-state choice).
 * Unlisted countries fall back to DEFAULT_CONSENT_AGE (16, the safe EU ceiling).
 */
export const CONSENT_AGE_BY_COUNTRY: Record<string, number> = {
  IE: 16, DE: 16, NL: 16, LU: 16, HR: 16, LT: 16,
  AT: 14, BG: 14, CY: 14, IT: 14, ES: 14,
  CZ: 15, FR: 15, GR: 15, SI: 15,
  BE: 13, DK: 13, EE: 13, FI: 13, LV: 13, MT: 13, PT: 13, PL: 13, SE: 13, NO: 13,
  GB: 13, // UK: 13 for consent, but high-privacy defaults for all under-18
  US: 13, // COPPA threshold
};

export const DEFAULT_CONSENT_AGE = 16;
/** Below this age the strictest (COPPA-grade) child protections apply. */
export const COPPA_AGE = 13;
/** Child-specific protections stay on up to this age regardless of consent age (DPC Fundamental 8). */
export const CHILD_PROTECTION_AGE = 18;

export type AgeStatus =
  | 'adult' //                 >= applicable consent age; self-consents
  | 'minor_pending_consent' // < consent age; account inert until a parent verifies
  | 'minor_consented' //       parent verified; child-safe experience unlocked
  | 'blocked'; //              failed the gate (anti-retry / disallowed)

export type AccountType = 'adult' | 'child' | 'parent';

export type ConsentScope =
  | 'camera'
  | 'microphone'
  | 'voice_ai'
  | 'transcript_retention'
  | 'community_share';

export type ConsentMethod = 'kws' | 'stripe_setup_intent' | 'k_id' | 'email_plus';

export type ConsentStatus = 'requested' | 'verified' | 'revoked' | 'expired';

/** Append-only, admin-written. Stores a provider REFERENCE, never ID/biometric/card. */
export interface ParentalConsentRecord {
  id: string;
  method: ConsentMethod;
  status: ConsentStatus;
  providerRef: string; //      KWS consent id / Stripe SetupIntent id
  parentIdentifier: string; // hash of parent email or provider parent id (never plaintext)
  scope: ConsentScope[];
  jurisdiction: string; //     ISO country used to decide the rules
  createdAt: string; //        ISO
  expiresAt?: string | null; //re-consent cadence
  evidence?: string; //        audit token, never an ID image
}

/** Minimised age profile persisted on the user (birth YEAR only, never a full DOB). */
export interface AgeProfile {
  birthYear?: number;
  country?: string; //          ISO alpha-2, drives the applicable consent age
  consentAgeApplied?: number;
  ageStatus: AgeStatus;
  accountType: AccountType;
  isMinor: boolean;
  coppa: boolean; //            under-13, strictest tier
  liveAccessEnabled: boolean; //derived + server-enforced; mirrored for the UI
}

export const DEFAULT_AGE_PROFILE: AgeProfile = {
  ageStatus: 'adult',
  accountType: 'adult',
  isMinor: false,
  coppa: false,
  liveAccessEnabled: true,
};

export const consentAgeFor = (country?: string): number =>
  (country ? CONSENT_AGE_BY_COUNTRY[country.toUpperCase()] : undefined) ?? DEFAULT_CONSENT_AGE;

/**
 * Approximate age from birth year. Year granularity is enough for the threshold
 * and is deliberately data-minimising (we do not store the exact DOB). Uses the
 * conservative floor (assumes this year's birthday has not happened yet).
 */
export const ageFromBirthYear = (birthYear: number, now = new Date().getUTCFullYear()): number =>
  Math.max(0, now - birthYear);

export interface AgeAssessment {
  age: number;
  consentAge: number;
  isMinor: boolean;
  coppa: boolean;
  needsParentalConsent: boolean;
}

export function assessAge(birthYear: number, country?: string, nowYear?: number): AgeAssessment {
  const age = ageFromBirthYear(birthYear, nowYear);
  const consentAge = consentAgeFor(country);
  const isMinor = age < consentAge;
  return { age, consentAge, isMinor, coppa: age < COPPA_AGE, needsParentalConsent: isMinor };
}

/** The status a fresh sign-up lands in after the neutral gate. */
export function initialStatusFor(a: AgeAssessment): AgeStatus {
  return a.needsParentalConsent ? 'minor_pending_consent' : 'adult';
}

/**
 * Build the persisted profile from a neutral gate answer. Minors start with live
 * access OFF: the camera/mic/AI tutor stays gated (server-enforced) until a
 * parent's consent is verified.
 */
export function buildAgeProfile(birthYear: number, country: string): AgeProfile {
  const a = assessAge(birthYear, country);
  return {
    birthYear,
    country,
    consentAgeApplied: a.consentAge,
    ageStatus: initialStatusFor(a),
    accountType: a.isMinor ? 'child' : 'adult',
    isMinor: a.isMinor,
    coppa: a.coppa,
    liveAccessEnabled: !a.isMinor,
  };
}

// ── Anti-circumvention for the neutral DOB gate ──
// A rejected user must not be able to immediately re-enter a passing date. We
// persist the decision locally as friction; the SERVER flag (custom claim /
// Firestore) is the real gate. FTC + ICO both endorse this pattern.
// Keyed PER USER, never per device. Ohmlet is explicitly used on shared family
// and classroom machines, and a device-global key meant the next person to sign
// up silently inherited the previous person's answer: a child could be handed an
// adult's birth year (unlocking the front camera, the community and self-
// purchase), or an adult could inherit a child's and be trapped at the parental
// consent screen. The SERVER claim is still the real gate; this is friction.
const gateKey = (uid: string | null | undefined) => userKey('ageGate.v1', uid);

export interface AgeGateDecision {
  birthYear: number;
  country?: string;
  decidedAt: string;
  ageStatus: AgeStatus;
}

export function readAgeGateDecision(uid: string | null | undefined): AgeGateDecision | null {
  const raw = readLocal(gateKey(uid));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AgeGateDecision;
  } catch {
    return null;
  }
}

export function writeAgeGateDecision(uid: string | null | undefined, decision: AgeGateDecision): void {
  writeLocal(gateKey(uid), JSON.stringify(decision));
}
