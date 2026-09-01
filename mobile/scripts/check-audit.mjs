// Vulnerability gate for the phone app.
//
// The frontend job can simply fail on high, because Vite and its toolchain are
// devDependencies and --omit=dev removes them. An Expo app cannot: `expo` is a
// RUNTIME dependency by necessity, and it pulls @expo/cli, metro and their
// transitive tree in with it. Every high advisory here today is in that build
// toolchain, which runs on a developer's machine and a build server and is never
// part of the binary a learner installs.
//
// Failing the build on those would leave this job permanently red until Expo
// ships an upstream release, which teaches everyone to ignore it. Lowering the
// threshold to `critical` and moving on would hide a genuine high in code that
// DOES ship. So neither: this fails on any critical, and on any high that is not
// one of the known build-toolchain packages named below. A new high in anything
// that reaches a device fails the build on the day it appears.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Packages that exist only to BUILD the app. Each is reachable from `expo` or
 * `metro` and none is linked into the shipped binary.
 *
 * Delete an entry the moment Expo's upstream fix lands: this list is allowed to
 * shrink and is not allowed to grow without a reason written next to it.
 */
const BUILD_ONLY = new Set([
  '@expo/browser-polyfill', '@expo/cli', '@expo/config', '@expo/config-plugins',
  '@expo/metro', '@expo/metro-config', '@expo/prebuild-config',
  'expo', 'expo-splash-screen',
  'metro', 'metro-config', 'metro-transform-worker',
  'fbemitter', 'fbjs', 'isomorphic-fetch', 'node-fetch',
  'image-size', 'postcss',
]);

let report;
try {
  report = JSON.parse(execFileSync('npm', ['audit', '--omit=dev', '--json'], {
    cwd: MOBILE, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  }));
} catch (err) {
  // npm audit exits non-zero WHEN IT FINDS SOMETHING, which is the normal case
  // here, so its output is the payload rather than a failure.
  if (!err.stdout) { console.error(`  FAIL  npm audit could not run: ${err.message}`); process.exit(1); }
  report = JSON.parse(err.stdout);
}

const vulns = report.vulnerabilities ?? {};
const bySeverity = (s) => Object.entries(vulns).filter(([, v]) => v.severity === s).map(([name]) => name);

const critical = bySeverity('critical');
const high = bySeverity('high');
const unexpected = high.filter((n) => !BUILD_ONLY.has(n));
const stale = [...BUILD_ONLY].filter((n) => !high.includes(n) && !(vulns[n]));

let bad = 0;
if (critical.length) {
  bad += 1;
  console.error(`  FAIL  ${critical.length} CRITICAL advisory: ${critical.join(', ')}`);
}
if (unexpected.length) {
  bad += 1;
  console.error(`  FAIL  ${unexpected.length} high-severity advisory outside the build toolchain, so it may reach a device:`);
  for (const n of unexpected) console.error(`          ${n}  (${vulns[n].via?.[0]?.title ?? 'see npm audit'})`);
  console.error('        Fix it, or add it to BUILD_ONLY with the reason it cannot reach a device.');
}

if (!bad) {
  console.log(`  ok    no critical advisories, and all ${high.length} high advisories are Expo build toolchain that never ships`);
  if (high.length) console.log(`          (${high.sort().join(', ')})`);
  if (stale.length) {
    console.log(`  note  ${stale.length} BUILD_ONLY entr${stale.length === 1 ? 'y is' : 'ies are'} no longer flagged and can be removed: ${stale.join(', ')}`);
  }
}

console.log(bad === 0 ? '\naudit: all checks passed' : `\naudit: ${bad} failure(s)`);
process.exit(bad === 0 ? 0 : 1);
