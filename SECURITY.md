# Ohmlet — security model

How secrets, identity, and least privilege work. Read before touching auth,
deploys, or anything that handles a credential.

## Secrets (#46)

**Rule: real secrets live only in GCP Secret Manager, never in the repo or a
container image.** They are injected into Cloud Run at deploy time, never baked
in. `.env` and `.env.local` are gitignored; only `*.env.example` (placeholders)
is committed. CI runs gitleaks on every push to catch accidental commits.

What is **not** a secret (safe to commit):
- The **Firebase web config** (`apiKey`, `authDomain`, etc. in
  `frontend/services/firebase.ts`). A Firebase web apiKey only identifies the
  project to Google; protection comes from Auth authorized-domains + Firestore
  rules, not secrecy. Google documents this explicitly.

What **is** a secret (Secret Manager only):
- Gemini: **none in production** — the backend uses Vertex AI via the service
  account (`GOOGLE_GENAI_USE_VERTEXAI=TRUE`), so there is no Gemini API key to
  manage. (A `GOOGLE_API_KEY` only exists for local non-Vertex dev.)
- **Stripe** (when #30 lands): `STRIPE_SECRET_KEY` and the webhook signing
  secret. Store each in Secret Manager and inject as an env var:

  ```bash
  printf '%s' "sk_live_..." | gcloud secrets create ohmlet-stripe-secret \
    --data-file=- --project=ohmlet-app
  # then on deploy:
  gcloud run deploy ohmlet-live-bridge ... \
    --set-secrets=STRIPE_SECRET_KEY=ohmlet-stripe-secret:latest
  ```

**Rotation:** add a new secret version, redeploy (picks up `:latest`), then
disable the old version. Rotate on any suspected exposure and at least yearly.

## Identity (#29, #44)

- Users authenticate with Firebase Auth (client). Every backend call carries the
  short-lived **ID token**; the server verifies it with the Admin SDK and derives
  the UID itself (`backend/live-bridge/app/auth.py`). The client-supplied id in a
  path/payload is never trusted.
- Owner/admin = an email allowlist (`OHMLET_ADMIN_EMAILS`), checked server-side.

## Least-privilege service accounts (#46)

The live-bridge runs as a **dedicated runtime SA**
`ohmlet-live-bridge@ohmlet-app.iam.gserviceaccount.com`, granted only:

| Role | Why |
|------|-----|
| `roles/datastore.user` | Firestore read/write (state, plans, budget) |
| `roles/aiplatform.user` | Vertex AI (Gemini) |
| `roles/logging.logWriter` | structured logs |
| `roles/secretmanager.secretAccessor` | read injected secrets (Stripe, etc.) |

It does **not** have `roles/editor`. `deploy.sh` sets `--service-account` so the
service always runs as this SA (override via `OHMLET_LIVE_BRIDGE_SA`).

**Known follow-up (tracked in #35):** the default *compute* SA (used by Cloud
Build during `--source` deploys) still carries `roles/editor`. Narrowing the
build identity is a separate hardening step; the runtime — the
internet-exposed, user-input-processing surface — is already least-privilege.

## Other controls

- **Rate limiting** (#47): per-user/IP REST caps + per-user live-session caps.
- **Input validation + size caps** (#45): every payload bounded and shape-checked.
- **Idempotency + concurrency** (#51): once-only event claims, optimistic state writes.
- **Dependency scanning** (#48): Dependabot + `npm audit` (blocks on high) +
  `pip-audit` (reports) + gitleaks, in `.github/`.
