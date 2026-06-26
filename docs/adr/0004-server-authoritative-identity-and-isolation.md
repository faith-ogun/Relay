# ADR-0004: Server-authoritative identity and per-user isolation

- **Status:** Accepted
- **Date:** 2026-06-26 (decision made during #44)

## Context

Ohmlet stores per-user data (progress, XP, community posts, billing plan) and
takes money. The classic failure modes are IDOR (reading/writing another user's
data by passing their id) and trusting client-supplied identity or entitlement.

## Decision

Identity is established **only** by a verified Firebase ID token. The Firebase
Auth SDK mints a short-lived JWT on the client; every backend request carries it
as `Authorization: Bearer <token>`. The server verifies the token and derives
`uid` from the verified claims. The client never supplies its own uid in a body
or path that is trusted — where a `{user_id}` appears in a route, the server
checks it equals the token uid.

All Firestore reads/writes are scoped to that uid. Entitlements (Free/Pro/Max) are
enforced **server-side** on the protected operation, not merely hidden in the UI;
the Stripe webhook is the source of truth for the plan. Money/XP/streak mutations
are idempotent and use atomic increments (#51).

## Consequences

- No IDOR: a forged or swapped id can't reach another user's data.
- A tampered client can't grant itself a tier — the server re-checks.
- Slightly more server work per request (token verify, ownership check). Cheap
  relative to the risk it removes, and cached by the SDK.
- Firebase web config (apiKey etc.) is public by design; protection comes from
  Auth authorized-domains + Firestore rules + this token verification, not from
  hiding those values.
