// Build library client: fetch from the backend, cache locally, work offline.
//
// The builds are not bundled into the app, for the reason set out in
// backend/live-bridge/app/builds.py: a parts list is what the camera kit check
// measures a learner's bench against, and a wrong part compiled into a binary
// takes an App Store review to correct. Served, a fix reaches the phone on the
// next launch.
//
// Cache-first, the same shape as services/curriculum.ts:
//
//   1. serve the cached copy immediately if there is one
//   2. ask the backend for the current version (a tiny request)
//   3. refetch only when the version actually changed
//
// Freshness is by ADDRESS. The version appears in BOTH the storage key and the
// request URL, so a content change is a guaranteed miss in both caches. That is
// not belt and braces: React Native's iOS NSURLSession answers a repeat GET out
// of NSURLCache for as long as the response allows, and the manifest endpoint
// sends `Cache-Control: private, max-age=86400`. A URL that does not change when
// the content does therefore returns yesterday's parts list for a day, however
// correctly the client decided to refetch. That cost a day once already on the
// lessons; it is not repeated here.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from './config';
import { getIdToken } from './firebase';

/** One build a learner can choose. Mirrors the served schema exactly. */
export interface Build {
  id: string;
  title: string;
  /** Beginner | Intermediate | Advanced, as authored. */
  level: string;
  /** Human estimate, e.g. "20 min". */
  est: string;
  /** The hardware this build targets, e.g. "Arduino + PIR". */
  mode: string;
  /** The build's identity colour, used for its mark and its rules. */
  color: string;
  /** Authored icon name (Zap, Camera, BrainCircuit...), drawn per client. */
  icon?: string;
  desc: string;
  /** What the kit check looks for on the bench. Never empty. */
  parts: string[];
}

export interface BuildCatalogue {
  version: string;
  builds: Build[];
}

const CATALOGUE_PREFIX = 'ohmlet.builds.catalogue.v1:';
const CATALOGUE_KEY = (version: string) => `${CATALOGUE_PREFIX}${version}`;

/** The build the learner last chose, so a returning learner is not asked again.
 *  Deliberately unversioned: it is the learner's choice, not content, and it is
 *  validated against the catalogue before it is used. */
const CHOSEN_KEY = 'ohmlet.builds.chosen.v1';

// One version poll stands for a minute: long enough that opening the picker
// twice costs one request, short enough that a correction lands in the session
// it was published.
const PROBE_TTL_MS = 60_000;
const PROBE_FAIL_TTL_MS = 10_000;
// The picker may not wait on the network longer than this before falling back to
// what is on the device.
const PROBE_TIMEOUT_MS = 3_000;

/**
 * `bust` goes in the URL, not a header, because the cache that matters here sits
 * below JavaScript and is keyed by the full URL. See the note at the top.
 */
async function authedGet<T>(path: string, bust: string, timeoutMs?: number): Promise<T | null> {
  if (!API_BASE) return null;
  const token = await getIdToken();
  if (!token) return null;

  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(`${API_BASE}${path}?v=${encodeURIComponent(bust)}`, {
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

/** A catalogue is only useful if it can answer a kit check, so a body with no
 *  builds, or a build with no parts, is treated as no answer at all. */
function usable(data: BuildCatalogue | null): data is BuildCatalogue {
  return Boolean(
    data?.version &&
      Array.isArray(data.builds) &&
      data.builds.length > 0 &&
      data.builds.every((b) => b?.id && b?.title && Array.isArray(b.parts) && b.parts.length > 0),
  );
}

let probe: { at: number; version: string | null } | null = null;
let probeInFlight: Promise<string | null> | null = null;

/**
 * The version the backend is serving right now, or null when it cannot be
 * reached. Memoised per session and de-duplicated across concurrent callers,
 * because the pre-flight screen and the picker can ask within the same second.
 */
async function remoteVersion(): Promise<string | null> {
  const ttl = probe?.version ? PROBE_TTL_MS : PROBE_FAIL_TTL_MS;
  if (probe && Date.now() - probe.at < ttl) return probe.version;
  if (!probeInFlight) {
    probeInFlight = (async () => {
      try {
        // The poll must never itself come from a cache: it is the thing that
        // tells us every other cache is out of date.
        const r = await authedGet<{ version: string }>(
          '/v1/builds/version', String(Date.now()), PROBE_TIMEOUT_MS,
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

/** Keep exactly one generation of the catalogue on the device. Runs once per
 *  version per session, after the backend has confirmed what the current version
 *  is, so it can never prune against a guess. */
async function sweep(version: string): Promise<void> {
  if (!version || sweptFor === version) return;
  sweptFor = version;
  try {
    const keys = await AsyncStorage.getAllKeys();
    const superseded = keys.filter(
      (k) => k.startsWith(CATALOGUE_PREFIX) && k !== CATALOGUE_KEY(version),
    );
    if (superseded.length) await AsyncStorage.multiRemove(superseded);
  } catch {
    // Housekeeping. A device that will not enumerate its keys still gets the
    // right catalogue; it just keeps an extra copy of the old one.
  }
}

/** Any copy still on the device, whatever version it came from. The last resort
 *  when there is no signal and no exact match. */
async function anyCached(): Promise<BuildCatalogue | null> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(CATALOGUE_PREFIX));
    for (const key of keys) {
      const found = await readCache<BuildCatalogue>(key);
      if (usable(found)) return found;
    }
  } catch {
    /* nothing readable on disk */
  }
  return null;
}

async function fetchCatalogue(bust: string): Promise<BuildCatalogue | null> {
  const fresh = await authedGet<BuildCatalogue>('/v1/builds/manifest', bust);
  if (!usable(fresh)) return null;
  // Keyed by the version the SERVER stamped on the body, never by the one we
  // asked for, so a key can never disagree with what is inside it.
  await writeCache(CATALOGUE_KEY(fresh.version), fresh);
  void sweep(fresh.version);
  return fresh;
}

/**
 * Every build a learner can choose.
 *
 * Returns the cached copy immediately when there is one and refreshes behind it,
 * so the picker opens instantly and offline. `onUpdate` fires only when a refresh
 * produced a different version, so a screen can re-render without blocking its
 * first paint on the network.
 */
export async function getBuilds(
  onUpdate?: (catalogue: BuildCatalogue) => void,
): Promise<BuildCatalogue | null> {
  const version = await remoteVersion();

  if (version) {
    const exact = await readCache<BuildCatalogue>(CATALOGUE_KEY(version));
    if (usable(exact)) {
      void sweep(version);
      return exact;
    }
  }

  const stale = await anyCached();

  // No signal. What is on the device is the best answer there is, and waiting on
  // a request that cannot succeed would hold the picker shut for the platform's
  // own timeout, which is a minute.
  if (!version) return stale;

  if (stale) {
    // Show the cached list now and swap it when the new one lands.
    void (async () => {
      const fresh = await fetchCatalogue(version);
      if (fresh) onUpdate?.(fresh);
    })();
    return stale;
  }

  return fetchCatalogue(version);
}

/** The build the learner chose last time, if it is still in the catalogue. A
 *  build that has been retired resolves to null rather than to a stale title. */
export async function rememberedBuild(catalogue: BuildCatalogue): Promise<Build | null> {
  const id = await readChosenId();
  return catalogue.builds.find((b) => b.id === id) ?? null;
}

async function readChosenId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CHOSEN_KEY);
  } catch {
    return null;
  }
}

/** Remember the learner's choice for the next session. */
export async function rememberBuild(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CHOSEN_KEY, id);
  } catch {
    /* the choice still holds for this session; it just is not remembered */
  }
}

/**
 * How a learner would say what they are building, for the opening turn of a live
 * session. Written in the first person on purpose: it is sent with `sendText`,
 * which shows it as the learner's own line in the transcript, and it is the
 * learner's action that produced it.
 */
export function buildIntro(build: Build): string {
  return (
    `I'm building the ${build.title} today (${build.mode}, about ${build.est}). ` +
    `The parts list is: ${build.parts.join(', ')}. Talk me through it.`
  );
}

/** The same, for a learner who changes their mind halfway through a session. */
export function buildSwitch(build: Build): string {
  return (
    `Change of plan: I want to build the ${build.title} instead. ` +
    `The parts are: ${build.parts.join(', ')}. Where do we start?`
  );
}
