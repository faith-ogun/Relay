// Every step type the curriculum authors must have a renderer that matches its
// SHAPE, and that actually USES the shape.
//
// Three failures, and each one rewrote this file.
//
// First: identify_component was in SUPPORTED and fell through to the choice
// renderer, which maps over `step.options`, a field it does not have. All 48
// threw, taking down 42 of the 142 lessons the moment the step came up. Nothing
// caught it because "supported" only ever meant "the type is in a set".
//
// Second, and worse because it never threw: 155 predict_reading steps carry a
// `meter` spec (a range, a granularity, a target, a tolerance) and 45
// choose_resistor steps carry a `bands` spec. Both fell through to the choice
// renderer, whose `options` array holds ONE entry: the answer, in words. So the
// question read "dial the voltage at the midpoint" and the app drew a single
// button saying "2.5 V". 200 exercises handed over their own answer.
//
// Third, and the reason for the rule below: 26 multiple_choice steps carry
// `optionImages`, four photographs of real parts. The renderer never read the
// field, so "Tap the LED" drew four words, one of which was the word LED. The
// PREVIOUS version of this file held a renderer to a field only when the field
// appeared on at least 50% of that type's steps. 26 of 420 is 6%. The threshold
// was a compromise, and this is what a compromise buys: the check ran green over
// a defect of exactly the class it was written to catch. It also sat green over
// 54 match steps whose component photographs were dropped, and over a teach step
// whose body says "tap each part of this loop" above a diagram that ignored
// every tap.
//
// So there is no threshold any more. ONE authored step is a contract. Every
// field name in the corpus is enumerated in FIELD_POLICY below with a decision
// and a reason, a field with no entry fails, and a field whose values carry an
// asset path or a composed spec CANNOT be given anything but "consumed", so the
// judgement call that hid optionImages is not available to make again.
//
//   node scripts/check-step-renderers.mjs           the checks
//   node scripts/check-step-renderers.mjs --table   every field and its decision
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const LESSONS = '/Users/faith/Desktop/Ohmlet/backend/live-bridge/app/curriculum_data/lessons.json';
const LESSON_DIR = new URL('../src/lesson/', import.meta.url);
const VIEW = new URL('StepView.tsx', LESSON_DIR);

const lessons = JSON.parse(readFileSync(LESSONS, 'utf8')).lessons;
const view = readFileSync(VIEW, 'utf8');
const SHOW_TABLE = process.argv.includes('--table');

let bad = 0;
const fail = (m) => { bad += 1; console.error(`  FAIL  ${m}`); };
const ok = (m) => console.log(`  ok    ${m}`);
const gap = (m) => console.log(`  gap   ${m}`);

// ── Which component does each step type reach? ───────────────────────────────
//
// A case body may route conditionally (predict_reading goes to MeterStep when it
// carries a meter and ChoiceStep when it does not), so a type maps to the SET of
// components its branch can reach, and the renderer's "source" is all of them.
const bodies = [...view.matchAll(/case '([a-z_]+)':([\s\S]*?)(?=\n    case '|\n    default:)/g)];
const routes = new Map();
for (const [, type, body] of bodies) {
  const comps = [...body.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)].map((m) => m[1]);
  const prev = routes.get(type) ?? new Set();
  for (const c of comps) prev.add(c);
  routes.set(type, prev);
}
// Fall-through cases (draw_circuit / draw_fix) share the next case's body.
for (const [, type, body] of bodies) {
  if (!/<[A-Z]/.test(body)) {
    const i = bodies.findIndex((b) => b[1] === type);
    for (let j = i + 1; j < bodies.length; j += 1) {
      if (/<[A-Z]/.test(bodies[j][2])) { routes.set(type, routes.get(bodies[j][1])); break; }
    }
  }
}
const DEFAULT_COMPONENT = (view.match(/default:[\s\S]*?<([A-Z][A-Za-z0-9]*)\b/) ?? [])[1];
if (!DEFAULT_COMPONENT) fail('cannot find the default branch of the step router');

// Read a component's source, plus one level of its own local imports, since a
// renderer legitimately delegates (MeterStep reads the spec through meterScale,
// ImageChoiceStep fetches through componentArt).
const sourceCache = new Map();
function sourceFor(component) {
  if (sourceCache.has(component)) return sourceCache.get(component);
  let text = '';

  // Most renderers are declared inline in StepView.tsx. Take that component's own
  // block, not the whole file: the whole file mentions every field of every step
  // type, so matching against it would pass anything and this check would be
  // decoration. Scan from the declaration to the next top-level declaration, or
  // to the end of the file for the last one.
  const at = view.search(new RegExp(`\\nconst ${component}: React\\.FC`));
  if (at >= 0) {
    const rest = view.slice(at + 1);
    const nextTop = rest.slice(1).search(/\n(const|export|function|type|interface) /);
    text = nextTop >= 0 ? rest.slice(0, nextTop + 1) : rest;
  }

  // Otherwise it is imported from its own file.
  if (!text) {
    const file = [...view.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/([A-Za-z0-9_]+)'/g)]
      .find(([, names]) => names.split(',').map((s) => s.trim().replace(/^type\s+/, '')).includes(component))?.[2] ?? component;
    for (const c of [`${file}.tsx`, `${file}.ts`]) {
      const p = fileURLToPath(new URL(c, LESSON_DIR));
      if (existsSync(p)) { text = readFileSync(p, 'utf8'); break; }
    }
  }
  if (text) {
    for (const [, , local] of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/([A-Za-z0-9_]+)'/g)) {
      for (const ext of ['.ts', '.tsx']) {
        const p = fileURLToPath(new URL(local + ext, LESSON_DIR));
        if (existsSync(p)) { text += readFileSync(p, 'utf8'); break; }
      }
    }
  }
  // Strip comments before anything is matched against this. A renderer that
  // merely TALKS about a field satisfies nothing, and the prose here is dense:
  // the first draft of the match-row photographs was reverted and the check
  // stayed green, because the comment above the deleted line still said the word
  // "images". A check that a comment can satisfy is decoration.
  sourceCache.set(component, stripComments(text));
  return sourceCache.get(component);
}

/** Remove block and line comments. Crude on purpose: it only has to stop prose
 *  counting as an implementation, and it is never parsed as code afterwards. */
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const rendererSource = (type) => {
  const comps = routes.get(type) ?? new Set([DEFAULT_COMPONENT]);
  return [...comps].map(sourceFor).join('\n');
};

/**
 * Run one of the app's own TypeScript modules, so a check can exercise REAL
 * behaviour instead of asserting about source text. Only dependency-free modules
 * qualify: nothing that imports React Native can be executed here, which is why
 * the rules worth proving (assetUrl, meterScale, grading) are kept pure.
 */
function loadTsModule(fileName) {
  const ts = createRequire(import.meta.url)('typescript');
  const src = readFileSync(fileURLToPath(new URL(fileName, LESSON_DIR)), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('exports', 'module', 'process', js)(mod.exports, mod, { env: {} });
  return mod.exports;
}

// A field name must appear as a WHOLE word. Substring matching let `correctOrder`
// satisfy a requirement to read `correct`, which is a different field entirely.
const reads = (src, field) => new RegExp(`\\b${field}\\b`).test(src);

// ── What does the corpus actually carry? ─────────────────────────────────────
const byType = new Map();
/** field -> { types: Map<type, count>, asset: boolean, spec: boolean, first: string } */
const fields = new Map();

const isPlainish = (v) => v !== null && typeof v === 'object';
/** A published image the author pointed at, rather than a word. */
const ASSET = /^\/[\w./-]+\.(png|jpe?g|webp|gif|svg|mp3|wav|mp4)$/i;
const assetLike = (v) =>
  (typeof v === 'string' && ASSET.test(v)) || (Array.isArray(v) && v.some(assetLike));
/** Structured data the author COMPOSED: a meter, a set of hotspots, terminals. */
const specLike = (v) =>
  (isPlainish(v) && !Array.isArray(v)) || (Array.isArray(v) && v.some(isPlainish));

for (const [lessonId, lesson] of Object.entries(lessons)) {
  for (const step of lesson.steps ?? []) {
    const e = byType.get(step.type) ?? { count: 0, keys: new Map(), first: lessonId, sample: step };
    e.count += 1;
    for (const [k, v] of Object.entries(step)) {
      e.keys.set(k, (e.keys.get(k) ?? 0) + 1);
      const f = fields.get(k) ?? { types: new Map(), asset: false, spec: false, first: lessonId };
      f.types.set(step.type, (f.types.get(step.type) ?? 0) + 1);
      f.asset = f.asset || assetLike(v);
      f.spec = f.spec || specLike(v);
      fields.set(k, f);
    }
    byType.set(step.type, e);
  }
}

// ── The field policy ─────────────────────────────────────────────────────────
//
// Every field name the corpus carries, and what the mobile renderer owes it.
//
//   consumed    the renderer reached by ANY step carrying this field must read
//               it, at any frequency. One authored step is a contract.
//   shell       the run shell draws it, not the step's own renderer.
//   authoring   never reaches a renderer at all; it steers something else.
//   router      the step router reads it to choose a renderer.
//   deferred    authored intent mobile does not render yet. Names the file that
//               has to change, is printed on every run, and fails once the
//               renderer DOES read it, so the list cannot quietly rot.
//
// A field carrying an asset path or a composed spec may only be "consumed", and
// that is enforced below rather than trusted to whoever edits this table.
const FIELD_POLICY = {
  answer: ['consumed', 'the string FillStep grades the typed or tiled answer against'],
  bands: ['consumed', 'the ohms ResistorBandStep asks the learner to encode'],
  blank: ['consumed', 'the token FillStep splits the prompt on to place the gap'],
  body: ['consumed', 'the teach card copy'],
  circuitDiagram: ['consumed', 'the schematic the step is asked about, on 274 steps across 12 types'],
  correct: ['consumed', 'the authored index a choice, true/false or build answer is graded against'],
  correctComponent: ['consumed', 'the region IdentifyStep grades a tap against'],
  correctFix: ['consumed', 'the repair index FixCircuitStep grades against'],
  correctOrder: ['consumed', 'the sequence OrderStep grades against'],
  correctPath: ['consumed', 'the loop order TraceCurrentStep grades against'],
  correctRegion: ['consumed', 'the faulty region SpotErrorStep grades against'],
  difficulty: ['authoring', 'lesson/levels.ts tiers a run by it; there is nothing to draw'],
  expected: ['consumed', 'the parts the vision grader looks for in a drawing'],
  expectedConnections: ['consumed', 'the wires ConnectStep grades against'],
  explanation: ['shell', 'app/lesson/[id].tsx draws it in the verdict banner after a check'],
  faultRegion: ['consumed', 'the region FixCircuitStep grades the first half against'],
  fixes: ['consumed', 'the repair options FixCircuitStep offers'],
  hint: ['consumed', 'drawn under the interaction while the step is unanswered'],
  hotspots: ['consumed', 'turns a teach card into an exploration: tap each part, read its job'],
  images: ['consumed', 'a photograph of the real part beside each match row'],
  instruction: ['consumed', 'the prompt on every non-question step'],
  items: ['consumed', 'the steps OrderStep asks the learner to sequence'],
  meter: ['consumed', 'the instrument MeterStep draws and grades against'],
  optionImages: ['consumed', 'the photographs that ARE the question on a "tap the part" step'],
  options: ['consumed', 'the answers a choice question offers'],
  pairs: ['consumed', 'the left and right sides MatchStep links'],
  palette: ['consumed', 'the parts BuildToSpecStep offers, more of them than there are slots'],
  prompt: ['consumed', 'the sentence FillStep puts a gap in'],
  question: ['consumed', 'the question'],
  showCurrentFlow: [
    'deferred',
    'animates current around the schematic on 9 teach steps; mobile CircuitDiagram draws static SVG and has no flow layer',
    'src/components/circuits/CircuitDiagram.tsx',
  ],
  slots: ['consumed', 'how many parts BuildToSpecStep asks for'],
  statement: ['consumed', 'the claim TrueFalseStep asks about'],
  terminals: ['consumed', 'the tappable points ConnectStep draws'],
  tiles: ['consumed', 'the word bank FillStep offers instead of a keyboard'],
  title: ['consumed', 'the teach card heading'],
  type: ['router', "StepView's switch reads it; by the time a renderer runs it already knows"],
};

// ── 1. Every type reaches a renderer whose shape it matches ──────────────────
for (const [type, e] of byType) {
  if (routes.has(type)) continue;
  if (!Array.isArray(e.sample.options)) {
    fail(`${type} falls through to ${DEFAULT_COMPONENT} and has no options array (first seen in "${e.first}")`);
  }
}
ok(`every authored step type reaches a renderer that matches its shape (${routes.size} dedicated)`);

// ── 2. NO ASSESSMENT MAY CONTAIN ONLY ITS OWN ANSWER ─────────────────────────
//
// A step whose learner-facing control is a list of options, with one option, is
// not a question.
{
  const before = bad;
  const offenders = new Map();
  for (const [lessonId, lesson] of Object.entries(lessons)) {
    for (const step of lesson.steps ?? []) {
      if (step.type === 'teach') continue;
      const comps = routes.get(step.type) ?? new Set([DEFAULT_COMPONENT]);
      const choiceOnly = [...comps].every((c) => c === DEFAULT_COMPONENT);
      // A conditional route only counts as a giveaway when THIS step would take
      // the choice branch, which it does when it carries no richer spec.
      const richer = ['meter', 'bands', 'optionImages', 'circuit', 'circuitDiagram', 'regions', 'pairs', 'items', 'tiles']
        .some((k) => step[k] !== undefined);
      const wouldTakeChoice = choiceOnly || !richer;
      if (!wouldTakeChoice) continue;
      if (!Array.isArray(step.options)) continue;
      if (step.options.length >= 2) continue;
      const k = step.type;
      offenders.set(k, (offenders.get(k) ?? 0) + 1);
      if (offenders.get(k) === 1) {
        fail(`${step.type} renders as a list of ${step.options.length} option(s), which prints the answer on a button. First: "${lessonId}" asks "${String(step.question).slice(0, 70)}" and offers ${JSON.stringify(step.options)}`);
      }
    }
  }
  for (const [t, n] of offenders) if (n > 1) console.error(`        (${n} ${t} steps affected in total)`);
  if (bad === before) ok('no step hands the learner a single option containing its own answer');
}

// ── 3. Every field in the corpus has a decision, and no threshold hides one ──
{
  const before = bad;

  // 3a. The table may not rot in either direction.
  for (const key of fields.keys()) {
    if (!FIELD_POLICY[key]) {
      const f = fields.get(key);
      const where = [...f.types].map(([t, n]) => `${t}:${n}`).join(', ');
      fail(`"${key}" is authored (${where}, first in "${f.first}") and FIELD_POLICY has no decision for it. Decide what it means before it ships.`);
    }
  }
  for (const key of Object.keys(FIELD_POLICY)) {
    if (!fields.has(key)) fail(`FIELD_POLICY still lists "${key}", which no step carries any more. Remove it.`);
  }

  // 3b. An asset or a composed spec may not be allowlisted. This is the rule
  //     that makes the optionImages judgement call unavailable: a field holding
  //     "/components/led.png" is a picture the author put in the exercise, and a
  //     field holding an object is an interaction they described.
  for (const [key, f] of fields) {
    const policy = FIELD_POLICY[key]?.[0];
    if (!policy || policy === 'consumed') continue;
    if (f.asset) fail(`"${key}" carries an asset path and is marked "${policy}". An asset the author put in a step must be rendered.`);
    if (f.spec) fail(`"${key}" carries a composed spec and is marked "${policy}". A described interaction must be built.`);
  }

  // 3c. A consumed field must be read by every renderer a step carrying it can
  //     reach. No frequency test: one authored step is a contract.
  for (const [type, e] of byType) {
    const src = rendererSource(type);
    if (!src) { fail(`${type}: cannot locate the source of its renderer`); continue; }
    for (const [key, n] of e.keys) {
      const entry = FIELD_POLICY[key];
      if (!entry) continue;                       // already failed in 3a
      const [policy] = entry;
      if (policy === 'consumed' && !reads(src, key)) {
        fail(`${type}: ${n} of ${e.count} steps carry "${key}" and its renderer never reads it (first seen in "${e.first}")`);
      }
      if (policy === 'deferred' && reads(src, key)) {
        fail(`${type}: FIELD_POLICY still calls "${key}" deferred, but its renderer now reads it. Promote it to consumed.`);
      }
    }
  }

  if (bad === before) ok(`every field the corpus carries has a decision, and every consumed one is read (${fields.size} fields)`);
}

// ── 4. Declared gaps, said out loud on every run ─────────────────────────────
for (const [key, [policy, why, owner]] of Object.entries(FIELD_POLICY)) {
  if (policy !== 'deferred') continue;
  const f = fields.get(key);
  if (!f) continue;
  const where = [...f.types].map(([t, n]) => `${n} ${t}`).join(', ');
  gap(`"${key}" (${where}) is authored and not rendered: ${why}. Owner: ${owner}`);
}

// ── 5. A step carrying an interaction spec may never reach the choice list ───
{
  const before = bad;
  // One line per affected TYPE, with the lesson count after it. A failure per
  // lesson would print 137 near-identical lines and bury its own summary.
  const hit = new Map();
  for (const [lessonId, lesson] of Object.entries(lessons)) {
    for (const step of lesson.steps ?? []) {
      if (step.meter === undefined && step.bands === undefined) continue;
      const comps = routes.get(step.type);
      if (comps && ![...comps].every((c) => c === DEFAULT_COMPONENT)) continue;
      const spec = step.meter ? 'meter' : 'bands';
      const key = `${step.type}/${spec}`;
      const e = hit.get(key) ?? { lessons: new Set(), first: lessonId };
      e.lessons.add(lessonId);
      hit.set(key, e);
    }
  }
  for (const [key, e] of hit) {
    const [type, spec] = key.split('/');
    fail(`${type} steps carry a ${spec} spec but the type routes only to ${DEFAULT_COMPONENT}, in ${e.lessons.size} lesson(s), first "${e.first}"`);
  }
  if (bad === before) ok('every meter and bands spec reaches a renderer built for it');
}

// ── 6. Every authored picture resolves, and its address carries the version ──
//
// The renderer checks above prove that `optionImages` and `images` are READ.
// They say nothing about whether the resulting URL points at anything, or
// whether it can go stale. Both are behaviour, so both are exercised here
// against the real src/lesson/assetUrl.ts rather than asserted about its source.
{
  const before = bad;
  const { componentImageUrl, isComponentImagePath, ASSET_ORIGIN } = loadTsModule('assetUrl.ts');

  const V = 'deadbeefcafe0001';
  const url = componentImageUrl('/components/led.png', V);

  if (!url || !url.startsWith(`${ASSET_ORIGIN}/components/led.png`)) {
    fail(`a lesson picture does not resolve to an absolute URL on the asset origin: ${url}`);
  }
  // The one that catches a well-meaning simplification. A phone caches by URL at
  // three layers it cannot see into, so an address with no version in it serves
  // superseded artwork until the cache decides otherwise, which for these files
  // is up to a month.
  if (url && !url.includes(`v=${V}`)) {
    fail(`a lesson picture's URL does not carry the content version, so replaced artwork can never reach a phone that cached it: ${url}`);
  }
  if (componentImageUrl('/components/led.png', 'aaaa') === componentImageUrl('/components/led.png', 'bbbb')) {
    fail('two content versions address a lesson picture identically, so a version change is not a cache miss');
  }
  if (componentImageUrl('led.png', V) !== null || componentImageUrl(undefined, V) !== null) {
    fail('componentImageUrl accepts something that is not an authored asset path');
  }

  // Every path the corpus actually carries has to be one this can fetch, or the
  // step silently falls back to words for a reason no one would look for.
  const unresolvable = new Set();
  for (const lesson of Object.values(lessons)) {
    for (const step of lesson.steps ?? []) {
      for (const key of ['optionImages', 'images']) {
        for (const p of step[key] ?? []) {
          if (!isComponentImagePath(p) || !componentImageUrl(p, V)) unresolvable.add(`${key}: ${p}`);
        }
      }
    }
  }
  for (const p of unresolvable) fail(`an authored picture path cannot be resolved to a URL (${p})`);

  // And the option grid only holds together while the two arrays line up.
  let misaligned = 0;
  for (const lesson of Object.values(lessons)) {
    for (const step of lesson.steps ?? []) {
      if (!Array.isArray(step.optionImages)) continue;
      if (step.optionImages.length !== (step.options ?? []).length) misaligned += 1;
    }
  }
  if (misaligned) fail(`${misaligned} step(s) carry a different number of pictures than options, so a picture sits under the wrong name`);

  if (bad === before) ok('every authored picture resolves to a versioned URL, and the grids line up');
}

// ── 7. The banks are keyed, and the rows graded, the way the corpus needs ────
//
// A renderer can read every field a step carries and still be unable to accept
// the answer the author wrote, because a bank is not a set of suggestions: it
// has a consumption rule, and grading has a comparison rule. Both had drifted
// from the web runner and neither drift ever threw:
//
//   14 fill_blank steps  the bank was keyed by the WORD on a tile, so a bank
//                        holding "×" twice still only placed it once and an
//                        answer needing it twice could not be built at all.
//    6 drag_order steps  grading compared item INDICES, so the two identical
//                        `delay(1000);` rows in Blink made a visually perfect
//                        answer a coin flip.
//   11 match steps       chips were spent by the WORD on them, so the second
//                        row of a categorisation whose answers repeat ("Series,
//                        Parallel, Series") could never be answered and Check
//                        never enabled.
//
// Every one of those steps is answerable in a browser, so this is not a corpus
// problem: it is the phone disagreeing with the web about the same lesson. The
// rules now live in src/lesson/grading.ts, and what follows RUNS them over the
// corpus rather than asserting about their source. Fixtures are derived from
// real authored steps, never written here, so the checks cannot drift into
// proving something about constants of their own.
{
  const before = bad;
  const g = loadTsModule('grading.ts');
  const {
    normaliseAnswer, tileAnswer, toggleTile, isTilePlaced, gradeFillTiles,
    gradeOrder, orderRowCorrect, matchChips, isChipTaken, gradeMatch,
    placePart, clearSlot, buildSlotCorrect, gradeBuild, unlinkRow,
  } = g;

  const missing = ['normaliseAnswer', 'tileAnswer', 'toggleTile', 'isTilePlaced', 'gradeFillTiles',
    'gradeOrder', 'orderRowCorrect', 'matchChips', 'isChipTaken', 'gradeMatch', 'unlinkRow',
    'placePart', 'clearSlot', 'buildSlotCorrect', 'gradeBuild']
    .filter((name) => typeof g[name] !== 'function');
  if (missing.length) fail(`src/lesson/grading.ts no longer exports ${missing.join(', ')}`);

  const stepsOf = (type) => {
    const out = [];
    for (const [lessonId, lesson] of Object.entries(lessons)) {
      for (const [i, step] of (lesson.steps ?? []).entries()) {
        if (step.type === type) out.push({ lessonId, i, step });
      }
    }
    return out;
  };
  const words = (text) => normaliseAnswer(text).split(' ').filter(Boolean);

  // ── 7a. A tile bank must be able to build the answer, repeats included ─────
  //
  // The search places tiles through the app's own toggleTile, so a bank that
  // refuses a free slot (which is exactly what keying by value does to a second
  // copy) shows up as an answer that cannot be assembled.
  //
  // It stops on the TEXT the tiles read, never on gradeFillTiles. Asking the
  // grader when to stop made the grader its own oracle, and the hole that opened
  // was not small: a gradeFillTiles that returned true for everything accepted
  // the EMPTY placement, so `solution` came back `[]`, and every check below it
  // (the reversal, the repeated-token fixture, both guarded by the solution's
  // length) was skipped. Grading that always says yes passed this section. So did
  // grading that accepted any prefix of the answer, and a normaliseAnswer that
  // collapsed every string to "". The grader is what is on trial here; it does
  // not get to say when the trial ends.
  const solveTiles = (tiles, answer) => {
    const target = words(answer);
    let refused = false;
    const search = (placed) => {
      const built = words(tileAnswer(tiles, placed));
      if (built.length > target.length) return null;
      for (let k = 0; k < built.length; k += 1) if (built[k] !== target[k]) return null;
      if (built.length === target.length) return placed;
      for (let i = 0; i < tiles.length; i += 1) {
        if (isTilePlaced(placed, i)) continue;
        const next = toggleTile(placed, i);
        if (next.length !== placed.length + 1) { refused = true; return null; }
        const found = search(next);
        if (found) return found;
      }
      return null;
    };
    const solution = search([]);
    return { solution, refused };
  };

  const tiled = stepsOf('fill_blank').filter(({ step }) => Array.isArray(step.tiles) && step.tiles.length);
  let repeatsNeeded = 0;
  for (const { lessonId, i, step } of tiled) {
    const { solution, refused } = solveTiles(step.tiles, step.answer);
    if (!solution) {
      fail(refused
        ? `fill_blank in "${lessonId}" step ${i}: the bank refused a free tile, so its answer cannot be assembled. A bank keyed by the word on a tile can only ever place one copy of a repeated token.`
        : `fill_blank in "${lessonId}" step ${i}: the bank cannot build "${step.answer}" from ${JSON.stringify(step.tiles)}`);
      continue;
    }
    const used = solution.map((k) => normaliseAnswer(step.tiles[k]));
    if (new Set(used).size !== used.length) repeatsNeeded += 1;

    // The grader agrees with what the tiles read. Assembling the answer and
    // being told it is wrong is the same dead end as not being able to assemble
    // it, and nothing above this line asks the grader anything.
    if (!gradeFillTiles(step.tiles, step.answer, solution)) {
      fail(`fill_blank in "${lessonId}" step ${i}: the tiles read "${tileAnswer(step.tiles, solution)}", which IS the answer, and grading says it is wrong`);
    }
    // And it disagrees with an empty one. An answer nobody typed is not the
    // answer, and a grader that says otherwise says it about every wrong
    // assembly too: this is the line that a vacuous or prefix-matching rule
    // cannot cross. It only means anything while the answer still HAS words
    // after normalising, so that is asserted rather than assumed: a normaliser
    // that collapsed every string to "" would otherwise empty the corpus and
    // make each check below it vacuously true.
    if (!words(step.answer).length) {
      fail(`fill_blank in "${lessonId}" step ${i}: "${step.answer}" normalises to nothing, so every assembly of the tiles reads as the answer`);
    } else if (gradeFillTiles(step.tiles, step.answer, [])) {
      fail(`fill_blank in "${lessonId}" step ${i}: an empty answer grades as "${step.answer}", so grading is not reading the tiles at all`);
    }

    // A placed tile can be taken back. The bank tile IS the placed tile on the
    // phone, so the ghosted tile the learner taps to undo depends on
    // isTilePlaced reporting the slot as placed and toggleTile giving it back:
    // an isTilePlaced stuck at false leaves the sentence with no way to remove a
    // word, and toggleTile appending a second copy of a slot it already holds.
    if (solution.length) {
      const one = toggleTile([], solution[0]);
      if (!isTilePlaced(one, solution[0]) || one.length !== 1) {
        fail(`fill_blank in "${lessonId}" step ${i}: a tile that was just placed does not read as placed, so the bank cannot ghost it`);
      } else if (toggleTile(one, solution[0]).length !== 0) {
        fail(`fill_blank in "${lessonId}" step ${i}: tapping a placed tile does not take it back, so a wrong word cannot be removed from the sentence`);
      }
    }

    // Every slot in the bank must be placeable at once, which is the property a
    // repeated token depends on: two tiles reading "×" are two tiles.
    const all = step.tiles.reduce((placed, _, k) => toggleTile(placed, k), []);
    const sort = (list) => [...list].sort();
    if (sort(all.map((k) => normaliseAnswer(step.tiles[k]))).join('')
        !== sort(step.tiles.map(normaliseAnswer)).join('')) {
      fail(`fill_blank in "${lessonId}" step ${i}: placing every tile in the bank yields ${all.length} of ${step.tiles.length}, so a repeated token cannot be used as often as the bank holds it`);
    }

    // And grading is not vacuous: an assembly that reads differently is wrong.
    if (solution.length > 1) {
      const reversed = [...solution].reverse();
      if (normaliseAnswer(tileAnswer(step.tiles, reversed)) !== normaliseAnswer(step.answer)
          && gradeFillTiles(step.tiles, step.answer, reversed)) {
        fail(`fill_blank in "${lessonId}" step ${i}: an assembly reading "${tileAnswer(step.tiles, reversed)}" grades as "${step.answer}"`);
      }
    }
  }

  // The repeated-token rule, proven whatever the corpus happens to hold today.
  // The fixture is a real authored bank with one of its own tokens added again.
  if (tiled.length) {
    const { step } = tiled[0];
    const { solution } = solveTiles(step.tiles, step.answer);
    if (solution && solution.length) {
      const token = step.tiles[solution[0]];
      const bank = [...step.tiles, token];
      const answer = `${step.answer} ${token}`;
      const spare = bank.length - 1;
      const placed = [...solution, spare].reduce((seq, k) => toggleTile(seq, k), []);
      if (placed.length !== solution.length + 1) {
        fail(`the tile bank will not hold ${solution.length + 1} tiles when one token repeats: it kept ${placed.length}`);
      } else if (!gradeFillTiles(bank, answer, placed)) {
        fail(`a bank holding "${token}" twice cannot answer a question needing it twice ("${answer}")`);
      } else if (gradeFillTiles(bank, answer, solution)) {
        fail(`an answer needing "${token}" twice grades correct with it placed once, so the tiles are not being read`);
      }
    }
  }

  // ── 7b. Two rows that read the same are interchangeable ───────────────────
  const ordered = stepsOf('drag_order');
  let duplicateRows = 0;
  for (const { lessonId, i, step } of ordered) {
    const { items, correctOrder } = step;
    if (!gradeOrder(items, correctOrder, correctOrder)) {
      fail(`drag_order in "${lessonId}" step ${i}: the authored order does not grade as correct`);
    }
    // Swap two rows that read the same. The learner cannot tell them apart, so
    // neither may the grader.
    const twin = [];
    for (let a = 0; a < items.length && !twin.length; a += 1) {
      for (let b = a + 1; b < items.length; b += 1) {
        if (items[a] === items[b]) { twin.push(a, b); break; }
      }
    }
    if (twin.length) {
      duplicateRows += 1;
      const swapped = [...correctOrder];
      const [x, y] = [swapped.indexOf(twin[0]), swapped.indexOf(twin[1])];
      [swapped[x], swapped[y]] = [swapped[y], swapped[x]];
      if (!gradeOrder(items, correctOrder, swapped)) {
        fail(`drag_order in "${lessonId}" step ${i}: two rows read "${items[twin[0]]}" and swapping them grades the same arrangement wrong, so the answer is a coin flip`);
      }
    }
    // A genuinely wrong order is still wrong: swap two rows that READ differently.
    const differ = [];
    for (let a = 0; a < correctOrder.length && !differ.length; a += 1) {
      for (let b = a + 1; b < correctOrder.length; b += 1) {
        if (items[correctOrder[a]] !== items[correctOrder[b]]) { differ.push(a, b); break; }
      }
    }
    if (differ.length) {
      const wrongOrder = [...correctOrder];
      [wrongOrder[differ[0]], wrongOrder[differ[1]]] = [wrongOrder[differ[1]], wrongOrder[differ[0]]];
      if (gradeOrder(items, correctOrder, wrongOrder)) {
        fail(`drag_order in "${lessonId}" step ${i}: swapping two rows that read differently still grades correct`);
      }
    }
    if (gradeOrder(items, correctOrder, correctOrder.slice(0, -1))) {
      fail(`drag_order in "${lessonId}" step ${i}: an incomplete arrangement grades correct`);
    }
  }

  // Same rule, proven from a real step whether or not the corpus repeats a row
  // today: take an authored order and make one of its rows read like another.
  if (ordered.length) {
    const base = ordered.find(({ step }) => step.items.length > 2) ?? ordered[0];
    const items = [...base.step.items];
    const { correctOrder } = base.step;
    if (items.length > 2) {
      items[correctOrder[2]] = items[correctOrder[0]];    // rows 0 and 2 now read alike
      const swapped = [...correctOrder];
      [swapped[0], swapped[2]] = [swapped[2], swapped[0]];
      if (!gradeOrder(items, correctOrder, swapped)) {
        fail(`two rows reading "${items[correctOrder[0]]}" are graded as different rows, so an arrangement that looks right can be marked wrong`);
      }
      const wrong = [...correctOrder];
      [wrong[0], wrong[1]] = [wrong[1], wrong[0]];
      if (items[correctOrder[0]] !== items[correctOrder[1]] && gradeOrder(items, correctOrder, wrong)) {
        fail('an order with two visibly different rows swapped grades correct, so grading by text has stopped rejecting wrong orders');
      }
      if (!orderRowCorrect(items, correctOrder, swapped[0], 0)) {
        fail('a row holding the right words is painted as the wrong row, so grading and painting disagree');
      }
    }
  }

  // ── 7c. A repeated answer offers a chip per row ───────────────────────────
  const matches = stepsOf('match');
  let repeatedAnswers = 0;
  const answerRows = (pairs) => {
    const chips = matchChips(pairs);
    let links = {};
    for (const [row, pair] of pairs.entries()) {
      const chip = chips.findIndex((value, k) => value === pair[1] && !isChipTaken(links, k));
      if (chip === -1) return { chips, links, stuck: row };
      links = { ...links, [row]: chip };
    }
    return { chips, links, stuck: -1 };
  };
  for (const { lessonId, i, step } of matches) {
    const pairs = step.pairs;
    const rights = pairs.map((p) => p[1]);
    if (new Set(rights).size !== rights.length) repeatedAnswers += 1;
    const { chips, links, stuck } = answerRows(pairs);
    if (stuck !== -1) {
      fail(`match in "${lessonId}" step ${i}: row "${pairs[stuck][0]}" has no chip left reading "${pairs[stuck][1]}", so the step can never be completed. Chips are spent by index, one per pair.`);
      continue;
    }
    if (!gradeMatch(pairs, chips, links)) {
      fail(`match in "${lessonId}" step ${i}: every row answered with a chip carrying its answer still grades wrong`);
    }
    const wrongChip = chips.findIndex((value) => value !== pairs[0][1]);
    if (wrongChip !== -1 && gradeMatch(pairs, chips, { ...links, 0: wrongChip })) {
      fail(`match in "${lessonId}" step ${i}: a row answered "${chips[wrongChip]}" instead of "${pairs[0][1]}" grades correct`);
    }
    const short = { ...links };
    delete short[pairs.length - 1];
    if (gradeMatch(pairs, chips, short)) {
      fail(`match in "${lessonId}" step ${i}: an unanswered row grades correct`);
    }

    // A row can be un-answered, and its chip comes back to the bank. There is
    // one chip per row, so the moment the last row is answered every chip is
    // spent: without this, a learner who spots their own mistake at that point
    // has every chip disabled and no move except Check and a lost heart. The web
    // never needs it because it refuses a wrong pairing outright.
    const last = pairs.length - 1;
    const freed = unlinkRow(links, last);
    if (freed[last] !== undefined) {
      fail(`match in "${lessonId}" step ${i}: taking a row's answer back leaves it answered, so a mistake cannot be changed`);
    } else if (isChipTaken(freed, links[last])) {
      fail(`match in "${lessonId}" step ${i}: a chip taken back from a row is still spent, so it can never be used on another row`);
    } else if (Object.keys(freed).length !== pairs.length - 1) {
      fail(`match in "${lessonId}" step ${i}: taking one row's answer back disturbed ${pairs.length - 1 - Object.keys(freed).length} other row(s)`);
    }
  }

  // A categorisation built from real rows: every row shares one answer, so the
  // chips only stretch far enough if they are spent by index.
  if (matches.length) {
    const pairs = matches[0].step.pairs.map((pair) => [pair[0], matches[0].step.pairs[0][1]]);
    if (pairs.length > 1) {
      const { links, stuck } = answerRows(pairs);
      if (stuck !== -1) {
        fail(`${pairs.length} rows sharing the answer "${pairs[0][1]}" run out of chips at row ${stuck}, so a categorisation cannot be finished`);
      } else if (!gradeMatch(pairs, matchChips(pairs), links)) {
        fail(`${pairs.length} rows sharing one answer grade wrong when every one of them is answered with it`);
      }
    }
  }

  // ── 7d. A build part is not spent by being used ───────────────────────────
  //
  // The web lets one palette part fill several slots (BuildStep.addPart has no
  // used check), so a build whose answer needs two of a part is answerable
  // there. Retiring a part on the phone made that answer impossible to give.
  // No authored build needs it today, which is exactly when to pin the rule.
  const builds = stepsOf('build_to_spec');
  for (const { lessonId, i, step } of builds) {
    const { correct, slots, palette } = step;
    const placed = correct.reduce((seq, part) => placePart(seq, slots, part), []);
    if (!gradeBuild(correct, slots, placed)) {
      fail(`build_to_spec in "${lessonId}" step ${i}: the authored answer cannot be placed, so the step cannot be completed`);
    }
    if (gradeBuild(correct, slots, clearSlot(placed, 0))) {
      fail(`build_to_spec in "${lessonId}" step ${i}: a build with an empty slot grades correct`);
    }
    // Clearing the FIRST slot shifts every later part up one, so the parts stop
    // matching their slots and a missing length gate is never felt. Dropping the
    // LAST one leaves every remaining part where it belongs, so only the gate
    // stands between a half-built circuit and a pass.
    if (gradeBuild(correct, slots, placed.slice(0, -1))) {
      fail(`build_to_spec in "${lessonId}" step ${i}: a build one part short of ${slots} grades correct, so an unfinished build passes`);
    }
    const other = palette.findIndex((_, k) => k !== correct[0]);
    if (other !== -1 && gradeBuild(correct, slots, [other, ...placed.slice(1)])) {
      fail(`build_to_spec in "${lessonId}" step ${i}: the wrong part in slot 1 grades correct`);
    }
    if (!buildSlotCorrect(correct, placed, 0) || buildSlotCorrect(correct, [], 0)) {
      fail(`build_to_spec in "${lessonId}" step ${i}: a slot is painted right when it is wrong, or wrong when it is right`);
    }
  }
  // The same part twice, built from a real palette, whatever the corpus asks for.
  if (builds.length) {
    const { step } = builds.find(({ step: b }) => b.slots > 1) ?? builds[0];
    if (step.slots > 1) {
      const twice = Array.from({ length: step.slots }, () => step.correct[0]);
      const placed = twice.reduce((seq, part) => placePart(seq, step.slots, part), []);
      if (placed.length !== step.slots) {
        fail(`a build cannot use "${step.palette[step.correct[0]]}" in ${step.slots} slots: the palette kept only ${placed.length}, so an answer needing two of a part could not be given`);
      } else if (!gradeBuild(twice, step.slots, placed)) {
        fail(`a build answered with the same part in every slot grades wrong when that is the answer`);
      }
    }
  }

  // ── 7f. A bank drawn in authored order hands over its own answer ──────────
  //
  // Section 2 says no assessment may contain only its own answer. A tile bank
  // passes that check and gives the answer away anyway, because of HOW the
  // corpus is authored: every bank lists the answer's tokens first, in order,
  // and puts the distractors after them. Drawn as authored, a learner answers by
  // tapping left to right and never reads the question, which is the same defect
  // the picture questions had (all 26 put the answer at index 0) and the reason
  // optionOrder.ts exists. So the count below is asserted, not assumed: if the
  // corpus ever stops spelling its answers the check says so and this rule can
  // be retired, and while it does spell them the bank must be shuffled.
  const spellsAnswer = tiled.filter(({ step }) => {
    const want = normaliseAnswer(step.answer);
    return step.tiles.some((_, k) =>
      normaliseAnswer(tileAnswer(step.tiles, step.tiles.map((__, j) => j).slice(0, k + 1))) === want);
  }).length;
  if (spellsAnswer === 0) {
    fail('no tile bank spells its answer in authored order any more, so 7f is asserting something the corpus stopped doing. Re-read the banks and rewrite this rule.');
  }
  {
    const { shuffledOrder } = loadTsModule('optionOrder.ts');
    if (typeof shuffledOrder !== 'function') {
      fail('src/lesson/optionOrder.ts no longer exports shuffledOrder, which is the only thing standing between an authored bank and its answer');
    } else {
      // A shuffle that lands on the authored order once is a shuffle. One that
      // lands there EVERY time is not a shuffle at all, and that is the only
      // thing asserted here: over 200 draws at each size, at least one must
      // differ. Requiring every single draw to differ would fail this check on
      // its own about one run in seven at n = 2, and a check that cries wolf is
      // worse than no check.
      const broken = [];
      for (let n = 2; n <= 12; n += 1) {
        let reordered = 0;
        for (let trial = 0; trial < 200; trial += 1) {
          const order = shuffledOrder(n);
          if (order.length !== n || new Set(order).size !== n) { broken.push(`${n}: returned ${JSON.stringify(order)}, which is not an arrangement of ${n} tiles`); break; }
          if (order.some((v, k) => v !== k)) reordered += 1;
        }
        if (!reordered) broken.push(`${n}: came back in authored order on all 200 draws, so it never reorders`);
      }
      if (broken.length) {
        fail(`shuffledOrder does not reorder: ${broken[0]}. ${spellsAnswer} of ${tiled.length} tile banks spell their answer left to right, so an unshuffled bank is answered without reading the question.`);
      }
    }
  }

  // ── 7e. The renderers use these rules rather than keeping their own ───────
  //
  // Everything above proves grading.ts behaves. It says nothing about whether
  // StepView still calls it, and the defect this section exists for lived in
  // StepView. So each renderer must delegate, and must not carry the rule that
  // was wrong: a bank keyed by the word on a tile, an order compared by index,
  // a chip spent by the word on it.
  const DELEGATION = [
    ['FillStep', ['toggleTile', 'isTilePlaced', 'gradeFillTiles', 'tileAnswer', 'shuffledOrder'], [
      [/\btiles\.includes\s*\(/, 'the tile bank is keyed by the word on a tile again, so a repeated token can only be placed once'],
      [/\bplaced\.filter\s*\(\s*\(?\s*x\s*\)?\s*=>\s*x\s*!==/, 'a tile is taken back by matching its text, which takes back every copy of it'],
      [/\{\s*tiles\.map\s*\(/, 'the bank is drawn straight off the authored tile array again, and every authored bank spells its answer left to right'],
    ]],
    ['OrderStep', ['gradeOrder', 'orderRowCorrect'], [
      [/step\.correctOrder\s*\[/, 'the order is compared position by position against item indices again, so two identical rows are a coin flip'],
    ]],
    ['MatchStep', ['matchChips', 'isChipTaken', 'gradeMatch', 'unlinkRow'], [
      [/Object\.values\s*\(\s*links\s*\)\s*\.includes\s*\(/, 'chips are spent by the word on them again, so a repeated answer runs out after one row'],
    ]],
    ['BuildToSpecStep', ['placePart', 'clearSlot', 'gradeBuild', 'buildSlotCorrect'], [
      [/placed\.includes\s*\(/, 'a palette part is retired once it is used again, so a build needing two of a part cannot be entered'],
    ]],
  ];
  for (const [component, uses, never] of DELEGATION) {
    const src = sourceFor(component);
    if (!src) { fail(`cannot locate ${component} in StepView.tsx`); continue; }
    for (const fn of uses) {
      if (!new RegExp(`\\b${fn}\\s*\\(`).test(src)) {
        fail(`${component} no longer calls ${fn}() from src/lesson/grading.ts, so the phone is grading by a rule of its own again`);
      }
    }
    for (const [pattern, why] of never) {
      if (pattern.test(src)) fail(`${component}: ${why}`);
    }
  }

  if (bad === before) {
    ok(`every bank can build its answer, is drawn out of authored order, and every order grades by what its rows say (${tiled.length} tile banks, ${repeatsNeeded} needing a token twice, ${spellsAnswer} spelling their answer left to right; ${ordered.length} orders, ${duplicateRows} with rows that read alike; ${matches.length} match banks, ${repeatedAnswers} with a repeated answer; ${builds.length} builds)`);
  }
}

// ── The table ────────────────────────────────────────────────────────────────
if (SHOW_TABLE) {
  const rows = [...fields.keys()].sort().map((key) => {
    const f = fields.get(key);
    const [policy, why] = FIELD_POLICY[key] ?? ['UNDECIDED', ''];
    const kind = f.asset ? 'asset' : f.spec ? 'spec' : 'value';
    const total = [...f.types.values()].reduce((a, b) => a + b, 0);
    const where = [...f.types].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}:${n}`).join(' ');
    return [key, policy, kind, String(total), where, why];
  });
  const w = (i) => Math.max(...rows.map((r) => r[i].length));
  console.log('\nfield                  policy     kind   steps  where / why');
  for (const r of rows) {
    console.log(`  ${r[0].padEnd(w(0))}  ${r[1].padEnd(9)}  ${r[2].padEnd(5)}  ${r[3].padStart(5)}  ${r[4]}`);
    if (r[5]) console.log(`  ${''.padEnd(w(0))}  ${''.padEnd(9)}  ${''.padEnd(5)}  ${''.padStart(5)}  ${r[5]}`);
  }
}

console.log(bad === 0
  ? `\nstep renderers: all checks passed (${byType.size} step types, ${[...byType.values()].reduce((a, b) => a + b.count, 0)} steps, ${fields.size} fields)`
  : `\nstep renderers: ${bad} failure(s)`);
process.exit(bad === 0 ? 0 : 1);
