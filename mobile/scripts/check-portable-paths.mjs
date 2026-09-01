// A check that only runs on one machine is not a check.
//
// Two of these scripts had `/Users/faith/Desktop/Ohmlet/...` baked into them.
// They passed on the author's laptop and would have thrown ENOENT on the first
// line inside CI, which is exactly the failure that let a broken push reach
// main: the solvability check depended on a sibling package's node_modules,
// was green everywhere it was ever run by hand, and red the first time it ran
// anywhere clean.
//
// So: no script may name a path that exists only on somebody's computer, and no
// script may shell out to a binary that exists only on one operating system.
//
// The second rule was added after the first one failed to catch its own sibling:
// check-usage-strings.mjs shelled out to `plutil`, which is macOS only, and its
// catch turned the Ubuntu runner's "command not found" into "the permission
// string is ABSENT". It passed on a laptop and blocked every push while
// reporting that iOS was about to terminate the app. Paths were portable; the
// tooling was not.
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

/**
 * Binaries that do not exist on the Ubuntu runner CI uses. A check script that
 * needs one of these cannot run in CI, which is the only place a check earns
 * its keep.
 *
 * `nm`, `strings` and `find` are deliberately absent: they exist on Linux too.
 */
const MAC_ONLY = [
  'plutil', 'sips', 'xcrun', 'xcodebuild', 'codesign', 'defaults', 'pbcopy',
  'pbpaste', 'hdiutil', 'diskutil', 'mdfind', 'networksetup', 'softwareupdate',
  'caffeinate', 'lipo', 'install_name_tool', 'say', 'open',
];

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
      // The MAC_ONLY list is a list OF the offending names, so it must not be
      // scanned as a use of them. Same reason the pattern lines are dropped.
      .replace(/const MAC_ONLY = \[[\s\S]*?\];/, '')
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .filter((l) => !l.includes('MACHINE_PATH') && !l.includes('WINDOWS_PATH') && !l.includes('MAC_ONLY'))
      .join('\n');
    for (const bin of MAC_ONLY) {
      // Matched only where the binary is actually INVOKED, never where the word
      // merely appears. `open` and `say` are ordinary English, and a first
      // attempt at this flagged the string 'open while the tutor was still
      // talking' in an assertion message. A check that cries wolf gets muted,
      // which costs more than the rule is worth.
      const run = new RegExp(
        `(?:exec|execFile|spawn)(?:Sync)?\\(\\s*(['"\`])${bin}\\1`
        + `|(?:exec|execFile|spawn)(?:Sync)?\\(\\s*(['"\`])${bin}[\\s]`,
        'g',
      );
      if (run.test(body)) {
        fail(`${relative(REPO, full)} runs \`${bin}\`, which does not exist on the Ubuntu runner, so this check cannot run in CI`);
      }
    }
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
