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

// The line glyphs they replaced must not creep back in beside them.
if (/const (Flame|Bolt|Target|HeartGlyph): React\.FC/.test(strip)) {
  fail('a hand-drawn stat glyph is back in StatStrip alongside the painted set; pick one');
}

console.log(bad === 0
  ? `  ok    all ${STATS.length} stat icons present on both surfaces, with the mobile density ladder`
  : '');
console.log(bad === 0 ? '\nstat icons: all checks passed' : `\nstat icons: ${bad} failure(s)`);
process.exit(bad === 0 ? 0 : 1);
