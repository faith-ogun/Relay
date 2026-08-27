// ── Curriculum client: one corpus, both surfaces ───────────────────────────
//
// The lessons are authored in components/ohmlet/data, exported to JSON, and
// SERVED by the backend (backend/live-bridge/app/curriculum.py). Mobile has
// always read them from there. The web did not: it imported the authored data
// directly and rendered it, which is how the two surfaces ended up disagreeing
// about what the curriculum is. The backend served 284 learner-sized sessions;
// the web rendered the 142 uncut lessons those sessions were cut from, off the
// SAME progress record. A learner who finished "The Closed Loop II" on their
// phone recorded progress the web could not even represent.
//
// This file is the web's half of the contract mobile already keeps
// (mobile/src/services/curriculum.ts): manifest plus per-lesson fetch, keyed on
// the version stamp. Two things differ, both deliberate:
//
//   1. The web BUNDLES an offline copy (data/curriculum.ts). Mobile cannot, and
//      shows a spinner on a cold start with no signal. The web must not: the
//      path is the first thing a learner sees, so it paints from the bundle on
//      the first frame and the served corpus replaces it in place.
//
//   2. Because a bundled copy exists, it can go stale, and a stale copy of the
//      curriculum is worse than none: it silently contradicts the learner's
//      phone. So the bundle is not "preferred less" than the server, it is
//      ADDRESSED BY ITS VERSION. peekLessonContent answers from the bundle only
//      when the resolved version is BUNDLED_CURRICULUM_VERSION; at any other
//      version the bundle is not addressable at all and cannot be served by
//      accident. If the two stamps disagree, the server wins, always.
//
// Freshness is by ADDRESS, not by comparison, throughout. Every cached entry
// lives at a key containing the content version and every request carries the
// version in its URL, so a version change is a guaranteed miss with nothing to
// compare and nothing to get wrong. This is the same lesson mobile learned the
// hard way: the cut kept part one's ids, so one id addressed both the old
// 20-step lesson and the new 8-step session, and a stale manifest compared
// equal to a stale lesson and agreed with itself.

import { getIdToken } from './firebase';
import {
  BUNDLED_CURRICULUM_VERSION,
  SESSION_CURRICULUM,
  getCurriculumSnapshot,
  installCurriculum,
  installLessonContent,
  peekLessonContent,
  type CurriculumUnit,
} from '../components/ohmlet/data/curriculum';
import type { LessonEntry } from '../components/ohmlet/data/lessons';

export type { CurriculumUnit };

/** The learning path: units, skills and lesson ids, without the lesson bodies. */
export interface Manifest {
  version: string;
  units: CurriculumUnit[];
}

/** One lesson's steps, as the backend stamps them. */
export interface LessonContent {
  version: string;
  id: string;
  lesson: LessonEntry;
}

/**
 * What the last refresh established about the corpus on screen.
 *
 *   checking  a refresh is in flight; the bundled or cached path is on screen
 *   current   what is rendered is what the backend serves
 *   offline   the backend could not be reached, so the local copy stands. It
 *             may well be correct; we simply do not know that it is not
 *   stale     the backend answered with a DIFFERENT version and we could not
 *             fetch it. The learner's phone is showing a different path from
 *             this one, and that is worth telling them
 */
export type SyncPhase = 'checking' | 'current' | 'offline' | 'stale';

export interface SyncState {
  phase: SyncPhase;
  /** The version the backend reports, when it could be reached. */
  serverVersion: string | null;
}

// ── Storage ────────────────────────────────────────────────────────────────
//
// The pointer is the one fixed key: it has to be findable before the version is
// known, so a returning learner with no signal can restore the corpus they last
// saw rather than dropping back to the bundle.

const POINTER_KEY = 'ohmlet.curriculum.version.v1';
const MANIFEST_PREFIX = 'ohmlet.curriculum.manifest.v1:';
const LESSON_PREFIX = 'ohmlet.curriculum.lesson.v1:';

const manifestKey = (version: string) => `${MANIFEST_PREFIX}${version}`;
const lessonKey = (version: string, id: string) => `${LESSON_PREFIX}${version}:${id}`;

function readStore<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Unparseable, or storage blocked entirely (Safari private browsing). The
    // app works either way; it just refetches.
    return null;
  }
}

function writeStore(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Full or unavailable. Drop every superseded generation and try once more,
    // because the thing most likely filling the quota is the corpus we just
    // replaced.
    try {
      sweep(readStore<string>(POINTER_KEY) ?? BUNDLED_CURRICULUM_VERSION);
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* caching is an optimisation; the corpus is already installed in memory */
    }
  }
}

/**
 * Keep exactly one generation of cached curriculum.
 *
 * Putting the version in the key makes a content change a guaranteed miss,
 * which is the point, but it also means the superseded copy would sit in
 * storage forever. The bundled version is never cached (it is in the bundle),
 * so anything not stamped with `keep` is dead weight.
 */
function sweep(keep: string): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key === manifestKey(keep) || key.startsWith(`${LESSON_PREFIX}${keep}:`)) continue;
      if (key.startsWith(MANIFEST_PREFIX) || key.startsWith(LESSON_PREFIX)) doomed.push(key);
    }
    for (const key of doomed) localStorage.removeItem(key);
  } catch {
    /* housekeeping only: a browser that will not enumerate its keys still works */
  }
}

// ── Network ────────────────────────────────────────────────────────────────

const apiBase = (): string => (import.meta.env.VITE_OHMLET_API_BASE_URL || '').trim().replace(/\/+$/, '');

/** Long enough for a Cloud Run cold start, short enough not to hold a screen. */
const FETCH_TIMEOUT_MS = 10_000;
/**
 * The version poll sits in front of a path that is already painted, so it gets
 * a much shorter leash: three seconds and the local copy stands.
 */
const PROBE_TIMEOUT_MS = 3_000;
/** How long one version poll stands for. A content fix lands in the session it
 *  was published; opening six lessons costs one request rather than six. */
const PROBE_TTL_MS = 60_000;
/** Failures expire sooner, so signal returning is noticed quickly, but not so
 *  soon that a learner with none pays the timeout on every tap. */
const PROBE_FAIL_TTL_MS = 10_000;

/**
 * `v` goes in the URL rather than a header because the browser caches at the
 * HTTP layer too, and the lesson endpoint sends `Cache-Control: private,
 * max-age=86400`. A URL that does not change when the content changes returns
 * yesterday's bytes for a day no matter how correctly the client decided to
 * refetch. Addressing content by its version makes new content a new URL, and
 * lets the day of caching keep doing its job within a version.
 */
async function authedGet<T>(path: string, bust: string, timeoutMs: number): Promise<T | null> {
  const base = apiBase();
  if (!base) return null;
  const token = await getIdToken();
  if (!token) return null;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}?v=${encodeURIComponent(bust)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

let probe: { at: number; version: string | null } | null = null;
let probeInFlight: Promise<string | null> | null = null;

/**
 * The version the backend is serving right now, or null when it cannot be
 * reached. Memoised per session and de-duplicated across concurrent callers,
 * because the path and a lesson may both ask within the same second.
 *
 * The installed corpus cannot answer this question: for the whole of the first
 * session after a content change it still reports the previous version, and
 * that is exactly when a lesson is opened.
 */
async function serverVersion(): Promise<string | null> {
  const ttl = probe?.version ? PROBE_TTL_MS : PROBE_FAIL_TTL_MS;
  if (probe && Date.now() - probe.at < ttl) return probe.version;
  if (!probeInFlight) {
    probeInFlight = (async () => {
      try {
        // The poll itself must never come from a cache: it is the thing that
        // tells us every other cache is out of date.
        const res = await authedGet<{ version: string }>(
          '/v1/curriculum/version',
          String(Date.now()),
          PROBE_TIMEOUT_MS,
        );
        probe = { at: Date.now(), version: res?.version || null };
        return probe.version;
      } finally {
        probeInFlight = null;
      }
    })();
  }
  return probeInFlight;
}

// ── The corpus ─────────────────────────────────────────────────────────────

const isUnitArray = (value: unknown): value is CurriculumUnit[] =>
  Array.isArray(value) && value.length > 0 && value.every((u) => !!u && typeof u === 'object' && Array.isArray((u as CurriculumUnit).skills));

let restored = false;

/**
 * Install the newest corpus this BROWSER already holds, before any network.
 *
 * Without this a returning learner with no signal drops back to the bundled
 * corpus, which on a phone-first account is not the one they were using. Runs
 * once, synchronously, so it lands before the first paint.
 */
export function restoreCachedCurriculum(): void {
  if (restored) return;
  restored = true;
  const pointer = readStore<string>(POINTER_KEY);
  if (!pointer || pointer === BUNDLED_CURRICULUM_VERSION) return;
  const cached = readStore<Manifest>(manifestKey(pointer));
  if (cached?.version === pointer && isUnitArray(cached.units)) {
    installCurriculum(cached.units, cached.version, 'cache');
  }
}

/**
 * Bring the rendered corpus up to what the backend serves.
 *
 * Never blocks a paint: the caller already has a path on screen (bundled, or
 * the cached one restored above) and this replaces it if the backend disagrees.
 */
export async function refreshCurriculum(): Promise<SyncState> {
  restoreCachedCurriculum();

  const version = await serverVersion();
  if (!version) return { phase: 'offline', serverVersion: null };

  if (getCurriculumSnapshot().version === version) {
    sweep(version);
    return { phase: 'current', serverVersion: version };
  }

  // A copy of this exact version may already be on the device, from a previous
  // session or another tab.
  const cached = readStore<Manifest>(manifestKey(version));
  if (cached?.version === version && isUnitArray(cached.units)) {
    installCurriculum(cached.units, version, 'cache');
    writeStore(POINTER_KEY, version);
    sweep(version);
    return { phase: 'current', serverVersion: version };
  }

  const fresh = await authedGet<Manifest>('/v1/curriculum/manifest', version, FETCH_TIMEOUT_MS);
  if (!fresh?.version || !isUnitArray(fresh.units)) {
    // We KNOW the corpus on screen is not the one being served, and we could
    // not get the right one. That is a different thing from being offline, and
    // the caller is expected to say so.
    return { phase: 'stale', serverVersion: version };
  }

  installCurriculum(fresh.units, fresh.version, 'server');
  // Keyed by the version the SERVER stamped on the body, never the one we asked
  // for, so a key can never disagree with what is inside it.
  writeStore(manifestKey(fresh.version), fresh);
  writeStore(POINTER_KEY, fresh.version);
  sweep(fresh.version);
  return { phase: 'current', serverVersion: version };
}

/**
 * The path, cache-first. The bundled corpus (or a newer cached one) is already
 * installed and returned immediately; `onUpdate` fires only if the backend
 * turns out to be serving something different.
 */
export async function getManifest(onUpdate?: (m: Manifest) => void): Promise<Manifest> {
  restoreCachedCurriculum();
  const before = getCurriculumSnapshot();
  await refreshCurriculum();
  const after = getCurriculumSnapshot();
  const manifest: Manifest = { version: after.version, units: after.units };
  if (onUpdate && after.version !== before.version) onUpdate(manifest);
  return manifest;
}

const isLessonEntry = (value: unknown): value is LessonEntry => {
  if (!value || typeof value !== 'object') return false;
  const entry = value as { steps?: unknown; xpReward?: unknown };
  return Array.isArray(entry.steps) && entry.steps.length > 0 && typeof entry.xpReward === 'number';
};

/**
 * The body this client can serve for `id` WITHOUT touching the network, at the
 * version currently installed. Undefined means the lesson has to be fetched.
 *
 * Lets a lesson whose content is already in hand (the overwhelmingly common
 * case, since the bundled corpus answers whenever the stamps agree) open with
 * no loading state at all.
 */
export function peekLesson(id: string): LessonEntry | undefined {
  restoreCachedCurriculum();
  const { version } = getCurriculumSnapshot();
  const held = peekLessonContent(id, version);
  if (held) return held;
  const cached = readStore<LessonContent>(lessonKey(version, id));
  if (cached?.version === version && isLessonEntry(cached.lesson)) {
    installLessonContent(version, id, cached.lesson);
    return cached.lesson;
  }
  return undefined;
}

/**
 * One lesson's steps, at the version the backend is serving.
 *
 * Resolution order, and it is the order that matters: the version is confirmed
 * with the backend first (one small memoised request in front of a screen that
 * already has a loading state, abandoned after PROBE_TIMEOUT_MS), then the body
 * is looked up at THAT version, then fetched. A body stamped with any other
 * version is not a candidate, which is what makes serving stale content
 * impossible rather than merely unlikely.
 *
 * The exception is a client that cannot reach the backend at all. Then the
 * installed version is the best answer available, and a cached or bundled body
 * at that version beats an empty screen.
 */
export async function getLesson(id: string): Promise<LessonEntry | null> {
  // Establishes what version this client should be rendering, installing the
  // served corpus if it turns out to differ. After it, the snapshot's version
  // IS the version to look bodies up at.
  await refreshCurriculum();
  const { version } = getCurriculumSnapshot();

  const held = peekLesson(id);
  if (held) return held;

  const fresh = await authedGet<LessonContent>(
    // Ids are authored strings containing spaces, so they must be encoded.
    `/v1/curriculum/lessons/${encodeURIComponent(id)}`,
    version,
    FETCH_TIMEOUT_MS,
  );
  if (fresh?.version && isLessonEntry(fresh.lesson)) {
    // Stamped with the version the SERVER put on the body, never the one we
    // asked for, so a key can never disagree with what is inside it. That also
    // means a body can come back stamped NEWER than the path on screen, when
    // the manifest fetch failed but this one got through. It is still served:
    // it is the current authored content for this lesson, and the alternative
    // is teaching an older version of the same lesson on purpose. The path
    // catches up on the next refresh, and says it is behind until then.
    installLessonContent(fresh.version, id, fresh.lesson);
    writeStore(lessonKey(fresh.version, id), fresh);
    return fresh.lesson;
  }

  return null;
}

/**
 * Every lesson id the app will render, in path order. The web's half of the
 * parity contract checked by scripts/check-curriculum-parity.mjs.
 */
export function renderedLessonIds(): string[] {
  return getCurriculumSnapshot().units.flatMap((u) => u.skills.flatMap((s) => s.lessons.map((l) => l.id)));
}

/** The bundled corpus, for tooling that needs it without touching the store. */
export const bundledCurriculum = (): { version: string; units: CurriculumUnit[] } => ({
  version: BUNDLED_CURRICULUM_VERSION,
  units: SESSION_CURRICULUM,
});

export type { LessonEntry };
