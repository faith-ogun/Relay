// Curriculum client: fetch from the backend, cache locally, work offline.
//
// The lessons are no longer bundled into the app — they come from the backend so
// a content fix ships instantly instead of waiting on App Store review. That
// trade only works if the app still functions on a train with no signal, so
// everything here is cache-first:
//
//   1. serve the cached copy immediately if there is one
//   2. ask the backend for the current version (a tiny request)
//   3. refetch only when the version actually changed
//
// A learner therefore sees content instantly, offline works, and a corrected
// lesson still reaches them on the next launch with a connection.
//
// Freshness is by ADDRESS, not by comparison. Every cached lesson lives at a
// key that contains the content version, and every request carries the version
// in its URL. A version change is therefore a guaranteed miss in both caches,
// with nothing to compare and nothing to get wrong. The previous design stored
// lessons at `...lesson.v1:${id}` and compared the stored version against the
// cached manifest's; splitting 142 long lessons into 284 short sessions kept the
// lesson ids, so the same key held both the old and the new "The Closed Loop",
// and a stale manifest compared equal to a stale lesson and agreed with itself.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from './config';
import { getIdToken } from './firebase';

export type CurriculumLevel = 'beginner' | 'intermediate' | 'advanced';
export type CurriculumAccent = 'gold' | 'blue' | 'green' | 'red';

export interface CurriculumLesson {
  id: string;
  title: string;
  summary: string;
}

export interface CurriculumSkill {
  id: string;
  title: string;
  /** Authored icon name (Zap, Gauge, Trophy...). The curriculum's own
   *  human-chosen variety, and what the path uses to tell one stretch from
   *  the next. */
  icon?: string;
  lessons: CurriculumLesson[];
}

export interface CurriculumUnit {
  id: string;
  title: string;
  subtitle: string;
  level: CurriculumLevel;
  accent: CurriculumAccent;
  skills: CurriculumSkill[];
}

export interface Manifest {
  version: string;
  units: CurriculumUnit[];
}

export interface LessonContent {
  version: string;
  id: string;
  lesson: { steps: unknown[]; xpReward: number; [k: string]: unknown };
}

// The manifest stays at a fixed key because it is the thing that reports the
// version: it has to be findable before the version is known.
const MANIFEST_KEY = 'ohmlet.curriculum.manifest.v1';

const LESSON_PREFIX = 'ohmlet.curriculum.lesson.v2:';
const LESSON_KEY = (version: string, id: string) => `${LESSON_PREFIX}${version}:${id}`;

// Where lessons lived before the version moved into the key. Entries here are
// adopted if they hold the current content and removed once swept, so upgrading
// does not silently throw away a lesson someone downloaded for a journey.
const LEGACY_LESSON_PREFIX = 'ohmlet.curriculum.lesson.v1:';

// How long one version poll stands for. A minute is short enough that a content
// fix lands in the session it was published, and long enough that opening six
// lessons in a row costs one request rather than six.
const PROBE_TTL_MS = 60_000;
// Failures expire sooner, so signal coming back is noticed quickly, but not so
// soon that a learner with no signal pays the timeout on every single tap.
const PROBE_FAIL_TTL_MS = 10_000;
// A lesson screen may not wait on the network longer than this before falling
// back to what is on the device. Without a deadline an unreachable backend
// leaves the loading spinner up for the platform default, which is a minute.
const PROBE_TIMEOUT_MS = 3_000;

/**
 * `bust` goes in the URL rather than a header because the phone caches at the
 * HTTP layer as well, and that layer is invisible from JavaScript. React Native
 * runs its iOS NSURLSession on the default configuration, which answers a repeat
 * GET out of NSURLCache for as long as the response allows; the lesson endpoint
 * sends `Cache-Control: private, max-age=86400`. A URL that does not change when
 * the content changes therefore returns yesterday's bytes for a day, no matter
 * how correctly the client decided to refetch. Addressing content by its version
 * makes new content a new URL, and lets the 24 hour caching keep doing its job
 * within a version.
 */
async function authedGet<T>(path: string, bust: string, timeoutMs?: number): Promise<T | null> {
  if (!API_BASE) return null;
  const token = await getIdToken();
  if (!token) return null;

  const url = `${API_BASE}${path}?v=${encodeURIComponent(bust)}`;
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    return parse<T>(await AsyncStorage.getItem(key));
  } catch {
    return null;
  }
}

async function writeCache(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable: the app still works, it just refetches */
  }
}

/** The content version this device last saw, from the cached manifest. */
async function knownVersion(): Promise<string | undefined> {
  const m = await readCache<Manifest>(MANIFEST_KEY);
  return m?.version;
}

let probe: { at: number; version: string | null } | null = null;
let probeInFlight: Promise<string | null> | null = null;

/**
 * The version the backend is serving right now, or null when it cannot be
 * reached. Memoised per session and de-duplicated across concurrent callers,
 * because several screens ask within the same second.
 *
 * The cached manifest cannot answer this question. `getManifest` hands back the
 * cached copy and refreshes behind it, so for the whole of the first session
 * after a content change the manifest still reports the previous version. That
 * is exactly when a lesson is opened, and exactly why comparing against it
 * served the pre-split lesson.
 */
async function remoteVersion(): Promise<string | null> {
  const ttl = probe?.version ? PROBE_TTL_MS : PROBE_FAIL_TTL_MS;
  if (probe && Date.now() - probe.at < ttl) return probe.version;
  if (!probeInFlight) {
    probeInFlight = (async () => {
      try {
        // The poll itself must never come from a cache: it is the thing that
        // tells us every other cache is out of date.
        const r = await authedGet<{ version: string }>(
          '/v1/curriculum/version', String(Date.now()), PROBE_TIMEOUT_MS,
        );
        probe = { at: Date.now(), version: r?.version ?? null };
        return probe.version;
      } finally {
        probeInFlight = null;
      }
    })();
  }
  return probeInFlight;
}

let sweptFor: string | null = null;

/**
 * Keep exactly one generation of lesson content on the device.
 *
 * Putting the version in the key makes a content change a guaranteed miss, which
 * is the point, but it also means the superseded copy would sit there forever.
 * This runs once per version per session, after the backend has confirmed what
 * the current version is, so it can never prune against a guess.
 */
async function sweep(version: string): Promise<void> {
  if (!version || sweptFor === version) return;
  sweptFor = version;
  try {
    const keys = await AsyncStorage.getAllKeys();
    const legacy = keys.filter((k) => k.startsWith(LEGACY_LESSON_PREFIX));
    const superseded = keys.filter(
      (k) => k.startsWith(LESSON_PREFIX) && !k.startsWith(`${LESSON_PREFIX}${version}:`),
    );
    if (!legacy.length && !superseded.length) return;

    // A legacy entry is worth keeping only if its body says it is the current
    // content. Adopting it here is what stops this upgrade from wiping the
    // lessons someone downloaded before a flight.
    if (legacy.length) {
      const rows = await AsyncStorage.multiGet(legacy);
      const adopt: Array<[string, string]> = [];
      for (const [key, raw] of rows) {
        const body = parse<LessonContent>(raw);
        if (raw && body?.version === version) {
          adopt.push([LESSON_KEY(version, key.slice(LEGACY_LESSON_PREFIX.length)), raw]);
        }
      }
      if (adopt.length) await AsyncStorage.multiSet(adopt);
    }

    await AsyncStorage.multiRemove([...legacy, ...superseded]);
  } catch {
    // Housekeeping. A device that will not enumerate its keys still gets the
    // right lesson; it just keeps an extra copy of the old one.
  }
}

/**
 * The learning path. Returns the cached copy immediately when present, and
 * refreshes in the background only if the backend reports a newer version.
 *
 * `onUpdate` fires if a refresh produced different content, so a screen can
 * re-render without blocking its first paint on the network.
 */
export async function getManifest(onUpdate?: (m: Manifest) => void): Promise<Manifest | null> {
  const cached = await readCache<Manifest>(MANIFEST_KEY);

  const fetchManifest = async (version: string | null): Promise<Manifest | null> => {
    const fresh = await authedGet<Manifest>(
      '/v1/curriculum/manifest', version ?? String(Date.now()),
    );
    if (!fresh) return null;
    await writeCache(MANIFEST_KEY, fresh);
    void sweep(fresh.version);
    return fresh;
  };

  if (cached) {
    void (async () => {
      const version = await remoteVersion();
      if (!version) return;                             // offline: keep the cache
      // Even when the manifest itself has not moved, the device may still be
      // holding lesson bodies from a version before it.
      void sweep(version);
      if (cached.version === version) return;
      const fresh = await fetchManifest(version);
      if (fresh) onUpdate?.(fresh);
    })();
    return cached;
  }

  // Cold start with no cache: we have to wait for the network.
  return fetchManifest(await remoteVersion());
}

/** Any copy of this lesson still on the device, whatever version it came from. */
async function anyCached(id: string): Promise<LessonContent | null> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => {
      if (k === `${LEGACY_LESSON_PREFIX}${id}`) return true;
      if (!k.startsWith(LESSON_PREFIX)) return false;
      const rest = k.slice(LESSON_PREFIX.length);
      const cut = rest.indexOf(':');                    // version segments never contain one
      return cut >= 0 && rest.slice(cut + 1) === id;
    });
    for (const key of mine) {
      const found = await readCache<LessonContent>(key);
      if (found) return found;
    }
  } catch {
    /* fall through: nothing readable on disk */
  }
  return null;
}

/**
 * One lesson's steps, cached per version so a previously-opened lesson replays
 * offline and a corrected one can never be served from yesterday's copy.
 *
 * The version is confirmed with the backend first. That is one small request in
 * front of a screen that already shows a loading state, it is memoised for a
 * minute, and it gives up after PROBE_TIMEOUT_MS, so a lesson opened with no
 * signal still comes straight off the device.
 */
export async function getLesson(id: string): Promise<LessonContent | null> {
  const version = (await remoteVersion()) ?? (await knownVersion()) ?? null;

  if (version) {
    const exact = await readCache<LessonContent>(LESSON_KEY(version, id));
    if (exact) return exact;
  }

  // Ids are authored strings that contain spaces, so they must be encoded.
  const fresh = await authedGet<LessonContent>(
    `/v1/curriculum/lessons/${encodeURIComponent(id)}`, version ?? String(Date.now()),
  );
  if (fresh) {
    // Keyed by the version the SERVER stamped on the body, never by the one we
    // asked for, so a key can never disagree with what is inside it.
    await writeCache(LESSON_KEY(fresh.version, id), fresh);
    void sweep(fresh.version);
    return fresh;
  }

  // Network failed: a cached copy, of whatever vintage, beats an empty screen.
  return anyCached(id);
}

/** Flatten the path into lesson order, the same way the web app does. */
export function allLessons(m: Manifest): CurriculumLesson[] {
  return m.units.flatMap((u) => u.skills.flatMap((s) => s.lessons));
}
