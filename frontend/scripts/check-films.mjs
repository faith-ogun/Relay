#!/usr/bin/env node
// Nobody may decide for themselves which skills have a film.
//
// Three places used to answer that question independently, and all three
// answered it by guessing the same way: "every skill that is not a review or a
// gateway has a film". backend/live-bridge/app/films.py, mobile's labs screen
// and the web's LabsView each carried their own copy of that rule.
//
// It was true on the day the films were rendered. Six skills were authored on
// 2026-08-28 and it became false everywhere at once: the index claimed 49 films,
// the bucket held 43, and Labs drew a play button on six skills whose film does
// not exist. Pressing it signed a URL for a missing object.
//
// The answer now comes from one place: content/films.json, generated from the
// bucket by sync-films.mjs, stamped onto every skill as `hasFilm` by the
// curriculum export, and read by everybody. This check enforces that.
//
// It does NOT talk to GCS, so it runs in CI. sync-films.mjs is the half that
// needs credentials.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO = resolve(FRONTEND, '..');
const read = (p) => readFileSync(join(REPO, p), 'utf8');

let bad = 0;
const fail = (m) => { bad += 1; console.error(`  FAIL  ${m}`); };

const films = JSON.parse(read('content/films.json'));
const filmed = new Set(films.skills);
const exported = JSON.parse(read('backend/live-bridge/app/curriculum_data/curriculum.json'));

// ── 1. The stamp matches the manifest, skill for skill ──
const skills = exported.units.flatMap((u) => u.skills ?? []);
const stamped = new Set(skills.filter((s) => s.hasFilm).map((s) => s.id));

for (const id of filmed) {
  if (!skills.some((s) => s.id === id)) {
    fail(`content/films.json lists a film for '${id}', which is not a skill in the curriculum. `
      + 'Either the skill was renamed and the film needs re-uploading under the new id, or the entry is stale.');
  } else if (!stamped.has(id)) {
    fail(`'${id}' has a film in the bucket and the exported curriculum does not say so. Re-run export-curriculum.mjs.`);
  }
}
for (const id of stamped) {
  if (!filmed.has(id)) {
    fail(`the exported curriculum claims '${id}' has a film and content/films.json does not list one. `
      + 'This is the defect this check exists for: a play button over an object that is not there.');
  }
}

// ── 2. Nobody re-derives it from the skill id ──
// The old rule, in any of its spellings. Matching the shape rather than one
// exact string, because the next copy of it will be spelled slightly differently.
const GUESSERS = [
  ['backend/live-bridge/app/films.py', /endswith\(\s*\(?\s*["']-check["']/],
  ['mobile/src/app/labs.tsx', /endsWith\(\s*['"]-check['"]/],
  ['frontend/components/ohmlet/views/LabsView.tsx', /endsWith\(\s*['"]-check['"]/],
];
for (const [file, re] of GUESSERS) {
  let src;
  try { src = read(file); } catch { continue; }
  if (re.test(src)) {
    fail(`${file} still decides for itself which skills have a film, by the shape of the skill id. `
      + 'Read `hasFilm` off the skill instead: the bucket is the only thing that knows.');
  }
}

// ── 3. A film script's id must BE its skill id ──
//
// films.py signs `v1/<skill>/ohmlet-lesson-<skill>-<shape>.mp4`, and every file
// name in the pipeline comes from the script's `id`. When the two differ, the
// film uploads to an address the server never asks for and 404s in production
// while every other film works.
//
// It happened twice. closed-loop was circuits-current and time-constant was
// rc-charging: their folders had been renamed by hand and the files inside them
// had not, so the two films were dead for weeks. circuits-current is the first
// film in Foundations, which made it the one a new learner was most likely to
// press.
{
  const dir = join(REPO, 'video/src/lesson-film/lessons');
  let names = [];
  try { names = readdirSync(dir).filter((n) => n.endsWith('.ts')); } catch { names = []; }
  for (const name of names) {
    const src = readFileSync(join(dir, name), 'utf8');
    const id = src.match(/^\s*id:\s*'([^']+)'/m)?.[1];
    const skillId = src.match(/^\s*skillId:\s*'([^']+)'/m)?.[1];
    const fileId = name.replace(/\.ts$/, '');
    if (!id || !skillId) {
      fail(`video/.../${name} has no id or no skillId, so nothing can work out where to publish it`);
      continue;
    }
    if (id !== skillId) {
      fail(`video/.../${name}: id '${id}' is not skillId '${skillId}'. `
        + 'Every file name in the pipeline comes from `id` and the server signs by skill, so this film would 404.');
    }
    if (fileId !== id) {
      fail(`video/.../${name}: the file is named '${fileId}' and its id is '${id}'. `
        + 'render-lessons.sh and upload.sh take ids from file names, so these must match.');
    }
  }
}

// ── 4. What is not filmed, said out loud ──
// Not a failure. A newly authored skill legitimately has no film until one is
// rendered, and failing here would mean authoring a lesson breaks the build. But
// a silent gap is how six of them went unnoticed, so it gets printed every run.
const unfilmed = skills
  .filter((s) => !s.hasFilm && !/-check$|-gateway$/.test(s.id))
  .map((s) => s.id);

if (bad === 0) {
  console.log(`check-films: ok  ${filmed.size} skills have a film, and the curriculum, the manifest `
    + 'and every client agree on which.');
  if (unfilmed.length) {
    console.log(`  ${unfilmed.length} skill(s) have no film yet, so no surface offers one: ${unfilmed.join(', ')}`);
    console.log('  Render them with video/scripts/render-lessons.sh, upload, then sync-films.mjs.');
  }
} else {
  console.error('\ncheck-films: the film index and what is in the bucket disagree.');
}
process.exit(bad === 0 ? 0 : 1);
