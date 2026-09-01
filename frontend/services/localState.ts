// ── Per-user local state ──
//
// Anything remembered about a PERSON must be keyed by their uid. Ohmlet is used
// on shared devices by design (a family iPad, a classroom laptop), so a
// device-global key silently carries one account's answer into the next
// account's session. That already caused two real defects: the AI-safety
// acknowledgement was skipped for a user who had never seen it, and the age-gate
// answer was inherited across accounts.
//
// It also cleans up on sign-out and on account deletion, so a person's data does
// not outlive their session on a machine they borrowed.

/** Namespaced key for something remembered about one signed-in user. */
export const userKey = (name: string, uid: string | null | undefined): string =>
  `ohmlet.${name}.${uid || 'anon'}`;

/** Safe read: storage can be blocked (private mode, embedded webviews). */
export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the feature degrades, it never throws */
  }
}

export function removeLocal(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// Device-scoped keys that must NOT survive a sign-out, because they change what
// the next person sees. `ohmlet-view-as` in particular can otherwise lock the
// owner out of admin surfaces with no way to discover why.
const DEVICE_KEYS_TO_CLEAR = ['ohmlet-view-as'];

// Deliberately preserved across sign-out: a cookie/consent choice is a decision
// made by the DEVICE owner under law, not a per-account preference, and
// re-prompting on every sign-out would be worse for them.
const PRESERVE = new Set(['ohmlet.cookieConsent', 'ohmlet.navCollapsed']);

/**
 * Remove everything stored about `uid` on this device, plus the device-scoped
 * keys that should not leak into the next session. Called on sign-out and after
 * account deletion.
 */
export function clearUserState(uid: string | null | undefined): void {
  try {
    const suffix = `.${uid || 'anon'}`;
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || PRESERVE.has(key)) continue;
      if (key.startsWith('ohmlet.') && key.endsWith(suffix)) doomed.push(key);
    }
    [...doomed, ...DEVICE_KEYS_TO_CLEAR].forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* storage blocked: nothing to clear */
  }
}
