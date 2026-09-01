# Ohmlet — Observability & Production Hardening (#35)

How Ohmlet's backend is observed, hardened, and alerted on in production. This
applies uniformly to all three Cloud Run services: **live-bridge**,
**quiz-engine**, **vision-verifier**.

The shared implementation lives in `app/obs.py` (one file, duplicated verbatim
per service the same way `resilience.py` is) and `app/cors.py`.

---

## 1. Structured logging + trace correlation

Every service logs **single-line JSON to stdout**, which Cloud Logging ingests
and parses automatically. Each line carries:

| Field | Meaning |
|-------|---------|
| `severity` | DEBUG/INFO/WARNING/ERROR/CRITICAL (maps to Cloud Logging levels) |
| `service` | `live-bridge` / `quiz-engine` / `vision-verifier` |
| `requestId` | Per-request id (also returned in the `X-Request-Id` response header) |
| `logging.googleapis.com/trace` | `projects/ohmlet-app/traces/<id>` — links the log to its **Cloud Trace** |
| `uid` | The verified user id, when the request is authenticated |
| `httpRequest` | Method, URL, status, latency, user agent, client IP (on the access log line) |

The trace id is parsed from the inbound `X-Cloud-Trace-Context` header that
Google's front end sets, so **every log line for a request is linked to its
trace** without running a tracing agent. To see all logs for one request, click
the trace in Logs Explorer or filter `jsonPayload.requestId="<id>"`.

Log level is `OHMLET_LOG_LEVEL` (default `INFO`).

### Useful Logs Explorer queries
```
# All audit events
jsonPayload.audit=true

# Every plan change (who, when, what)
jsonPayload.event="billing.plan_changed" OR jsonPayload.event="account.plan_set_admin"

# Server errors with their request id
severity>=ERROR

# One user's activity
jsonPayload.uid="<firebase-uid>"
```

---

## 2. Metrics

Cloud Run reports request count / latency at the platform level. On top of that,
each service keeps **in-process application metrics** exposed at
`GET /internal/metrics`:

- per-route request count, server-error count, client-error count
- per-route latency: avg, p50, p95, max
- custom counters: `inventory_checks`, `component_ids`, `question_gen_fallbacks`,
  `unhandled_exceptions`, …
- **circuit-breaker states** (`closed` / `open` / `half-open`) for every upstream

The endpoint is **guarded by a token** and returns `404` unless the request
carries `X-Ohmlet-Metrics-Token: <token>` matching the `OHMLET_METRICS_TOKEN`
env var. With the env var unset (the default), the endpoint does not exist —
metrics are never exposed by accident.

**Provisioned.** The `ohmlet-metrics-token` secret exists in Secret Manager and is
mounted on all three services (and owned by `deploy.sh`, so redeploys keep it).
To read the metrics:
```bash
TOKEN=$(gcloud secrets versions access latest --secret=ohmlet-metrics-token --project ohmlet-app)
curl -H "X-Ohmlet-Metrics-Token: $TOKEN" \
  https://ohmlet-live-bridge-182102811288.europe-west1.run.app/internal/metrics | jq
```
To rotate the token: `gcloud secrets versions add ohmlet-metrics-token --data-file=-`
then redeploy (or `gcloud run services update … --update-secrets=…:latest`).
Metrics are **per-instance** (Cloud Run scales horizontally), so treat them as a
spot-check / debugging aid, not a fleet-wide aggregate — Cloud Monitoring is the
source of truth for aggregate request/latency/error metrics.

---

## 3. Security audit trail

Security- and compliance-relevant actions emit an immutable audit record via
`obs.audit(event, uid=…, **fields)`:

| Event | When |
|-------|------|
| `billing.plan_changed` | Stripe webhook upgrades/downgrades/cancels a plan |
| `account.plan_set_admin` | An admin overrides a plan via `PUT /v1/me/plan` |
| `privacy.data_exported` | A user exports their data (GDPR Art. 15/20) |
| `privacy.account_deleted` | A user erases their account (GDPR Art. 17) |

Each record is **always** written as a structured log line (Cloud Logging is the
durable, immutable, BigQuery-exportable audit sink). In live-bridge it is **also**
appended to the Firestore `ohmlet_audit_log` collection (`OHMLET_AUDIT_COLLECTION`)
for an in-app admin view. Auditing is best-effort and never blocks the action it
records.

> For long-term retention / tamper-evidence, add a Logging **sink** to BigQuery
> filtered on `jsonPayload.audit=true` (one-time setup; not scripted here).

---

## 4. Hardening built into every service

- **Global exception handler.** Any unhandled error becomes a clean JSON `500`
  `{ "detail": "Something went wrong on our end…", "requestId": "<id>" }`. Internal
  stack traces go to the logs, **never to the client**. The request id lets
  support correlate a user report to the exact log line.
- **Security headers** on every response: `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`,
  `X-Request-Id`.
- **CORS** scoped to Ohmlet's own origins (ohmlet.org, Firebase Hosting + preview
  channels, localhost) instead of the old `*`. Auth is a Bearer token (no
  cross-origin cookies), so credentials are off. Override with
  `OHMLET_ALLOWED_ORIGINS` (`*` to allow all, or a comma-separated allowlist).
- **Circuit breakers + graceful degradation** (#50) on every AI upstream: a slow
  or down Vertex fails fast with a clean `503 Retry-After`, not a hung request.
- **Rate limiting** (#47) and **input validation / size caps** (#45) on the
  authenticated REST surface.

---

## 4b. Which build answered

`/health` on `live-bridge` is the only unauthenticated endpoint, and it reports
the **curriculum content stamp** alongside the model:

```bash
curl -s https://ohmlet-live-bridge-182102811288.europe-west1.run.app/health
# {"status":"ok","service":"live-bridge","runtime":"google-adk-bidi",
#  "model":"gemini-live-2.5-flash-native-audio","curriculum":"fd7efe04087d1ec5"}
```

Compare `curriculum` against `backend/live-bridge/app/curriculum_data/curriculum.json`
after any curriculum deploy. That is the whole check.

It exists because the question "did the new lessons actually reach production?"
had no cheap answer: the manifest that carries the stamp needs a Firebase bearer
token, so on 2026-08-28 a curriculum deploy was verified by comparing a Cloud Run
revision timestamp against a git commit timestamp. That proves when a container
was built, not what is inside it. The stamp is a hash of published lesson
content, so exposing it discloses nothing the app does not hand to every
signed-in learner.

An empty `curriculum` means the corpus failed to load, and a service answering
`"status":"ok"` while serving no lessons is worse than one that fails outright.

---

## 4c. Resources created outside Terraform

Recorded here because CLAUDE.md asks for it and because a bucket nobody
remembers creating is a bucket nobody remembers to bill for.

| When | What | Why |
|---|---|---|
| 2026-08-30 | Secret `ohmlet-appstore-api-key` — the App Store Connect API key (`AuthKey_*.p8`, Key ID `97FP8VLSXM`, App Manager role) | No service reads it. RevenueCat holds the working copy and uses it to import products from Apple; this is the backup, because App Store Connect allows exactly one download. |
| 2026-08-30 | Secret `ohmlet-revenuecat-webhook` — the Authorization header value RevenueCat sends to `/v1/billing/revenuecat` | Mounted on live-bridge. The handler returns 503 when it is absent rather than treating an empty string as a match, so a missing secret is a dead endpoint, never an open one. |
| 2026-08-30 | Secret `ohmlet-appstore-iap-key` — the App Store Connect in-app purchase key (`.p8`, Key ID `DT6JKF7RJP`) | No service reads it. RevenueCat holds the working copy and talks to Apple; this is the backup, because App Store Connect allows exactly one download and losing it means revoking and regenerating. |
| 2026-08-29 | `gs://ohmlet-app-twins` — `europe-west1`, STANDARD, uniform bucket-level access, **public access prevention enforced**, `objectAdmin` for `182102811288-compute@…` | Where the reporter writes 3D twin meshes. Public access is prevented on purpose: a twin is streamed through the authenticated `/v1/twins/{id}/model` endpoint after an ownership check, so it is as private as the rest of a learner's data. Empty until the Stability key lands. |

`ops/enable-twins.sh` re-checks the bucket, so that script is the whole story
even on a fresh project.

---

## 5. Alerting

`ops/alerting.sh` provisions Cloud Monitoring for all three services:

1. An HTTPS **uptime check** on `/health` (every 60s) + a down alert.
2. A **5xx error-rate** alert (sustained server errors).
3. A **p95 latency** alert (degraded service), **excluding `1xx` responses**.

   That exclusion is not tidying. Cloud Run reports a `101 Switching Protocols`
   request's latency as the **entire lifetime of the WebSocket**, and
   `live-bridge` exists to hold long WebSockets: a learner talking to the tutor
   for a minute is one request with 60000ms of "latency". Without it the policy
   fires on every session that is any use. It did, on 2026-08-27, on a 27-second
   voice test, while every real HTTP request in the same hour ran between 3 and
   10 milliseconds.

   WebSocket health is not measured by duration. Failures to establish return
   4xx or 5xx and are caught by the alert above; in-session failures are logged
   by the bridge itself. What is genuinely NOT alerted on is a slow upgrade
   handshake, which is the price of this exclusion and is worth knowing.

All notify an email channel (default `hello@ohmlet.org`; override with
`OHMLET_ALERT_EMAIL`). Run once after the services are deployed:

```bash
./ops/alerting.sh
```

**Provisioned** (2026-06-24): 1 email channel, 3 uptime checks, 6 alert policies
(5xx + p95 latency per service). Channel + uptime-check creation is idempotent on
re-run; alert policies are not — delete the old ones first if you re-run.

Thresholds are env-tunable (`OHMLET_ALERT_LATENCY_P95_MS`,
`OHMLET_ALERT_5XX_PER_SEC`). Re-running may create duplicate policies — delete
the old ones in Cloud Monitoring → Alerting before re-running after edits.

---

## 6. On-call quick reference

| Symptom | First look |
|---------|-----------|
| Users report errors | Logs Explorer: `severity>=ERROR`; grab the `requestId`/trace |
| A feature is "down" | `/internal/metrics` → `circuitBreakers` (is an upstream `open`?) |
| Slow responses | `/internal/metrics` → route `p95Ms`; Cloud Run latency dashboard |
| Billing dispute | Logs: `jsonPayload.event="billing.plan_changed" jsonPayload.uid="…"` |
| "Did we delete X's data?" | Logs/Firestore: `jsonPayload.event="privacy.account_deleted"` |
