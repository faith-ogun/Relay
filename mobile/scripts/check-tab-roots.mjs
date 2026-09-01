#!/usr/bin/env node
// A tab root has no "back", so the back gesture must not be able to fire on one.
//
// The defect this exists for, reported 2026-09-01: "if you press Live Tutor and
// then you press back, it then takes you back to the login screen... if you
// slide to the left, it takes you straight back to the login page."
//
// Nothing was broken in the build. `AppTabs` navigates with `router.replace`, so
// a tab root is the ONLY entry in the stack and has nothing behind it. But iOS
// enables the interactive edge-swipe on every stack screen by default, and the
// gesture still fired: it unwound past the tab root to the entry gate in
// `app/index.tsx`, which re-runs auth, re-reads the age gate, and shows the brand
// splash for 1.4 seconds before redirecting.
//
// To the person holding the phone that is the app throwing them out to the login
// screen in the middle of a session, which is about the worst thing a swipe can
// do. It cost nothing to fix and would have cost a lot to discover in a review.
//
// `plans` made it worse by being absent from the layout entirely, so when the tab
// was added on 2026-08-29 it silently took the default animation AND the default
// gesture. That is the specific failure mode this guard exists to make loud: a
// new tab is added to the bar and nobody remembers there is a second list.
//
// Two properties:
//   1. every tab in AppTabs has a Stack.Screen in the root layout
//   2. every one of those has gestureEnabled: false
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE = dirname(dirname(fileURLToPath(import.meta.url)));
const tabs = readFileSync(join(MOBILE, 'src/components/AppTabs.tsx'), 'utf8');
const layout = readFileSync(join(MOBILE, 'src/app/_layout.tsx'), 'utf8');

let bad = 0;
const fail = (m) => { bad += 1; console.error(`  FAIL  ${m}`); };

// ── Which routes the tab bar can reach ──
// Every item navigates with router.replace('/route'), including the ones behind
// a child-safe conditional: a route hidden from a minor is still a tab root for
// everyone else.
const routes = [...tabs.matchAll(/router\.replace\('\/([a-z-]+)'\)/g)].map((m) => m[1]);
if (routes.length < 4) {
  fail(`only found ${routes.length} tab routes in AppTabs.tsx. This guard reads them from `
    + "router.replace('/...') calls; if the bar now navigates some other way, teach it that shape "
    + 'rather than deleting the check.');
}

// ── Each must be declared, and declared without the gesture ──
for (const route of routes) {
  const decl = layout.match(new RegExp(`<Stack\\.Screen\\s+name="${route}"[^/]*/>`, 's'));
  if (!decl) {
    fail(`'${route}' is a tab in AppTabs but has no <Stack.Screen> in _layout.tsx. `
      + 'It will take the default push animation and the default back gesture, and that gesture '
      + 'unwinds past the tab root to the entry gate, which reads as being thrown out to sign-in.');
    continue;
  }
  if (!/gestureEnabled:\s*false/.test(decl[0])) {
    fail(`the '${route}' tab root does not set gestureEnabled: false. `
      + 'A tab root has nothing behind it, so an edge-swipe there escapes the tab shell entirely '
      + 'and lands on the splash and sign-in screen.');
  }
  if (!/animation:\s*'none'/.test(decl[0])) {
    fail(`the '${route}' tab root does not set animation: 'none'. `
      + 'Switching tabs should not slide like a push; iOS does not animate a tab change at all.');
  }
}

// ── A tab root must render the tab bar ──
//
// `live` was the only one that did not, found 2026-09-01. Its single exit was a
// "‹ Back" link that always returned to Learn regardless of where the learner
// came from, and the interactive edge-swipe was quietly serving as the second
// way out. That swipe was the bug above: it unwound past the tab root to the
// sign-in gate. Disabling it closed the trapdoor and left the room with one
// door, which is a worse trap than the one it fixed.
//
// A tab without a tab bar is not a tab. Only the REFERENCE is required, not that
// every branch renders it: `live` deliberately drops the bar once a session is
// connected, because there the camera owns the screen and the End button is the
// exit. An idle tab root with no bar is what this catches.
for (const route of routes) {
  let src;
  try { src = readFileSync(join(MOBILE, `src/app/${route}.tsx`), 'utf8'); }
  catch { fail(`'${route}' is a tab but src/app/${route}.tsx does not exist.`); continue; }
  if (!/AppTabs/.test(src)) {
    fail(`src/app/${route}.tsx never renders AppTabs, so the '${route}' tab has no tab bar. `
      + 'With the back gesture correctly disabled on tab roots, a learner who opens it can only '
      + 'leave by whatever single link the screen happens to offer. That is a dead end.');
  }
}

// ── EVERY render path of a tab root must carry the bar, not just one ──
//
// The rule above only asks whether the file MENTIONS AppTabs, and that was not
// enough. On 2026-09-01, hours after `live.tsx` was given a tab bar, two new
// render paths were added to it for the Interview and Coaching segments. Both
// returned a bare screen view. The file still mentioned AppTabs, so the guard
// stayed green, and selecting Interview left the learner on a screen with no tab
// bar and no way back: the identical trap, in the identical file, the same day.
//
// So this walks the default export and checks what each `return (` actually
// opens with. A screen root that is not AppTabs has to be listed as deliberate.
const IMMERSIVE = {
  // The live session itself. Full bleed on purpose: the camera owns the screen
  // and the End button is the exit, which is a real exit rather than an absence.
  live: ['<KeyboardAvoidingView'],
};

for (const route of routes) {
  let src;
  try { src = readFileSync(join(MOBILE, `src/app/${route}.tsx`), 'utf8'); }
  catch { continue; }

  const start = src.search(/export default function/);
  if (start < 0) continue;
  // Bound the screen component at its own closing brace. Reading to EOF pulls in
  // every helper component and callback defined below it, whose returns are not
  // screen roots and must not be judged as if they were.
  const after = src.slice(start).split('\n');
  const end = after.findIndex((l, i) => i > 0 && l === '}');
  const lines = end > 0 ? after.slice(0, end) : after;
  const allowed = IMMERSIVE[route] ?? [];

  lines.forEach((line, i) => {
    // Two spaces is the component's final return; four is an early return
    // inside an `if`. Deeper is a callback, not a screen root. Safe to match
    // both now that the body is bounded at the component's closing brace.
    if (!/^ {2,4}return \($/.test(line)) return;
    // The first thing the return actually renders, skipping comments and blanks.
    let j = i + 1;
    while (j < lines.length && /^\s*($|\{?\/\*|\*|\/\/)/.test(lines[j])) j += 1;
    const root = (lines[j] ?? '').trim();
    if (root.startsWith('<AppTabs')) return;
    if (allowed.some((a) => root.startsWith(a))) return;
    fail(`src/app/${route}.tsx has a render path opening with \`${root.slice(0, 44)}\` `
      + 'instead of <AppTabs>.\n        Every path of a tab root needs the bar. One that does not '
      + 'strands the learner on a screen with no tabs and no back, which is exactly what happened '
      + "to the Interview segment.\n        If it is deliberately full bleed, add its opening tag to "
      + `IMMERSIVE.${route} in this file with the reason.`);
  });
}

// ── The entry gate is what the gesture escapes TO, so name it here ──
// If index.tsx ever stops being a redirect gate this guard's reasoning changes,
// and whoever changes it should see this.
const index = readFileSync(join(MOBILE, 'src/app/index.tsx'), 'utf8');
if (!/Redirect/.test(index)) {
  fail('app/index.tsx no longer redirects. This guard assumes it is the entry gate that a stray '
    + 'back gesture unwinds to; re-check the reasoning in this header before changing it.');
}

if (bad === 0) {
  console.log(`  ok    all ${routes.length} tab roots (${routes.join(', ')}) are declared, `
    + 'un-animated, and cannot be swiped away from');
  console.log('\ntab roots: all checks passed');
} else {
  console.error('\ntab roots: ' + bad + ' failure(s)');
}
process.exit(bad === 0 ? 0 : 1);
