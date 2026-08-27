// A check that only runs on one machine is not a check.
//
// Two of these scripts had `/Users/faith/Desktop/Ohmlet/...` baked into them.
// They passed on the author's laptop and would have thrown ENOENT on the first
// line inside CI, which is exactly the failure that let a broken push reach
// main: the solvability check depended on a sibling package's node_modules,
// was green everywhere it was ever run by hand, and red the first time it ran
// anywhere clean.
//
// So: no script may name a path that exists only on somebody's computer, and
// nothing may be read from outside the repository.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../..');

const DIRS = [join(REPO, 'mobile', 'scripts'), join(REPO, 'frontend', 'scripts')];

// A path that begins at a filesystem root and names somebody's home directory or
// a developer-machine location. Repo-relative and URL-relative paths are fine.
const MACHINE_PATH = /(['"`])(\/(Users|home|root|private\/tmp|tmp\/[A-Za-z]|var\/folders)\/[^'"`\n]*)\1/g;
// Windows drive letters, for the same reason.
const WINDOWS_PATH = /(['"`])([A-Za-z]:\\\\?[^'"`\n]*)\1/g;

let bad = 0;
const fail = (m) => { bad += 1; console.error(`  FAIL  ${m}`); };

let scanned = 0;
for (const dir of DIRS) {
  let entries;
  try {
    entries = readdirSync(dir).filter((f) => f.endsWith('.mjs') || f.endsWith('.js'));
  } catch {
    continue; // the other package may not be checked out in every context
  }
  for (const file of entries) {
    const full = join(dir, file);
    const src = readFileSync(full, 'utf8');
    scanned += 1;
    // Comments are stripped first: several of these scripts document the bad
    // path they exist to prevent, and matching the explanation instead of the
    // code is the false alarm that trains people to ignore a check.
    const body = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .filter((l) => !l.includes('MACHINE_PATH') && !l.includes('WINDOWS_PATH'))
      .join('\n');
    for (const re of [MACHINE_PATH, WINDOWS_PATH]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(body)) !== null) {
        // A temp directory built at runtime is fine; a literal one is not.
        fail(`${relative(REPO, full)} names a machine-specific path: ${m[2].slice(0, 70)}`);
      }
    }
  }
}

console.log(bad === 0
  ? `  ok    all ${scanned} check scripts resolve their paths from the repository, not from one machine`
  : '');
console.log(bad === 0 ? '\nportable paths: all checks passed' : `\nportable paths: ${bad} failure(s)`);
process.exit(bad === 0 ? 0 : 1);
