#!/usr/bin/env node
// ── The bundled curriculum must never be served over the backend's ─────────
//
// The web ships an offline copy of the curriculum so the path paints on the
// first frame instead of waiting on the network. That copy can go stale, and a
// stale copy of the curriculum is worse than none: it silently contradicts the
// same learner's phone, which fetches the corpus live, while both surfaces
// write to ONE progress record.
//
// services/curriculum.ts is built so that cannot happen by accident. Content is
// addressed BY VERSION, never by id alone: the bundle answers only for
// BUNDLED_CURRICULUM_VERSION, and at any other version it is not addressable at
// all. This drives that module against a fake browser and a fake backend to
// prove the rule holds, the way mobile/scripts/check-curriculum-cache.mjs does
// for the phone. It is the same bug class, in the other client.
//
//   node frontend/scripts/check-curriculum-parity.mjs   ids match the backend
//   node frontend/scripts/check-curriculum-fallback.mjs the stale copy loses
//
// The module is TypeScript and reads `import.meta.env`, which CommonJS has no
// equivalent of, so the source is rewritten to read a harness-supplied object
// before it is transpiled. Nothing else about it is stubbed: the caching,
// sweeping and resolution logic under test is the deployed code.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'services/curriculum.ts');
const API_BASE = 'https://api.test';

/** A localStorage that behaves like the real one, including the quota error. */
function makeStorage(initial = {}, quota = Infinity) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem(k, v) {
      if (map.size >= quota && !map.has(k)) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      map.set(k, v);
    },
    removeItem: (k) => map.delete(k),
  };
}

/** A backend serving one version, optionally unreachable. */
function makeNetwork({ version, units, lesson, offline = false, lessonsDown = false, manifestDown = false }) {
  const state = { version, units, lesson, offline, lessonsDown, manifestDown, requests: [] };
  state.fetch = async (url) => {
    state.requests.push(url);
    if (state.offline) throw new TypeError('Failed to fetch');
    const route = url.split('?')[0].slice(API_BASE.length);
    if (route === '/v1/curriculum/version') return ok({ version: state.version });
    if (route === '/v1/curriculum/manifest') {
      return state.manifestDown ? { ok: false, json: async () => ({}) } : ok({ version: state.version, units: state.units });
    }
    if (route.startsWith('/v1/curriculum/lessons/')) {
      if (state.lessonsDown) return { ok: false, json: async () => ({}) };
      const id = decodeURIComponent(route.slice('/v1/curriculum/lessons/'.length));
      return ok({ version: state.version, id, lesson: state.lesson(id) });
    }
    return { ok: false, json: async () => ({}) };
  };
  const ok = (body) => ({ ok: true, json: async () => body });
  return state;
}

/**
 * Load a fresh copy of services/curriculum.ts, the way a page load would, with
 * the data module it imports supplied by Vite so the REAL bundled corpus is
 * under test rather than a fixture of it.
 */
function loadModule({ storage, net, dataModules }) {
  const source = readFileSync(SRC, 'utf8').replaceAll('import.meta.env', '__ENV__');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;

  const stub = (id) => {
    if (id === './firebase') return { getIdToken: async () => 'test-token' };
    if (id.endsWith('data/curriculum')) return dataModules.curriculum;
    if (id.endsWith('data/lessons')) return dataModules.lessons;
    throw new Error(`services/curriculum.ts imported something the harness does not stub: ${id}`);
  };

  const mod = { exports: {} };
  const fn = new Function(
    'require', 'module', 'exports', 'fetch', 'localStorage', 'window', '__ENV__',
    js,
  );
  fn(
    stub, mod, mod.exports,
    (u, o) => net.fetch(u, o),
    storage,
    { setTimeout: () => 0, clearTimeout: () => {} },
    { VITE_OHMLET_API_BASE_URL: API_BASE },
  );
  return mod.exports;
}

const failures = [];
async function scenario(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`  FAIL ${name}`);
    console.log(`       ${String(err.message).split('\n')[0]}`);
  }
}

const lessonIds = (units) => units.flatMap((u) => u.skills.flatMap((s) => s.lessons.map((l) => l.id)));

async function main() {
  const server = await createServer({
    root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error',
    optimizeDeps: { noDiscovery: true },
  });

  // A FRESH copy of the data modules per scenario: they hold the installed
  // corpus in module state, exactly as a page load would.
  const freshData = async () => {
    server.moduleGraph.invalidateAll();
    const [curriculum, lessons] = await Promise.all([
      server.ssrLoadModule('/components/ohmlet/data/curriculum.ts', { fixStacktrace: false }),
      server.ssrLoadModule('/components/ohmlet/data/lessons.ts', { fixStacktrace: false }),
    ]);
    return { curriculum, lessons };
  };

  const base = await freshData();
  const BUNDLED = base.curriculum.BUNDLED_CURRICULUM_VERSION;
  const NEWER = 'ffffffffffffffff';
  const BUNDLED_IDS = lessonIds(base.curriculum.SESSION_CURRICULUM);
  const SAMPLE = BUNDLED_IDS[0];

  /** A served corpus that is deliberately NOT the bundled one. */
  const newerUnits = [{
    id: 'foundations', title: 'Foundations', subtitle: 'Where current comes from',
    level: 'beginner', accent: 'gold',
    skills: [{
      id: 'loops', title: 'Loops', description: 'Loops', icon: 'Zap',
      lessons: [{ id: SAMPLE, title: 'The Closed Loop I', summary: 'A circuit is a loop.', estMinutes: 5 },
                { id: 'A Brand New Session', title: 'A Brand New Session', summary: 'Published after this build shipped.', estMinutes: 5 }],
    }],
  }];
  const newerLesson = (id) => ({
    steps: [{ type: 'true_false', statement: `${id} at ${NEWER}`, correct: true, explanation: 'x' }],
    xpReward: 10,
  });

  console.log('\ncurriculum fallback\n');

  await scenario('the path paints from the bundle before any network answers', async () => {
    const dataModules = await freshData();
    const storage = makeStorage();
    const net = makeNetwork({ version: NEWER, units: newerUnits, lesson: newerLesson });
    loadModule({ storage, net, dataModules });
    const snapshot = dataModules.curriculum.getCurriculumSnapshot();
    assert.equal(snapshot.source, 'bundled');
    assert.equal(snapshot.version, BUNDLED);
    assert.equal(net.requests.length, 0, 'importing the service hit the network');
  });

  await scenario('a backend on a newer version replaces the bundled path', async () => {
    const dataModules = await freshData();
    const net = makeNetwork({ version: NEWER, units: newerUnits, lesson: newerLesson });
    const mod = loadModule({ storage: makeStorage(), net, dataModules });

    const state = await mod.refreshCurriculum();
    assert.equal(state.phase, 'current');
    const snapshot = dataModules.curriculum.getCurriculumSnapshot();
    assert.equal(snapshot.version, NEWER, `rendered version ${snapshot.version}`);
    assert.deepEqual(lessonIds(snapshot.units), [SAMPLE, 'A Brand New Session']);
  });

  await scenario('a lesson whose id survived the version bump serves the NEW body', async () => {
    const dataModules = await freshData();
    const net = makeNetwork({ version: NEWER, units: newerUnits, lesson: newerLesson });
    const mod = loadModule({ storage: makeStorage(), net, dataModules });

    // SAMPLE exists in the bundle too. The bundled body must not be reachable
    // at the served version, however convenient it would be to answer with it.
    const body = await mod.getLesson(SAMPLE);
    assert.ok(body, 'no body served');
    assert.equal(body.steps.length, 1, `served ${body.steps.length} steps: the BUNDLED body`);
    assert.equal(body.steps[0].statement, `${SAMPLE} at ${NEWER}`);
  });

  await scenario('a lesson published after this build ships is fetched, not 404ed locally', async () => {
    const dataModules = await freshData();
    const net = makeNetwork({ version: NEWER, units: newerUnits, lesson: newerLesson });
    const mod = loadModule({ storage: makeStorage(), net, dataModules });
    const body = await mod.getLesson('A Brand New Session');
    assert.ok(body, 'a lesson only the backend knows about could not be opened');
  });

  await scenario('offline, the bundle still teaches every lesson it holds', async () => {
    const dataModules = await freshData();
    const net = makeNetwork({ version: BUNDLED, units: [], lesson: newerLesson, offline: true });
    const mod = loadModule({ storage: makeStorage(), net, dataModules });

    const state = await mod.refreshCurriculum();
    assert.equal(state.phase, 'offline');
    assert.equal(dataModules.curriculum.getCurriculumSnapshot().version, BUNDLED);
    const body = await mod.getLesson(SAMPLE);
    assert.ok(body && body.steps.length > 1, 'the bundled body did not open offline');
  });

  await scenario('a known-newer corpus we cannot fetch reports stale, never silence', async () => {
    const dataModules = await freshData();
    const net = makeNetwork({ version: NEWER, units: newerUnits, lesson: newerLesson, manifestDown: true });
    const mod = loadModule({ storage: makeStorage(), net, dataModules });

    const state = await mod.refreshCurriculum();
    assert.equal(state.phase, 'stale', `reported ${state.phase}`);
    assert.equal(state.serverVersion, NEWER);
  });

  await scenario('a fetched corpus survives a reload with no network', async () => {
    const storage = makeStorage();
    const first = await freshData();
    const online = makeNetwork({ version: NEWER, units: newerUnits, lesson: newerLesson });
    const mod = loadModule({ storage, net: online, dataModules: first });
    await mod.refreshCurriculum();
    await mod.getLesson('A Brand New Session');

    // Reload: fresh module state, same browser storage, no signal at all.
    const second = await freshData();
    const offline = makeNetwork({ version: NEWER, units: newerUnits, lesson: newerLesson, offline: true });
    const again = loadModule({ storage, net: offline, dataModules: second });
    again.restoreCachedCurriculum();
    const snapshot = second.curriculum.getCurriculumSnapshot();
    assert.equal(snapshot.version, NEWER, 'a reload dropped back to the bundled corpus');
    const body = await again.getLesson('A Brand New Session');
    assert.ok(body, 'a downloaded lesson did not replay offline');
  });

  await scenario('superseded generations are swept from storage', async () => {
    const storage = makeStorage();
    const first = await freshData();
    const older = makeNetwork({ version: 'aaaaaaaaaaaaaaaa', units: newerUnits, lesson: newerLesson });
    const a = loadModule({ storage, net: older, dataModules: first });
    await a.refreshCurriculum();
    await a.getLesson('A Brand New Session');

    const second = await freshData();
    const newer = makeNetwork({ version: NEWER, units: newerUnits, lesson: newerLesson });
    const b = loadModule({ storage, net: newer, dataModules: second });
    await b.refreshCurriculum();
    await b.getLesson('A Brand New Session');

    const stale = [...storage.map.keys()].filter((k) => k.includes('aaaaaaaaaaaaaaaa'));
    assert.deepEqual(stale, [], `kept a superseded generation: ${stale.join(', ')}`);
  });

  await scenario('a browser that refuses to store still renders the served corpus', async () => {
    const dataModules = await freshData();
    const storage = makeStorage({}, 0);            // every write throws
    const net = makeNetwork({ version: NEWER, units: newerUnits, lesson: newerLesson });
    const mod = loadModule({ storage, net, dataModules });

    const state = await mod.refreshCurriculum();
    assert.equal(state.phase, 'current');
    assert.equal(dataModules.curriculum.getCurriculumSnapshot().version, NEWER);
    assert.ok(await mod.getLesson('A Brand New Session'), 'a lesson could not be opened without storage');
  });

  await server.close();

  if (failures.length) {
    console.error(`\ncurriculum fallback: ${failures.length} failing scenario(s)`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log('\ncurriculum fallback: every scenario passed.\n');
}

main().catch((err) => {
  console.error('curriculum fallback: harness failed to run:', err);
  process.exit(2);
});
