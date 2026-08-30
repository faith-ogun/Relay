// Which store package buys which tier, at which interval.
//
// Pure logic, kept out of the screen so scripts/check-package-match.mjs can run
// it against the identifiers actually configured in RevenueCat. It was inside
// plans.tsx and carried a bug nothing could have caught there.

export type Interval = 'monthly' | 'annual';

/** Only the fields the matcher needs, so a test does not have to fake a whole
 *  RevenueCat package. */
export interface MatchablePackage {
  id: string;
  title: string;
}

/**
 * The store package that buys a given tier AT A GIVEN INTERVAL.
 *
 * The interval half is not decoration. This used to match on the tier alone,
 * which worked while there was one product per tier and broke the moment four
 * existed: `pro` matches BOTH `pro_monthly` and `pro_annual`, so the card would
 * take whichever Apple happened to list first and could show $15.99 above a
 * button that charges $143.99.
 *
 * RevenueCat identifiers are ours to choose, so matching on the names we chose
 * is the contract. A tier with no package for the chosen interval shows why it
 * cannot be bought rather than a button that does nothing.
 */
export function packageFor<T extends MatchablePackage>(
  packages: T[] | null,
  plan: string,
  interval: Interval,
): T | null {
  if (!packages) return null;
  const wanted = interval === 'annual' ? ['annual', 'yearly', 'year'] : ['monthly', 'month'];
  return packages.find((pkg) => {
    const hay = `${pkg.id} ${pkg.title}`.toLowerCase();
    return hay.includes(plan) && wanted.some((w) => hay.includes(w));
  }) ?? null;
}

