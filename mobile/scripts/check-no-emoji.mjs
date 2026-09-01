// No emoji as icons. Ever.
//
// An emoji renders in the system font: its weight, colour and optical size are
// outside our control, it looks different on every OS version, and it never
// matches the stroke weight of anything drawn beside it. Five of them had crept
// in as a heart, a lock, a speech bubble and a close cross, and they were a real
// part of why the app read as unfinished.
//
//   node scripts/check-no-emoji.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Pictographs, dingbats, and the variation selector that turns a glyph into one.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2764}\u{2665}]/u;

const offenders = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) { walk(path); continue; }
    if (!/\.tsx?$/.test(path)) continue;
    readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
      // Comments are prose and may legitimately contain one.
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      const m = code.match(EMOJI);
      if (m) offenders.push(`${path}:${i + 1}  ${JSON.stringify(m[0])}  ${code.trim().slice(0, 60)}`);
    });
  }
}
walk('src');

if (offenders.length) {
  console.error('Emoji used in UI code. Draw it in components/icons.tsx instead:\n');
  offenders.forEach((o) => console.error(`  ${o}`));
  process.exit(1);
}
console.log('OK: no emoji in UI code.');
