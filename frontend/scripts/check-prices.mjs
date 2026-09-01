// Three files publish Ohmlet's price. They must agree.
//
// They did not. `frontend/components/ohmlet/entitlements.ts` said Pro was $12
// and Max $29, while `PricingPage.tsx` and the mobile app both said $15.99 and
// $34.99. The web app and its own pricing page disagreed about what the product
// costs, which is the kind of defect nobody notices until a customer does.
//
// There is no single source to import from, because one file is Python-adjacent
// config, one is a React page and one is a React Native service, and the two
// surfaces deploy independently. So the constraint lives here instead.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO = resolve(FRONTEND, '..');

const fail = (msg) => { console.error(`check-prices: ${msg}`); process.exit(1); };
const read = (p) => readFileSync(join(REPO, p), 'utf8');

/** Strip comments so a price quoted in prose cannot satisfy or break the check. */
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const sources = {};

// ── Annual, which this check did not cover until 2026-08-30 ──
//
// Apple sells subscriptions only at fixed price points, so an annual price is
// never simply the monthly-equivalent times twelve. Pro's advertised $6.50 a
// month works out at $78.00 and the nearest point Apple offers is $77.99.
//
// The site shows the per-month figure and, since today, the total that will
// actually leave someone's account. Those two have to stay consistent with each
// other, and the drift that matters is the one where the total creeps ABOVE
// twelve times the advertised monthly: that is the site quoting one price and
// the store charging another.
{
  const src = code(read('frontend/components/PricingPage.tsx'));
  const rows = [...src.matchAll(/variant:\s*'(free|pro|max)'[\s\S]*?annual:\s*([\d.]+),[\s\S]*?annualTotal:\s*([\d.]+)/g)];
  if (rows.length !== 3) fail(`expected 3 tiers with an annualTotal, found ${rows.length}`);
  for (const [, variant, perMonth, total] of rows) {
    const implied = Number(perMonth) * 12;
    const actual = Number(total);
    if (implied === 0 && actual === 0) continue;
    const drift = actual - implied;
    if (drift > 0.5) {
      fail(`${variant}: the page advertises $${perMonth}/month annually, which is $${implied.toFixed(2)}, `
        + `but bills $${actual.toFixed(2)}. Quoting less than you charge is the wrong direction to round.`);
    }
    if (drift < -5) {
      fail(`${variant}: annualTotal $${actual.toFixed(2)} is far below 12 x $${perMonth}. One of the two is stale.`);
    }
  }
  console.log("check-prices: ok  annual totals agree with their advertised monthly rate");
}

// ── The phone's annual figures, against the page's ──
//
// The mobile plans screen gained a monthly/annual toggle on 2026-08-30, so it
// now carries annual prices of its own. Two files publishing the same annual
// price is two files that can disagree, which is exactly what this whole script
// exists to prevent for the monthly one.
{
  const web = code(read('frontend/components/PricingPage.tsx'));
  const app = code(read('mobile/src/services/entitlements.ts'));

  const webRows = Object.fromEntries([...web.matchAll(
    /variant:\s*'(pro|max)'[\s\S]*?annual:\s*([\d.]+),[\s\S]*?annualTotal:\s*([\d.]+)/g,
  )].map((m) => [m[1], [Number(m[2]), Number(m[3])]]));

  const appRows = Object.fromEntries([...app.matchAll(
    /(pro|max):\s*\{[\s\S]*?priceAnnualPerMonth:\s*([\d.]+),\s*priceAnnualTotal:\s*([\d.]+)/g,
  )].map((m) => [m[1], [Number(m[2]), Number(m[3])]]));

  for (const plan of ['pro', 'max']) {
    const w = webRows[plan];
    const a = appRows[plan];
    if (!w) { fail(`PricingPage.tsx has no annual pair for ${plan}`); continue; }
    if (!a) { fail(`mobile entitlements.ts has no annual pair for ${plan}`); continue; }
    if (w[0] !== a[0] || w[1] !== a[1]) {
      fail(`${plan} annual disagrees: the page says $${w[0]}/mo totalling $${w[1]}, `
        + `the phone says $${a[0]}/mo totalling $${a[1]}. One price per product, on every surface.`);
    }
  }
  console.log("check-prices: ok  the phone and the page agree on both annual prices");
}


// ── The discount badge, against what the discount actually is ──
//
// Added 2026-09-01, when the tiers were repriced and the badge moved from 25%
// to 50%. Every other figure on the page is a price somebody can check against
// their statement; the badge is a CLAIM about two of them, and it is the one
// number nothing derived. It sat at "Save 25%" through the reprice in a draft of
// this change and read as a 50% saving sold as a quarter of one.
//
// The direction that matters most is overstating: a badge promising more than
// the arithmetic delivers is a false advertising claim on the paywall itself,
// and it is worse than a stale price because no checkout ever contradicts it.
// Understating is caught too, at a looser tolerance, because a badge left behind
// by a reprice is the same defect facing the other way.
//
// The badge is shown ONCE for all paid tiers, so it has to be true of the
// stingiest of them, not the most generous.
{
  const pct = (src, label) => {
    const m = src.match(/save\s*(\d+(?:\.\d+)?)\s*%/i);
    if (!m) fail(`${label} publishes an annual toggle with no discount badge to check.`);
    return Number(m[1]);
  };

  const web = code(read('frontend/components/PricingPage.tsx'));
  const app = code(read('mobile/src/app/plans.tsx'));
  const webBadge = pct(web, 'PricingPage.tsx');
  const appBadge = pct(app, 'mobile/src/app/plans.tsx');

  if (webBadge !== appBadge) {
    fail(`the discount badge disagrees: the page says ${webBadge}% and the phone says ${appBadge}%. `
      + 'One saving per product, on every surface.');
  }

  const rows = [...web.matchAll(/variant:\s*'(pro|max)'[\s\S]*?monthly:\s*([\d.]+),[\s\S]*?annualTotal:\s*([\d.]+)/g)];
  if (rows.length !== 2) fail(`expected 2 paid tiers to check the badge against, found ${rows.length}`);
  for (const [, variant, monthly, total] of rows) {
    const year = Number(monthly) * 12;
    const actual = (1 - Number(total) / year) * 100;
    if (webBadge - actual > 0.5) {
      fail(`the badge advertises "Save ${webBadge}%", but ${variant} annual saves ${actual.toFixed(1)}%: `
        + `$${Number(total).toFixed(2)} against $${year.toFixed(2)} of monthly. `
        + 'A badge that promises more than the checkout delivers is a false claim.');
    }
    if (actual - webBadge > 1) {
      fail(`the badge advertises "Save ${webBadge}%", but ${variant} annual actually saves ${actual.toFixed(1)}%. `
        + 'The badge is stale: it was left behind by a reprice and is underselling the offer.');
    }
  }
  console.log(`check-prices: ok  the "Save ${webBadge}%" badge is what the annual prices actually save`);
}

// ── The live-tutor hours, against the minute cap they describe ──
//
// The cap is a number in one module; the hours are prose in four places, on two
// surfaces that deploy separately. Repricing on 2026-09-01 moved Pro from 240
// minutes to 150 and Max from 540 to 300, and every one of those sentences had
// to move with it or the paywall would be selling time the server refuses to
// give. Hours, not minutes, because that is how the copy reads.
{
  const caps = code(read('frontend/components/ohmlet/entitlements.ts'))
    .match(/LIVE_MINUTES_PER_MONTH[\s\S]*?free:\s*(\d+),[\s\S]*?pro:\s*(\d+),[\s\S]*?max:\s*(\d+)/);
  if (!caps) fail('cannot read LIVE_MINUTES_PER_MONTH out of frontend entitlements.ts');
  const expected = { pro: Number(caps[2]) / 60, max: Number(caps[3]) / 60 };

  // Where each tier's copy lives, and what encloses it. Sliced per tier so a
  // swap (Pro promised Max's hours) fails as loudly as a stale figure.
  const sites = [
    { file: 'frontend/components/PricingPage.tsx', pro: ["variant: 'pro'", "variant: 'max'"], max: ["variant: 'max'", '\n];'] },
    { file: 'frontend/components/UpgradeSuccess.tsx', pro: ['  pro: {', '  max: {'], max: ['  max: {', '\n};'] },
    { file: 'mobile/src/services/entitlements.ts', pro: ['  pro: {', '  max: {'], max: ['  max: {', '\n};'] },
  ];

  for (const site of sites) {
    const src = code(read(site.file));
    for (const plan of ['pro', 'max']) {
      const [from, to] = site[plan];
      const i = src.indexOf(from);
      if (i < 0) { fail(`${site.file} has no ${plan} block to check (looked for ${JSON.stringify(from)})`); continue; }
      const j = src.indexOf(to, i + from.length);
      const block = src.slice(i, j < 0 ? src.length : j);

      const claims = [...block.matchAll(/(\d+(?:\.\d+)?)\s+hours?\b/g)].map((m) => Number(m[1]));
      if (claims.length === 0) {
        fail(`${site.file} says nothing about how much live tutoring ${plan} buys. `
          + 'That is the headline of the tier and it cannot go unsaid.');
        continue;
      }
      for (const claimed of claims) {
        if (claimed !== expected[plan]) {
          fail(`${site.file} sells ${plan} "${claimed} hours" of live tutoring, but the cap is `
            + `${caps[plan === 'pro' ? 2 : 3]} minutes, which is ${expected[plan]} hours. `
            + 'The paywall is promising time the server will refuse.');
        }
      }
    }
  }
  console.log(`check-prices: ok  every surface sells pro ${expected.pro} hours and max ${expected.max} hours, matching the caps`);
}

// 1. The marketing pricing page: a tiers array with monthly/annual numbers.
//    Keyed off `variant`, not `name`: the Max tier's display name is lowercase
//    'max' on purpose, for the shimmer treatment, so matching on a capitalised
//    name silently found only two of the three tiers.
{
  const s = code(read('frontend/components/PricingPage.tsx'));
  const tiers = [...s.matchAll(/variant:\s*'(free|pro|max)'[\s\S]*?monthly:\s*([\d.]+)/g)];
  if (tiers.length !== 3) fail(`expected 3 tiers in PricingPage.tsx, found ${tiers.length}`);
  sources['PricingPage.tsx'] = Object.fromEntries(tiers.map((m) => [m[1], Number(m[2])]));
}

// 2. The web app's own entitlements module.
{
  const s = code(read('frontend/components/ohmlet/entitlements.ts'));
  const rows = [...s.matchAll(/(free|pro|max):\s*\{[^}]*priceMonthly:\s*(null|[\d.]+)/g)];
  if (rows.length !== 3) fail(`expected 3 plans in frontend entitlements.ts, found ${rows.length}`);
  sources['frontend/entitlements.ts'] = Object.fromEntries(
    rows.map((m) => [m[1], m[2] === 'null' ? 0 : Number(m[2])]),
  );
}

// 3. The mobile app.
{
  const s = code(read('mobile/src/services/entitlements.ts'));
  const rows = [...s.matchAll(/(free|pro|max):\s*\{[\s\S]*?priceMonthly:\s*(null|[\d.]+)/g)];
  if (rows.length !== 3) fail(`expected 3 plans in mobile entitlements.ts, found ${rows.length}`);
  sources['mobile/entitlements.ts'] = Object.fromEntries(
    rows.map((m) => [m[1], m[2] === 'null' ? 0 : Number(m[2])]),
  );
}

const names = Object.keys(sources);
for (const plan of ['free', 'pro', 'max']) {
  const seen = names.map((n) => [n, sources[n][plan]]);
  const distinct = [...new Set(seen.map(([, v]) => v))];
  if (distinct.length > 1) {
    fail(
      `the ${plan} price disagrees across sources:\n` +
      seen.map(([n, v]) => `    ${n.padEnd(26)} ${v === 0 ? 'free' : '$' + v}`).join('\n') +
      `\n  Pick one and set it in all three.`,
    );
  }
}

// A currency symbol hard-coded anywhere near a plan price is its own trap: the
// mobile fallback rendered euros against a page that publishes dollars.
{
  const s = code(read('mobile/src/app/plans.tsx'));
  if (/[€£](\$\{)?meta\.priceMonthly/.test(s) || /[€£]\$\{meta/.test(s)) {
    fail('mobile/src/app/plans.tsx renders a non-dollar symbol for priceMonthly, but the pricing page publishes dollars.');
  }
}

const p = sources['PricingPage.tsx'];
console.log(`check-prices: ok free, pro $${p.pro}, max $${p.max} agree across ${names.length} sources`);
