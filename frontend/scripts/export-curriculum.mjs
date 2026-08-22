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
    // Lesson/curriculum modules import lucide icons for the UI; those are
    // irrelevant to the data and cannot evaluate outside React.
    external: ['react', 'react-dom', 'lucide-react'],
    logLevel: 'silent',
  });
  const code = result.outputFiles[0].text;
  const dataUrl = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  return import(dataUrl);
}

const lessons = await loadModule('components/ohmlet/data/lessons.ts');
const curriculum = await loadModule('components/ohmlet/data/curriculum.ts');

// CURRICULUM carries React icon components per unit; strip anything non-serialisable.
const units = JSON.parse(JSON.stringify(curriculum.CURRICULUM, (k, v) =>
  typeof v === 'function' ? undefined : v,
));

const lessonContent = JSON.parse(JSON.stringify(lessons.LESSON_CONTENT ?? lessons.default ?? {}, (k, v) =>
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

console.log(`units:          ${unitCount}`);
console.log(`lesson entries: ${lessonIds.length}`);
console.log(`lesson content: ${contentCount}`);
console.log(`version:        ${version}`);
console.log(`written to:     ${out}`);
