// ── Addressing the published lesson artwork ──
//
// Deliberately free of React and of every native module, so scripts/
// check-step-renderers.mjs can transpile this file and run the real functions
// rather than pattern-matching the source of them. The rendering side lives in
// componentArt.tsx.
//
// See componentArt.tsx for WHY the art is fetched rather than bundled, and why
// the content version is part of the address.

const DEFAULT_ORIGIN = 'https://ohmlet-app.web.app';

/**
 * Where the published component photographs live. Deliberately not derived from
 * API_BASE: the art is Firebase Hosting's, not the live-bridge's, and the two
 * move independently. It is the same origin the backend rewrites achievement
 * art to, in `_absolute_art` in backend/live-bridge/app/curriculum.py.
 */
export const ASSET_ORIGIN = (process.env.EXPO_PUBLIC_OHMLET_ASSET_ORIGIN ?? DEFAULT_ORIGIN)
  .trim()
  .replace(/\/+$/, '');

/** Authored asset paths are root relative and name a real image file. */
const ASSET_PATH = /^\/[\w./-]+\.(png|jpe?g|webp|gif)$/i;

/** True when an authored value is a path this module knows how to fetch. */
export const isComponentImagePath = (value: unknown): value is string =>
  typeof value === 'string' && ASSET_PATH.test(value.trim());

/**
 * The absolute, version-addressed URL for an authored asset path, or null when
 * the path is not one.
 *
 * The version is in the query string because the URL is the cache key at three
 * layers that cannot see each other: expo-image's disk cache, the phone's own
 * HTTP cache, and the CDN. `version` may be null when the device has never seen
 * a manifest, in which case the bare URL is used rather than no picture at all.
 */
export function componentImageUrl(path: unknown, version: string | null): string | null {
  if (!isComponentImagePath(path)) return null;
  const clean = path.trim();
  return version
    ? `${ASSET_ORIGIN}${clean}?v=${encodeURIComponent(version)}`
    : `${ASSET_ORIGIN}${clean}`;
}
