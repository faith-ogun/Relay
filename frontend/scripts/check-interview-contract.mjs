// The interview report's shape is written by the server and read by two clients.
// They must agree.
//
// They did not, and it was not caught by anything. `recommendedTopics` started
// life as `string[]`. When gap routing shipped, the server began returning
// objects: `{topic, why, skillId, skillTitle, unitId, unitTitle, covered}`,
// because the whole differentiator of Interview Mode is that a weakness comes
// back attached to the lesson that closes it. The web's type still claimed
// `string[]`, and the report view rendered each item straight into JSX.
//
// React does not render an object as a child. It throws. So any report that
// recommended anything, which is every real report, took the entire view down at
// the exact moment the Max feature was supposed to deliver its value.
//
// TypeScript could not catch it because a type describing a network payload is a
// CLAIM about the wire, not a check of it. That is what this script is for.
//
// It checks three things:
//   1. Every key the server writes is declared by both clients.
//   2. Neither client types the routed field as a bare string array.
//   3. No client renders a routed topic object directly as a JSX child.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO = resolve(FRONTEND, '..');

const problems = [];
const note = (msg) => problems.push(msg);
const read = (p) => readFileSync(join(REPO, p), 'utf8');

const SERVER = 'backend/live-bridge/app/interview_gaps.py';
const CLIENTS = [
  { name: 'web', types: 'frontend/services/interview.ts', views: ['frontend/components/ohmlet/interview/InterviewReportView.tsx'] },
  { name: 'mobile', types: 'mobile/src/services/interview.ts', views: ['mobile/src/components/InterviewReport.tsx'] },
];

// ── 1. What the server actually writes ────────────────────────────────────────
// The covered branch is the wide one: it carries every key the narrow branch
// does, plus the routing. Read the keys out of that dict literal rather than
// hard-coding them here, so a key added server-side fails this check instead of
// silently going unread by both clients.
const py = read(SERVER);
const covered = py.match(/routed\.append\(\{\s*\n([\s\S]*?)\n\s*\}\)/);
if (!covered) {
  note(`could not find the routed-topic dict literal in ${SERVER}. If it moved, this check must move with it.`);
}
const serverKeys = covered ? [...covered[1].matchAll(/"([a-zA-Z]+)":/g)].map((m) => m[1]) : [];
if (covered && serverKeys.length < 5) {
  note(`only found ${serverKeys.length} keys in the routed literal, which does not look right.`);
}

// ── 2. What each client declares, and how it renders it ───────────────────────
for (const client of CLIENTS) {
  const ts = read(client.types);

  const iface = ts.match(/export interface RoutedTopic \{([\s\S]*?)\n\}/);
  if (!iface) {
    note(`${client.name}: no RoutedTopic interface in ${client.types}. The server sends objects; a client that has no type for them is about to render one.`);
    continue;
  }
  const declared = new Set([...iface[1].matchAll(/^\s{2}([a-zA-Z]+)\??:/gm)].map((m) => m[1]));
  const missing = serverKeys.filter((k) => !declared.has(k));
  if (missing.length) {
    note(`${client.name}: the server writes ${missing.map((k) => `\`${k}\``).join(', ')} on every routed topic and ${client.types} does not declare it.`);
  }

  if (/recommendedTopics\s*:\s*string\[\]/.test(ts)) {
    note(`${client.name}: recommendedTopics is typed \`string[]\`, and the server has been sending objects since gap routing shipped. This is the exact defect this check exists for.`);
  }
  if (!/uncoveredTopics/.test(ts)) {
    note(`${client.name}: the server reports \`uncoveredTopics\` (probed but not taught) and ${client.types} does not read it. That list is the honest half of the report.`);
  }

  // ── 3. The render. An object where a string used to be. ──
  for (const view of client.views) {
    const src = read(view);
    // Find `recommendedTopics.map((x, i) => ... )` and look for the bare param
    // used as a JSX child: `{x}` or `{x}` with whitespace. A property access
    // (`{x.topic}`) is fine, which is why the pattern requires the closing brace
    // to follow the identifier directly.
    for (const m of src.matchAll(/recommendedTopics\??\.map\(\(?\s*([A-Za-z_$][\w$]*)/g)) {
      const param = m[1];
      const after = src.slice(m.index, m.index + 1200);
      if (new RegExp(`\\{\\s*${param}\\s*\\}`).test(after)) {
        note(`${view}: renders \`{${param}}\` where \`${param}\` is a routed topic OBJECT. React throws on an object child, so this takes the whole report down.`);
      }
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────
if (problems.length) {
  console.error('check-interview-contract: the report shape and its readers disagree.\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('');
  process.exit(1);
}
console.log(
  `check-interview-contract: ok  the server's ${serverKeys.length} routed-topic keys ` +
  `(${serverKeys.join(', ')}) are declared by both clients, and neither renders one as a bare child.`,
);
