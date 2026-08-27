// No Gemini model may outlive its retirement date without somebody noticing.
//
// gemini-2.5 retires 2026-10-16, which falls inside the Shipaton judging window.
// A model that stops answering takes the live tutor with it, and the failure
// arrives on a date rather than in a diff, so nothing in review would catch it.
// This turns that date into a build failure with warning first.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(dirname(fileURLToPath(import.meta.url))), '..');

/**
 * Retirement dates, and what to move to.
 *
 * Availability was PROBED against this project on 2026-08-27, not read off a
 * docs page: in europe-west1 only 2.5 answers, and on `global` 3.5, 3.6 and 3.7
 * flash all answer while no 3.x Pro exists yet.
 */
const RETIRING = [
  // Catches BOTH id forms: gemini-2.5-flash and gemini-live-2.5-flash-native-audio.
  { match: /gemini-(?:[a-z]+-)?2\.5-/, retires: '2026-10-16', note: 'move to a gemini-3.x model on location=global' },
];

/** Warn this many days before the date, so it is never a surprise. */
const WARN_DAYS = 90;

// Today comes from the environment, never from a hardcoded literal, so this
// starts failing on its own.
const today = new Date();

const FILES = [];
const walk = (dir, depth = 0) => {
  if (depth > 4 || !existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, depth + 1);
    else if (/\.(py|sh|ts|tsx)$/.test(e.name)) FILES.push(full);
  }
};
walk(join(REPO, 'backend'));
FILES.push(join(REPO, 'deploy.sh'));

let bad = 0;
let warned = 0;
const hits = new Map();

for (const f of FILES) {
  // The prober NAMES old models on purpose: they are the candidates it tries,
  // and the current one is the control that proves the probe works. Flagging it
  // is flagging the tool that exists to clear the flag.
  if (f.endsWith('probe_models.py')) continue;
  const src = readFileSync(f, 'utf8');
  for (const line of src.split('\n')) {
    // Only DEFAULTS and deploy values matter. A comment naming an old model, or
    // a doc line explaining the migration, is not a dependency on it.
    if (/^\s*[#/]/.test(line)) continue;
    for (const r of RETIRING) {
      const m = line.match(new RegExp(`(gemini-(?:[a-z]+-)?2\\.5-[a-z0-9.-]*)`));
      if (!m) continue;
      const key = `${m[1]}`;
      const at = hits.get(key) ?? { retires: r.retires, note: r.note, where: new Set() };
      at.where.add(f.slice(REPO.length + 1));
      hits.set(key, at);
    }
  }
}

for (const [model, info] of hits) {
  const days = Math.round((new Date(info.retires) - today) / 86400000);
  const where = [...info.where].join(', ');
  if (days <= 0) {
    bad += 1;
    console.error(`  FAIL  ${model} retired ${info.retires}, ${-days} days ago, and is still referenced in ${where}. ${info.note}`);
  } else if (days <= WARN_DAYS) {
    warned += 1;
    // A live/native-audio model is a different kind of warning: as of
    // 2026-08-27 Google publishes no 3.x successor that this project can reach,
    // in any region, verified by opening real bidi sessions
    // (backend/live-bridge/scripts/probe_models.py). So it is blocked upstream
    // rather than forgotten, and saying so is the difference between a warning
    // somebody acts on and one they learn to scroll past.
    const isLive = /live|native-audio/.test(model);
    const why = isLive
      ? 'BLOCKED UPSTREAM: no 3.x live model is reachable yet. '
        + 'Run backend/live-bridge/scripts/probe_models.py to check again; it exits 0 the day one appears.'
      : info.note;
    console.error(`  WARN  ${model} retires ${info.retires}, in ${days} days, still in ${where}. ${why}`);
  }
}

if (bad === 0 && warned === 0) console.log('  ok    no model in use is near its retirement date');
if (bad === 0 && warned > 0) console.log(`\nmodel currency: ${warned} warning(s), nothing retired yet`);
if (bad > 0) console.log(`\nmodel currency: ${bad} retired model(s) still in use`);
process.exit(bad === 0 ? 0 : 1);
