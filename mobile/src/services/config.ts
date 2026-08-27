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

// Each service module owns its own readiness test, next to the calls that need
// it: `compilerConfigured` in compiler.ts, `verifierConfigured` in
// visionVerifier.ts, and `probeTwins` in twins.ts, which asks the reporter
// rather than trusting the URL. A second set of predicates lived here and
// nothing imported it, so the two could disagree about the same service and the
// copy nobody called was the one that looked authoritative.
