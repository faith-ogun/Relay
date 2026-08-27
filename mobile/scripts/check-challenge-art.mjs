// Every challenge the server can return must have art on the phone.
//
// A challenge card is built around its hero scene. If the server seeds a new
// series and the phone has no scene for it, nothing crashes and nothing is
// logged: `sceneFor` falls back to `firstlight`, so a brand new challenge ships
// wearing another challenge's picture. That is the worst kind of bug, because it
// looks deliberate. This script makes it a build failure instead.
//
// It checks four things against backend/live-bridge/app/community.py:
//
//   1. every `art` key the server seeds is a SceneKey with a scene behind it
//   2. every challenge `id` the server seeds resolves through SCENE_BY_ID, so a
//      challenge that arrives WITHOUT an art key still gets its own scene
//   3. every `theme` the server seeds exists in CHALLENGE_THEME
//   4. every SceneKey has both a SCENES and a PAINTED entry, so the painted
//      upgrade registry cannot drift out of step with the vector one
//
//   node scripts/check-challenge-art.mjs

import { readFileSync } from 'node:fs';

const ART = 'src/components/ChallengeArt.tsx';
const SERVER = '../backend/live-bridge/app/community.py';

// ── The server side ──
const serverSrc = readFileSync(SERVER, 'utf8');
const listStart = serverSrc.indexOf('DEFAULT_CHALLENGES = [');
if (listStart === -1) throw new Error(`Could not find DEFAULT_CHALLENGES in ${SERVER}.`);
const listEnd = serverSrc.indexOf('\n]', listStart);
if (listEnd === -1) throw new Error('DEFAULT_CHALLENGES is not terminated where expected.');
const listSrc = serverSrc.slice(listStart, listEnd);

// One chunk per challenge dict. Splitting on the dict opener keeps id, art and
// theme together, so a challenge missing one of them is caught as missing
// rather than silently paired with its neighbour's value.
const chunks = listSrc.split(/\n    \{\n/).slice(1);
const field = (chunk, name) => {
  const m = chunk.match(new RegExp(`"${name}":\\s*"([^"]+)"`));
  return m ? m[1] : null;
};

const seeded = chunks.map((chunk) => ({
  id: field(chunk, 'id'),
  art: field(chunk, 'art'),
  theme: field(chunk, 'theme'),
}));

if (seeded.length === 0) throw new Error('Parsed zero challenges from the server; the parser needs updating.');

const problems = [];
for (const c of seeded) {
  for (const key of ['id', 'art', 'theme']) {
    if (!c[key]) problems.push(`server challenge ${c.id ?? '(unnamed)'} has no "${key}"`);
  }
}

// ── The phone side ──
const artSrc = readFileSync(ART, 'utf8');

const unionMatch = artSrc.match(/export type SceneKey =([^;]*);/);
if (!unionMatch) throw new Error(`Could not find the SceneKey union in ${ART}.`);
const sceneKeys = [...unionMatch[1].matchAll(/'([a-z0-9]+)'/g)].map((m) => m[1]);

/** The keys of an object literal assigned to `name`. */
function recordKeys(name) {
  const at = artSrc.indexOf(name);
  if (at === -1) throw new Error(`Could not find ${name} in ${ART}.`);
  const open = artSrc.indexOf('{', at);
  const close = artSrc.indexOf('\n};', open);
  if (open === -1 || close === -1) throw new Error(`Could not read the body of ${name} in ${ART}.`);
  const body = artSrc.slice(open, close);
  return new Set([...body.matchAll(/^\s{2}([A-Za-z0-9]+):/gm)].map((m) => m[1]));
}

const scenes = recordKeys('const SCENES:');
const painted = recordKeys('const PAINTED:');
const byId = recordKeys('const SCENE_BY_ID:');
const themes = recordKeys('export const CHALLENGE_THEME:');

for (const c of seeded) {
  if (c.art && !scenes.has(c.art)) {
    problems.push(`${c.id}: art "${c.art}" has no scene in SCENES`);
  }
  if (c.art && !sceneKeys.includes(c.art)) {
    problems.push(`${c.id}: art "${c.art}" is not in the SceneKey union`);
  }
  if (c.id && !byId.has(c.id)) {
    problems.push(`${c.id}: no SCENE_BY_ID entry, so a card arriving without an art key would borrow another challenge's picture`);
  }
  if (c.theme && !themes.has(c.theme)) {
    problems.push(`${c.id}: theme "${c.theme}" is not in CHALLENGE_THEME`);
  }
}

for (const key of sceneKeys) {
  if (!scenes.has(key)) problems.push(`SceneKey "${key}" has no entry in SCENES`);
  if (!painted.has(key)) problems.push(`SceneKey "${key}" has no entry in PAINTED, so it can never be upgraded to painted art`);
}

if (problems.length) {
  console.error(`Challenges the phone cannot draw. Add the scene to ${ART}:\n`);
  problems.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}

console.log(
  `OK: all ${seeded.length} server challenges have art on the phone `
  + `(${sceneKeys.length} scenes, ${themes.size} themes).`,
);
