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

import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const out = resolve(root, '../backend/live-bridge/app/curriculum_data');

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

const lessons = await loadModule('components/ohmlet/data/lessons.ts');
const curriculum = await loadModule('components/ohmlet/data/curriculum.ts');
const achievements = await loadModule('components/ohmlet/data/achievements.tsx');

// CURRICULUM carries React icon components per unit; strip anything non-serialisable.
const units = JSON.parse(JSON.stringify(curriculum.CURRICULUM, (k, v) =>
  typeof v === 'function' ? undefined : v,
));

const lessonContent = JSON.parse(JSON.stringify(lessons.LESSON_CONTENT ?? lessons.default ?? {}, (k, v) =>
  typeof v === 'function' ? undefined : v,
));

// Achievements: plain data only. The web module also carries React icon
// components, which cannot cross the wire and are re-derived per client.
const achievementList = JSON.parse(JSON.stringify(achievements.ACHIEVEMENTS ?? [], (k, v) =>
  typeof v === 'function' ? undefined : v,
));

mkdirSync(out, { recursive: true });

const unitCount = units.length;
const lessonIds = units.flatMap((u) => (u.skills ?? []).flatMap((s) => (s.lessons ?? []).map((l) => l.id)));
const contentCount = Object.keys(lessonContent).length;

// A content version so clients can cache and only refetch on change.
const { createHash } = await import('node:crypto');
const version = createHash('sha256')
  .update(JSON.stringify({ units, lessonContent }))
  .digest('hex')
  .slice(0, 16);

writeFileSync(resolve(out, 'curriculum.json'), JSON.stringify({ version, units }, null, 0));
writeFileSync(resolve(out, 'lessons.json'), JSON.stringify({ version, lessons: lessonContent }, null, 0));
writeFileSync(resolve(out, 'achievements.json'), JSON.stringify({ version, achievements: achievementList }, null, 0));

console.log(`units:          ${unitCount}`);
console.log(`lesson entries: ${lessonIds.length}`);
console.log(`lesson content: ${contentCount}`);
console.log(`achievements:   ${achievementList.length}`);
console.log(`version:        ${version}`);
console.log(`written to:     ${out}`);
