// The four stat icons must exist, on both surfaces, at every density.
//
// They are painted artwork rather than glyphs drawn in code, so a missing file
// is a blank square where a learner's XP should be, and Metro resolves `require`
// at build time so it is a build failure on mobile and a silent hole on web.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO = resolve(MOBILE, '..');
const STATS = ['xp', 'streak', 'hearts', 'goal'];

let bad = 0;
const fail = (m) => { bad += 1; console.error(`  FAIL  ${m}`); };

// Mobile: every require resolves, with its density ladder beside it.
const strip = readFileSync(join(MOBILE, 'src/components/StatStrip.tsx'), 'utf8');
for (const name of STATS) {
  if (!new RegExp(`${name}:\\s*require\\(`).test(strip)) {
    fail(`StatStrip no longer requires the ${name} icon, so that stat is drawing nothing`);
    continue;
  }
  for (const suffix of ['', '@2x', '@3x']) {
    const f = join(MOBILE, 'assets/stats', `${name}${suffix}.png`);
    if (!existsSync(f)) {
      fail(`mobile/assets/stats/${name}${suffix}.png is missing`
        + (suffix ? ', so a 2x or 3x phone falls back to the blurry 1x bitmap' : ''));
    }
  }
}

// ── The second surface: the Profile stat block ─────────────────────────────
//
// Profile shows the same four numbers as the strip, larger. On 2026-09-01 it
// stopped drawing them as a coloured figure with a caption and started drawing
// the artwork, because Faith's verdict on the old block was that it was "a wee
// bit ugly and a wee bit rudimentary" while the app already owned a picture of
// every one of those numbers.
//
// Two of the four have painted bitmaps and two are drawn in components/icons
// (Built and live minutes have no bitmap), and each half regresses silently in
// its own way:
//
//   the bitmaps  a second `require` of assets/stats here is a second registry,
//                and this script only protects the one in StatStrip
//   the drawn    deleting a glyph is a compile error, but a Profile that quietly
//                stops rendering one and goes back to a bare number is not
const profile = readFileSync(join(MOBILE, 'src/app/profile.tsx'), 'utf8');
const icons = readFileSync(join(MOBILE, 'src/components/icons.tsx'), 'utf8');

if (/require\(\s*['"][^'"]*assets\/stats\//.test(profile)) {
  fail('profile.tsx requires the stat PNGs directly. Import STAT_ART from components/StatStrip '
    + 'instead: the density ladder above protects ONE registry, and a second copy drifts off it.');
}
if (!/STAT_ART/.test(profile)) {
  fail('profile.tsx no longer uses STAT_ART, so XP and the streak have lost their artwork there '
    + 'and are back to being bare numbers in a box.');
}
for (const glyph of ['BuiltGlyph', 'MinutesGlyph']) {
  if (!new RegExp(`export const ${glyph}`).test(icons)) {
    fail(`components/icons.tsx no longer exports ${glyph}, which is the only drawing of that stat.`);
  }
  if (!new RegExp(`<${glyph}\\b`).test(profile)) {
    fail(`profile.tsx no longer draws <${glyph} />. Built and live minutes have no painted bitmap, `
      + 'so these two ARE their icons, and one stat without a picture in a block of four that have '
      + 'one reads as a missing asset.');
  }
}

// ── The trophy shelf shows the CARDS, not the card's name ──────────────────
//
// The defect, same day: "the achievements shouldn't show the icons that they
// created, it should show the actual preview of the cards, because we already
// have cards". Profile was printing each medal's TITLE in a small white
// rectangle while /achievements had been rendering the painted card art all
// along, from the same catalogue field.
//
// Both go through components/MedalArt now, which is one `onError` and therefore
// one degradation path. A screen that hand-rolls a second `<Image source={{ uri:
// a.art }}>` is exactly how one surface ends up falling back to its tier disc
// while the other shows a hole.
for (const rel of ['src/app/profile.tsx', 'src/app/achievements.tsx']) {
  const src = readFileSync(join(MOBILE, rel), 'utf8');
  if (!/<MedalArt\b/.test(src)) {
    fail(`${rel} does not render <MedalArt />, so it is not showing the achievement card art the `
      + 'catalogue serves.');
  }
  if (/source=\{\{\s*uri:\s*a\.art/.test(src)) {
    fail(`${rel} loads a.art through its own <Image>. Use MedalArt, so both surfaces degrade the `
      + 'same way when a medal fails to load.');
  }
}

// Web: the file the markup points at has to be there.
const home = readFileSync(join(REPO, 'frontend/components/WorkspaceHome.tsx'), 'utf8');
for (const m of home.matchAll(/art="\/stats\/([a-z]+)\.png"/g)) {
  if (!existsSync(join(REPO, 'frontend/public/stats', `${m[1]}.png`))) {
    fail(`the web asks for /stats/${m[1]}.png and it is not in frontend/public/stats`);
  }
}

// ── The tab bar, same rules ────────────────────────────────────────────────
// Comments stripped: this file EXPLAINS what was removed, and matching the
// explanation instead of the code is the false alarm that trains people to
// ignore a check.
const tabsRaw = readFileSync(join(MOBILE, 'src/components/TabBar.tsx'), 'utf8');
const tabs = tabsRaw.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
const TABS = ['learn', 'practice', 'live', 'community', 'plans', 'profile'];
for (const name of TABS) {
  for (const state of ['off', 'on']) {
    if (!new RegExp(`${name}-${state}\\.png`).test(tabsRaw)) {
      fail(`TabBar no longer references ${name}-${state}.png, so that tab draws nothing in that state`);
      continue;
    }
    for (const suffix of ['', '@2x', '@3x']) {
      const f = join(MOBILE, 'assets/nav', `${name}-${state}${suffix}.png`);
      if (!existsSync(f)) fail(`mobile/assets/nav/${name}-${state}${suffix}.png is missing`);
    }
  }
}
// The selected state carries its own plate, so a second one drawn in code would
// sit behind it.
if (/slotOn/.test(tabs)) {
  fail('TabBar draws slotOn behind the icon again, and the selected artwork already has a plate');
}

// The drawn placeholder must not come back now the artwork exists.
//
// TabBar carried an SVG battery for one day while Faith made the real icon. The
// swap is done; this is what stops a future "just until we have art" from
// quietly becoming permanent beside a painted set.
if (/const PlansIcon: React\.FC/.test(tabsRaw)) {
  fail('TabBar is drawing PlansIcon again, and assets/nav/plans-*.png exist. Use the artwork.');
}

// The line glyphs they replaced must not creep back in beside them.
if (/const (Flame|Bolt|Target|HeartGlyph): React\.FC/.test(strip)
    || /const (LearnIcon|PracticeIcon|LiveIcon|CommunityIcon|ProfileIcon): React\.FC/.test(tabs)) {
  fail('a hand-drawn stat glyph is back in StatStrip alongside the painted set; pick one');
}

console.log(bad === 0
  ? `  ok    all ${STATS.length} stat icons present on both surfaces, with the mobile density ladder,`
    + '\n  ok    Profile draws the artwork for all four stats and the real achievement cards'
  : '');
console.log(bad === 0 ? '\nstat icons: all checks passed' : `\nstat icons: ${bad} failure(s)`);
process.exit(bad === 0 ? 0 : 1);
