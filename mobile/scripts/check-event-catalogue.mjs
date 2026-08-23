// The mobile event names must exist in the server's catalogue.
//
// The server rejects unknown names, so a typo does not corrupt the data. It does
// something worse: the event silently never lands, and the funnel shows fewer
// people than really passed through. That reads as a product problem rather
// than a tooling one, which is how teams spend a week fixing the wrong thing.
//
//   node scripts/check-event-catalogue.mjs

import { readFileSync } from 'node:fs';

const CLIENT = 'src/services/analytics.ts';
const SERVER = '../backend/live-bridge/app/events.py';

const clientSrc = readFileSync(CLIENT, 'utf8');
const typeBlock = clientSrc.match(/export type AnalyticsEvent =([\s\S]*?);/);
if (!typeBlock) throw new Error('Could not find AnalyticsEvent in the client.');
const clientEvents = [...typeBlock[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

const serverSrc = readFileSync(SERVER, 'utf8');
const setBlock = serverSrc.match(/KNOWN_EVENTS = \{([\s\S]*?)\}/);
if (!setBlock) throw new Error('Could not find KNOWN_EVENTS on the server.');
const serverEvents = new Set([...setBlock[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]));

const missing = clientEvents.filter((e) => !serverEvents.has(e));
if (missing.length) {
  console.error('Events the client sends that the server will silently reject:\n');
  missing.forEach((e) => console.error(`  ${e}`));
  process.exit(1);
}
console.log(`OK: all ${clientEvents.length} client events are in the server catalogue.`);
