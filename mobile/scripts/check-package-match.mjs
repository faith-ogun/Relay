#!/usr/bin/env node
// The plans screen must find the right store package for every tier and interval.
//
// This exists because the matcher shipped with a bug that nothing could catch.
// It compared only the tier name:
//
//     packages.find((pkg) => `${pkg.id} ${pkg.title}`.includes(plan))
//
// `pro` matches BOTH pro_monthly and pro_annual. With one product per tier that
// was correct. On 2026-08-30 four products were created in App Store Connect and
// it became a mischarge: the Pro card would take whichever package Apple listed
// first and could show $15.99 above a button that takes $143.99. Nothing failed,
// nothing logged, and the only symptom would have been a customer's bank.
//
// So the matcher moved out of plans.tsx into services/packageMatch.ts, and this
// runs it against the identifiers that are actually configured in RevenueCat.
//
// If the RevenueCat offering is ever rebuilt with different package identifiers,
// change EXPECTED here at the same time. That is the point: the identifiers are
// a contract between a dashboard nobody diffs and a screen that takes money.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE = dirname(dirname(fileURLToPath(import.meta.url)));

/** The four packages the RevenueCat offering is configured with. */
const EXPECTED = [
  { id: 'pro_monthly', title: 'Ohmlet Pro' },
  { id: 'pro_annual', title: 'Ohmlet Pro (Annual)' },
  { id: 'max_monthly', title: 'Ohmlet Max' },
  { id: 'max_annual', title: 'Ohmlet Max (Annual)' },
];

// The matcher, read from the module rather than reimplemented here. A guard that
// restates the logic it is guarding proves only that it can copy.
const src = readFileSync(join(MOBILE, 'src/services/packageMatch.ts'), 'utf8');
const body = src.slice(src.indexOf('export function packageFor'));
const js = body
  .replace(/export function packageFor<T extends MatchablePackage>\(\s*packages: T\[\] \| null,\s*plan: string,\s*interval: Interval,\s*\): T \| null \{/, 'function packageFor(packages, plan, interval) {')
  .replace(/: \w+(\[\])?/g, '')
  .split('\n}')[0] + '\n}';
// eslint-disable-next-line no-new-func
const packageFor = new Function(`${js}; return packageFor;`)();

let bad = 0;
const fail = (m) => { bad += 1; console.error(`  FAIL  ${m}`); };

// ── Every tier and interval finds exactly its own package ──
for (const plan of ['pro', 'max']) {
  for (const interval of ['monthly', 'annual']) {
    const want = `${plan}_${interval}`;
    const got = packageFor(EXPECTED, plan, interval);
    if (!got) fail(`${plan} ${interval} matched nothing. Every tier must be buyable at both intervals.`);
    else if (got.id !== want) {
      fail(`${plan} ${interval} matched '${got.id}', wanted '${want}'. `
        + 'This is the mischarge: the card shows one price and the button takes another.');
    }
  }
}

// ── The wizard's leftovers must never match ──
// RevenueCat's onboarding created Test Store products called `monthly` and
// `yearly`, and they cannot be deleted. They carry an interval and no tier, so
// they must fall through rather than being sold as Pro.
const LEFTOVERS = [{ id: 'monthly', title: 'Monthly' }, { id: 'yearly', title: 'Yearly' }];
for (const plan of ['pro', 'max']) {
  for (const interval of ['monthly', 'annual']) {
    if (packageFor(LEFTOVERS, plan, interval)) {
      fail(`the Test Store leftovers matched ${plan} ${interval}. They name no tier and must never be sold.`);
    }
  }
}

// ── An empty or absent offering yields nothing, never a wrong guess ──
if (packageFor(null, 'pro', 'monthly') || packageFor([], 'pro', 'monthly')) {
  fail('an empty offering produced a package. It must return null so the screen can say why.');
}

if (bad === 0) {
  console.log('  ok    every tier finds its own package at both intervals, and nothing else matches');
  console.log('\npackage match: all checks passed');
} else {
  console.error('\npackage match: ' + bad + ' failure(s)');
}
process.exit(bad === 0 ? 0 : 1);
