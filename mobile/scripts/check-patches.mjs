// Every patch in patches/ must actually be applied in node_modules.
//
// A patch that silently stops applying is worse than no patch: the behaviour it
// bought disappears and nothing says so. patch-package runs from postinstall,
// which `npm ci --ignore-scripts` skips, and which a version bump can defeat
// (the file is named for the version it was cut against).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE = dirname(dirname(fileURLToPath(import.meta.url)));
const PATCHES = join(MOBILE, 'patches');

let bad = 0;
const fail = (m) => { bad += 1; console.error(`  FAIL  ${m}`); };

if (!existsSync(PATCHES)) {
  console.log('  ok    no patches to keep honest');
  process.exit(0);
}

const pkg = JSON.parse(readFileSync(join(MOBILE, 'package.json'), 'utf8'));
if (!/patch-package/.test(pkg.scripts?.postinstall ?? '')) {
  fail('patches/ exists but postinstall does not run patch-package, so a fresh install drops every patch');
}

const files = readdirSync(PATCHES).filter((f) => f.endsWith('.patch'));
if (!files.length) fail('patches/ is empty');

for (const file of files) {
  // react-native-audio-api+0.12.2.patch -> name and the version it was cut for
  const m = file.match(/^(.+)\+(\d+\.\d+\.\d+)\.patch$/);
  if (!m) { fail(`${file} is not named <package>+<version>.patch, so patch-package will not apply it`); continue; }
  const [, name, version] = m;

  const installed = JSON.parse(readFileSync(join(MOBILE, 'node_modules', name, 'package.json'), 'utf8')).version;
  if (installed !== version) {
    fail(`${file} was cut against ${name}@${version} but ${installed} is installed, so it no longer applies`);
    continue;
  }

  // The patch adds lines; every one of them must be present in the file it
  // targets. Checking the diff applied is the only thing that proves it did.
  const patch = readFileSync(join(PATCHES, file), 'utf8');
  const target = patch.match(/\+\+\+ b\/node_modules\/(.+)/)?.[1];
  if (!target) { fail(`${file} has no target path`); continue; }
  const onDisk = join(MOBILE, 'node_modules', target);
  if (!existsSync(onDisk)) { fail(`${file} targets ${target}, which is not installed`); continue; }

  const src = readFileSync(onDisk, 'utf8');
  const added = patch.split('\n')
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .map((l) => l.slice(1).trim())
    .filter((l) => l.length > 12);
  const missing = added.filter((l) => !src.includes(l));
  if (missing.length) {
    fail(`${file} is NOT applied: ${missing.length} of its ${added.length} added lines are absent from ${target}. `
      + `Run \`npx patch-package\`. First missing: ${missing[0].slice(0, 60)}`);
  }
}

if (bad === 0) console.log(`  ok    all ${files.length} patch(es) applied in node_modules`);
console.log(bad === 0 ? '\npatches: all checks passed' : `\npatches: ${bad} failure(s)`);
process.exit(bad === 0 ? 0 : 1);
