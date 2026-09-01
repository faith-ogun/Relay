#!/usr/bin/env node
// A full-screen Modal renders OUTSIDE the root Shell, so it gets no safe area.
//
// The defect this exists for, reported 2026-09-01: "the X button is too high up,
// so it's very hard to click X."
//
// `app/_layout.tsx` wraps the whole Stack in a View with `paddingTop: insets.top`,
// which is why ordinary screens never think about the notch. A React Native
// <Modal> is a SEPARATE native view hierarchy presented above that shell, so it
// inherits none of it. `FilmPlayer` was standing in with a fixed
// `paddingTop: space.xl`, which is 32, against the 59 a Dynamic Island reserves.
// The close button sat under the island.
//
// This is the SECOND time the same defect shipped. The note in `_layout.tsx`
// records the first, on the back button, and the fix there was the shell padding
// that a Modal escapes. A comment did not prevent the repeat, so this does.
//
// Only full-screen modals are checked. A `transparent` modal draws a scrim with a
// centred card and has nothing at a screen edge, so it needs no inset: path.tsx,
// achievements.tsx and SafetyAck.tsx are all that shape and are correctly exempt.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(dirname(fileURLToPath(import.meta.url))), 'src');

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : full.endsWith('.tsx') ? [full] : [];
});

const HANDLES = /useSafeAreaInsets|SafeAreaView/;

/** Local components a file imports, resolved to paths that exist. */
function importedFiles(file, src) {
  const out = [];
  for (const m of src.matchAll(/import\s+\{[^}]*\}\s+from\s+'(\.[^']+)'/g)) {
    for (const ext of ['.tsx', '.ts', '/index.tsx']) {
      const p = resolve(dirname(file), m[1] + ext);
      try { statSync(p); out.push(p); break; } catch { /* next */ }
    }
  }
  return out;
}

let bad = 0;
const fail = (m) => { bad += 1; console.error(`  FAIL  ${m}`); };
let checked = 0;

for (const file of walk(SRC)) {
  const src = readFileSync(file, 'utf8');
  if (!src.includes('<Modal')) continue;

  // Each <Modal ...> opening tag, up to the closing bracket of the tag itself.
  for (const m of src.matchAll(/<Modal\b[^>]*>/gs)) {
    if (/\btransparent\b/.test(m[0])) continue;   // scrim + centred card, no edges
    checked += 1;

    if (HANDLES.test(src)) continue;             // the file handles it directly

    // Otherwise the content is a component; one of them must handle it.
    const delegates = importedFiles(file, src)
      .some((p) => HANDLES.test(readFileSync(p, 'utf8')));
    if (!delegates) {
      const rel = file.slice(SRC.length + 1);
      fail(`${rel} presents a FULL-SCREEN <Modal> and neither it nor any component it `
        + 'imports reads safe-area insets.\n        A Modal renders outside the root Shell in '
        + '_layout.tsx, so it inherits none of that shell\'s paddingTop: insets.top. Any control '
        + 'near the top or bottom edge will sit under the Dynamic Island or the home indicator '
        + 'and be very hard to tap.\n        Use useSafeAreaInsets() inside the modal content, or '
        + 'make the modal `transparent` if it is really a centred card.');
    }
  }
}

if (checked === 0) {
  fail('no full-screen modals found at all. This guard reads `<Modal ...>` tags and skips ones '
    + 'marked transparent; if modals are now presented some other way, teach it that shape.');
}

if (bad === 0) {
  console.log(`  ok    all ${checked} full-screen modal(s) handle their own safe area`);
  console.log('\nmodal insets: all checks passed');
} else {
  console.error('\nmodal insets: ' + bad + ' failure(s)');
}
process.exit(bad === 0 ? 0 : 1);
