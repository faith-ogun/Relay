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
  ? `  ok    all ${STATS.length} stat icons present on both surfaces, with the mobile density ladder`
  : '');
console.log(bad === 0 ? '\nstat icons: all checks passed' : `\nstat icons: ${bad} failure(s)`);
process.exit(bad === 0 ? 0 : 1);
