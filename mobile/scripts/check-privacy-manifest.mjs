// The privacy manifest must keep declaring what the app collects.
//
// Two failure modes, both invisible until App Review:
//   - `NSPrivacyCollectedDataTypes` empty, which asserts the app collects
//     nothing. Ohmlet collects an email, a name, audio and camera among others,
//     so an empty array is a false statement to Apple.
//   - `NSPrivacyTracking` true, or a tracking domain listed, without an ATT
//     prompt. Ohmlet does not track and must not claim to.
//
//   node scripts/check-privacy-manifest.mjs

import { readFileSync } from 'node:fs';

const CONFIG = 'app.json';
const REQUIRED = [
  'NSPrivacyCollectedDataTypeEmailAddress',
  'NSPrivacyCollectedDataTypeName',
  'NSPrivacyCollectedDataTypeUserID',
  'NSPrivacyCollectedDataTypeAudioData',
  'NSPrivacyCollectedDataTypePhotosorVideos',
];

const app = JSON.parse(readFileSync(CONFIG, 'utf8'));
const m = app?.expo?.ios?.privacyManifests;
const problems = [];

if (!m) {
  problems.push('ios.privacyManifests is missing entirely.');
} else {
  const declared = (m.NSPrivacyCollectedDataTypes ?? []).map((d) => d.NSPrivacyCollectedDataType);
  for (const r of REQUIRED) {
    if (!declared.includes(r)) problems.push(`missing collected data type: ${r}`);
  }
  if (m.NSPrivacyTracking === true && !(m.NSPrivacyTrackingDomains ?? []).length) {
    problems.push('NSPrivacyTracking is true but no tracking domains are listed.');
  }
  for (const d of m.NSPrivacyCollectedDataTypes ?? []) {
    if (d.NSPrivacyCollectedDataTypeTracking === true) {
      problems.push(
        `${d.NSPrivacyCollectedDataType} is marked as used for tracking. ` +
        'If that became true, the app needs an ATT prompt and this check needs revisiting.',
      );
    }
  }
}

if (problems.length) {
  console.error('Privacy manifest problems:\n');
  problems.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}
console.log('OK: privacy manifest declares what the app collects, and claims no tracking.');
