// ── Cookie consent store (#37) ──
//
// The single source of truth for whether the user has accepted non-essential
// (analytics) cookies. Our Cookie Policy promises that non-essential cookies
// stay OFF until the user opts in, that rejecting is as easy as accepting, and
// that the choice can be changed later. This module enforces exactly that:
//
//   - Nothing here, and nothing that reads `analyticsAllowed()`, runs analytics
//     until a positive choice is stored. Essential cookies (auth, security) are
//     never gated and are not represented here.
//   - The choice persists in localStorage so the banner only asks once.
//   - Changing the choice (Footer "Cookie settings") re-opens the banner and
//     broadcasts a change event so listeners (Firebase Analytics init) react.

export interface CookieConsent {
  /** Has the user allowed analytics cookies? */
  analytics: boolean;
  /** When the choice was made (epoch ms) — useful for re-consent on policy changes. */
  decidedAt: number;
  /** Schema version, so a future policy change can invalidate stale choices. */
  version: number;
}

const STORAGE_KEY = 'ohmlet.cookieConsent';
const VERSION = 1;
const CHANGE_EVENT = 'ohmlet:cookie-consent-changed';
const OPEN_EVENT = 'ohmlet:cookie-settings-open';

function read(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsent>;
    if (!parsed || parsed.version !== VERSION || typeof parsed.analytics !== 'boolean') return null;
    return parsed as CookieConsent;
  } catch {
    // Corrupt value or storage blocked (private mode): treat as no decision.
    return null;
  }
}

/** The stored choice, or null if the user has not decided yet. */
export function getConsent(): CookieConsent | null {
  return read();
}

/** Has the user made any choice (so we can stop showing the banner)? */
export function hasDecided(): boolean {
  return read() !== null;
}

/** Whether analytics cookies are currently permitted. Defaults to false. */
export function analyticsAllowed(): boolean {
  return read()?.analytics === true;
}

/** Persist a choice and notify listeners (analytics init, the banner). */
export function setConsent(analytics: boolean): void {
  const value: CookieConsent = { analytics, decidedAt: Date.now(), version: VERSION };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // If storage is unavailable the choice can't persist; analytics then stays
    // off (the safe default) and the banner will ask again next load.
  }
  window.dispatchEvent(new CustomEvent<CookieConsent>(CHANGE_EVENT, { detail: value }));
}

/** Re-open the banner so the user can change a previous choice. */
export function openCookieSettings(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_EVENT));
}

/** Subscribe to consent changes. Returns an unsubscribe fn. */
export function onConsentChange(fn: (consent: CookieConsent) => void): () => void {
  const handler = (e: Event) => fn((e as CustomEvent<CookieConsent>).detail);
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

/** Subscribe to "re-open the banner" requests. Returns an unsubscribe fn. */
export function onOpenSettings(fn: () => void): () => void {
  window.addEventListener(OPEN_EVENT, fn);
  return () => window.removeEventListener(OPEN_EVENT, fn);
}
