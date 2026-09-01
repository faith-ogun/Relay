#!/usr/bin/env node
// Dark mode rots one component at a time, so this fails on the first raw colour.
//
// The whole web palette is CSS channel variables bound into Tailwind, which means
// roughly 1,700 `bg-ohmlet-*` classes theme themselves for free. A raw Tailwind
// colour is immune to all of it: `bg-white` stays white on a dark page.
//
// That is not hypothetical. On 2026-09-01, when dark mode was added, there were
// 234 `bg-white`, 113 `text-white` and 55 slate/gray classes already in the tree,
// and every card in the app would have stayed white. The point of this guard is
// that the 235th is caught the day it is written rather than the day someone
// switches themes.
//
// It also catches two real defects found in that sweep:
//   - `bg-ohmlet-slate-900` in TwinStudio and InterviewView. There is no `slate`
//     under `ohmlet` in the config, so both elements shipped with NO background.
//     A class that looks like a token but is not is invisible in review.
//   - 23 places wrote `bg-ohmlet-ink text-white`. Ink inverts to near-white on
//     dark, so all 23 would have rendered white on white.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const COMPONENTS = join(ROOT, 'components');

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const f = join(dir, n);
  return statSync(f).isDirectory() ? walk(f) : /\.tsx?$/.test(f) ? [f] : [];
});

// Translucent white over a dark ground is deliberate glass and reads correctly in
// both themes. Only near-opaque values are card surfaces in disguise.
const RAW_NEUTRAL = /\b(?:bg|text|border|ring|divide|placeholder)-(?:white|black|slate|gray|zinc|neutral|stone)(?:-[0-9]{2,3})?\b(?!\/)/g;
const GLASS = /\bbg-white\/(?:5|10|15|20|25|30)\b/;
const FAKE_TOKEN = /\b(?:bg|text|border)-ohmlet-(?:slate|gray|zinc|white|black)[a-z0-9-]*/g;
const WHITE_ON_INK = /bg-ohmlet-ink[^"'`]*\btext-white\b|\btext-white\b[^"'`]*bg-ohmlet-ink/;

// White text on a SATURATED surface is correct in both themes, because those
// colours barely move between them: gold stays gold. Only white on a surface
// that inverts is a bug, and WHITE_ON_INK above catches that case exactly.
const ON_SATURATED = new RegExp(
  'bg-(?:'
  + 'ohmlet-(?:gold|gold-deep|red|blue|blue-deep|green|green-deep|panel)'   // brand
  + '|black'
  + '|\\[#[0-9a-fA-F]{3,8}\\]'                                                 // arbitrary value
  + '|(?:rose|sky|emerald|amber|indigo|violet|fuchsia|cyan|teal|lime|orange|red|blue|green|yellow|purple|pink)-[456789]00'
  + ')');

// Files that describe PHYSICAL THINGS, not user interface.
//
// A red LED is #ef4444 because the LED is red. A red jumper wire is red on a
// dark bench and on a light one. Theming these would be a category error: the
// colour is the component's identity, not a surface we are styling, and a
// learner matching a real part against the screen needs it to stay put.
const PHYSICAL = [
  'components/ohmlet/circuits/',   // wire and probe colours in circuit diagrams
  'components/Sandbox.tsx',        // the parts palette: LEDs, boards, resistors
  'components/ohmlet/data/library.ts',
  'components/ohmlet/data/levels.ts',
];
const isPhysical = (rel) => PHYSICAL.some((p) => rel.replace(/\\/g, '/').includes(p));

// Surfaces that are dark in BOTH themes, by design rather than by theme.
//
// A video player is black because video is watched on black. A camera overlay
// sits on whatever the learner's bench looks like. The 3D twin viewer is a dark
// stage so the model reads. The marketing header's dark route is a deliberate
// design choice on the landing side. White text on all of these is correct in
// light mode AND dark mode, and "fixing" them to follow the theme would make a
// video player turn white behind the video.
//
// Listed explicitly rather than detected, because the honest signal is intent,
// and intent is not visible in a class name. Adding a file here is a decision
// somebody should have to make on purpose.
const DARK_CHROME = [
  'components/ohmlet/FilmModal.tsx',
  'components/ohmlet/views/LiveTutorView.tsx',
  'components/ohmlet/twin/TwinStudio.tsx',
  'components/ohmlet/twin/SharedTwinPage.tsx',
  'components/ohmlet/achievements/HoloCard.tsx',
  'components/Header.tsx',
];
const isDarkChrome = (rel) => DARK_CHROME.some((p) => rel.replace(/\\/g, '/').includes(p));

// THE LIMIT OF THIS GUARD, stated rather than hidden.
//
// It reads one line at a time, so it can see `bg-ohmlet-ink text-white` on a
// single line and cannot see white text whose dark ground is set on a PARENT
// element, or by a CSS class like `ohmlet-podium-3`, or by a `isMax ?` branch
// that colours the card three levels up.
//
// Those are legitimate and the guard cannot prove it, so they are listed. The
// alternative is parsing JSX to resolve ancestor backgrounds, which is a great
// deal of machinery to catch a mistake that has not happened yet.
//
// If you add a file here, satisfy yourself that the white text really does sit
// on something dark in BOTH themes. That is the whole judgement being recorded.
const DARK_SECTION = [
  'components/BlogPostPage.tsx',      // dark closing band
  'components/LearnPage.tsx',         // dark closing band
  'components/LearnPath.tsx',         // active node, dark pill
  'components/SupportPage.tsx',       // dark closing band
  'components/PricingPage.tsx',       // the Max card is dark in both themes
  'components/UpgradeSuccess.tsx',    // same Max card
  'components/ohmlet/views/CommunityView.tsx',  // podium places, league banner
  'components/Sandbox.tsx',           // the simulator canvas is a dark stage in both themes
  // Logo takes an explicit `tone` prop, so the CALLER has declared whether the
  // ground is dark. The intent is in the code, just as a prop rather than as a
  // class on the same line, which is the one thing this guard cannot read.
  'components/Logo.tsx',
];
const isDarkSection = (rel) => DARK_SECTION.some((p) => rel.replace(/\\/g, '/').includes(p));

let bad = 0;
const fail = (m) => { bad += 1; console.error(`  FAIL  ${m}`); };
let scanned = 0;

for (const file of walk(COMPONENTS)) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);
  scanned += 1;

  const darkChrome = isDarkChrome(rel) || isDarkSection(rel);

  for (const line of src.split('\n')) {
    if (GLASS.test(line)) continue;   // deliberate glass, correct on both grounds
    // Dark-by-design surfaces keep their white text; a surface that inverts is
    // still caught below, because WHITE_ON_INK is checked regardless.
    if (darkChrome && /\btext-white\b|\bborder-white\b|\bbg-black\b|\btext-black\b/.test(line)
        && !WHITE_ON_INK.test(line)) continue;

    const raw = line.match(RAW_NEUTRAL);
    if (raw && raw.every((c) => c === 'text-white' || c === 'text-black') && ON_SATURATED.test(line)) continue;
    if (raw) {
      fail(`${rel}: raw Tailwind colour ${[...new Set(raw)].join(', ')}\n`
        + '        These bypass the palette entirely and will not follow the theme. '
        + 'Use an ohmlet token: bg-ohmlet-surface for a card, text-ohmlet-ink / '
        + 'ink-soft / ink-mute for text, border-ohmlet-line for a hairline, '
        + 'bg-ohmlet-panel for a deliberately dark panel.');
    }

    const fake = line.match(FAKE_TOKEN);
    if (fake) {
      fail(`${rel}: ${[...new Set(fake)].join(', ')} is not a real token.\n`
        + '        It LOOKS like one, so it survives review, but Tailwind emits nothing '
        + 'and the element renders with no colour at all.');
    }

    if (WHITE_ON_INK.test(line)) {
      fail(`${rel}: text-white on bg-ohmlet-ink.\n`
        + '        Ink inverts to near-white in dark mode, so this renders white on white. '
        + 'Use text-ohmlet-on-ink, which inverts with the surface under it.');
    }
  }
}

// A literal hex belongs in styles.css, where both themes are defined together.
for (const file of walk(COMPONENTS)) {
  const rel = relative(ROOT, file);
  if (isPhysical(rel)) continue;
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/(?:color|background|backgroundColor|fill|stroke)\s*:\s*'(#[0-9a-fA-F]{3,8})'/g)) {
    fail(`${rel}: inline literal colour ${m[1]}.\n`
      + '        Inline styles cannot be themed. Move it to a token in styles.css, '
      + 'which is the one place both themes are written side by side.');
  }
}

if (bad === 0) {
  console.log(`  ok    ${scanned} components carry no raw colour: every surface follows the theme`);
  console.log('\ntheme: all checks passed');
} else {
  console.error(`\ntheme: ${bad} failure(s)`);
}
process.exit(bad === 0 ? 0 : 1);
