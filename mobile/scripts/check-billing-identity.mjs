#!/usr/bin/env node
// A purchase must be attributable to an account, or it takes money and grants
// nothing.
//
// The defect this exists for, found 2026-08-30 after the first sandbox purchase:
//
//   export async function initBilling(appUserId?: string) {
//     if (state) return state;                                  // <- memoised
//     ...
//     await purchases.configure({ appUserID: appUserId ?? null });
//   }
//
// `configure()` is one-shot and `state` is memoised, so whichever call landed
// FIRST decided the identity forever. `getOfferings`, `purchasePackage` and
// `restorePurchases` all call `initBilling()` with no uid, and plans.tsx calls
// it with `user?.uid`, which is undefined on the first render before auth
// resolves. Lose that race and RevenueCat invents a `$RCAnonymousID:` id that
// nothing can ever change.
//
// Nothing visible breaks. The purchase succeeds, Apple charges the card, the
// dialog says "You're all set". Then the webhook receives an event whose
// app_user_id is anonymous, refuses it as unattributable, and the learner sits
// on the free tier's 60 minutes having paid for 5 hours. The only trace is one
// ERROR line in Cloud Run that nobody is reading at the time.
//
// So two properties are enforced here, and they are belt and braces on purpose:
//   1. a uid arriving AFTER configure is still attached, via logIn()
//   2. a purchase is REFUSED while the id is anonymous, rather than taken
//
// Property 2 is what makes property 1 safe to get wrong. Blocking a purchase is
// recoverable in a way that silently swallowing one is not.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE = dirname(dirname(fileURLToPath(import.meta.url)));
const ROOT = dirname(MOBILE);

const billing = readFileSync(join(MOBILE, 'src/services/billing.ts'), 'utf8');
const handler = readFileSync(join(ROOT, 'backend/live-bridge/app/revenuecat.py'), 'utf8');

let bad = 0;
const fail = (m) => { bad += 1; console.error(`  FAIL  ${m}`); };

const between = (src, start, end) => {
  const i = src.indexOf(start);
  if (i < 0) return null;
  const j = src.indexOf(end, i + start.length);
  return j < 0 ? src.slice(i) : src.slice(i, j);
};

// ── 1. The memoised early return must still attach a late uid ──
const init = between(billing, 'export async function initBilling', '\nexport ');
if (!init) {
  fail('initBilling not found in billing.ts. This guard has gone stale, fix it rather than deleting it.');
} else {
  const earlyReturn = between(init, 'if (state) {', '\n  if (isExpoGo)');
  if (!earlyReturn) {
    fail('initBilling returns the memoised state without a block that can re-identify. '
      + 'A uid arriving after the first call would be dropped and the session stays anonymous.');
  } else if (!/\bidentify\(/.test(earlyReturn)) {
    fail('the memoised branch of initBilling never calls identify(). configure() is one-shot: '
      + 'without logIn() there, a uid that arrives after auth resolves is silently discarded.');
  }
  if (!/purchases\.logIn\(/.test(billing)) {
    fail('billing.ts never calls purchases.logIn(). It is the only way to attach an identity '
      + 'to an already-configured RevenueCat session.');
  }
}

// ── 2. A purchase must be refused while the id is anonymous ──
const buy = between(billing, 'export async function purchasePackage', '\nexport ');
if (!buy) {
  fail('purchasePackage not found in billing.ts. This guard has gone stale, fix it rather than deleting it.');
} else {
  const check = buy.indexOf('getAppUserID');
  const charge = buy.indexOf('purchases.purchasePackage(');
  if (check < 0) {
    fail('purchasePackage never reads getAppUserID(), so it cannot tell an attributable '
      + 'purchase from one that will be silently dropped by the webhook.');
  } else if (charge < 0) {
    fail('purchasePackage no longer calls purchases.purchasePackage(). This guard has gone stale.');
  } else if (check > charge) {
    fail('purchasePackage checks the app user id AFTER charging. The check has to come first '
      + 'or the money is already gone by the time we notice we cannot attribute it.');
  }
  if (!new RegExp('ANONYMOUS_PREFIX|\\$RCAnonymousID').test(buy)) {
    fail('purchasePackage does not test for an anonymous id.');
  }
}

// ── 3. Client and server must agree on what "anonymous" looks like ──
// The client refuses to make one of these and the server refuses to honour one.
// If the two strings ever drift, both halves pass their own tests and the pair
// is useless: the client permits a purchase the server will then discard.
const clientPrefix = billing.match(/ANONYMOUS_PREFIX\s*=\s*'([^']+)'/)?.[1];
const serverPrefix = handler.match(/uid\.startswith\("([^"]+)"\)/)?.[1];
if (!clientPrefix) fail('ANONYMOUS_PREFIX is not exported from billing.ts as a literal.');
else if (!serverPrefix) fail('revenuecat.py no longer tests uid.startswith("..."). This guard has gone stale.');
else if (clientPrefix !== serverPrefix) {
  fail(`the client treats '${clientPrefix}' as anonymous and the server '${serverPrefix}'. `
    + 'They must be identical, or the client waves through purchases the server drops.');
}

if (bad === 0) {
  console.log('  ok    a late uid is attached via logIn, and an anonymous id blocks the purchase');
  console.log(`  ok    client and server agree that '${clientPrefix}' means unattributable`);
  console.log('\nbilling identity: all checks passed');
} else {
  console.error('\nbilling identity: ' + bad + ' failure(s)');
}
process.exit(bad === 0 ? 0 : 1);
