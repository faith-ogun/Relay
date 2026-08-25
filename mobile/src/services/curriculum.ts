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

const MANIFEST_KEY = 'ohmlet.curriculum.manifest.v1';
const LESSON_KEY = (id: string) => `ohmlet.curriculum.lesson.v1:${id}`;

async function authedGet<T>(path: string): Promise<T | null> {
  if (!API_BASE) return null;
  const token = await getIdToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
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

/**
 * The learning path. Returns the cached copy immediately when present, and
 * refreshes in the background only if the backend reports a newer version.
 *
 * `onUpdate` fires if a refresh produced different content, so a screen can
 * re-render without blocking its first paint on the network.
 */
export async function getManifest(onUpdate?: (m: Manifest) => void): Promise<Manifest | null> {
  const cached = await readCache<Manifest>(MANIFEST_KEY);

  const refresh = async () => {
    const remoteVersion = await authedGet<{ version: string }>('/v1/curriculum/version');
    if (!remoteVersion) return;                              // offline: keep the cache
    if (cached && cached.version === remoteVersion.version) return;  // already current

    const fresh = await authedGet<Manifest>('/v1/curriculum/manifest');
    if (!fresh) return;
    await writeCache(MANIFEST_KEY, fresh);
    onUpdate?.(fresh);
  };

  if (cached) {
    void refresh();      // fire and forget: never block the first paint
    return cached;
  }
  // Cold start with no cache: we have to wait for the network.
  const fresh = await authedGet<Manifest>('/v1/curriculum/manifest');
  if (fresh) await writeCache(MANIFEST_KEY, fresh);
  return fresh;
}

export interface LessonContent {
  version: string;
  id: string;
  lesson: { steps: unknown[]; xpReward: number; [k: string]: unknown };
}

/** The content version this device last saw, from the cached manifest. */
async function knownVersion(): Promise<string | undefined> {
  const m = await readCache<Manifest>(MANIFEST_KEY);
  return m?.version;
}

/**
 * One lesson's steps. Cached per lesson and invalidated by version, so a
 * previously-opened lesson replays offline.
 *
 * The version defaults to the cached manifest's, which is the fix for a cache
 * that could never expire: the only caller passed nothing, and `!currentVersion`
 * then short-circuited the comparison, so ANY cached lesson was returned forever.
 * Splitting the curriculum into shorter sessions changed every lesson on the
 * server and not one of them on a device that had already opened it.
 */
export async function getLesson(id: string, currentVersion?: string): Promise<LessonContent | null> {
  const key = LESSON_KEY(id);
  const cached = await readCache<LessonContent>(key);
  const version = currentVersion ?? (await knownVersion());
  if (cached && version && cached.version === version) return cached;
  if (cached && !version) return cached;   // no manifest yet: stale beats nothing

  // Ids are authored strings that contain spaces, so they must be encoded.
  const fresh = await authedGet<LessonContent>(`/v1/curriculum/lessons/${encodeURIComponent(id)}`);
  if (fresh) {
    await writeCache(key, fresh);
    return fresh;
  }
  // Network failed: a stale cached copy beats nothing.
  return cached;
}

/** Flatten the path into lesson order, the same way the web app does. */
export function allLessons(m: Manifest): CurriculumLesson[] {
  return m.units.flatMap((u) => u.skills.flatMap((s) => s.lessons));
}
