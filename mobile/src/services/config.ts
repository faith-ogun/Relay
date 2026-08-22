// Service endpoints. Mirrors frontend/services/liveBridgeUrl.ts: the WebSocket
// origin is DERIVED from the REST base rather than kept as a separate variable,
// because a missing variable is exactly how the web app shipped a production
// build pointing at ws://localhost:8082 and left the live tutor dead for
// everyone. One value, one failure mode.

const strip = (v: string) => v.trim().replace(/\/+$/, '');

export const API_BASE = strip(process.env.EXPO_PUBLIC_OHMLET_API_BASE_URL ?? '');
export const QUIZ_BASE = strip(process.env.EXPO_PUBLIC_OHMLET_QUIZ_API_BASE_URL ?? '');
export const VERIFIER_BASE = strip(process.env.EXPO_PUBLIC_OHMLET_VERIFIER_API_BASE_URL ?? '');
export const COMPILER_BASE = strip(process.env.EXPO_PUBLIC_OHMLET_COMPILER_API_BASE_URL ?? '');
export const REPORTER_BASE = strip(process.env.EXPO_PUBLIC_OHMLET_REPORTER_API_BASE_URL ?? '');

/** ws(s):// origin of the live-bridge, derived from the REST base. */
export function liveBridgeWsUrl(): string {
  if (!API_BASE) {
    throw new Error(
      'Live tutor is not configured: EXPO_PUBLIC_OHMLET_API_BASE_URL is missing.',
    );
  }
  return API_BASE.replace(/^http(s?):\/\//i, (_m, s) => `ws${s}://`);
}

/** A service is only "configured" if it has a URL; callers hide the feature otherwise. */
export const reporterConfigured = () => !!REPORTER_BASE;
export const verifierConfigured = () => !!VERIFIER_BASE;
export const compilerConfigured = () => !!COMPILER_BASE;
