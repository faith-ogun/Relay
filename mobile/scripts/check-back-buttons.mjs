// Every back affordance must go through `goBack`, which falls back to a real
// route when there is no history.
//
// `router.back()` is a silent no-op on any screen reached with `replace` or on
// a cold launch: React Navigation logs GO_BACK-not-handled and the person is
// stuck with a button that does nothing. That is how the sign-in screen trapped
// people, and it is the kind of bug that walks back in the moment someone adds
// a screen and reaches for the obvious API.
//
//   node scripts/check-back-buttons.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';
const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) { walk(path); continue; }
    if (!/\.tsx?$/.test(path)) continue;
    if (path.endsWith(join('services', 'nav.ts'))) continue;   // the helper itself
    readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
      if (line.includes('router.back()')) offenders.push(`${path}:${i + 1}`);
    });
  }
}

walk(ROOT);

if (offenders.length) {
  console.error('Bare router.back() found. Use goBack(fallback) from services/nav:\n');
  offenders.forEach((o) => console.error(`  ${o}`));
  process.exit(1);
}
console.log('OK: every back affordance goes through goBack().');
