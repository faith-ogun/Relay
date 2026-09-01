// Dark mode rots one component at a time. This is what stops it.
//
// The app has two themes. Every colour on screen has to come from the palette
// in src/theme, because that is the only thing that knows which theme is on.
// A colour that does not come from there is correct in exactly one theme and
// wrong in the other, and it is wrong SILENTLY: it typechecks, it builds, it
// looks right on the machine of whoever wrote it, and it is unreadable on a
// phone in dark mode.
//
// Four ways that happens, and one rule each.
//
//   1. A raw #rrggbb typed into a component. The obvious one.
//   2. A module-scope `StyleSheet.create`. This is the one that caused the
//      whole migration. `create` runs ONCE, at import, and freezes whatever
//      colours were current at that moment, so such a stylesheet can never
//      react to a theme change however correct its tokens are. `makeStyles`
//      exists precisely so a sheet is a function of the theme instead.
//   3. Reaching past the hooks for a palette directly. `lightColors` imported
//      into a screen is dark mode switched off for that screen.
//   4. `userInterfaceStyle` pinned in app.json. Set to "light", iOS reports
//      light to `Appearance` for ever, so System mode silently never resolves
//      to dark no matter what the phone is set to, and nothing anywhere fails.
//
//   node scripts/check-theme.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(MOBILE, 'src');
const THEME = join(SRC, 'theme');

let bad = 0;
const fail = (m) => { bad += 1; console.error(`  FAIL  ${m}`); };

/**
 * Colours that are NOT the theme's to decide, with the reason each one is not.
 *
 * Every entry here is a colour that is a fact about something outside the app:
 * a physical component, another company's brand, or artwork with its own baked
 * light. Adding a file is a claim of that kind, so write the reason.
 */
const NOT_THEMED = {
  'src/lesson/resistorCode.ts':
    'the IEC resistor band colours. Brown-black-red is what the part looks like',
  'src/lesson/ResistorBandStep.tsx':
    'the beige body of a real resistor, drawn to scale',
  'src/components/UnoBoard.tsx':
    'the Arduino Uno is teal. The board does not have a dark mode',
  'src/components/ChallengeArt.tsx':
    'the illustration palette. Painted artwork carries its own light, and it sits on a ground this file also paints',
  'src/lesson/levels.ts':
    'bronze, silver and gold are metals',
  'src/services/achievements.ts':
    'common / rare / epic / legendary, the colours every game uses for rarity',
  'src/components/SocialButton.tsx':
    "Google's brand blue, which their sign-in guidelines fix",
  'src/components/BrandSplash.tsx':
    'sampled from the launch PNG, which has its own ground baked in. It has to match the image, not the theme',
  'src/app/simulator.tsx':
    'phosphor green on the serial console, which is a slab and dark in both themes',
};

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p)) files.push(p);
  }
})(SRC);

/**
 * Blank out every comment, keeping the line numbering, so the checks read code
 * and never prose. A note explaining WHY a colour is wrong has to be able to
 * name the colour.
 */
const withoutComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGB = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/;

/**
 * A translucent wash may be spelled by hand only when it means the same thing
 * in both themes: white light, or a black scrim. Those are near-neutral and at
 * one end of the range. Anything else is a brand colour copied out of the
 * palette, and `withAlpha(colors.x, a)` is how to say it instead.
 */
const neutralWash = (r, g, b) => {
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  return spread <= 12 && (Math.max(r, g, b) <= 44 || Math.min(r, g, b) >= 215);
};

for (const file of files) {
  const rel = relative(MOBILE, file);
  const inTheme = file.startsWith(THEME);
  const exempt = NOT_THEMED[rel];
  const src = readFileSync(file, 'utf8');
  const code = withoutComments(src);

  // ── 1. raw colours ──────────────────────────────────────────────────────
  if (!inTheme && !exempt) {
    code.split('\n').forEach((line, i) => {
      const hex = line.match(HEX);
      if (hex) {
        fail(`${rel}:${i + 1} paints ${hex[0]} directly. Take it from the palette, or add this file `
          + 'to NOT_THEMED in this script with the reason it is not the theme\'s to decide.');
      }
      const rgb = line.match(RGB);
      if (rgb && !neutralWash(+rgb[1], +rgb[2], +rgb[3])) {
        fail(`${rel}:${i + 1} spells a brand colour as ${rgb[0]}...). `
          + 'Use withAlpha(colors.x, a) so it follows the palette.');
      }
    });
  }

  // ── 2. stylesheets frozen at import ─────────────────────────────────────
  //
  // Matched at the start of a line: a `StyleSheet.create` indented inside a
  // component is re-run on render and is not the defect this is about.
  for (const m of code.matchAll(/^(export )?const (\w+)(: [^=]+)? = StyleSheet\.create\(/gm)) {
    const line = code.slice(0, m.index).split('\n').length;
    fail(`${rel}:${line} builds \`${m[2]}\` with StyleSheet.create at module scope, so it is `
      + 'evaluated once at import and keeps whichever theme happened to be on. '
      + 'Use makeStyles((colors, th) => ({ ... })) and call the hook in the component.');
  }

  // ── 3. reaching past the hooks ──────────────────────────────────────────
  if (!inTheme) {
    for (const m of code.matchAll(/import \{([^}]*)\} from '[^']*theme\/tokens'/g)) {
      for (const spec of m[1].split(',').map((x) => x.trim())) {
        if (/^(lightColors|darkColors|colors)$/.test(spec.replace(/^type /, ''))) {
          const line = code.slice(0, m.index).split('\n').length;
          fail(`${rel}:${line} imports \`${spec}\` straight from the tokens. That is one theme, `
            + 'fixed. Use useColors() or the makeStyles factory argument.');
        }
      }
    }
  }
}

// ── 4. the OS has to be allowed to tell us, in BOTH files ─────────────────
//
// This checked app.json alone and it was not enough. On 2026-09-01 app.json read
// "automatic" while `ios/Ohmlet/Info.plist` still read `Light`, and the app
// obeys the plist: iOS forced light appearance, `Appearance.getColorScheme()`
// returned "light" for ever, and System mode reported "following your phone,
// which is set to light" on a phone that was set to dark.
//
// The cause is that `ios/` is a COMMITTED native project. Editing app.json does
// not regenerate Info.plist without an `expo prebuild`, so the two drift and the
// one that ships is the one nobody edited. Both are checked now.
const app = JSON.parse(readFileSync(join(MOBILE, 'app.json'), 'utf8'));
const style = app.expo?.userInterfaceStyle;
if (style !== 'automatic') {
  fail(`app.json sets userInterfaceStyle to ${JSON.stringify(style)}. Anything but "automatic" makes `
    + 'iOS report that scheme to Appearance for ever, so System mode can never resolve to the other one.');
}

const PLIST = join(MOBILE, 'ios', 'Ohmlet', 'Info.plist');
try {
  const plist = readFileSync(PLIST, 'utf8');
  const m = plist.match(/<key>UIUserInterfaceStyle<\/key>\s*<string>([^<]*)<\/string>/);
  if (m && m[1] !== 'Automatic') {
    fail(`ios/Ohmlet/Info.plist pins UIUserInterfaceStyle to "${m[1]}".\n`
      + '        iOS obeys the PLIST, not app.json. With this set, the whole app is forced to that '
      + 'appearance and Appearance.getColorScheme() returns it for ever, so System mode reports the '
      + 'wrong thing on a phone set to the other one. Set it to Automatic, or delete the key.\n'
      + '        app.json alone does not fix this: ios/ is a committed native project, so its value '
      + 'only reaches the plist through an expo prebuild.');
  }
} catch {
  // No native project checked out. app.json is then the only source of truth
  // and the check above already covers it.
}

// ── 5. the palettes have to agree ─────────────────────────────────────────
//
// TypeScript already enforces this through `darkColors: Colors`, but the error
// it gives points at a type, and the thing that is actually wrong is that a
// colour has no dark value.
const tokens = readFileSync(join(THEME, 'tokens.ts'), 'utf8');
const keysOf = (name) => {
  const start = tokens.indexOf(`export const ${name}: Colors = {`);
  if (start < 0) return null;
  const body = tokens.slice(start, tokens.indexOf('\n};', start));
  return [...body.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]).sort();
};
const light = keysOf('lightColors');
const dark = keysOf('darkColors');
if (!light || !dark) {
  fail('src/theme/tokens.ts no longer exports lightColors and darkColors as Colors');
} else {
  for (const k of light) if (!dark.includes(k)) fail(`\`${k}\` has a light value and no dark one`);
  for (const k of dark) if (!light.includes(k)) fail(`\`${k}\` has a dark value and no light one`);
}

console.log(bad === 0
  ? `  ok    ${files.length} files take every colour from the theme, `
    + `${light ? light.length : 0} tokens defined in both`
  : '');
console.log(bad === 0 ? '\ntheme: all checks passed' : `\ntheme: ${bad} failure(s)`);
process.exit(bad === 0 ? 0 : 1);
