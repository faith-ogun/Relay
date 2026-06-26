# ADR-0005: Consent-gated analytics

- **Status:** Accepted
- **Date:** 2026-06-26 (decisions #37 + #59)

## Context

We want product analytics (funnel, retention, cancellation) to make informed
decisions, and we serve EU users, so non-essential cookies must stay off until
the user opts in. Our published Cookie Policy commits to exactly that: analytics
off by default, reject as easy as accept, choice changeable later.

## Decision

A single consent store (`frontend/services/cookieConsent.ts`) is the source of
truth (`analyticsAllowed()`). Two things gate on it:

1. **Firebase Analytics initialisation.** `getOhmletAnalytics()` returns `null`
   until consent is given — and since calling `getAnalytics()` is what starts
   collection and sets the cookie, nothing analytics-related runs before opt-in.
2. **The product event layer** (`frontend/services/analytics.ts`, #59). A small
   typed `track(event, params)` API for funnel/retention/cancellation events.
   Every call no-ops unless `analyticsAllowed()` is true.

The cookie banner asks once on first visit; "Cookie settings" in the footer
re-opens it to change the choice. Essential cookies (auth, security) are never
gated.

## Consequences

- Compliant by construction: there is no path that emits analytics without
  consent, because the gate is at initialisation, not just at the call site.
- Events are defined in one typed place, so the funnel is consistent and
  greppable, and renaming an event is a single edit.
- We lose analytics signal from users who decline. Accepted — it's the law and
  the promise we made; we never dark-pattern the choice.
