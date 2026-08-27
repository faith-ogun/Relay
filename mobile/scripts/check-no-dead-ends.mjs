// The phone must not promise a capability it cannot perform.
//
// Four defects share one shape: the app declares a thing, and nothing a learner
// can open ever reaches it. A base URL for a backend nobody calls. A service
// function nobody invokes, sitting next to a screen that tells the learner to
// use it. A whole client module that only its own hook imports, so a flagship
// feature exists in the repo and in no screen. An achievement whose counter is
// never incremented, so its progress ring is frozen at zero for every learner,
// forever. None of these fail a type check, none crash, and all of them ship.
//
//   node scripts/check-no-dead-ends.mjs        (run from mobile/)
//
// The load-bearing idea is REACHABILITY, not reference counting. "Something
// imports it" is far too weak a test: a dead module imported only by a dead
// hook passes it, and that is exactly how the camera kit check came to exist
// in src/ while no screen could reach it. So the graph is walked from the only
// true entry points this app has, the expo-router routes under src/app/, and a
// symbol counts as used only when a module on that walk uses it.
//
// Rules:
//   R1  every *_BASE in services/config.ts is read by a module a screen reaches
//   R2  every exported SERVICE-BOUNDARY function (one whose body calls fetch()
//       or reads a *_BASE, directly or through its module's own helpers) is
//       called from a module a screen reaches
//   R3  every metric in the achievement catalogue has a live source on the
//       phone: a bumpMetric call in a reachable module, a progress mutator that
//       writes it, a value derived from progress/server state, or an explicit
//       UNTRACKED entry
//   R4  every module that reaches a backend is itself reachable from a screen
//
// There is no allowlist. A dead end is either wired up or deleted.

import { readdirSync, readFileSync, statSync } from 'node:fs';

const SRC = 'src';
const ENTRY = 'src/app/';
const CONFIG = 'src/services/config.ts';
const PROGRESS = 'src/services/progress.ts';
const ACHIEVEMENTS_TS = 'src/services/achievements.ts';
const CATALOGUE = '../backend/live-bridge/app/curriculum_data/achievements.json';

const failures = [];
const fail = (rule, message) => failures.push({ rule, message });

// ── Source loading ──────────────────────────────────────────────────────────

/** Every .ts/.tsx under a directory, recursively. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = `${dir}/${entry}`;
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(path);
  }
  return out;
}

/**
 * Blank out comments, and optionally string bodies, replacing each character
 * with a space so every offset still lines up with the original file.
 *
 * Two variants are needed. Reference counting must NOT see comments (a symbol
 * named in a sentence is not a caller) but MUST see template literals, because
 * `${API_BASE}/v1/twins` is a real read of API_BASE. Brace matching must see
 * neither, because a template literal's `${...}` would otherwise unbalance the
 * count and swallow the rest of the file.
 */
function mask(src, { blankStrings }) {
  const out = src.split('');
  const blank = (from, to) => {
    for (let i = from; i < to && i < out.length; i++) if (out[i] !== '\n') out[i] = ' ';
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      const end = src.indexOf('\n', i);
      blank(i, end === -1 ? src.length : end);
      i = end === -1 ? src.length : end;
    } else if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      if (blankStrings) blank(i, j + 1);
      i = j + 1;
    } else if (c === '`') {
      // Walk the template to its matching backtick, counting nested `${ }`.
      let j = i + 1;
      let depth = 0;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '{') { depth++; j += 2; continue; }
        if (src[j] === '}' && depth > 0) { depth--; j++; continue; }
        if (src[j] === '`' && depth === 0) break;
        j++;
      }
      if (blankStrings) blank(i, j + 1);
      i = j + 1;
    } else {
      i++;
    }
  }
  return out.join('');
}

// Only src/ is loaded. scripts/ is build tooling, and a symbol used solely by a
// render script or by this checker is still absent from the shipped app;
// counting those as callers would let tooling vouch for dead product code.
const files = walk(SRC);
/** path -> { code (comments gone), skeleton (comments AND strings gone) } */
const sources = new Map(
  files.map((f) => {
    const raw = readFileSync(f, 'utf8');
    return [f, { code: mask(raw, { blankStrings: false }), skeleton: mask(raw, { blankStrings: true }) }];
  }),
);

const codeOf = (f) => sources.get(f).code;
const skeletonOf = (f) => sources.get(f).skeleton;

// ── Module graph ────────────────────────────────────────────────────────────

/** Resolve a relative import specifier to a path we have loaded. */
function resolve(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const dir = fromFile.slice(0, fromFile.lastIndexOf('/'));
  const parts = `${dir}/${specifier}`.split('/');
  const stack = [];
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  const base = stack.join('/');
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (sources.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Every module a file pulls in, by any syntax that creates an edge.
 *
 * All five forms matter to reachability. A screen that only does
 * `import './styles'` or `const { x } = await import('./heavy')` still makes
 * that module live, and a barrel that re-exports with `export * from` is the
 * usual way a component tree is reached at all.
 */
function importSpecifiers(file) {
  const code = codeOf(file);
  const out = new Set();
  const patterns = [
    /\bimport\b[^;'"()]*?\bfrom\s*['"]([^'"]+)['"]/g,   // import x / { x } / * as x from
    /\bexport\b[^;'"()]*?\bfrom\s*['"]([^'"]+)['"]/g,   // re-export, including export *
    /\bimport\s*['"]([^'"]+)['"]/g,                      // side-effect import
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,            // dynamic import
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code))) out.add(m[1]);
  }
  return [...out];
}

/** module path -> the modules it imports. */
const edges = new Map(
  files.map((f) => [f, importSpecifiers(f).map((s) => resolve(f, s)).filter(Boolean)]),
);

/**
 * Modules a learner can actually reach.
 *
 * expo-router makes every file under src/app/ a route, so those are the entry
 * points and nothing else is: this app has no other way in. Everything else is
 * live only by being imported, transitively, from one of them.
 */
const entryPoints = files.filter((f) => f.startsWith(ENTRY));
if (!entryPoints.length) fail('R4', `No route files found under ${ENTRY}. Has the app directory moved?`);

const live = new Set();
for (const stack = [...entryPoints]; stack.length; ) {
  const file = stack.pop();
  if (live.has(file)) continue;
  live.add(file);
  for (const target of edges.get(file) ?? []) if (!live.has(target)) stack.push(target);
}

/** module path -> exported name -> [{ file, alias }] of every importer. */
const importers = new Map();
for (const [file, { code }] of sources) {
  const re = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(code))) {
    const target = resolve(file, m[2]);
    if (!target) continue;
    for (const clause of m[1].split(',')) {
      const named = clause.trim().replace(/^type\s+/, '');
      if (!named) continue;
      const [exported, alias] = named.split(/\s+as\s+/).map((s) => s.trim());
      if (!importers.has(target)) importers.set(target, new Map());
      const byName = importers.get(target);
      if (!byName.has(exported)) byName.set(exported, []);
      byName.get(exported).push({ file, alias: alias || exported });
    }
  }
}

/**
 * Which modules import `name` from `module` and genuinely use it.
 *
 * Counting bare identifiers across the tree is not good enough: two modules can
 * export the same name, and a plain text search then credits one module's dead
 * export to the other module's live one. config.ts's unused `compilerConfigured`
 * looked used because compiler.ts exported a working function of that name.
 * So the import is resolved first, then the alias must appear a SECOND time in
 * the importing file, since the import statement itself is the first.
 */
function callers(module, name) {
  return (importers.get(module)?.get(name) ?? []).filter(
    ({ file, alias }) => (codeOf(file).match(new RegExp(`\\b${alias}\\b`, 'g')) ?? []).length > 1,
  );
}

const usedFromScreen = (module, name) => callers(module, name).some(({ file }) => live.has(file));

// ── Declaration extraction ──────────────────────────────────────────────────

/**
 * The full text of the top-level declaration starting at `start`.
 *
 * Brace matching runs over the skeleton (no strings, no comments) so the offsets
 * are trustworthy; the text is then sliced out of the real code so the caller
 * can look for `fetch(` and `*_BASE` inside it.
 */
function declarationAt(file, start) {
  const skeleton = skeletonOf(file);
  let depth = 0;
  let opened = false;
  for (let i = start; i < skeleton.length; i++) {
    const c = skeleton[i];
    if (c === '{' || c === '(' || c === '[') { depth++; opened = true; }
    else if (c === '}' || c === ')' || c === ']') {
      depth--;
      if (depth === 0 && opened && c === '}') return codeOf(file).slice(start, i + 1);
    } else if (c === ';' && depth === 0) {
      return codeOf(file).slice(start, i + 1);
    } else if (c === '\n' && depth === 0 && opened) {
      return codeOf(file).slice(start, i);
    }
  }
  return codeOf(file).slice(start);
}

/** Every top-level declaration, as { name, kind, text, exported }. */
function declarations(file) {
  const skeleton = skeletonOf(file);
  const re = /^(export\s+)?(?:async\s+)?(function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;
  const out = [];
  let m;
  while ((m = re.exec(skeleton))) {
    out.push({
      name: m[3],
      kind: m[2],
      exported: Boolean(m[1]),
      text: declarationAt(file, m.index),
    });
  }
  return out;
}

const exportedValues = (file) => declarations(file).filter((d) => d.exported);

/** Whether a declaration is a function at all (a `const` may just be data). */
const isFunction = (decl) =>
  decl.kind === 'function' || /^export\s+const\s+[\w$]+\s*(?::[^=]+)?=\s*(?:async\s*)?\(/.test(decl.text);

// ── R1: a service base URL no screen reads ──────────────────────────────────

const baseNames = [...skeletonOf(CONFIG).matchAll(/^export\s+const\s+([A-Z0-9_]*BASE)\b/gm)].map((m) => m[1]);
if (!baseNames.length) fail('R1', `No *_BASE exports found in ${CONFIG}. Has the file moved?`);

for (const name of baseNames) {
  if (usedFromScreen(CONFIG, name)) continue;
  const orphaned = callers(CONFIG, name);
  fail(
    'R1',
    orphaned.length
      ? `${CONFIG} declares ${name}, and the only thing that reads it is ` +
        `${orphaned.map((c) => c.file).join(', ')}, which no screen reaches. ` +
        'The service it points at is unreachable from the phone.'
      : `${CONFIG} declares ${name} and nothing in the app reads it. ` +
        'The service it points at is unreachable from the phone. Wire it up or delete it.',
  );
}

// ── Which modules talk to a backend at all ──────────────────────────────────

const basePattern = new RegExp(`\\b(?:${baseNames.join('|')})\\b`);

/** A module that opens a socket itself, rather than through another module. */
const talksDirectly = (file) =>
  file !== CONFIG && (/\bfetch\s*\(/.test(codeOf(file)) || basePattern.test(codeOf(file)));

// Propagate up the import graph: a hook whose whole purpose is to drive a
// service client is just as much a broken promise when no screen mounts it.
const reachesBackend = new Set(files.filter(talksDirectly));
for (let changed = true; changed; ) {
  changed = false;
  for (const file of files) {
    if (reachesBackend.has(file)) continue;
    if ((edges.get(file) ?? []).some((t) => reachesBackend.has(t))) {
      reachesBackend.add(file);
      changed = true;
    }
  }
}

// ── R2: an exported service function no screen calls ────────────────────────
//
// Scoped to functions that actually cross the service boundary: they call
// fetch(), or they gate on a *_BASE. That is the defect this rule exists for,
// a backend capability the app declares and never invokes. A pure local helper
// that happens to be over-exported is untidy, not a broken promise.

const serviceFiles = files.filter((f) => f.startsWith('src/services/') && f.endsWith('.ts'));

/**
 * The names in a module that reach a backend, directly or through its own
 * private helpers.
 *
 * The indirection matters. visionVerifier.ts routes every call through one
 * unexported `post()`, so `verifyInventory` mentions neither fetch nor a base
 * URL and a direct test would wave it through: exactly the function this rule
 * exists to catch. Seed with the ones that touch the wire, then keep adding
 * callers of those until nothing new appears.
 */
function boundaryCrossers(file) {
  const decls = declarations(file);
  const crossing = new Set(
    decls.filter((d) => /\bfetch\s*\(/.test(d.text) || basePattern.test(d.text)).map((d) => d.name),
  );
  for (let changed = true; changed; ) {
    changed = false;
    for (const d of decls) {
      if (crossing.has(d.name)) continue;
      const calls = [...crossing].some(
        (name) => name !== d.name && new RegExp(`\\b${name}\\s*[(<]`).test(d.text),
      );
      if (calls) { crossing.add(d.name); changed = true; }
    }
  }
  return crossing;
}

for (const file of serviceFiles) {
  // A module no screen reaches is reported once, by R4, as the single fact that
  // matters. Listing each of its exports as well would bury that under noise.
  if (!live.has(file)) continue;

  const crossing = boundaryCrossers(file);
  for (const decl of exportedValues(file)) {
    if (!isFunction(decl) || !crossing.has(decl.name)) continue;
    if (usedFromScreen(file, decl.name)) continue;

    const orphaned = callers(file, decl.name);
    fail(
      'R2',
      orphaned.length
        ? `${file} exports ${decl.name}(), which reaches a backend service, and the only thing ` +
          `that calls it is ${orphaned.map((c) => c.file).join(', ')}, which no screen reaches. ` +
          'No learner can get to this.'
        : `${file} exports ${decl.name}(), which reaches a backend service, and nothing calls it. ` +
          'The feature behind it does not exist in the app.',
    );
  }
}

// ── R3: an achievement whose metric is never bumped ─────────────────────────

const catalogue = JSON.parse(readFileSync(CATALOGUE, 'utf8'));
const achievements = Array.isArray(catalogue) ? catalogue : catalogue.achievements;
if (!Array.isArray(achievements) || !achievements.length) {
  fail('R3', `Could not read the achievement catalogue at ${CATALOGUE}.`);
}

/** metric -> the achievements that need it. */
const needed = new Map();
for (const a of achievements ?? []) {
  if (!needed.has(a.metric)) needed.set(a.metric, []);
  needed.get(a.metric).push(a.id);
}

// What the phone actually evaluates achievements against.
const statsFn = (() => {
  const skeleton = skeletonOf(PROGRESS);
  const at = skeleton.search(/^export\s+function\s+achievementStats\b/m);
  return at === -1 ? null : declarationAt(PROGRESS, at);
})();
if (!statsFn) fail('R3', `Could not find achievementStats() in ${PROGRESS}.`);

/** metric -> the expression it is computed from. */
const statExpressions = new Map(
  [...(statsFn ?? '').matchAll(/^\s{4}([A-Za-z_]\w*):\s*(.+?),\s*$/gm)].map((m) => [m[1], m[2]]),
);

// Metrics declared as having no source on this client, so their card says so.
const untrackedBlock = codeOf(ACHIEVEMENTS_TS).match(/UNTRACKED\s*=\s*new Set<string>\(\[?([\s\S]*?)\]?\)/);
const untracked = new Set([...(untrackedBlock?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]));

// Exported mutators in progress.ts that write a counter directly, keyed by the
// counter they write. creditLeagueWin is one: it sets leagueWins itself rather
// than going through bumpMetric, and it is no less a real source for that.
const progressMutators = exportedValues(PROGRESS).filter(
  (d) => isFunction(d) && d.name !== 'bumpMetric' && d.name !== 'achievementStats',
);

const bumpPattern = (metric) =>
  new RegExp(`bumpMetric\\s*\\([\\s\\S]{0,200}?['"]${metric}['"]`);

for (const [metric, ids] of needed) {
  const label = `${ids.length} achievement${ids.length === 1 ? '' : 's'} (${ids.join(', ')})`;

  if (untracked.has(metric)) continue;

  const expression = statExpressions.get(metric);
  if (!expression) {
    fail(
      'R3',
      `The catalogue awards ${label} on "${metric}", and achievementStats() in ${PROGRESS} ` +
        'never supplies it. Those achievements read as zero on every phone, forever.',
    );
    continue;
  }

  // Derived from Progress fields, a parameter or the server: no counter to bump.
  if (!new RegExp(`\\bm\\.${metric}\\b`).test(expression)) continue;

  // The bump has to sit somewhere a learner can actually get to. One buried in
  // a module no screen mounts leaves the counter at zero just as surely as no
  // bump at all.
  const bumped = files.some(
    (f) => f !== PROGRESS && live.has(f) && bumpPattern(metric).test(codeOf(f)),
  );
  if (bumped) continue;

  const written = progressMutators.some(
    (d) => new RegExp(`\\b${metric}\\s*:`).test(d.text) && usedFromScreen(PROGRESS, d.name),
  );
  if (written) continue;

  fail(
    'R3',
    `"${metric}" is a counter behind ${label}, and nothing on the phone ever increments it. ` +
      'Those achievements cannot be earned. Bump it where it is genuinely earned, ' +
      `or add "${metric}" to UNTRACKED in ${ACHIEVEMENTS_TS} so the card says so.`,
  );
}

// ── R4: a backend client no screen can reach ────────────────────────────────
//
// The rule the other three cannot express. R1 and R2 both ask "does something
// use this", and a dead module imported only by an equally dead hook answers
// yes. This asks the only question that matters to a learner: starting from a
// screen they can open, can execution ever get here.

for (const file of files) {
  if (live.has(file) || !reachesBackend.has(file)) continue;
  fail(
    'R4',
    `${file} reaches a backend service, and no screen reaches it: nothing under ${ENTRY} ` +
      'imports it, directly or through anything else. The feature it provides is in the repo ' +
      'and not in the app. Mount it on the screen that should use it, or delete it.',
  );
}

// ── Report ──────────────────────────────────────────────────────────────────

if (failures.length) {
  console.error(`Dead ends: ${failures.length}\n`);
  for (const { rule, message } of failures) console.error(`  [${rule}] ${message}\n`);
  process.exit(1);
}

console.log(
  `OK: ${baseNames.length} service base URLs read from screens, ` +
    `every service function reachable, ` +
    `all ${needed.size} achievement metrics sourced, ` +
    `${live.size} of ${files.length} modules reachable.`,
);
