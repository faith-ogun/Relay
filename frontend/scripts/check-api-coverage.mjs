#!/usr/bin/env node
// ── Every backend route a client is supposed to call, actually gets called ──
//
// Written after the checkpoint bug: POST /v1/me/checkpoints/claim shipped,
// tested, transactional and correct, and no client ever called it. The chest
// artwork drew, the ceremony played, the XP was never granted. Nothing failed,
// because nothing ran. A route with no caller is invisible to every other kind
// of check we have: the backend tests pass, the type-checkers pass, the build
// passes, and the feature is dead.
//
// So this walks the two edges and joins them:
//
//   backend/<service>/app/**.py   route decorators + their router prefix
//   frontend/**, mobile/src/**    every string and template literal
//
// A literal covers a route when, once both sides have their path parameters
// flattened to `{}`, the literal ENDS WITH the route path. Clients always write
// `${API_BASE}/v1/me/hearts`, so the base is unknowable here and a suffix match
// is the honest comparison.
//
// That alone is not enough, and the first run of this script proved it by
// reporting the checkpoint routes it was written for as uncovered. Every service
// module splits the path across TWO literals: a helper holds
// `${base}/v1/me${path}` and each call site passes the tail `'/checkpoints'`.
// Neither literal contains `/v1/me/checkpoints`, so neither matches on its own.
// So a route is also covered when one file supplies both halves: a literal
// ending in an interpolation whose text ends with the route's leading segments,
// and another literal in the SAME file that is exactly the remaining tail. Same
// file, because that is what makes the two halves actually meet at runtime.
//
// What it deliberately does NOT do: match the HTTP method. A client's method
// lives in an options object several lines from the URL, and chasing it
// statically would trade a real signal for false alarms. Two methods on one path
// are therefore covered together. The bug class this exists for is a path no
// client mentions at all, and that it catches exactly.
//
// Server-only routes are real — webhooks, metrics scrapes, health probes — so
// they are EXEMPT BY NAME with a reason, never by silence. An exemption that no
// longer matches a route, or that names a route clients now call, is itself a
// failure: the list has to decay when the code does.
//
// Run: node frontend/scripts/check-api-coverage.mjs

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Routes no client calls, on purpose. Each needs a reason a reviewer can check.
 *
 * `path` is the full route path exactly as this script prints it. `service` is
 * optional and narrows the exemption to one backend folder, which matters where
 * the same path exists in several services and is server-only in some of them
 * but genuinely called in others. `/health` is exactly that: five services
 * define it, four are only ever hit by Cloud Run probes, and the reporter's is
 * polled by the mobile app to decide whether 3D twins are available at all.
 */
const EXEMPT = [
  { path: '/v1/billing/webhook', why: 'Called by Stripe, server to server. A browser calling it would be an attack.' },
  { path: '/v1/billing/revenuecat', why: 'Called by RevenueCat, server to server, signature-verified.' },
  { path: '/internal/metrics', why: 'Scraped by ops/alerting.sh with the metrics token; never reachable from an app.' },
  { path: '/health', service: 'live-bridge', why: 'Cloud Run startup and liveness probes.' },
  { path: '/health', service: 'quiz-engine', why: 'Cloud Run startup and liveness probes.' },
  { path: '/health', service: 'vision-verifier', why: 'Cloud Run startup and liveness probes.' },
  { path: '/health', service: 'compiler', why: 'Cloud Run startup and liveness probes.' },
  {
    path: '/v1/state/{}',
    why: 'Compatibility read/write for clients that predate keyed records. Current clients call /v1/state/{}/{} instead, so having no caller here is the intended end state, not a gap. Delete the routes and this exemption together once no old build is still live.',
  },
];

// ── Directories ───────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([
  'node_modules', '.venv', '__pycache__', 'dist', 'build', '.git',
  '.expo', 'ios', 'android', 'coverage', '.next',
]);

function walk(dir, test, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, test, out);
    } else if (test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// ── The backend edge: routes ──────────────────────────────────────────────────

/** `/v1/me/{user_id}` and `/v1/me/${uid}` both become `/v1/me/{}`. */
const flatten = (p) => p.replace(/\{[^}]*\}/g, '{}').replace(/\/+$/, '') || '/';

const ROUTE_RE = /@(?:router|app)\.(get|post|put|patch|delete|websocket)\(\s*(['"])((?:[^'"\\]|\\.)*)\2/g;
const PREFIX_RE = /APIRouter\(\s*prefix\s*=\s*(['"])((?:[^'"\\]|\\.)*)\1/;
// include_router(x, prefix="/v1/thing") — no service uses one today, and a
// prefix applied there rather than on the router would silently shift every
// path in the file, so it is read rather than assumed absent.
const INCLUDE_RE = /include_router\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,[^)]*prefix\s*=\s*(['"])((?:[^'"\\]|\\.)*)\2/g;

function collectRoutes() {
  const backend = join(ROOT, 'backend');
  const files = walk(backend, (n) => n.endsWith('.py')).filter(
    (f) => !/[/\\]tests?[/\\]/.test(f),
  );

  // Extra prefixes contributed at include time, keyed by "<service>:<module>".
  const includePrefix = new Map();
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const service = serviceOf(file);
    for (const m of src.matchAll(INCLUDE_RE)) {
      includePrefix.set(`${service}:${m[1]}`, m[3]);
    }
  }

  const routes = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const service = serviceOf(file);
    const routerPrefix = src.match(PREFIX_RE)?.[2] ?? '';
    const moduleName = file.split(/[/\\]/).pop().replace(/\.py$/, '');
    // Modules are imported as `from x import router as x_router`, so try both.
    const extra =
      includePrefix.get(`${service}:${moduleName}_router`) ??
      includePrefix.get(`${service}:router`) ??
      '';
    for (const m of src.matchAll(ROUTE_RE)) {
      const line = src.slice(0, m.index).split('\n').length;
      const path = flatten(`${extra}${routerPrefix}${m[3]}`);
      routes.push({
        method: m[1].toUpperCase(),
        path,
        service,
        where: `${relative(ROOT, file)}:${line}`,
      });
    }
  }
  return routes;
}

function serviceOf(file) {
  const rel = relative(join(ROOT, 'backend'), file);
  return rel.split(/[/\\]/)[0];
}

// ── The client edge: every literal that could be a URL ────────────────────────

const CLIENT_ROOTS = [
  join(ROOT, 'frontend'),
  join(ROOT, 'mobile', 'src'),
];

const CLIENT_FILE = (n) => /\.(ts|tsx|js|jsx|mjs)$/.test(n);

// Single-quoted, double-quoted, and backtick literals. Interpolations inside a
// template collapse to `{}` so `${base}/v1/me/${uid}` reads as `{}/v1/me/{}`.
const LITERAL_RE = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;

function collectLiterals() {
  const literals = new Map(); // normalized literal -> [where, ...]
  const byFile = new Map();   // rel path -> Map(normalized literal -> where)
  for (const root of CLIENT_ROOTS) {
    for (const file of walk(root, CLIENT_FILE)) {
      const rel = relative(ROOT, file);
      // The checker itself quotes every route path it knows about; counting
      // those as call sites would make it pass by describing the problem.
      if (rel.endsWith('check-api-coverage.mjs')) continue;
      const src = readFileSync(file, 'utf8');
      const local = new Map();
      for (const m of src.matchAll(LITERAL_RE)) {
        const raw = m[1] ?? m[2] ?? m[3];
        if (!raw || !raw.includes('/')) continue;
        const norm = flatten(raw.replace(/\$\{[^}]*\}/g, '{}'));
        if (!norm.includes('/')) continue;
        const line = src.slice(0, m.index).split('\n').length;
        const at = `${rel}:${line}`;
        const seen = literals.get(norm);
        if (seen) seen.push(at);
        else literals.set(norm, [at]);
        if (!local.has(norm)) local.set(norm, at);
      }
      if (local.size) byFile.set(rel, local);
    }
  }
  return { literals, byFile };
}

// ── Join ──────────────────────────────────────────────────────────────────────

/** Drop one trailing `{}`, which is how `${base}/v1/me${path}` and a tail with a
 *  query string like `/results${qs}` both end. */
const withoutTail = (s) => (s.endsWith('{}') ? s.slice(0, -2) : s);

function callersFor(routePath, literals) {
  const out = [];
  for (const [literal, where] of literals) {
    // Exact, or a full trailing segment match so `${base}/v1/me` covers
    // `/v1/me` while `/v1/twins` never covers `/v1/twin`.
    if (literal === routePath || literal.endsWith(routePath)) out.push(...where);
  }
  return out;
}

/**
 * The two-literal case: a base helper plus a tail passed in by a call site.
 *
 * Only splits at segment boundaries, and only accepts a base literal that ends
 * in an interpolation, because that trailing `${path}` is the thing being
 * concatenated. A plain literal that merely happens to end with the same
 * segments is not evidence of a call.
 */
function splitCallersFor(routePath, byFile) {
  const cuts = [];
  for (let i = 1; i < routePath.length; i += 1) {
    if (routePath[i] === '/') cuts.push(i);
  }
  if (!cuts.length) return [];

  for (const [, local] of byFile) {
    for (const cut of cuts) {
      const head = routePath.slice(0, cut);
      const tail = routePath.slice(cut);

      let baseAt = null;
      for (const [literal, at] of local) {
        if (literal.endsWith('{}') && withoutTail(literal).endsWith(head)) { baseAt = at; break; }
      }
      if (!baseAt) continue;

      for (const [literal, at] of local) {
        if (literal === tail || withoutTail(literal) === tail) return [at, `base ${baseAt}`];
      }
    }
  }
  return [];
}

const exemptKey = (path, service) => (service ? `${service} ${path}` : path);

function main() {
  const routes = collectRoutes();
  const { literals, byFile } = collectLiterals();
  const exemptIndex = new Map(EXEMPT.map((e) => [exemptKey(e.path, e.service), e]));
  /** A service-scoped exemption wins; a bare one applies to every service. */
  const exemptFor = (route) =>
    exemptIndex.get(exemptKey(route.path, route.service)) ?? exemptIndex.get(route.path);

  // How many services define each path. A path defined by several of them
  // cannot be attributed to one from a client literal: every service is a
  // different host, and the base URL is a variable this script never resolves.
  // `/health` is the case in point, so the "exempt but called" check below has
  // to stay quiet there rather than blame four probe routes for a literal that
  // belongs to the fifth.
  const servicesPerPath = new Map();
  for (const route of routes) {
    if (!servicesPerPath.has(route.path)) servicesPerPath.set(route.path, new Set());
    servicesPerPath.get(route.path).add(route.service);
  }
  const ambiguous = (path) => servicesPerPath.get(path).size > 1;

  const uncovered = [];
  const covered = [];
  const exemptedButCalled = [];
  const unattributable = new Set();
  const usedExemptions = new Set();

  for (const route of routes) {
    const callers = callersFor(route.path, literals);
    const viaSplit = callers.length ? [] : splitCallersFor(route.path, byFile);
    const all = callers.length ? callers : viaSplit;
    const exempt = exemptFor(route);
    if (exempt) {
      usedExemptions.add(exempt);
      if (!all.length) continue;
      if (ambiguous(route.path)) unattributable.add(route.path);
      else exemptedButCalled.push({ route, callers: all, exempt });
      continue;
    }
    if (all.length) covered.push({ route, callers: all });
    else uncovered.push(route);
  }

  // An exemption is stale when no route it could apply to exists any more, not
  // merely when its path is missing: a service-scoped one outlives its service.
  const staleExemptions = EXEMPT.filter((e) => !usedExemptions.has(e));

  const routePaths = new Set(routes.map((r) => `${r.method} ${r.path}`));
  console.log(`Routes found: ${routePaths.size} across ${new Set(routes.map((r) => r.service)).size} services`);
  console.log(`Client literals scanned: ${literals.size}`);
  console.log(`Covered: ${new Set(covered.map((c) => c.route.path)).size} paths`);
  console.log(`Exempt (server-only): ${usedExemptions.size}`);

  let failed = false;

  if (uncovered.length) {
    failed = true;
    console.log('\nNO CLIENT CALLS THESE ROUTES:');
    for (const r of uncovered) {
      console.log(`  ${r.method.padEnd(9)} ${r.path.padEnd(44)} ${r.service}  (${r.where})`);
    }
    console.log(
      '\nEither wire a client to it, or add it to EXEMPT in this file with the reason it is server-only.',
    );
  }

  // Not a failure: a note, so the quiet is visible rather than merely absent.
  if (unattributable.size) {
    console.log(
      `\nShared across services, so a caller cannot be pinned to one: ${[...unattributable].join(', ')}`,
    );
    console.log('  A client calls one of them. Which one is not decidable from a relative path.');
  }

  if (staleExemptions.length) {
    failed = true;
    console.log('\nEXEMPTIONS FOR ROUTES THAT NO LONGER EXIST:');
    for (const e of staleExemptions) console.log(`  ${e.path}  — ${e.why}`);
    console.log('\nRemove them; an exemption list that outlives its routes stops being read.');
  }

  if (exemptedButCalled.length) {
    failed = true;
    console.log('\nEXEMPT AS SERVER-ONLY, BUT A CLIENT CALLS THEM:');
    for (const { route, callers, exempt } of exemptedButCalled) {
      console.log(`  ${route.path}  — exempt because: ${exempt.why}`);
      console.log(`      called from ${callers.slice(0, 3).join(', ')}`);
    }
    console.log('\nEither the exemption is wrong or the client is. Both are worth knowing.');
  }

  if (failed) process.exit(1);
  console.log('\nEvery route has a caller or a documented reason not to.');
}

main();
