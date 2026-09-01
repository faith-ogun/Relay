#!/usr/bin/env node
/**
 * Lesson solvability checker — `npm run check:solvability`.
 *
 * The lesson linter (scripts/lint-lessons.mjs) asks "is this step well formed?".
 * This asks a different and stricter question: **can a learner actually produce
 * the answer the grader accepts, using only what the step puts in front of them?**
 *
 * That question has to be answered against the runner's REAL interaction rules,
 * because a bank is not a set of suggestions: every bank has a consumption rule,
 * and an authored answer that needs more of a token than the rule can supply is
 * unreachable no matter how well the learner understands the material. The web
 * runner requeues a wrong graded step to the back of the run and only ends the
 * run when the queue empties (LessonRunner.tsx, handleContinue), so an
 * unreachable answer is not a bad question, it is a lesson that can never be
 * finished: the step comes back forever, burning a heart every lap.
 *
 * The rules encoded here, each read off the runner rather than assumed:
 *
 *   fill_blank + tiles   Tiles are placed by INDEX and a placed index cannot be
 *                        placed again (FillTileStep.place: `tileSeq.includes(i)`
 *                        returns early). The placed tiles are joined with single
 *                        spaces and compared to the answer after collapsing
 *                        whitespace and lowercasing. So the bank is a MULTISET
 *                        of indices, a tile may span several words, and the real
 *                        test is: can the answer be segmented into a sequence of
 *                        distinct bank entries?
 *                        The winning placement is then put to MOBILE'S OWN
 *                        grader (mobile/src/lesson/grading.ts, toggleTile +
 *                        gradeFillTiles), executed, not described. If the phone
 *                        refuses the placement a browser accepts, that is an
 *                        error by default.
 *   build_to_spec        Palette parts are NOT consumed (BuildStep.addPart has no
 *                        used check), so a part may fill several slots. Only the
 *                        slot count and index range can make it unreachable.
 *   drag_order           The learner permutes the items, so correctOrder must be
 *                        a permutation of them. The web runner grades the
 *                        arrangement by what each row SAYS, so two rows with the
 *                        same text are interchangeable. Whether the phone agrees
 *                        is asked of mobile's own gradeOrder, by swapping a pair
 *                        of rows that read alike: if that arrangement grades
 *                        wrong, identical rows are a coin flip there.
 *   match                Left and right chips are consumed independently and
 *                        pair BY VALUE (MatchStep.select), which is what lets one
 *                        value serve several terms. Solvable iff the value graph
 *                        admits a perfect matching. Identical left labels with
 *                        different answers are indistinguishable, so unsolvable.
 *   option lists         `correct` must index the list, and no other option may
 *                        read as the same answer: an identical wrong twin grades
 *                        a correct read as wrong.
 *   predict_reading      A meter is a discrete bank too: the slider only stops on
 *   + meter              min + k·step. Solvable iff one of those stops lands
 *                        within tolerance of the target.
 *   choose_resistor      Three bands: two digits 0-9 and a multiplier 0-6
 *   + bands              (ResistorBandStep.cycle), graded by exact equality, so
 *                        the target must be exactly encodable.
 *   trace_current        The regions are the bank and each is used ONCE: tapping
 *                        a traced region rewinds the path to just before it
 *                        (TraceStep.tap), so a path that revisits a part can
 *                        never be entered.
 *   step type            mobile's canRender refuses any type outside SUPPORTED
 *                        (mobile/src/lesson/types.ts) BEFORE it looks at
 *                        anything else, so a type the phone has no renderer for
 *                        is dropped from the run as silently as a region with no
 *                        hit area. Every type in the corpus is supported today;
 *                        the rule is here for the day one is not.
 *   region taps          spot_error / identify_component / fix_the_circuit grade
 *                        a region id, which must be one the diagram exposes.
 *                        Checked against BOTH surfaces' hit maps, because they
 *                        are not the same map: web and mobile each draw their
 *                        own art for a circuit id (web's `ldr_alarm` is
 *                        D9 → 220 Ω → LED, mobile's is an NPN driving a buzzer),
 *                        and mobile's canRender (mobile/src/lesson/types.ts)
 *                        DROPS a region step whose answer has no hit area. An
 *                        answer only web exposes is silently missing content on
 *                        mobile, which is an error by default.
 *   draw_connection      Wires are drawn terminal to terminal; an endpoint that
 *                        is not a terminal can never be wired, and a terminal
 *                        cannot wire to itself (a second tap deselects). A pair
 *                        listed twice is invisible on web, which grades the
 *                        wires as a set, and stalls mobile, which enables Check
 *                        on the wire COUNT (StepView, ConnectStep).
 *
 * It checks two corpora: the authored source (components/ohmlet/data/lessons.ts)
 * and, when it exists, the JSON the backend serves from
 * backend/live-bridge/app/curriculum_data/lessons.json — the artefact the mobile
 * app actually fetches. A clean source with a dirty export just means the export
 * is stale.
 *
 * BOTH SURFACES ARE ENFORCED BY DEFAULT. The mobile rules used to sit behind a
 * --strict-mobile opt-in, on the reasoning that clearing them needs a change
 * under mobile/src/ rather than in lesson content. That reasoning is true and
 * irrelevant: where a fix has to live says nothing about whether the lesson is
 * broken. Both surfaces run the same corpus, so a step a learner cannot finish
 * on the phone is a broken step, and the comfortable default meant impossible
 * steps sat green in CI.
 *
 * EVERY MOBILE RULE READS MOBILE, and none of them may quietly not run. The tile
 * and order rules were once this file's PROSE about the phone ("the mobile bank
 * keys tiles by value"), true when written; mobile then moved its grading into
 * src/lesson/grading.ts and fixed both, and the prose could not notice, so this
 * checker went on calling 20 solvable steps unsolvable and citing a
 * `tiles.includes(t)` that no longer existed. They now execute mobile's own
 * grading functions, the region rule parses mobile's own hit maps, and the
 * step-type rule reads mobile's own SUPPORTED set. Any of the three failing to
 * load is exit 2, never a quiet pass: a rule that cannot run prints the same
 * green as a rule that passed.
 *
 * Usage:
 *   node scripts/check-lesson-solvability.mjs [--web-only] [--json] [--self-test]
 *
 *   --web-only   Report the mobile rules as warnings rather than errors, for
 *                someone debugging the WEB runner in isolation. It hides
 *                nothing: every mobile finding is still printed, and the summary
 *                names how many were left unenforced. Never use it in CI.
 *   --json       Machine-readable findings on stdout, nothing else.
 *   --self-test  Exercise the rules against fixture steps and assert the
 *                defaults, corpus independent. Fails if the mobile rules stop
 *                being errors by default, if either mobile rule goes back to
 *                quietly not running when it cannot read mobile's source, or if
 *                package.json stops enforcing them — whatever the corpus happens
 *                to say that day.
 *
 * Exit codes: 0 clean, 1 unsolvable step(s) found, 2 the checker itself failed.
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT_JSON = path.resolve(root, '../backend/live-bridge/app/curriculum_data/lessons.json');
const MOBILE_DIAGRAM = path.resolve(root, '../mobile/src/components/circuits/CircuitDiagram.tsx');
const MOBILE_TYPES = path.resolve(root, '../mobile/src/lesson/types.ts');
const MOBILE_GRADING = path.resolve(root, '../mobile/src/lesson/grading.ts');

/**
 * Mobile findings are errors unless the caller explicitly asks for the web-only
 * read. Pure, so the self-test can assert the default without spawning a run.
 */
export const mobileSeverityFor = (flags) => (flags.has('--web-only') ? 'warn' : 'error');

const KNOWN_FLAGS = ['--web-only', '--json', '--self-test', '--strict-mobile'];
const args = process.argv.slice(2);
const argv = new Set(args);
const unknown = args.filter((a) => !KNOWN_FLAGS.includes(a));
if (unknown.length) {
  // A mistyped flag must not quietly become "no flag": the reader would take the
  // run at face value.
  console.error(`check-lesson-solvability: unknown option ${unknown.join(', ')}. Known options: ${KNOWN_FLAGS.join(', ')}.`);
  process.exit(2);
}
if (argv.has('--web-only') && argv.has('--strict-mobile')) {
  console.error('check-lesson-solvability: --web-only and --strict-mobile ask for opposite things. Pick one.');
  process.exit(2);
}
// --strict-mobile is what the mobile rules used to need. It still parses and
// still means "enforce them"; it just no longer says anything the run was not
// already doing.
const AS_JSON = argv.has('--json');
const SELF_TEST = argv.has('--self-test');
const MOBILE_SEVERITY = mobileSeverityFor(argv);
const WEB_ONLY = MOBILE_SEVERITY === 'warn';

const c = AS_JSON
  ? new Proxy({}, { get: () => (s) => s })
  : {
      red: (s) => `\x1b[31m${s}\x1b[0m`,
      yellow: (s) => `\x1b[33m${s}\x1b[0m`,
      green: (s) => `\x1b[32m${s}\x1b[0m`,
      dim: (s) => `\x1b[2m${s}\x1b[0m`,
      bold: (s) => `\x1b[1m${s}\x1b[0m`,
      cyan: (s) => `\x1b[36m${s}\x1b[0m`,
    };

// ── The runner's own normalisation (LessonRunner.tsx evaluate, fill_blank) ──
export const norm = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Tile bank as the runner sees it.
 *
 *   'index'  web: every entry is its own token, used at most once (tileSeq holds
 *            indices, and a placed index is refused).
 *   'value'  mobile: entries collapse by raw text, and each distinct text can be
 *            placed at most once (the chosen list holds values, and pressing a
 *            value that is already chosen removes it).
 */
export const bankEntries = (tiles, keyed) => {
  const entries = [];
  const seen = new Set();
  tiles.forEach((raw, index) => {
    if (keyed === 'value') {
      if (seen.has(raw)) return;
      seen.add(raw);
    }
    const words = norm(raw).split(' ').filter(Boolean);
    if (words.length) entries.push({ index, raw, words });
  });
  return entries;
};

/**
 * Can the answer be assembled from the bank? Exact search over segmentations:
 * each bank entry may be used once, entries may span several words, and the
 * placed entries are read back joined by single spaces.
 *
 * Returns the winning sequence of bank indices, or null when no sequence exists.
 * Banks are a dozen entries or so, and failures are memoised, so the search is
 * instant at corpus scale.
 */
export const assemble = (answer, entries) => {
  const target = norm(answer).split(' ').filter(Boolean);
  if (!target.length) return null;
  // The used-set is a bitmask. Corpus banks run to 15 tiles; anything past 30
  // would silently wrap, so refuse rather than answer wrongly.
  if (entries.length > 30) throw new Error(`tile bank of ${entries.length} is too large to search exactly`);
  const dead = new Set();
  const plan = [];

  const walk = (pos, used) => {
    if (pos === target.length) return true;
    const key = `${pos}:${used}`;
    if (dead.has(key)) return false;
    for (let e = 0; e < entries.length; e += 1) {
      if (used & (1 << e)) continue;
      const { words } = entries[e];
      if (pos + words.length > target.length) continue;
      let hit = true;
      for (let w = 0; w < words.length; w += 1) {
        if (target[pos + w] !== words[w]) {
          hit = false;
          break;
        }
      }
      if (!hit) continue;
      plan.push(entries[e].index);
      if (walk(pos + words.length, used | (1 << e))) return true;
      plan.pop();
    }
    dead.add(key);
    return false;
  };

  return walk(0, 0) ? [...plan] : null;
};

/**
 * Why a bank failed, in the terms an author can act on: which token the answer
 * asks for more often than the bank can supply. Falls back to the raw shapes
 * when the answer needs a segmentation the bank simply does not have.
 */
const explainBank = (answer, tiles, entries) => {
  const want = new Map();
  for (const w of norm(answer).split(' ').filter(Boolean)) want.set(w, (want.get(w) ?? 0) + 1);
  const have = new Map();
  for (const e of entries) {
    if (e.words.length !== 1) continue;
    have.set(e.words[0], (have.get(e.words[0]) ?? 0) + 1);
  }
  const short = [];
  for (const [tok, n] of want) {
    const got = have.get(tok) ?? 0;
    if (got < n) short.push(`"${tok}" ${n}× but the bank offers ${got}`);
  }
  if (short.length) return `the answer needs ${short.join('; ')}`;
  return `no arrangement of the bank reads as the answer (answer: "${norm(answer)}"; bank: ${tiles.map((t) => `"${t}"`).join(', ')})`;
};

/** Perfect matching (Kuhn's algorithm) for the match step's value graph. */
const hasPerfectMatching = (pairs) => {
  const n = pairs.length;
  const matchRight = new Array(n).fill(-1);
  const tryKuhn = (l, seen) => {
    for (let r = 0; r < n; r += 1) {
      if (seen[r] || pairs[l][1] !== pairs[r][1]) continue;
      seen[r] = true;
      if (matchRight[r] === -1 || tryKuhn(matchRight[r], seen)) {
        matchRight[r] = l;
        return true;
      }
    }
    return false;
  };
  for (let l = 0; l < n; l += 1) if (!tryKuhn(l, new Array(n).fill(false))) return false;
  return true;
};

/** Every value the resistor band widget can encode: 2 digits (0-9) x 10^0..10^6. */
export const bandEncodable = (target) => {
  for (let m = 0; m <= 6; m += 1) {
    for (let d1 = 0; d1 <= 9; d1 += 1) {
      for (let d2 = 0; d2 <= 9; d2 += 1) {
        if ((d1 * 10 + d2) * 10 ** m === target) return true;
      }
    }
  }
  return false;
};

/** Nearest stop the meter's slider can actually rest on, to the target. */
export const nearestMeterStop = (m) => {
  const tick = m.step ?? Math.max((m.max - m.min) / 100, 0.0001);
  if (!(tick > 0) || !(m.max > m.min)) return null;
  const maxK = Math.floor((m.max - m.min) / tick + 1e-9);
  const k = Math.min(Math.max(Math.round((m.target - m.min) / tick), 0), maxK);
  let best = null;
  for (const cand of [k - 1, k, k + 1]) {
    if (cand < 0 || cand > maxK) continue;
    const v = m.min + cand * tick;
    if (best === null || Math.abs(v - m.target) < Math.abs(best - m.target)) best = v;
  }
  return best;
};

const OPTION_TYPES = new Set(['multiple_choice', 'predict_behavior', 'predict_reading', 'choose_resistor']);

/**
 * The regions MOBILE exposes, which are NOT the web registry's.
 *
 * The two surfaces draw their own art for the same circuit id, and `ldr_alarm`
 * is the case that proves it: web draws D9 → 220 Ω → LED, mobile draws an NPN
 * driving a buzzer. So a region id that is tappable on one surface can be absent
 * on the other, and mobile's `canRender` (mobile/src/lesson/types.ts) DROPS a
 * region step whose answer has no hit area rather than showing a diagram that
 * ignores every tap. A step that vanishes on mobile is not unanswerable, but it
 * is content the learner silently never sees, so it belongs in this report.
 *
 * Read by parsing the REGIONS literal out of the file: mobile's diagram module
 * is react-native JSX and cannot be imported into this Vite (web) graph, and a
 * duplicated copy of the map here would drift the moment mobile edits its art.
 *
 * Every way of failing to read it THROWS, the missing file included. Returning
 * null for an absent file used to look like tolerance and was the same
 * comfortable default this checker exists to refuse: with the file renamed the
 * run dropped its six region findings, printed 20 instead of 26 and still
 * claimed "web and mobile rules both enforced". A rule that cannot run has to
 * say so, not pass.
 */
export function loadMobileRegions(file = MOBILE_DIAGRAM) {
  if (!existsSync(file)) {
    throw new Error(
      `${file} is missing, so the mobile region rule cannot run. Skipping it would print a run that claims ` +
        'both surfaces are enforced while never checking one of them. Point MOBILE_DIAGRAM at the file mobile draws its circuits from.',
    );
  }
  const src = readFileSync(file, 'utf8');
  const start = src.indexOf('const REGIONS');
  const end = src.indexOf('export const regionsFor');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`${file} no longer exposes a REGIONS map this checker can read — update loadMobileRegions()`);
  }
  const regions = new Map();
  let current = null;
  for (const line of src.slice(start, end).split('\n')) {
    const head = /^\s{2}([A-Za-z0-9_]+):\s*\[/.exec(line);
    if (head) {
      current = head[1];
      regions.set(current, []);
      continue;
    }
    if (!current) continue;
    for (const m of line.matchAll(/id:\s*'([^']+)'/g)) regions.get(current).push(m[1]);
  }
  if (!regions.size) throw new Error(`${file} parsed to zero circuits — update loadMobileRegions()`);
  return regions;
}

/**
 * The step types mobile can present at all, read from the SAME `SUPPORTED` set
 * `canRender` gates on (mobile/src/lesson/types.ts).
 *
 * canRender has two arms and the region map above only models the second one.
 * Its FIRST line is `if (!SUPPORTED.has(step.type)) return false`, so a type the
 * phone has no renderer for is dropped exactly as silently as a region with no
 * hit area: the step is simply not in the run, and the learner is taught less on
 * one surface than the other with nothing anywhere saying so. The corpus happens
 * to use only supported types today, which is why this costs nothing to add and
 * is worth having the day somebody authors the eighteenth type.
 *
 * Throws on every failure to read it, for the reason loadMobileRegions does.
 */
export function loadMobileSupported(file = MOBILE_TYPES) {
  if (!existsSync(file)) {
    throw new Error(
      `${file} is missing, so the mobile step-type rule cannot run. A rule that cannot run must say so rather than pass: ` +
        'point MOBILE_TYPES at the module holding mobile\'s SUPPORTED set.',
    );
  }
  const src = readFileSync(file, 'utf8');
  const block = /export const SUPPORTED = new Set\(\[([\s\S]*?)\]\)/.exec(src);
  if (!block) {
    throw new Error(`${file} no longer exposes a SUPPORTED set this checker can read — update loadMobileSupported()`);
  }
  const types = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  if (!types.length) throw new Error(`${file} parsed to zero supported step types — update loadMobileSupported()`);
  return new Set(types);
}

/** The functions this checker drives out of mobile's grading module. */
export const MOBILE_GRADERS = ['toggleTile', 'gradeFillTiles', 'gradeOrder'];

/**
 * Mobile's REAL grading rules, executed rather than believed.
 *
 * This used to be a copy of mobile's behaviour written into this file as prose:
 * "the mobile bank keys tiles by value", "mobile compares item indices". Both
 * sentences were true when they were written and both stopped being true when
 * mobile moved its grading into `src/lesson/grading.ts` — and because the
 * sentences could not notice, the checker went on calling 20 perfectly solvable
 * steps unsolvable, naming a `tiles.includes(t)` that no longer exists. A
 * frozen model of another surface fails in both directions: it cries wolf after
 * a fix, and it would have passed a regression it did not happen to predict.
 *
 * `grading.ts` has no imports at all, precisely so a checker can execute it, so
 * this loads and calls it. The Vite server is the web graph's, but the module is
 * plain TypeScript and resolves by absolute path.
 */
export async function loadMobileGrading(_server, file = MOBILE_GRADING) {
  if (!existsSync(file)) {
    throw new Error(
      `${file} is missing, so the mobile tile and order rules cannot run. They are not allowed to quietly not run: ` +
        'point MOBILE_GRADING at the module holding mobile\'s grading functions.',
    );
  }
  // Transpiled in isolation, NOT loaded through the Vite server the frontend
  // modules use. Vite resolves the nearest tsconfig, which for a mobile file is
  // mobile/tsconfig.json, and that extends "expo/tsconfig.base". CI's frontend
  // job installs frontend/node_modules only, so expo is not there and the
  // extends cannot resolve: the check passed on every machine with a populated
  // mobile/node_modules and failed the moment it ran anywhere clean.
  //
  // grading.ts is deliberately pure and dependency-free so this works, which is
  // the same reason meterScale.ts and resistorCode.ts are separate modules.
  // transpileModule ignores tsconfig entirely, and it is what every other check
  // script in this repo already uses to read a TypeScript module.
  const js = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const dir = mkdtempSync(path.join(tmpdir(), 'ohmlet-grading-'));
  const out = path.join(dir, 'grading.mjs');
  writeFileSync(out, js);
  const mod = await import(pathToFileURL(out).href);
  const missing = MOBILE_GRADERS.filter((name) => typeof mod[name] !== 'function');
  if (missing.length) {
    throw new Error(`${file} no longer exports ${missing.join(', ')} — update loadMobileGrading() and the rules that call it`);
  }
  return mod;
}

/** The region ids each region-tapping step needs a hit area for, mirroring mobile's canRender. */
const regionsNeeded = (step) => {
  switch (step.type) {
    case 'spot_error':
      return [step.correctRegion];
    case 'identify_component':
      return [step.correctComponent];
    case 'fix_the_circuit':
      return [step.faultRegion];
    case 'trace_current':
      return step.correctPath ?? [];
    default:
      return null;
  }
};

/**
 * Every solvability rule, per step. `regionsFor` comes from the circuit registry
 * so region banks are checked against what the diagram actually exposes.
 *
 * `mobileSeverity` decides what a mobile-only finding is worth. It defaults to
 * 'error', the honest answer for a corpus both surfaces serve, and reading it
 * from an argument rather than module state keeps an importer's result from
 * depending on whatever flags the process happened to be started with.
 */
export function checkStep(step, regionsFor, isKnownCircuit, mobile = null, mobileSeverity = 'error') {
  const out = [];
  const err = (bank, message, surface = 'both') => out.push({ severity: 'error', bank, message, surface });
  const warn = (bank, message, surface = 'both') => out.push({ severity: 'warn', bank, message, surface });
  // What mobile actually is, read off mobile: its hit maps, the types it can
  // render, and its own grading functions. Every mobile rule below asks one of
  // these three rather than asserting something remembered about the phone.
  const mobileRegions = mobile?.regions ?? null;
  const mobileSupported = mobile?.supported ?? null;
  const grading = mobile?.grading ?? null;

  // ── canRender's first arm: a type the phone has no renderer for ──
  if (mobileSupported && !mobileSupported.has(step.type)) {
    out.push({
      severity: mobileSeverity,
      bank: 'type',
      surface: 'mobile',
      message:
        `${step.type}: mobile has no renderer for this step type, so canRender drops it ` +
        '(mobile/src/lesson/types.ts, SUPPORTED) and the learner is taught less on the phone than in the browser, ' +
        `with nothing saying so. Add a ${step.type} renderer to mobile/src/lesson/StepView.tsx and list the type in SUPPORTED.`,
    });
  }

  // ── The same region bank, on the other surface ──
  // Checked for every region step regardless of type, because mobile's drop rule
  // is the same for all four of them.
  if (mobileRegions) {
    const needed = regionsNeeded(step);
    if (needed && needed.length) {
      const have = mobileRegions.get(step.circuitDiagram) ?? [];
      const missing = needed.filter((r) => !have.includes(r));
      if (missing.length) {
        out.push({
          severity: mobileSeverity,
          bank: 'regions',
          surface: 'mobile',
          message:
            `${step.type}: ${missing.map((r) => `"${r}"`).join(', ')} ` +
            `${missing.length > 1 ? 'have' : 'has'} no hit area on mobile's "${step.circuitDiagram}" ` +
            `(mobile offers: ${have.length ? have.join(', ') : 'nothing — the diagram has no hit map'}), ` +
            "so mobile's canRender drops this step and the learner never sees it. " +
            'The two surfaces draw different art for this circuit id: align mobile/src/components/circuits/CircuitDiagram.tsx with the web registry.',
        });
      }
    }
  }

  // ── Widget-graded and option banks ──
  const widgetGraded = !!step.meter || !!step.bands;
  if (OPTION_TYPES.has(step.type) && !widgetGraded) {
    const options = step.options;
    if (!Array.isArray(options) || !options.length) {
      err('options', `${step.type}: no options to choose from`);
    } else if (!Number.isInteger(step.correct) || step.correct < 0 || step.correct >= options.length) {
      err('options', `${step.type}: correct index ${step.correct} is outside the option list (0..${options.length - 1})`);
    } else {
      const right = norm(options[step.correct]);
      const twin = options.findIndex((o, i) => i !== step.correct && norm(o) === right);
      if (twin !== -1) {
        err('options', `${step.type}: option ${twin} reads exactly like the correct option ${step.correct} ("${options[step.correct]}"), so a correct read can be graded wrong`);
      }
    }
  }

  switch (step.type) {
    case 'fill_blank': {
      if (!Array.isArray(step.tiles) || !step.tiles.length) break; // typed answer: no bank
      const byIndex = bankEntries(step.tiles, 'index');
      const web = assemble(step.answer, byIndex);
      if (!web) {
        err('tiles', `fill_blank: the tile bank cannot build the answer — ${explainBank(step.answer, step.tiles, byIndex)}`);
      } else {
        const spare = step.tiles.length - web.length;
        if (spare < 1) warn('tiles', 'fill_blank: every tile is needed, so there is nothing to choose against (add a distractor)');
        // The same placement, put to the phone's OWN grader. `web` is the
        // winning sequence of bank slots; tapping those slots in that order is
        // exactly what toggleTile does, so if the placement it builds is not the
        // one we asked for, or mobile's grader refuses it, the answer a browser
        // accepts cannot be given on a phone.
        if (grading) {
          let placed = [];
          for (const slot of web) placed = grading.toggleTile(placed, slot);
          const asTapped = placed.length === web.length && placed.every((slot, i) => slot === web[i]);
          if (!asTapped || !grading.gradeFillTiles(step.tiles, step.answer, placed)) {
            out.push({
              severity: mobileSeverity,
              bank: 'tiles',
              surface: 'mobile',
              message:
                'fill_blank: solvable on web but NOT on mobile — tapping bank slots ' +
                `${web.join(', ')} in order spells the answer, and mobile's own grading (mobile/src/lesson/grading.ts, ` +
                `${asTapped ? 'gradeFillTiles' : 'toggleTile'}) ${asTapped ? 'marks it wrong' : 'cannot even build that placement'}. ` +
                'Usually the bank is being keyed by tile VALUE rather than by slot, so a second copy of a token can never be placed.',
            });
          }
        }
      }
      break;
    }

    case 'build_to_spec': {
      const { palette, slots, correct } = step;
      if (!Array.isArray(palette) || !palette.length) {
        err('palette', 'build_to_spec: no palette to build from');
        break;
      }
      if (!Array.isArray(correct) || correct.length !== slots) {
        err('palette', `build_to_spec: ${slots} slot(s) but ${Array.isArray(correct) ? correct.length : 0} correct part(s), so the slots can never all be right`);
        break;
      }
      const bad = correct.filter((i) => !Number.isInteger(i) || i < 0 || i >= palette.length);
      if (bad.length) err('palette', `build_to_spec: correct part index ${bad.join(', ')} is not in the palette (0..${palette.length - 1})`);
      // Slots are graded by palette INDEX (BuildStep: `p === step.correct[i]`), but the
      // learner only ever sees the part's text. Two parts that read the same are a coin
      // flip: tap the twin and a visually perfect build grades wrong, with nothing on
      // screen to change. Same defect as identical drag_order rows.
      const seenPart = new Map();
      palette.forEach((part, i) => {
        const k = norm(part);
        if (seenPart.has(k)) {
          const twin = seenPart.get(k);
          if (correct.includes(twin) || correct.includes(i))
            err('palette', `build_to_spec: parts ${twin} and ${i} both read as "${k}" and one of them is the answer, so which to tap is a guess the screen cannot settle`);
          else warn('palette', `build_to_spec: parts ${twin} and ${i} both read as "${k}" (harmless today, but making either the answer would be unanswerable)`);
        } else seenPart.set(k, i);
      });
      break;
    }

    case 'drag_order': {
      const { items, correctOrder } = step;
      if (!Array.isArray(items) || items.length < 2) {
        err('order', 'drag_order: fewer than 2 items to order');
        break;
      }
      const perm = Array.isArray(correctOrder) && correctOrder.length === items.length && new Set(correctOrder).size === items.length && correctOrder.every((v) => Number.isInteger(v) && v >= 0 && v < items.length);
      if (!perm) {
        err('order', `drag_order: correctOrder is not an arrangement of the ${items.length} items, so no arrangement the learner can make will match`);
        break;
      }
      // Repeated rows are legitimate content (Blink's loop() really does hold two
      // `delay(1000);` lines). The web runner grades the arrangement by what the
      // rows SAY, so they are interchangeable there. Whether the phone agrees is
      // put to the phone's own grader rather than assumed: swap a pair of rows
      // that read alike and ask whether the arrangement the learner cannot tell
      // apart from the authored one still grades correct.
      const byText = new Map();
      items.forEach((t, i) => {
        const k = norm(t);
        if (!byText.has(k)) byText.set(k, []);
        byText.get(k).push(i);
      });
      if (grading) {
        if (!grading.gradeOrder(items, correctOrder, [...correctOrder])) {
          out.push({
            severity: mobileSeverity,
            bank: 'order',
            surface: 'mobile',
            message: "drag_order: mobile's own grading (mobile/src/lesson/grading.ts, gradeOrder) marks the AUTHORED arrangement wrong, so this step cannot be cleared on a phone at all",
          });
          break;
        }
        for (const [text, idxs] of byText) {
          if (idxs.length < 2) continue;
          const swapped = [...correctOrder];
          const a = swapped.indexOf(idxs[0]);
          const b = swapped.indexOf(idxs[1]);
          if (a === -1 || b === -1) continue;
          [swapped[a], swapped[b]] = [swapped[b], swapped[a]];
          if (!grading.gradeOrder(items, correctOrder, swapped)) {
            out.push({
              severity: mobileSeverity,
              bank: 'order',
              surface: 'mobile',
              message:
                `drag_order: ${idxs.length} rows read as "${text}", and swapping two of them gives an arrangement the learner ` +
                "cannot tell from the authored one, which mobile's grading (mobile/src/lesson/grading.ts, gradeOrder) marks wrong. " +
                'Half the visually perfect answers fail there, at random, and the step comes back round the requeue. Grade by row text, not item index.',
            });
          }
        }
      }
      break;
    }

    case 'match': {
      const { pairs } = step;
      if (!Array.isArray(pairs) || !pairs.length) {
        err('match', 'match: no pairs to match');
        break;
      }
      if (!hasPerfectMatching(pairs)) {
        err('match', 'match: the pair values admit no complete matching, so some term can never be cleared');
      }
      const leftSeen = new Map();
      pairs.forEach(([l, r], i) => {
        const k = norm(l);
        if (leftSeen.has(k) && norm(leftSeen.get(k).r) !== norm(r)) {
          err('match', `match: terms ${leftSeen.get(k).i} and ${i} both read as "${k}" but want different answers, so which is which is a guess`);
        }
        leftSeen.set(k, { i, r });
      });
      break;
    }

    case 'predict_reading': {
      if (!step.meter) break;
      const m = step.meter;
      if (!(m.max > m.min)) {
        err('meter', 'predict_reading: the meter has no usable range (max must exceed min)');
        break;
      }
      if (m.target < m.min || m.target > m.max) {
        err('meter', `predict_reading: the target ${m.target} is off the dial (${m.min}..${m.max})`);
        break;
      }
      const stop = nearestMeterStop(m);
      if (stop === null || Math.abs(stop - m.target) > m.tolerance + 1e-9) {
        err('meter', `predict_reading: the dial steps in ${m.step ?? 'auto'}, so the closest reading it can rest on is ${stop}, which is outside the ±${m.tolerance} accepted around ${m.target}`);
      }
      break;
    }

    case 'choose_resistor': {
      if (!step.bands) break;
      if (!bandEncodable(step.bands.targetOhms)) {
        err('bands', `choose_resistor: ${step.bands.targetOhms} Ω cannot be set on the three bands (two digits × 10^0..10^6)`);
      }
      break;
    }

    case 'trace_current': {
      const valid = regionsFor(step.circuitDiagram);
      if (!isKnownCircuit(step.circuitDiagram)) {
        err('regions', `trace_current: "${step.circuitDiagram}" is not a circuit the app can draw, so there is nothing to tap`);
        break;
      }
      step.correctPath.forEach((r, i) => {
        if (!valid.includes(r)) err('regions', `trace_current: step ${i} of the path taps "${r}", which the diagram does not expose (offers: ${valid.join(', ')})`);
      });
      const dupes = step.correctPath.filter((r, i) => step.correctPath.indexOf(r) !== i);
      if (dupes.length) {
        err('regions', `trace_current: the path revisits ${[...new Set(dupes)].map((d) => `"${d}"`).join(', ')}, but re-tapping a traced part rewinds the path to before it, so the repeat can never be entered`);
      }
      break;
    }

    case 'spot_error':
    case 'identify_component':
    case 'fix_the_circuit': {
      const wanted = step.type === 'spot_error' ? step.correctRegion : step.type === 'identify_component' ? step.correctComponent : step.faultRegion;
      if (!isKnownCircuit(step.circuitDiagram)) {
        err('regions', `${step.type}: "${step.circuitDiagram}" is not a circuit the app can draw, so there is nothing to tap`);
      } else {
        const valid = regionsFor(step.circuitDiagram);
        if (!valid.includes(wanted)) err('regions', `${step.type}: the answer "${wanted}" is not a clickable part of "${step.circuitDiagram}" (offers: ${valid.join(', ')})`);
      }
      if (step.type === 'fix_the_circuit') {
        const fixes = step.fixes;
        if (!Array.isArray(fixes) || !fixes.length) err('options', 'fix_the_circuit: no repairs to choose from');
        else if (!Number.isInteger(step.correctFix) || step.correctFix < 0 || step.correctFix >= fixes.length) {
          err('options', `fix_the_circuit: correctFix ${step.correctFix} is outside the repair list (0..${fixes.length - 1})`);
        } else {
          const right = norm(fixes[step.correctFix]);
          const twin = fixes.findIndex((f, i) => i !== step.correctFix && norm(f) === right);
          if (twin !== -1) err('options', `fix_the_circuit: repair ${twin} reads exactly like the correct repair ${step.correctFix}, so a correct read can be graded wrong`);
        }
      }
      break;
    }

    case 'draw_connection': {
      const ids = new Set((step.terminals ?? []).map((t) => t.id));
      (step.expectedConnections ?? []).forEach(([a, b], i) => {
        if (!ids.has(a) || !ids.has(b)) {
          err('terminals', `draw_connection: wire ${i} runs to ${!ids.has(a) ? `"${a}"` : `"${b}"`}, which is not a terminal on the board`);
        } else if (a === b) {
          err('terminals', `draw_connection: wire ${i} joins "${a}" to itself, and a second tap on a terminal deselects it, so that wire cannot be drawn`);
        }
      });
      // A pair listed twice reads differently on each runner, and the phone is
      // where it bites. Web's DrawStep TOGGLES: re-tapping a drawn pair removes
      // it, so `drawn` can never hold the repeat, and evaluate compares sets
      // (LessonRunner, draw_connection: `want.size === have.size`), so drawing
      // each distinct wire once is graded correct. Mobile only counts wires
      // (StepView, ConnectStep: `wires.length === expected.length`) and never
      // toggles, so Check stays disabled until the learner draws the SAME wire a
      // second time, with nothing on the board asking for it. Same shape as the
      // drag_order coin flip: completable in principle, a dead end in front of a
      // learner.
      const seen = new Set();
      (step.expectedConnections ?? []).forEach((pair) => {
        const k = [...pair].sort().join('|');
        if (seen.has(k)) {
          out.push({
            severity: mobileSeverity,
            bank: 'terminals',
            surface: 'mobile',
            message:
              `draw_connection: the wire ${k.replace('|', ' to ')} is listed twice. Web grades the wires as a set and re-tapping a drawn pair removes it, so the repeat is invisible there; ` +
              'mobile enables Check on the COUNT of wires (mobile/src/lesson/StepView.tsx, ConnectStep), so the learner has to draw that wire twice to get past it, and nothing on the board says so. ' +
              'List each wire once.',
          });
        }
        seen.add(k);
      });
      break;
    }

    case 'teach': {
      if (!Array.isArray(step.hotspots) || !step.hotspots.length || !step.circuitDiagram) break;
      const valid = regionsFor(step.circuitDiagram);
      for (const h of step.hotspots) {
        if (!valid.includes(h.region)) warn('regions', `teach: hotspot "${h.region}" is not a clickable part of "${step.circuitDiagram}", so it can only be reached from the list, never from the diagram`);
      }
      break;
    }

    default:
      break;
  }

  return out;
}

/** Which bank a step puts in front of the learner, for the coverage report. */
function bankOf(step) {
  switch (step.type) {
    case 'fill_blank':
      return Array.isArray(step.tiles) && step.tiles.length ? 'tiles' : null;
    case 'build_to_spec':
      return 'palette';
    case 'drag_order':
      return 'order';
    case 'match':
      return 'match';
    case 'predict_reading':
      return step.meter ? 'meter' : 'options';
    case 'choose_resistor':
      return step.bands ? 'bands' : 'options';
    case 'multiple_choice':
    case 'predict_behavior':
      return 'options';
    case 'trace_current':
    case 'spot_error':
    case 'identify_component':
      return 'regions';
    case 'fix_the_circuit':
      return 'regions+options';
    case 'draw_connection':
      return 'terminals';
    default:
      return null;
  }
}

export function checkCorpus(lessons, regionsFor, isKnownCircuit, mobile, mobileSeverity) {
  // All three mobile inputs are REQUIRED here, where checkStep leaves them
  // optional so a caller can exercise one rule at a time. A corpus walked
  // without one of them drops that rule and still prints "web and mobile rules
  // both enforced" — exactly the comfortable green this checker was rewritten
  // to stop — so the walk refuses to start rather than under-report.
  if (!(mobile?.regions instanceof Map)) throw new Error("checkCorpus needs mobile's region map, or the mobile region rule silently does not run");
  if (!(mobile?.supported instanceof Set)) throw new Error("checkCorpus needs mobile's SUPPORTED set, or the mobile step-type rule silently does not run");
  const absent = MOBILE_GRADERS.filter((name) => typeof mobile?.grading?.[name] !== 'function');
  if (absent.length) throw new Error(`checkCorpus needs mobile's grading (${absent.join(', ')}), or the mobile tile and order rules silently do not run`);
  const findings = [];
  const banks = new Map();
  let steps = 0;
  for (const [lessonId, entry] of Object.entries(lessons ?? {})) {
    (entry?.steps ?? []).forEach((step, stepIndex) => {
      steps += 1;
      const bank = bankOf(step);
      if (bank) banks.set(bank, (banks.get(bank) ?? 0) + 1);
      for (const f of checkStep(step, regionsFor, isKnownCircuit, mobile, mobileSeverity)) {
        findings.push({ lessonId, stepIndex, stepType: step.type, ...f });
      }
    });
  }
  return { findings, steps, banks, lessons: Object.keys(lessons ?? {}).length };
}

function report(title, result) {
  const errors = result.findings.filter((f) => f.severity === 'error');
  const warns = result.findings.filter((f) => f.severity === 'warn');
  const mobile = result.findings.filter((f) => f.surface === 'mobile');
  const banked = [...result.banks.entries()].sort((a, b) => b[1] - a[1]);

  console.log(c.bold(`\n${title}`));
  console.log(
    c.dim(
      `  ${result.lessons} lessons · ${result.steps} steps · ` +
        `${banked.reduce((n, [, v]) => n + v, 0)} with a bank (${banked.map(([k, v]) => `${k} ${v}`).join(', ')})`,
    ),
  );

  if (!result.findings.length) {
    console.log(c.green('  ✓ every banked step can be answered from what it offers, on web and on mobile.'));
    return { errors: errors.length, warns: warns.length, mobile: mobile.length };
  }

  const byLesson = new Map();
  for (const f of result.findings) {
    if (!byLesson.has(f.lessonId)) byLesson.set(f.lessonId, []);
    byLesson.get(f.lessonId).push(f);
  }
  for (const [lessonId, list] of byLesson) {
    const hasError = list.some((f) => f.severity === 'error');
    console.log(`  ${hasError ? c.red('✗') : c.yellow('!')} ${c.bold(lessonId)}`);
    for (const f of list.sort((a, b) => (a.severity === b.severity ? a.stepIndex - b.stepIndex : a.severity === 'error' ? -1 : 1))) {
      const tag = f.severity === 'error' ? c.red('unsolvable') : c.yellow('warning   ');
      console.log(`      ${tag} ${c.dim(`(step ${f.stepIndex} · ${f.stepType} · ${f.bank})`)} ${f.message}`);
    }
  }
  return { errors: errors.length, warns: warns.length, mobile: mobile.length };
}

// ─────────────────────────── self-test ───────────────────────────
// The corpus is a moving target: once the mobile defects are fixed, a run of
// this checker is green whether or not the mobile rules are enforced, so a green
// run proves nothing about the DEFAULT. These fixtures do. They fail the moment
// a mobile finding stops being an error without a flag asking for it, or
// package.json stops asking for the strict answer.

/** A minimal web registry: "demo" is drawn, and web exposes led + battery. */
const FIXTURE_WEB = {
  regionsFor: (id) => (id === 'demo' ? ['led', 'battery'] : []),
  isKnownCircuit: (id) => id === 'demo',
};

/** The phone as it WAS: the tile bank keyed by value, the order compared by index. */
const GRADING_DRIFTED = {
  toggleTile: (placed, slot) => (placed.includes(slot) ? placed.filter((s) => s !== slot) : [...placed, slot]),
  gradeFillTiles: (tiles, answer, placed) => {
    const spent = new Set();
    for (const slot of placed) {
      if (spent.has(tiles[slot])) return false; // that VALUE is already used up
      spent.add(tiles[slot]);
    }
    return norm(placed.map((slot) => tiles[slot] ?? '').join(' ')) === norm(answer);
  },
  gradeOrder: (items, correctOrder, order) =>
    order.length === correctOrder.length && order.every((v, i) => v === correctOrder[i]),
};

/** The phone as mobile/src/lesson/grading.ts has it today: by slot, and by row text. */
const GRADING_ALIGNED = {
  toggleTile: GRADING_DRIFTED.toggleTile,
  gradeFillTiles: (tiles, answer, placed) => norm(placed.map((slot) => tiles[slot] ?? '').join(' ')) === norm(answer),
  gradeOrder: (items, correctOrder, order) =>
    order.length === correctOrder.length
    && order.every((itemIndex, slot) => items[correctOrder[slot]] !== undefined && items[correctOrder[slot]] === items[itemIndex]),
};

const MOBILE_FIXTURE = {
  // Mobile draws its own art for "demo" and has no LED in it.
  regions: new Map([['demo', ['buzzer', 'battery']]]),
  // The types this fixture phone has renderers for. Everything the other
  // fixtures use is here, so only the fixture that means to be unsupported is.
  supported: new Set(['fill_blank', 'drag_order', 'identify_component', 'draw_connection', 'multiple_choice']),
  grading: GRADING_DRIFTED,
};
const MOBILE_FIXTURE_ALIGNED = { ...MOBILE_FIXTURE, grading: GRADING_ALIGNED };

// `expect` is what the rules must say about a DRIFTED phone. `whenAligned` is
// what they must say once mobile grades the way it does today, and it is the
// half that would have caught the stale rules: a rule that reports the same
// count either way is not reading mobile, it is remembering it.
const FIXTURES = [
  {
    name: 'fill_blank: a token a value-keyed bank cannot place twice',
    step: { type: 'fill_blank', answer: 'more current more heat', tiles: ['more', 'current', 'more', 'heat', 'less'] },
    expect: { count: 1, surface: 'mobile', bank: 'tiles' },
    whenAligned: 0,
  },
  {
    name: 'drag_order: identical rows, a coin flip against index grading',
    step: { type: 'drag_order', items: ['delay(1000);', 'digitalWrite(13, HIGH);', 'delay(1000);'], correctOrder: [1, 0, 2] },
    expect: { count: 1, surface: 'mobile', bank: 'order' },
    whenAligned: 0,
  },
  {
    name: 'identify_component: an answer with no hit area on mobile art',
    step: { type: 'identify_component', circuitDiagram: 'demo', correctComponent: 'led' },
    expect: { count: 1, surface: 'mobile', bank: 'regions' },
  },
  {
    name: 'draw_connection: a wire listed twice, which stalls the phone Check button',
    step: {
      type: 'draw_connection',
      terminals: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      expectedConnections: [['a', 'b'], ['b', 'c'], ['b', 'a']],
    },
    expect: { count: 1, surface: 'mobile', bank: 'terminals' },
  },
  {
    name: 'a step type the phone has no renderer for, which canRender drops before it looks at anything else',
    step: { type: 'solder_joint', question: 'which joint is cold?', options: ['left', 'right'], correct: 0 },
    expect: { count: 1, surface: 'mobile', bank: 'type' },
  },
  {
    name: 'control: a step both surfaces can answer raises nothing',
    step: { type: 'fill_blank', answer: 'ohms law', tiles: ['ohms', 'law', 'watts'] },
    expect: { count: 0 },
  },
  {
    name: 'control: a web-side defect stays an error even in the web-only read',
    step: { type: 'multiple_choice', options: ['a', 'b'], correct: 4 },
    expect: { count: 1, surface: 'both', bank: 'options', alwaysError: true },
  },
];

function selfTest() {
  const failures = [];
  const check = (ok, message) => {
    if (!ok) failures.push(message);
  };

  // 1. The flag derivation: no flag means the strict, both-surfaces answer.
  check(mobileSeverityFor(new Set()) === 'error', 'a run with no flags must treat mobile findings as errors');
  check(mobileSeverityFor(new Set(['--json'])) === 'error', '--json must not change what a mobile finding is worth');
  check(mobileSeverityFor(new Set(['--strict-mobile'])) === 'error', '--strict-mobile must still mean enforced');
  check(mobileSeverityFor(new Set(['--web-only'])) === 'warn', '--web-only must downgrade mobile findings, and only --web-only may');

  // 2. The rules themselves, with the severity left to its default. This is what
  //    breaks if that default is put back to warn.
  const { regionsFor, isKnownCircuit } = FIXTURE_WEB;
  for (const f of FIXTURES) {
    const byDefault = checkStep(f.step, regionsFor, isKnownCircuit, MOBILE_FIXTURE);
    const webOnly = checkStep(f.step, regionsFor, isKnownCircuit, MOBILE_FIXTURE, 'warn');
    // The same step against a phone that grades the way mobile grades TODAY. A
    // rule that answers the same either way is remembering the phone, not
    // reading it, which is how 20 solvable steps stayed "unsolvable" for a
    // fortnight after mobile fixed them.
    const aligned = checkStep(f.step, regionsFor, isKnownCircuit, MOBILE_FIXTURE_ALIGNED);
    const wantAligned = f.whenAligned ?? f.expect.count;
    check(aligned.length === wantAligned, `${f.name}: against a phone whose grading matches the web this must raise ${wantAligned} finding(s), got ${aligned.length} (${aligned.map((x) => x.message).join(' | ')})`);
    check(byDefault.length === f.expect.count, `${f.name}: expected ${f.expect.count} finding(s) by default, got ${byDefault.length} (${byDefault.map((x) => x.message).join(' | ')})`);
    check(webOnly.length === f.expect.count, `${f.name}: expected ${f.expect.count} finding(s) in the web-only read, got ${webOnly.length}`);
    if (!f.expect.count || byDefault.length !== f.expect.count) continue;
    const [d] = byDefault;
    const [w] = webOnly;
    check(d.surface === f.expect.surface, `${f.name}: expected surface "${f.expect.surface}", got "${d.surface}"`);
    check(d.bank === f.expect.bank, `${f.name}: expected bank "${f.expect.bank}", got "${d.bank}"`);
    check(d.severity === 'error', `${f.name}: must be an ERROR by default, was "${d.severity}". The default has to be the strict, both-surfaces answer`);
    check(w.severity === (f.expect.alwaysError ? 'error' : 'warn'), `${f.name}: in the web-only read this must be "${f.expect.alwaysError ? 'error' : 'warn'}", was "${w.severity}". Only MOBILE findings may be softened by --web-only`);
  }

  // 3. A mobile rule that cannot read mobile must FAIL, never quietly not run.
  //    Both loaders used to have, or could regrow, a "file missing → skip" arm,
  //    and a skipped rule prints the same green as a passing one. So: a missing
  //    file throws, and the real files still parse — the second half catches the
  //    rename that would otherwise reach the first.
  const throws = (fn) => {
    try {
      fn();
      return false;
    } catch {
      return true;
    }
  };
  check(throws(() => loadMobileRegions(path.resolve(root, 'no/such/CircuitDiagram.tsx'))), 'a missing mobile diagram must throw, not skip the region rule and still print a green "both surfaces" run');
  check(throws(() => loadMobileSupported(path.resolve(root, 'no/such/types.ts'))), 'missing mobile types must throw, not skip the step-type rule');
  check(!throws(() => loadMobileRegions()), `${MOBILE_DIAGRAM} no longer parses, so the mobile region rule cannot run`);
  check(!throws(() => loadMobileSupported()), `${MOBILE_TYPES} no longer parses, so the mobile step-type rule cannot run`);
  //    The grading module is executed, not parsed, so the sync half of that is
  //    the file being there and still naming what the rules call. The run itself
  //    throws if either stops being true.
  check(existsSync(MOBILE_GRADING), `${MOBILE_GRADING} is missing, so the mobile tile and order rules have nothing to drive`);
  const gradingSrc = existsSync(MOBILE_GRADING) ? readFileSync(MOBILE_GRADING, 'utf8') : '';
  for (const name of MOBILE_GRADERS) {
    check(new RegExp(`export const ${name}\\b`).test(gradingSrc), `${MOBILE_GRADING} no longer exports ${name}, which the mobile tile and order rules call`);
  }
  //    And the corpus walk must refuse ANY of the three being dropped at the
  //    call site, which no fixture calling checkStep directly would notice.
  const corpus = { l1: { steps: [{ type: 'multiple_choice', options: ['a', 'b'], correct: 0 }] } };
  const without = (key) => ({ ...MOBILE_FIXTURE, [key]: undefined });
  check(throws(() => checkCorpus(corpus, regionsFor, isKnownCircuit, without('regions'), 'error')), "checkCorpus must refuse to walk a corpus without mobile's region map instead of quietly skipping that rule");
  check(throws(() => checkCorpus(corpus, regionsFor, isKnownCircuit, without('supported'), 'error')), "checkCorpus must refuse to walk a corpus without mobile's SUPPORTED set instead of quietly skipping that rule");
  check(throws(() => checkCorpus(corpus, regionsFor, isKnownCircuit, without('grading'), 'error')), "checkCorpus must refuse to walk a corpus without mobile's grading instead of quietly skipping the tile and order rules");
  check(!throws(() => checkCorpus(corpus, regionsFor, isKnownCircuit, MOBILE_FIXTURE, 'error')), 'checkCorpus rejects its own valid arguments');

  // 4. The wiring: the scripts everybody actually runs must ask for the strict answer.
  const pkg = JSON.parse(readFileSync(path.resolve(root, 'package.json'), 'utf8'));
  for (const name of ['lint:lessons', 'check:solvability']) {
    const cmd = pkg.scripts?.[name];
    check(typeof cmd === 'string' && cmd.includes('check-lesson-solvability.mjs'), `package.json script "${name}" must run check-lesson-solvability.mjs`);
    check(!String(cmd).includes('--web-only'), `package.json script "${name}" must not pass --web-only: that is the debugging read, not the answer`);
  }

  if (failures.length) {
    console.error(c.red(`\nSolvability self-test: ${failures.length} failure(s)`));
    for (const f of failures) console.error(`  ${c.red('✗')} ${f}`);
    console.error('');
    return 1;
  }
  console.log(c.green(`\nSolvability self-test: ${FIXTURES.length} fixtures and the package.json wiring agree that both surfaces are enforced by default.\n`));
  return 0;
}

async function main() {
  const server = await createServer({
    root,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
    optimizeDeps: { noDiscovery: true },
  });

  try {
    const [{ LESSON_CONTENT }, registry] = await Promise.all([
      server.ssrLoadModule('/components/ohmlet/data/lessons.ts'),
      server.ssrLoadModule('/components/ohmlet/circuits/registry.ts'),
    ]);
    const { regionsFor, isKnownCircuit } = registry;

    const mobile = {
      regions: loadMobileRegions(),
      supported: loadMobileSupported(),
      grading: await loadMobileGrading(server),
    };
    const source = checkCorpus(LESSON_CONTENT, regionsFor, isKnownCircuit, mobile, MOBILE_SEVERITY);

    let exported = null;
    if (existsSync(EXPORT_JSON)) {
      const raw = JSON.parse(readFileSync(EXPORT_JSON, 'utf8'));
      exported = checkCorpus(raw.lessons, regionsFor, isKnownCircuit, mobile, MOBILE_SEVERITY);
      exported.version = raw.version;
    }

    if (AS_JSON) {
      console.log(
        JSON.stringify(
          {
            mobileRules: WEB_ONLY ? 'web-only' : 'enforced',
            source: { lessons: source.lessons, steps: source.steps, findings: source.findings },
            exported: exported && { version: exported.version, lessons: exported.lessons, steps: exported.steps, findings: exported.findings },
          },
          null,
          2,
        ),
      );
      await server.close();
      process.exit(source.findings.some((f) => f.severity === 'error') || (exported?.findings ?? []).some((f) => f.severity === 'error') ? 1 : 0);
    }

    console.log(c.bold('\nChecking that every banked lesson step can actually be answered…'));
    const a = report('Authored source · components/ohmlet/data/lessons.ts', source);
    const b = exported
      ? report(`Served corpus · curriculum_data/lessons.json ${c.dim(`(version ${exported.version})`)}`, exported)
      : { errors: 0, warns: 0, mobile: 0 };

    if (!exported) {
      console.log(c.yellow('\n  ! No exported corpus found. Run `node scripts/export-curriculum.mjs` so the backend and mobile serve these lessons.'));
    } else if (a.errors === 0 && b.errors > 0) {
      console.log(c.yellow('\n  ! The source is clean but the served corpus is not: the export is stale. Run `node scripts/export-curriculum.mjs`.'));
    }

    const errors = a.errors + b.errors;
    const warns = a.warns + b.warns;
    const mobileFindings = a.mobile + b.mobile;
    console.log(
      `\n${c.bold('Summary:')} ${errors ? c.red(`${errors} unsolvable step(s)`) : c.green('0 unsolvable steps')}, ` +
        `${warns ? c.yellow(`${warns} warning(s)`) : '0 warnings'}` +
        (WEB_ONLY ? '' : c.dim(' · web and mobile rules both enforced')) +
        '\n',
    );
    if (WEB_ONLY) {
      // The escape hatch has to cost something to read, or it becomes the default
      // by habit and the phone stays broken.
      console.log(
        c.yellow(
          `  ! --web-only: ${mobileFindings} finding(s) that make a step impossible or invisible on the phone were reported as warnings, not enforced.\n` +
            '    This is the WEB-ONLY answer, for debugging the web runner in isolation. Drop the flag for the real one; never use it in CI.\n',
        ),
      );
    }

    await server.close();
    process.exit(errors ? 1 : 0);
  } catch (err) {
    await server.close();
    console.error(c.red('Solvability check failed to run:'), err);
    process.exit(2);
  }
}

// Only when run as a command: the rules above are importable so they can be
// exercised directly against known-good and known-bad shapes.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (SELF_TEST) process.exit(selfTest());
  else main();
}
