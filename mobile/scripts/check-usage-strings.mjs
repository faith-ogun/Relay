// The permission text a learner reads must be the text we wrote.
//
// `mobile/ios/` is checked in, so nothing regenerates it: editing app.json does
// NOT change Info.plist, and Info.plist is what actually ships. The two drifted
// on NSMicrophoneUsageDescription, and the direction of the drift is the danger.
// Today Info.plist wins and is accurate, so nothing is broken. But `expo
// prebuild` regenerates Info.plist FROM app.json, so the day anyone runs it the
// text at the permission prompt silently becomes whatever app.json happened to
// say, with no diff in any file anyone was looking at.
//
// A missing usage description is worse than a wrong one: iOS terminates the app
// the instant it touches that API, so this also refuses a declared permission
// with no string at all.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE = dirname(dirname(fileURLToPath(import.meta.url)));
const PLIST = join(MOBILE, 'ios', 'Ohmlet', 'Info.plist');

const app = JSON.parse(readFileSync(join(MOBILE, 'app.json'), 'utf8'));
const declared = app?.expo?.ios?.infoPlist ?? {};

const fromPlist = (key) => {
  try {
    return execFileSync('plutil', ['-extract', key, 'raw', PLIST],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

let bad = 0;
const fail = (m) => { bad += 1; console.error(`  FAIL  ${m}`); };

const keys = Object.keys(declared).filter((k) => k.startsWith('NS') && k.endsWith('UsageDescription'));
if (!keys.length) fail('app.json declares no usage descriptions, which cannot be right for an app that uses the camera and microphone');

for (const key of keys) {
  const shipped = fromPlist(key);
  if (shipped === null) {
    fail(`${key} is declared in app.json but ABSENT from Info.plist, so iOS terminates the app the moment it touches that API`);
    continue;
  }
  if (shipped !== declared[key]) {
    fail(`${key} differs between app.json and the shipping Info.plist.\n`
      + `          app.json:   ${declared[key]}\n`
      + `          Info.plist: ${shipped}\n`
      + '        Info.plist is what a learner reads today; app.json is what a prebuild would write.');
  }
}

// Anything the plist declares that app.json does not would be silently dropped
// by a prebuild, which is the same bug in the other direction.
for (const key of ['NSCameraUsageDescription', 'NSMicrophoneUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSLocalNetworkUsageDescription']) {
  if (declared[key] === undefined && fromPlist(key) !== null) {
    fail(`${key} ships in Info.plist but app.json does not declare it, so a prebuild would drop it and the app would be terminated on first use`);
  }
}

console.log(bad === 0
  ? `  ok    all ${keys.length} permission strings agree between app.json and the shipping Info.plist`
  : '');
console.log(bad === 0 ? '\nusage strings: all checks passed' : `\nusage strings: ${bad} failure(s)`);
process.exit(bad === 0 ? 0 : 1);
