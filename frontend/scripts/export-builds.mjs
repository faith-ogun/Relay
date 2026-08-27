// Export the authored build library to JSON so the BACKEND can serve it.
//
// Same reason as the curriculum (scripts/export-curriculum.mjs): a build library
// compiled into a client is a build library that needs an App Store review to
// correct. A wrong part in a parts list is worse than a wrong lesson, because it
// is what the camera kit check measures the learner's bench against.
//
// The source of truth stays where it is, components/ohmlet/data/library.ts. This
// script bundles that module in-memory with esbuild and evaluates it, so the JSON
// is generated FROM what the web app compiles and cannot drift from it. Rerun it
// whenever a build changes:
//
//   node scripts/export-builds.mjs        (run from frontend/)
//
// backend/live-bridge/tests/test_builds.py re-reads library.ts independently and
// fails if the served JSON no longer matches it, so forgetting to rerun this is
// a red test rather than a silent divergence.

import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const SOURCE = 'components/ohmlet/data/library.ts';
const out = resolve(root, '../backend/live-bridge/app/curriculum_data');

const source = readFileSync(resolve(root, SOURCE), 'utf8');

// Which lucide icons the library actually imports. The icon a build carries is
// a React component, which cannot cross the wire, but its NAME is authored
// variety worth keeping: it is how each client draws its own mark for the build,
// exactly as the curriculum's per-skill icon names are re-drawn on each surface.
// So lucide is stubbed with these names bound to markers the evaluated data can
// carry, rather than with the inert no-ops the curriculum export uses.
const iconNames = [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g)]
  .flatMap((m) => m[1].split(',').map((s) => s.trim()).filter(Boolean));

async function loadModule(entry) {
  const result = await build({
    entryPoints: [resolve(root, entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    plugins: [
      {
        name: 'stub-ui-imports',
        setup(build) {
          const UI = /^(react|react-dom|react\/jsx-runtime|react\/jsx-dev-runtime|lucide-react)$/;
          build.onResolve({ filter: UI }, (args) => ({ path: args.path, namespace: 'ui-stub' }));
          build.onLoad({ filter: /.*/, namespace: 'ui-stub' }, (args) => ({
            contents:
              args.path === 'lucide-react'
                ? iconNames.map((n) => `export const ${n} = { __icon: ${JSON.stringify(n)} };`).join('\n')
                : `
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
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}

const library = await loadModule(SOURCE);
const authored = library.BUILD_LIBRARY ?? [];
if (!Array.isArray(authored) || !authored.length) {
  throw new Error(`${SOURCE} exported no BUILD_LIBRARY. Has it been renamed?`);
}

/** A stable, URL-safe id derived from the title, since the source has none. */
const slug = (title) =>
  String(title).toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const builds = authored.map((b) => {
  const id = slug(b.title);
  if (!id) throw new Error(`A build has no usable title: ${JSON.stringify(b).slice(0, 120)}`);
  const parts = (b.parts ?? []).map((p) => String(p).trim()).filter(Boolean);
  if (!parts.length) {
    throw new Error(`"${b.title}" has no parts list, so its kit check would have nothing to verify.`);
  }
  const icon = b.icon?.__icon ?? null;
  if (!icon) {
    throw new Error(
      `"${b.title}" carries no lucide icon, or the import in ${SOURCE} could not be read. ` +
        'Each client draws its own mark from that name.',
    );
  }
  return {
    id,
    title: String(b.title),
    level: String(b.level),
    est: String(b.est),
    mode: String(b.mode),
    color: String(b.color),
    icon,
    desc: String(b.desc),
    parts,
  };
  // `builds: 847` is deliberately NOT carried across. It is an authored figure
  // with no source behind it, and shipping it to a second surface would present
  // invented social proof as a real count on two apps instead of one. Real
  // per-build activity belongs to the community service, which counts it.
});

const ids = builds.map((b) => b.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) throw new Error(`Two builds slugify to the same id: ${[...new Set(dupes)].join(', ')}`);

// A content version so clients can cache and only refetch on change, the way
// the curriculum's does. Over the payload itself, so any edit moves it.
const version = createHash('sha256').update(JSON.stringify(builds)).digest('hex').slice(0, 16);

mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'builds.json'), JSON.stringify({ version, builds }, null, 0));

console.log(`builds:     ${builds.length}`);
console.log(`parts:      ${builds.reduce((n, b) => n + b.parts.length, 0)} across all builds`);
console.log(`version:    ${version}`);
console.log(`written to: ${out}/builds.json`);
