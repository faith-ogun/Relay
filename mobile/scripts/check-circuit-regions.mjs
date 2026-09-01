// Mobile's circuit hit map, held to the web's.
//
// ── Why this exists ──
//
// A lesson is authored ONCE and graded on both surfaces. A region step
// (identify_component, spot_error, fix_the_circuit, trace_current) names a
// circuit id plus a region id on it, and each surface draws its own art for
// that id. When the two arts drift, the step does not fail loudly on the
// surface that is missing the part: mobile's `canRender`
// (src/lesson/types.ts) DROPS it from the run, so the learner never sees it and
// the lesson is quietly shorter and easier on a phone.
//
// That is exactly what happened. Mobile's `ldr_alarm` was an NPN driving a
// buzzer; the web's, and the lesson text's, is D9 -> 220R -> LED. Six authored
// identify_component steps asked for "led" or "resistor" on that circuit and
// were silently dropped on every phone.
//
// `canRender` stays: it is the guard that stopped 42 lessons crashing. This
// checker is what stops it ever firing in production, by proving at check time
// that it has nothing to drop.
//
// ── What it asserts ──
//
//   1. The two surfaces draw the same set of circuit ids.
//   2. For every circuit id, mobile exposes EXACTLY the regions the web does.
//      Missing means a dropped step. Extra means a distractor only phone
//      learners can tap, which no authored answer can ever be.
//   3. Every region an authored step can name resolves on mobile, checked
//      against both corpora (the authored source and the JSON the app fetches).
//   4. Every hit area can be hit with a finger: at least MIN_UNITS on its
//      shorter side (see the scale note below), inside the diagram's viewBox,
//      and not overlapping another region on the same diagram.
//   5. Each drawing's canvas height comes from the SAME constant the overlay
//      reads. The art and the hit map are two separate SVGs over one viewBox;
//      if the drawing hard-codes 200 while HEIGHTS says 230 both still render,
//      but they scale differently and every hit area on that diagram lands off
//      its part, with assertions 1-4 all still green. So a drawing that needs a
//      taller canvas must write `h={HEIGHTS.<its own id>}`, never a number.
//
//   node scripts/check-circuit-regions.mjs
//
// Exit 0 clean, 1 findings, 2 the checker itself could not run.

import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../..');
const DIAGRAM = resolve(here, '../src/components/circuits/CircuitDiagram.tsx');
const CIRCUITS_DIR = resolve(REPO, 'frontend/components/ohmlet/circuits');
const AUTHORED = resolve(REPO, 'frontend/components/ohmlet/data/lessons.ts');
const SERVED = resolve(REPO, 'backend/live-bridge/app/curriculum_data/lessons.json');

// ── The finger ──
//
// The diagram's SVG is `width="100%" height={h}` over a `0 0 320 h` viewBox, so
// it is never scaled UP: the fit is min(contentWidth / 320, 1). A lesson lays
// its content out with 24 pt of padding either side, so contentWidth is the
// screen width minus 48. The narrowest common phone is a 360 dp Android, giving
// 312 / 320 = 0.975 pt per viewBox unit; every wider phone renders 1 unit as
// exactly 1 pt. 46 units therefore clears the 44 pt finger minimum everywhere
// that matters (44.9 pt at the worst common scale).
const NARROWEST_SCREEN_PT = 360;
const LESSON_PADDING_PT = 24;
const SCALE = Math.min((NARROWEST_SCREEN_PT - 2 * LESSON_PADDING_PT) / 320, 1);
const MIN_TAP_PT = 44;
const MIN_UNITS = 46;
const VIEWBOX_W = 320;
// The height every diagram draws at unless HEIGHTS gives it its own.
const DEFAULT_H = 170;

const findings = [];
const fail = (m) => findings.push(m);
const die = (m) => { console.error(`check-circuit-regions: ${m}`); process.exit(2); };

// ── Mobile: read the hit map straight out of the component ──
//
// Parsed from the AST rather than imported, because the module is react-native
// JSX and cannot be loaded in plain Node, and a second copy of the coordinates
// here would drift the moment the art moves.
function readMobile() {
  if (!existsSync(DIAGRAM)) die(`${DIAGRAM} is missing`);
  const sf = ts.createSourceFile(
    'CircuitDiagram.tsx', readFileSync(DIAGRAM, 'utf8'),
    ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX,
  );

  const decls = new Map();
  const walk = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      decls.set(n.name.text, n.initializer);
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);

  const literal = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
    if (ts.isNumericLiteral(n)) return Number(n.text);
    if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken) return -literal(n.operand);
    // `{...} as const` and `({...})` are the same value with a wrapper node.
    if (ts.isAsExpression(n) || ts.isParenthesizedExpression(n)) return literal(n.expression);
    if (ts.isArrayLiteralExpression(n)) return n.elements.map(literal);
    if (ts.isObjectLiteralExpression(n)) {
      return Object.fromEntries(n.properties.map((p) => {
        if (!ts.isPropertyAssignment(p)) throw new Error('unexpected object member');
        const key = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : p.name.getText();
        return [key, literal(p.initializer)];
      }));
    }
    throw new Error(`unhandled node ${ts.SyntaxKind[n.kind]}`);
  };

  const need = (name) => {
    const n = decls.get(name);
    if (!n) die(`${DIAGRAM} no longer declares \`${name}\`: update readMobile()`);
    return n;
  };

  let regions;
  let heights;
  try {
    regions = literal(need('REGIONS'));
    heights = literal(need('HEIGHTS'));
  } catch (e) {
    die(`could not read REGIONS/HEIGHTS out of ${DIAGRAM}: ${e.message}`);
  }

  const circuitsNode = need('CIRCUITS');
  if (!ts.isObjectLiteralExpression(circuitsNode)) {
    die(`${DIAGRAM}: CIRCUITS is no longer an object literal: update readMobile()`);
  }
  const drawn = circuitsNode.properties.map((p) => (ts.isIdentifier(p.name) ? p.name.text : p.name.getText()));

  // What each drawing passes as its canvas height, as written. `null` means it
  // took the default; `undefined` means no <Frame> was found at all, which is
  // this checker losing track of the art rather than the art being wrong.
  const frameHeight = new Map();
  for (const p of circuitsNode.properties) {
    const key = ts.isIdentifier(p.name) ? p.name.text : p.name.getText();
    let found;
    const seek = (n) => {
      if (found !== undefined) return;
      if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText() === 'Frame') {
        const attr = n.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText() === 'h');
        found = attr && attr.initializer && ts.isJsxExpression(attr.initializer) && attr.initializer.expression
          ? attr.initializer.expression.getText()
          : null;
        return;
      }
      ts.forEachChild(n, seek);
    };
    seek(p);
    frameHeight.set(key, found);
  }

  if (!drawn.length) die(`${DIAGRAM} parsed to zero circuits: update readMobile()`);
  return { regions, heights, drawn, frameHeight };
}

// ── Web: the registry is the source of truth for which regions exist ──
//
// registry.ts / specs.ts / spec.ts are deliberately React-free so tooling can
// read them; transpiled to ESM here and imported for real, so a change to the
// DSL is picked up rather than re-implemented.
async function readWebRegions(scratch) {
  const load = async (file, name) => {
    const abs = join(CIRCUITS_DIR, file);
    if (!existsSync(abs)) die(`${abs} is missing, and the web registry is this checker's source of truth`);
    const src = readFileSync(abs, 'utf8')
      .replace(/from '\.\/spec'/g, "from './spec.mjs'")
      .replace(/from '\.\/specs'/g, "from './specs.mjs'");
    const js = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const out = join(scratch, `${name}.mjs`);
    writeFileSync(out, js);
    return import(`file://${out}`);
  };
  await load('spec.ts', 'spec');
  await load('specs.ts', 'specs');
  const registry = await load('registry.ts', 'registry');
  const map = new Map(
    Object.entries(registry.CIRCUIT_REGIONS).map(([id, meta]) => [id, meta.regions]),
  );
  if (!map.size) die('the web registry exposed no circuits');
  return map;
}

// ── The corpus: every (circuit, region) an authored step can name ──
const REGION_STEP = {
  spot_error: (s) => [s.correctRegion],
  identify_component: (s) => [s.correctComponent],
  fix_the_circuit: (s) => [s.faultRegion],
  trace_current: (s) => s.correctPath ?? [],
};

function collectReferences(lessons, source, into) {
  for (const [key, lesson] of Object.entries(lessons ?? {})) {
    const title = lesson?.title ?? key;
    for (const [i, step] of (lesson?.steps ?? []).entries()) {
      const named = [];
      const pick = REGION_STEP[step.type];
      if (pick) named.push(...pick(step).filter(Boolean));
      // A teach step with hotspots is an exploration on both surfaces, and the
      // same drop rule applies to it, so its regions count too.
      for (const h of step.hotspots ?? []) if (h?.region) named.push(h.region);
      if (!named.length) continue;
      for (const region of named) {
        into.push({ circuit: step.circuitDiagram, region, where: `${source} · ${title} · step ${i} (${step.type})` });
      }
    }
  }
}

async function readCorpus(scratch) {
  const refs = [];
  if (!existsSync(AUTHORED)) die(`${AUTHORED} is missing, and the authored corpus is what the checker protects`);
  const js = ts.transpileModule(readFileSync(AUTHORED, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const out = join(scratch, 'lessons.mjs');
  writeFileSync(out, js);
  const { LESSON_CONTENT } = await import(`file://${out}`);
  collectReferences(LESSON_CONTENT, 'authored', refs);

  // The served export is what the app actually fetches; a clean source with a
  // stale export still ships dropped steps.
  if (existsSync(SERVED)) {
    collectReferences(JSON.parse(readFileSync(SERVED, 'utf8')).lessons, 'served', refs);
  }
  if (!refs.length) die('the corpus named no regions at all, so the loader is broken, not the content');
  return refs;
}

const overlaps = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const scratch = mkdtempSync(join(tmpdir(), 'ohmlet-regions-'));
try {
  const mobile = readMobile();
  const web = await readWebRegions(scratch);
  const refs = await readCorpus(scratch);

  const mobileIds = new Set(Object.keys(mobile.regions));
  const drawn = new Set(mobile.drawn);

  // 1. Same circuits on both surfaces.
  for (const id of web.keys()) {
    if (!drawn.has(id)) fail(`circuit "${id}" is in the web registry but mobile draws no art for it`);
    else if (!mobileIds.has(id)) fail(`circuit "${id}" is drawn on mobile but exposes no hit areas, so every region step on it is dropped`);
  }
  for (const id of drawn) {
    if (!web.has(id)) fail(`circuit "${id}" is drawn on mobile but the web registry does not know it, so no lesson can reference it`);
  }

  // 1b. The art and the overlay agree on the canvas. Checked by SHAPE, not by
  // value: the drawing has to name the shared constant, because two numbers
  // that happen to match today are two numbers that can stop matching.
  for (const id of drawn) {
    const written = mobile.frameHeight.get(id);
    const tall = mobile.heights[id];
    if (written === undefined) {
      fail(`"${id}": no <Frame> in its drawing, so this checker cannot tell what viewBox the art uses. `
        + 'Update readMobile() if the Frame has been renamed.');
    } else if (tall === undefined && written !== null) {
      fail(`"${id}"'s drawing passes h={${written}} but HEIGHTS has no entry for it, so the tap overlay `
        + `uses ${DEFAULT_H} and scales differently from the art: every hit area on it lands off its part. `
        + `Add "${id}" to HEIGHTS and pass h={HEIGHTS.${id}}.`);
    } else if (tall !== undefined && written !== `HEIGHTS.${id}`) {
      fail(`"${id}" is ${tall} units tall in HEIGHTS, which is what the tap overlay uses, but its drawing `
        + `passes h={${written ?? 'nothing, so it draws at ' + DEFAULT_H}}. Two heights for one viewBox drift `
        + `silently and misplace every hit area: write h={HEIGHTS.${id}}.`);
    }
  }

  // 2. Region-for-region parity, per circuit.
  for (const [id, wanted] of web) {
    const have = (mobile.regions[id] ?? []).map((r) => r.id);
    const missing = wanted.filter((r) => !have.includes(r));
    const extra = have.filter((r) => !wanted.includes(r));
    if (missing.length) {
      fail(`"${id}": mobile has no hit area for ${missing.map((r) => `"${r}"`).join(', ')}, `
        + `which the web offers. canRender drops any step naming one and the learner never sees it. `
        + `(mobile offers: ${have.join(', ') || 'nothing'})`);
    }
    if (extra.length) {
      fail(`"${id}": mobile exposes ${extra.map((r) => `"${r}"`).join(', ')}, which the web does not. `
        + `No authored answer can be one of those, so they are distractors only phone learners meet.`);
    }
  }

  // 3. Every region a real step names actually resolves on mobile. Grouped by
  // (circuit, region) with a step count, because one missing hit area is one
  // fix but can be many quietly shorter lessons.
  const byPair = new Map();
  for (const ref of refs) {
    const key = `${ref.circuit}::${ref.region}`;
    if (!byPair.has(key)) byPair.set(key, { circuit: ref.circuit, region: ref.region, steps: [] });
    byPair.get(key).steps.push(ref.where);
  }
  for (const ref of byPair.values()) {
    const have = (mobile.regions[ref.circuit] ?? []).map((r) => r.id);
    const also = ref.steps.length > 1 ? ` and ${ref.steps.length - 1} other step(s)` : '';
    if (!drawn.has(ref.circuit)) {
      fail(`${ref.steps[0]}${also}: names circuit "${ref.circuit}", which mobile cannot draw`);
    } else if (!have.includes(ref.region)) {
      fail(`${ref.steps[0]}${also}: needs "${ref.region}" on "${ref.circuit}", which mobile has no hit `
        + 'area for, so canRender drops it and the lesson is quietly shorter on a phone');
    }
  }

  // 4. Every hit area is reachable with a finger, on the diagram, and unambiguous.
  let smallest = null;
  for (const [id, list] of Object.entries(mobile.regions)) {
    const h = mobile.heights[id] ?? DEFAULT_H;
    for (const r of list) {
      const short = Math.min(r.w, r.h);
      if (!smallest || short < smallest.short) smallest = { ...r, circuit: id, short };
      if (short < MIN_UNITS) {
        fail(`"${id}.${r.id}" is ${r.w}x${r.h} units, ${(short * SCALE).toFixed(1)} pt on its shorter side. `
          + `Under the ${MIN_TAP_PT} pt finger minimum: enlarge it to at least ${MIN_UNITS} units.`);
      }
      if (r.x < 0 || r.y < 0 || r.x + r.w > VIEWBOX_W || r.y + r.h > h) {
        fail(`"${id}.${r.id}" runs outside the ${VIEWBOX_W}x${h} viewBox `
          + `(${r.x},${r.y} to ${r.x + r.w},${r.y + r.h}); the part outside is clipped and cannot be tapped.`);
      }
    }
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        if (overlaps(list[i], list[j])) {
          fail(`"${id}": hit areas "${list[i].id}" and "${list[j].id}" overlap, `
            + `so a tap in the shared strip grades as whichever is drawn last.`);
        }
      }
    }
  }

  const circuitCount = Object.keys(mobile.regions).length;
  const regionCount = Object.values(mobile.regions).reduce((n, l) => n + l.length, 0);

  if (findings.length) {
    for (const f of findings) console.error(`  FAIL  ${f}`);
    console.error(`\n  ${findings.length} finding(s) across ${circuitCount} circuits.`);
    process.exit(1);
  }

  console.log(`  ok    ${circuitCount} circuits, ${regionCount} hit areas: mobile matches the web registry region for region`);
  console.log(`  ok    ${byPair.size} (circuit, region) pairs across ${refs.length} authored steps resolve on mobile, so canRender drops nothing`);
  console.log(`  ok    smallest hit area is ${smallest.circuit}.${smallest.id} at ${smallest.w}x${smallest.h} units `
    + `(${(smallest.short * SCALE).toFixed(1)} pt on its shorter side at the worst common scale, ${MIN_TAP_PT} pt minimum)`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
