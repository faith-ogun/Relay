// The curriculum cache must never serve content from an older version.
//
// This is the bug that shipped: lesson ids survived the split of 142 long
// lessons into 284 short sessions, so "The Closed Loop" addressed a 20-question
// lesson before the split and an 8-question one after it. Nothing about either
// address carried the version: the storage key was `...lesson.v1:${id}` and the
// URL was `/v1/curriculum/lessons/${id}`. Freshness rested entirely on comparing
// a stored version against the cached manifest's, and both copies were stale, so
// the comparison agreed with itself and the phone replayed the old lesson.
//
// The second half of the failure is invisible from JavaScript: the lesson
// endpoint answers with `Cache-Control: private, max-age=86400`, and React
// Native on iOS runs its NSURLSession on the default configuration, which serves
// a fresh-enough response straight out of NSURLCache. So even a client that
// correctly decided to refetch got yesterday's bytes back for a day.
//
// The harness below drives the real `src/services/curriculum.ts` against a fake
// AsyncStorage and a fake network that models both of those caches.
//
//   node scripts/check-curriculum-cache.mjs

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const SRC = new URL('../src/services/curriculum.ts', import.meta.url);
const API_BASE = 'https://api.test';

const OLD = 'e5996d6d2c3892c0';
const NEW = 'f16f67d8372135ef';
const LESSON_ID = 'The Closed Loop';
const LESSON_URL = `${API_BASE}/v1/curriculum/lessons/${encodeURIComponent(LESSON_ID)}`;

/** The manifest as the backend serves it, for a given version. */
const manifestFor = (version) => ({
  version,
  units: [{
    id: 'foundations',
    title: 'Foundations',
    subtitle: 'Where current comes from',
    level: 'beginner',
    accent: 'gold',
    skills: [{ id: 'loops', title: 'Loops', icon: 'Zap', lessons: [{ id: LESSON_ID, title: 'The Closed Loop', summary: 'A circuit is a loop.' }] }],
  }],
});

/** A lesson body, distinguishable by step count: 20 pre-split, 8 post-split. */
const lessonFor = (version, steps) => ({
  version,
  id: LESSON_ID,
  lesson: { steps: Array.from({ length: steps }, (_, i) => ({ type: 'choice', prompt: `q${i}` })), xpReward: 20 },
});

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    async getItem(k) { return map.has(k) ? map.get(k) : null; },
    async setItem(k, v) { map.set(k, v); },
    async removeItem(k) { map.delete(k); },
    async getAllKeys() { return [...map.keys()]; },
    async multiGet(keys) { return keys.map((k) => [k, map.has(k) ? map.get(k) : null]); },
    async multiSet(pairs) { for (const [k, v] of pairs) map.set(k, v); },
    async multiRemove(keys) { for (const k of keys) map.delete(k); },
  };
}

/**
 * A network that behaves the way the phone's does: it honours `Cache-Control`
 * on the way back, keyed by the full URL including its query string, exactly as
 * NSURLCache does.
 */
function makeNetwork({ version, steps, httpCache = new Map(), offline = false }) {
  const state = { version, steps, offline, httpCache, requests: [], served: [] };

  state.fetch = async (url) => {
    state.requests.push(url);
    const hit = state.httpCache.get(url);
    if (hit && hit.expires > Date.now()) {
      state.served.push(`cache ${url}`);
      return { ok: true, json: async () => JSON.parse(hit.body) };
    }
    if (state.offline) throw new TypeError('Network request failed');

    const path = url.split('?')[0].slice(API_BASE.length);
    let body;
    let maxAge = 0;
    if (path === '/v1/curriculum/version') body = { version: state.version };
    else if (path === '/v1/curriculum/manifest') body = manifestFor(state.version);
    else if (path === `/v1/curriculum/lessons/${encodeURIComponent(LESSON_ID)}`) {
      body = lessonFor(state.version, state.steps);
      maxAge = 86400;                       // what the deployed service sends
    } else return { ok: false, json: async () => ({}) };

    const raw = JSON.stringify(body);
    if (maxAge) state.httpCache.set(url, { body: raw, expires: Date.now() + maxAge * 1000 });
    state.served.push(`origin ${url}`);
    return { ok: true, json: async () => JSON.parse(raw) };
  };

  return state;
}

/** Load a fresh copy of the module, the way a relaunched app would. */
function loadModule({ storage, net }) {
  const js = ts.transpileModule(readFileSync(SRC, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;

  const stub = (id) => {
    if (id === '@react-native-async-storage/async-storage') return { __esModule: true, default: storage };
    if (id === './config') return { API_BASE };
    if (id === './firebase') return { getIdToken: async () => 'test-token' };
    throw new Error(`curriculum.ts imported something the harness does not stub: ${id}`);
  };

  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', 'fetch', js)(stub, mod, mod.exports, (u, o) => net.fetch(u, o));
  return mod.exports;
}

/** Let fire-and-forget refreshes and pruning settle. */
async function settle() {
  for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
}

const stepsOf = (content) => content?.lesson?.steps?.length ?? 0;

const failures = [];
async function scenario(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`  FAIL ${name}`);
    console.log(`       ${err.message.split('\n')[0]}`);
  }
}

// ---------------------------------------------------------------------------

console.log('curriculum cache');

// 1. The reported failure. The phone holds a stale manifest AND a stale lesson,
//    both stamped with the old version, and the HTTP cache still holds the old
//    body from when the lesson was last opened.
await scenario('a lesson opened with a stale manifest serves the current version', async () => {
  const httpCache = new Map([[LESSON_URL, { body: JSON.stringify(lessonFor(OLD, 20)), expires: Date.now() + 86400e3 }]]);
  const storage = makeStorage({
    'ohmlet.curriculum.manifest.v1': JSON.stringify(manifestFor(OLD)),
    [`ohmlet.curriculum.lesson.v1:${LESSON_ID}`]: JSON.stringify(lessonFor(OLD, 20)),
  });
  const net = makeNetwork({ version: NEW, steps: 8, httpCache });
  const { getLesson } = loadModule({ storage, net });

  const got = await getLesson(LESSON_ID);
  assert.equal(got?.version, NEW, `served version ${got?.version}, wanted ${NEW}`);
  assert.equal(stepsOf(got), 8, `served ${stepsOf(got)} questions, wanted 8`);
});

// 2. The HTTP cache on its own. The manifest is already current, so the version
//    comparison correctly asks for a refetch. The bytes must still be new ones.
await scenario('a refetch cannot be answered from the phone HTTP cache', async () => {
  const httpCache = new Map([[LESSON_URL, { body: JSON.stringify(lessonFor(OLD, 20)), expires: Date.now() + 86400e3 }]]);
  const storage = makeStorage({
    'ohmlet.curriculum.manifest.v1': JSON.stringify(manifestFor(NEW)),
    [`ohmlet.curriculum.lesson.v1:${LESSON_ID}`]: JSON.stringify(lessonFor(OLD, 20)),
  });
  const net = makeNetwork({ version: NEW, steps: 8, httpCache });
  const { getLesson } = loadModule({ storage, net });

  const got = await getLesson(LESSON_ID);
  assert.equal(stepsOf(got), 8, `served ${stepsOf(got)} questions from the HTTP cache, wanted 8`);
});

// 3. Offline replay, the reason any of this is cached at all.
await scenario('a lesson opened once replays with no network', async () => {
  const storage = makeStorage({ 'ohmlet.curriculum.manifest.v1': JSON.stringify(manifestFor(NEW)) });
  const net = makeNetwork({ version: NEW, steps: 8 });
  const { getLesson } = loadModule({ storage, net });

  assert.equal(stepsOf(await getLesson(LESSON_ID)), 8);
  await settle();

  // Relaunch with no signal at all, including no HTTP cache.
  const off = makeNetwork({ version: NEW, steps: 8, offline: true });
  const again = loadModule({ storage, net: off });
  const got = await again.getLesson(LESSON_ID);
  assert.equal(stepsOf(got), 8, 'a downloaded lesson did not replay offline');
});

// 4. Lessons downloaded under the pre-fix key scheme must not be orphaned if
//    they hold the current content, and must be pruned if they do not.
await scenario('pre-fix cache entries are adopted when current and pruned when not', async () => {
  const storage = makeStorage({
    'ohmlet.curriculum.manifest.v1': JSON.stringify(manifestFor(OLD)),
    [`ohmlet.curriculum.lesson.v1:${LESSON_ID}`]: JSON.stringify(lessonFor(NEW, 8)),
    'ohmlet.curriculum.lesson.v1:Voltage Basics': JSON.stringify(lessonFor(OLD, 20)),
  });
  const net = makeNetwork({ version: NEW, steps: 8 });
  const { getManifest } = loadModule({ storage, net });

  await getManifest();
  await settle();

  const keys = [...storage.map.keys()];
  assert.ok(
    keys.includes(`ohmlet.curriculum.lesson.v2:${NEW}:${LESSON_ID}`),
    `current content was not adopted into the versioned key: ${keys.join(', ')}`,
  );
  assert.ok(
    !keys.some((k) => k.startsWith('ohmlet.curriculum.lesson.v1:')),
    `stale pre-fix entries were left behind: ${keys.join(', ')}`,
  );

  // And the adopted copy plays with no network.
  const off = makeNetwork({ version: NEW, steps: 8, offline: true });
  const again = loadModule({ storage, net: off });
  assert.equal(stepsOf(await again.getLesson(LESSON_ID)), 8, 'the adopted copy did not replay offline');
});

// 5. Storage must not grow a copy per version forever.
await scenario('superseded versions are pruned from storage', async () => {
  const storage = makeStorage({ 'ohmlet.curriculum.manifest.v1': JSON.stringify(manifestFor(OLD)) });
  const net = makeNetwork({ version: OLD, steps: 20 });
  const { getLesson } = loadModule({ storage, net });
  await getLesson(LESSON_ID);
  await settle();

  net.version = NEW;
  net.steps = 8;
  net.httpCache.clear();
  const after = loadModule({ storage, net });
  assert.equal(stepsOf(await after.getLesson(LESSON_ID)), 8);
  await settle();

  const lessonKeys = [...storage.map.keys()].filter((k) => k.startsWith('ohmlet.curriculum.lesson.'));
  assert.equal(lessonKeys.length, 1, `kept ${lessonKeys.length} copies of one lesson: ${lessonKeys.join(', ')}`);
  assert.ok(lessonKeys[0].includes(NEW), `kept the superseded copy: ${lessonKeys[0]}`);
});

if (failures.length) {
  console.error(`\ncurriculum cache: ${failures.length} failing scenario(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('curriculum cache: every scenario passed.');
