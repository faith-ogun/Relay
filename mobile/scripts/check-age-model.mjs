// The consent ages in the mobile age model must match the web one exactly.
//
// They are legal thresholds (GDPR Art 8 member-state choices, COPPA), not
// preferences. Two surfaces disagreeing about who counts as a minor is invisible
// in testing and indefensible if a regulator asks which one was right.
//
//   node scripts/check-age-model.mjs

import { readFileSync } from 'node:fs';

const MOBILE = 'src/services/ageModel.ts';
const WEB = '../frontend/components/ohmlet/childmode/ageModel.ts';

function extract(path, label) {
  // Comments are stripped first. The web file carries `// UK: 13 for consent...`
  // on the GB line, and a naive scan reads that as a country entry, which made
  // this check report drift that did not exist.
  const src = readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  const block = src.match(/CONSENT_AGE_BY_COUNTRY[^{]*\{([\s\S]*?)\}/);
  if (!block) throw new Error(`Could not find CONSENT_AGE_BY_COUNTRY in ${label}`);
  const map = {};
  for (const [, cc, age] of block[1].matchAll(/([A-Z]{2}):\s*(\d+)/g)) map[cc] = Number(age);
  const scalar = (name) => {
    const m = src.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));
    return m ? Number(m[1]) : null;
  };
  return {
    map,
    DEFAULT_CONSENT_AGE: scalar('DEFAULT_CONSENT_AGE'),
    COPPA_AGE: scalar('COPPA_AGE'),
    CHILD_PROTECTION_AGE: scalar('CHILD_PROTECTION_AGE'),
  };
}

const a = extract(MOBILE, 'mobile');
const b = extract(WEB, 'web');
const problems = [];

for (const cc of new Set([...Object.keys(a.map), ...Object.keys(b.map)])) {
  if (a.map[cc] !== b.map[cc]) {
    problems.push(`  ${cc}: mobile=${a.map[cc] ?? 'absent'} web=${b.map[cc] ?? 'absent'}`);
  }
}
for (const k of ['DEFAULT_CONSENT_AGE', 'COPPA_AGE', 'CHILD_PROTECTION_AGE']) {
  if (a[k] !== b[k]) problems.push(`  ${k}: mobile=${a[k]} web=${b[k]}`);
}

if (problems.length) {
  console.error('Age model drift between mobile and web:\n');
  problems.forEach((p) => console.error(p));
  process.exit(1);
}
console.log(`OK: ${Object.keys(a.map).length} countries and 3 thresholds match web.`);
