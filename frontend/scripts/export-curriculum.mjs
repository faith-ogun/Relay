// Export the authored curriculum to JSON so the BACKEND can serve it.
//
// Why: on mobile a lesson fix would otherwise need an App Store review — days
// to correct a typo. Serving the curriculum means content ships instantly to
// both surfaces, and keeps the authored lessons (the moat) out of any client
// bundle. Decision: metadata/decisions/2026-08-22_curriculum-client-vs-backend.md
//
// The lesson data is TypeScript, so it is bundled in-memory with esbuild and
// evaluated, rather than parsed by hand. That way the JSON can never drift from
// what the app actually compiles.
//
// SESSION SPLITTING USED TO LIVE HERE. It does not any more, and that is the
// point of this file's current shape. Cutting the 142 authored lessons into 284
// learner-sized sessions at export time meant the split existed only in what the
// backend served: mobile fetched the 284 sessions while the web bundled and
// rendered the 142 uncut lessons, off ONE shared progress record. The two
// surfaces disagreed about what the curriculum even was.
//
// The cut now lives in the authored source (components/ohmlet/data/lessons.ts,
// splitLessonContent) and the index above it (curriculum.ts, SESSION_CURRICULUM),
// so both surfaces consume the same corpus from the same implementation. This
// script exports it, stamps a version, and writes that stamp back into the web
// bundle so a client can tell whether its offline copy is the served one.

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const out = resolve(root, '../backend/live-bridge/app/curriculum_data');
const CURRICULUM_TS = resolve(root, 'components/ohmlet/data/curriculum.ts');

async function loadModule(entry) {
  const result = await build({
    entryPoints: [resolve(root, entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    // These modules import React and lucide icons for the UI. None of that is
    // data, and none of it can evaluate outside a React runtime — so every such
    // import is replaced with an inert stub. Any icon or component referenced by
    // the data becomes a harmless no-op that JSON.stringify then drops.
    plugins: [
      {
        name: 'stub-ui-imports',
        setup(build) {
          const UI = /^(react|react-dom|react\/jsx-runtime|react\/jsx-dev-runtime|lucide-react)$/;
          build.onResolve({ filter: UI }, (args) => ({ path: args.path, namespace: 'ui-stub' }));
          build.onLoad({ filter: /.*/, namespace: 'ui-stub' }, () => ({
            contents: `
              const noop = () => null;
              export const jsx = noop; export const jsxs = noop; export const jsxDEV = noop;
              export const Fragment = noop; export const createElement = noop;
              export default new Proxy({}, { get: () => noop });
            `,
            loader: 'js',
          }));
        },
      },
    ],
    logLevel: 'silent',
  });
  const code = result.outputFiles[0].text;
  const dataUrl = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  return import(dataUrl);
}

/** Plain data only: anything non-serialisable (a React icon) is dropped. */
const plain = (value) => JSON.parse(JSON.stringify(value, (k, v) => (typeof v === 'function' ? undefined : v)));

const lessons = await loadModule('components/ohmlet/data/lessons.ts');
const curriculum = await loadModule('components/ohmlet/data/curriculum.ts');
const achievements = await loadModule('components/ohmlet/data/achievements.tsx');

// The SESSION corpus, not the authored one: exactly what the web renders.
const units = plain(curriculum.SESSION_CURRICULUM);
const sessionContent = plain(lessons.SESSION_CONTENT);

// ── Which skills have a film ──────────────────────────────────────────────────
//
// Counted here, never computed here. curriculum.ts already stamps `hasFilm` on
// every skill from the generated components/ohmlet/data/films.ts, which
// sync-films.mjs writes from the bucket itself.
//
// The backend used to INFER it: every skill that was not a review or a gateway
// was assumed to have a film. True on the day the films were rendered, false the
// moment six skills were authored on 2026-08-28. Labs drew a play button on all
// six and pressing one signed a URL for an object that is not there.
//
// Stamping it a second time here is how the web bundle and the backend copy
// would end up with two answers, and the parity check would then be enforcing a
// disagreement that neither side owns.
const withFilm = units.reduce((n, u) => n + (u.skills ?? []).filter((sk) => sk.hasFilm).length, 0);

// Achievements: plain data only. The web module also carries React icon
// components, which cannot cross the wire and are re-derived per client.
const achievementList = plain(achievements.ACHIEVEMENTS ?? []);

const authoredCount = Object.keys(plain(lessons.LESSON_CONTENT)).length;
const sessionStats = (() => {
  const lens = Object.values(sessionContent).map((l) => (l.steps ?? []).length).sort((a, b) => a - b);
  return { count: lens.length, min: lens[0], max: lens[lens.length - 1], median: lens[Math.floor(lens.length / 2)] };
})();

const unitCount = units.length;
const lessonIds = units.flatMap((u) => (u.skills ?? []).flatMap((s) => (s.lessons ?? []).map((l) => l.id)));
const contentCount = Object.keys(sessionContent).length;

// Fail loudly rather than shipping a corpus whose index and bodies disagree:
// the backend would answer the manifest and 404 the lesson.
const orphanMeta = lessonIds.filter((id) => !(id in sessionContent));
const orphanContent = Object.keys(sessionContent).filter((id) => !lessonIds.includes(id));
if (orphanMeta.length || orphanContent.length) {
  console.error('export-curriculum: the index and the bodies disagree.');
  for (const id of orphanMeta) console.error(`  on the path with no content: ${id}`);
  for (const id of orphanContent) console.error(`  content on no path:        ${id}`);
  process.exit(1);
}

// A content version so clients can cache and only refetch on change.
const { createHash } = await import('node:crypto');
const version = createHash('sha256')
  .update(JSON.stringify({ units, splitLessonContent: sessionContent }))
  .digest('hex')
  .slice(0, 16);

mkdirSync(out, { recursive: true });

writeFileSync(resolve(out, 'curriculum.json'), JSON.stringify({ version, units }, null, 0));
writeFileSync(resolve(out, 'lessons.json'), JSON.stringify({ version, lessons: sessionContent }, null, 0));
writeFileSync(resolve(out, 'achievements.json'), JSON.stringify({ version, achievements: achievementList }, null, 0));

// Stamp the same version into the web bundle. This is what lets a browser tell
// whether its bundled offline copy IS the corpus being served: if the stamps
// disagree the bundle is stale, the server's corpus wins, and
// scripts/check-curriculum-parity.mjs fails the build.
const STAMP = /(export const BUNDLED_CURRICULUM_VERSION = ')[0-9a-f]*(';)/;
const source = readFileSync(CURRICULUM_TS, 'utf8');
if (!STAMP.test(source)) {
  console.error(`export-curriculum: no BUNDLED_CURRICULUM_VERSION to stamp in ${CURRICULUM_TS}`);
  process.exit(1);
}
const stamped = source.replace(STAMP, `$1${version}$2`);
if (stamped !== source) writeFileSync(CURRICULUM_TS, stamped);

console.log(`units:            ${unitCount}`);
console.log(`authored lessons: ${authoredCount}`);
console.log(`sessions:         ${sessionStats.count}, ${sessionStats.min}-${sessionStats.max} steps, median ${sessionStats.median}`);
console.log(`lesson entries:   ${lessonIds.length}`);
console.log(`lesson content:   ${contentCount}`);
console.log(`achievements:     ${achievementList.length}`);
console.log(`skills with film: ${withFilm}`);
console.log(`version:          ${version}${stamped === source ? ' (bundle stamp already current)' : ' (bundle stamp updated)'}`);
console.log(`written to:       ${out}`);
