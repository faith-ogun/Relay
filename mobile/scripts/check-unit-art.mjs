// Every unit in the curriculum must have an emblem, at every density.
//
// The art is keyed by the curriculum's own unit ids, and `require` cannot take a
// computed path, so UnitEmblem.tsx carries a literal map. Nothing connects that
// map to the curriculum except this. Add a thirteenth unit server-side and the
// banner would simply render no picture: no crash, no warning, and on a surface
// where eleven neighbours DO have art, one gap reads as a broken build.
//
// Also catches the reverse. Art for a unit that no longer exists is dead weight
// shipped in every download, and the only way anyone would notice is by looking.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO = resolve(MOBILE, '..');

const fail = (msg) => { console.error(`check-unit-art: ${msg}`); process.exit(1); };

const curriculum = JSON.parse(
  readFileSync(join(REPO, 'backend/live-bridge/app/curriculum_data/curriculum.json'), 'utf8'),
);
const units = (curriculum.units ?? []).map((u) => u.id).filter(Boolean);
if (!units.length) fail('read no units out of curriculum.json');

const src = readFileSync(join(MOBILE, 'src/components/path/UnitEmblem.tsx'), 'utf8');
// Only the map body, so a unit id mentioned in a COMMENT cannot satisfy this.
const body = src.match(/const UNIT_ART:[^=]*=\s*\{([\s\S]*?)\n\};/);
if (!body) fail('could not find the UNIT_ART map in UnitEmblem.tsx');

const mapped = new Set();
for (const m of body[1].matchAll(/^\s*'?([a-z0-9-]+)'?\s*:\s*require\(/gm)) mapped.add(m[1]);
if (!mapped.size) fail('the UNIT_ART map parsed as empty');

const missing = units.filter((u) => !mapped.has(u));
if (missing.length) {
  fail(`the curriculum has units with no emblem: ${missing.join(', ')}. ` +
       `Add the art to mobile/assets/units/ and the entry to UnitEmblem.tsx.`);
}

const orphans = [...mapped].filter((u) => !units.includes(u));
if (orphans.length) {
  fail(`UnitEmblem.tsx maps art for units the curriculum no longer has: ${orphans.join(', ')}. ` +
       `Remove the entry and the files, or they ship in every download for nothing.`);
}

// Every density has to exist, not just the one the simulator happens to pick.
const densities = ['', '@2x', '@3x'];
const absent = [];
for (const u of units) {
  for (const d of densities) {
    const f = join(MOBILE, `assets/units/${u}${d}.png`);
    if (!existsSync(f)) absent.push(`${u}${d}.png`);
  }
}
if (absent.length) fail(`missing asset files: ${absent.join(', ')}`);

console.log(`check-unit-art: ok ${units.length} units, ${units.length * densities.length} files, no orphans`);
