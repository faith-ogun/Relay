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


// ── Session splitting ──────────────────────────────────────────────────────
//
// Authored lessons run 15-20 steps (median 17, of which 15 are graded). That is
// a long sitting: Duolingo lands nearer 10, and a learner who has to abandon
// halfway loses the lot, because progress is only recorded when a lesson ends.
//
// The split happens HERE rather than in the authored source on purpose. An
// author thinks in concepts; a learner sits down for a session. Keeping those
// separate means the 3,700-line lesson file never has to be carved up, the
// ratio stays a constant rather than a permanent edit, and reverting is one
// number rather than a rewrite.
//
// Part 1 KEEPS THE ORIGINAL ID. That is the whole migration: anyone who had
// completed a lesson still has part 1 complete, and only the later parts appear
// as new work. Nothing is lost and no backfill is needed.
const MAX_STEPS_PER_SESSION = 12;

/** Roman numerals, for as many parts as a lesson could plausibly need. */
const NUMERAL = ['I', 'II', 'III', 'IV', 'V'];

/** Even-as-possible chunk sizes: 17 into 2 becomes 9 and 8, never 12 and 5. */
function chunkSizes(total, parts) {
  const base = Math.floor(total / parts);
  const extra = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

function splitContent(id, entry) {
  const steps = entry.steps ?? [];
  const parts = Math.ceil(steps.length / MAX_STEPS_PER_SESSION);
  if (parts < 2) return [{ id, suffix: null, entry }];

  const sizes = chunkSizes(steps.length, parts);
  const out = [];
  let cursor = 0;
  for (let i = 0; i < parts; i += 1) {
    const slice = steps.slice(cursor, cursor + sizes[i]);
    cursor += sizes[i];
    out.push({
      id: i === 0 ? id : `${id} ${NUMERAL[i]}`,
      suffix: NUMERAL[i],
      entry: {
        ...entry,
        steps: slice,
        // XP follows the work: a half lesson pays half, rounded to a multiple of
        // 5 so the numbers stay legible.
        xpReward: Math.max(5, Math.round(((entry.xpReward ?? 0) * slice.length) / steps.length / 5) * 5),
      },
    });
  }
  return out;
}

const splitLessonContent = {};
const splitMap = new Map(); // original id -> [{id, suffix, steps}]
for (const [id, entry] of Object.entries(lessonContent)) {
  const parts = splitContent(id, entry);
  splitMap.set(id, parts);
  for (const part of parts) splitLessonContent[part.id] = part.entry;
}

// Mirror the split into the unit -> skill -> lesson index, so the path shows the
// parts as the separate sessions they now are.
for (const unit of units) {
  for (const skill of unit.skills ?? []) {
    skill.lessons = (skill.lessons ?? []).flatMap((meta) => {
      const parts = splitMap.get(meta.id);
      if (!parts || parts.length < 2) return [meta];
      const total = parts.reduce((n, p) => n + p.entry.steps.length, 0);
      return parts.map((p) => ({
        ...meta,
        id: p.id,
        title: `${meta.title} ${p.suffix}`,
        estMinutes: Math.max(2, Math.round(
          ((meta.estMinutes ?? 8) * p.entry.steps.length) / total,
        )),
      }));
    });
  }
}

const splitStats = (() => {
  const lens = Object.values(splitLessonContent).map((l) => (l.steps ?? []).length).sort((a, b) => a - b);
  const median = lens[Math.floor(lens.length / 2)];
  return { count: lens.length, min: lens[0], max: lens[lens.length - 1], median };
})();

mkdirSync(out, { recursive: true });

const unitCount = units.length;
const lessonIds = units.flatMap((u) => (u.skills ?? []).flatMap((s) => (s.lessons ?? []).map((l) => l.id)));
const contentCount = Object.keys(splitLessonContent).length;

// A content version so clients can cache and only refetch on change.
const { createHash } = await import('node:crypto');
const version = createHash('sha256')
  .update(JSON.stringify({ units, splitLessonContent }))
  .digest('hex')
  .slice(0, 16);

writeFileSync(resolve(out, 'curriculum.json'), JSON.stringify({ version, units }, null, 0));
writeFileSync(resolve(out, 'lessons.json'), JSON.stringify({ version, lessons: splitLessonContent }, null, 0));
writeFileSync(resolve(out, 'achievements.json'), JSON.stringify({ version, achievements: achievementList }, null, 0));

console.log(`units:          ${unitCount}`);
console.log(`lesson entries: ${lessonIds.length}`);
console.log(`lesson content: ${contentCount}`);
console.log(`achievements:   ${achievementList.length}`);
console.log(`sessions:       ${splitStats.count} (was ${Object.keys(lessonContent).length}), ${splitStats.min}-${splitStats.max} steps, median ${splitStats.median}`);
console.log(`version:        ${version}`);
console.log(`written to:     ${out}`);
