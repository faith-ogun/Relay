// ── Live-bridge WebSocket URL ──
//
// The live tutor's socket and the live-bridge REST API are the SAME Cloud Run
// service, so the socket URL is derived from the REST base rather than kept as a
// second env var. That removes the failure this exists to prevent: a production
// build that silently fell back to ws://localhost:8082 because one VITE_* key
// was missing from .env, leaving the tutor dead behind a mixed-content block.
//
// Order: an explicit override, then the REST base (http -> ws), then localhost,
// and that last step ONLY in dev. A production build with neither configured
// throws at module load, which is loud and findable, instead of shipping a
// socket that can never connect.

const stripTrailingSlash = (value: string) => value.trim().replace(/\/+$/, '');

const toWebSocketScheme = (httpUrl: string) => httpUrl.replace(/^http(s?):\/\//i, (_m, s) => `ws${s}://`);

function resolve(): string {
  const explicit = stripTrailingSlash(import.meta.env.VITE_OHMLET_WS_URL || '');
  if (explicit) return explicit;

  const apiBase = stripTrailingSlash(import.meta.env.VITE_OHMLET_API_BASE_URL || '');
  if (apiBase) return toWebSocketScheme(apiBase);

  if (import.meta.env.DEV) return 'ws://localhost:8082';

  throw new Error(
    'Live tutor is not configured: set VITE_OHMLET_WS_URL or VITE_OHMLET_API_BASE_URL at build time.',
  );
}

/** The base ws(s):// origin of the live-bridge, with no trailing slash. */
export const liveBridgeWsUrl = (): string => resolve();
