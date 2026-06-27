# Ohmlet — API Contracts

> Status: living document. Last reviewed 2026-06-26. Source of truth is the code
> (`backend/*/app/`); this is the human-readable contract. Update both together.

## Conventions

- **Base URLs** are per service (Cloud Run), injected into the frontend as
  `VITE_OHMLET_*_API_BASE_URL`. All are `europe-west1`, project `ohmlet-app`.
- **Auth:** unless marked *public*, every endpoint requires
  `Authorization: Bearer <Firebase ID token>`. The server verifies the token and
  derives `uid` from it — the client never supplies its own uid. A missing or
  invalid token returns `401`.
- **Isolation:** all reads/writes are scoped to the token's `uid` (ADR-0004).
- **Errors:** JSON `{ "detail": "<message>" }` with a conventional status
  (`401` auth, `403` forbidden, `404` missing, `422` validation, `429` rate
  limited, `5xx` clean server error — never an internal stack trace).
- **Rate limiting:** mutating/expensive endpoints are rate-limited per uid (#47);
  over-limit returns `429`.

---

## live-bridge — `VITE_OHMLET_API_BASE_URL`

### Health & live session
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | public | Liveness probe → `200`. |
| WS  | `/ws/{user_id}/{session_id}` | token | Bidirectional audio/video stream to the live tutor (ADK ↔ Gemini Live). |
| POST | `/v1/live/text` | token | Send a text turn into an active live session. |

### Entitlements — prefix `/v1/me`
| Method | Path | Body | Purpose |
|--------|------|------|---------|
| PUT | `/v1/me/plan` | `{ plan }` | Internal plan reconciliation; the **webhook** is the real source of truth. |

### Billing — prefix `/v1/billing`
| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/v1/billing/checkout` | `{ plan, origin }` | `{ url }` — Stripe Checkout session to redirect to. |
| POST | `/v1/billing/portal` | `{ origin }` | `{ url }` — Stripe Customer Portal (manage/cancel). |
| POST | `/v1/billing/webhook` | Stripe event (raw) | *public, signature-verified.* Writes the plan to Firestore. Idempotent (#51). |

### Privacy / GDPR — prefix `/v1/me`
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/me/export` | Full export of the caller's data (#34). |
| POST | `/v1/me/delete` | Delete the caller's account + data (#34). |

### Workspace state — prefix `/v1/state`
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/state/{user_id}` | Read progress (completed lessons, XP, streak). Must equal the token uid. |
| PUT | `/v1/state/{user_id}` | Upsert progress. Server-authoritative; idempotent on XP/streak. |

### Community — prefix `/v1/community`
| Method | Path | Body | Purpose |
|--------|------|------|---------|
| GET | `/posts` | — | Latest feed (≤30). Each post carries the caller's `liked`. |
| POST | `/posts` | `{ kind, title, body }` | Create a post. `kind ∈ {build, win, question}`. |
| POST | `/posts/{id}/like` | — | Toggle like → `{ liked, likes }`. |
| GET | `/posts/{id}/comments` | — | Thread for a post. |
| POST | `/posts/{id}/comments` | `{ text }` | Add a comment. |
| GET | `/challenges` | — | Live challenges with `joined` + `progress` for the caller, sorted by `order`. |
| POST | `/challenges/{id}/join` | — | Join → `{ joined, participantCount }`. Idempotent. |
| POST | `/challenges/{id}/leave` | — | Leave → `{ joined:false, participantCount }`. Idempotent. |
| POST | `/xp` | `{ amount }` | Add XP to the caller's weekly league tally (`0 < amount ≤ 10000`). |
| GET | `/leaderboard` | — | Current ISO-week league: `{ week, leaders[], me }`. |

**Challenge object:** `id, title, tagline, desc, longDesc, reward, goal,
durationDays, art, theme, order, participantCount, joined, progress`. `art` and
`theme` select the client-rendered hero illustration / palette and are validated
against a known set (see `tests/test_community.py`).

---

## quiz-engine — `VITE_OHMLET_QUIZ_API_BASE_URL`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | public | Liveness. |
| POST | `/generate` | token | Generate an adaptive quiz item. |
| POST | `/assess-drawing` | token | Assess a learner's circuit drawing (latency-critical; warm container, #60). |
| GET | `/internal/metrics` | metrics token | Prometheus-style metrics (token-guarded, #35). |

## vision-verifier — `VITE_OHMLET_VERIFIER_API_BASE_URL`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | public | Liveness. |
| POST | `/v1/verify-inventory` | token | Check the learner's kit against a build's required components from a camera frame. |
| POST | `/v1/identify-component` | token | Identify a single component held to the camera. |
| GET | `/internal/metrics` | metrics token | Metrics. |

## compiler — `VITE_OHMLET_COMPILER_API_BASE_URL`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | public | Liveness. |
| POST | `/v1/compile` | token | Compile an Arduino sketch → `{ hex, ... }` or structured errors. Sandboxed: source ≤64 KB, board allow-list, non-root, rlimits, timeout. Source is **compiled, never executed**. |
| GET | `/internal/metrics` | metrics token | Metrics. |

## reporter — `VITE_OHMLET_REPORTER_API_BASE_URL`

The 3D digital-twin service: a real image→mesh of the finished build (the one
post-session artifact). Generation is gated + metered per plan; the GLB is private
and streamed through an authenticated, ownership-checked endpoint.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | public | Liveness + which provider is configured. |
| POST | `/v1/twin` | token | Generate a twin from `{ image_base64, title?, sessionId?, buildId? }`. `402` when over the monthly quota; `503` when generation is unconfigured. |
| GET | `/v1/twins` | token | The caller's twins, newest first. |
| GET | `/v1/twins/{id}` | token | One twin's metadata. |
| GET | `/v1/twins/{id}/model` | token | Stream the GLB mesh (ownership-checked). |
| DELETE | `/v1/twins/{id}` | token | Delete a twin + its mesh. |
| GET | `/internal/metrics` | metrics token | Metrics. |

---

## Versioning

Endpoints are prefixed `/v1/…` where they are part of the stable contract. A
breaking change ships under a new prefix (`/v2/…`) with the old one kept until the
frontend has migrated. Health and metrics are unversioned infrastructure routes.
