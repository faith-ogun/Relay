# Ohmlet — Engineering Docs

The map of the system and the reasoning behind it. Start here.

- **[architecture.md](architecture.md)** — system topology (with diagram),
  frontend, the modular Cloud Run services, state/data, billing, observability,
  deployment.
- **[api-contracts.md](api-contracts.md)** — every HTTP/WS endpoint per service:
  method, path, auth, body, returns, and the shared conventions (auth, isolation,
  errors, rate limits).
- **[caching.md](caching.md)** — what we cache, for how long, and how staleness
  is bounded (static assets + the leaderboard TTL cache).
- **[blockers.md](blockers.md)** — what's built but not fully live, and exactly
  what (credential, cloud action, or decision) unblocks each.
- **[adr/](adr/)** — Architecture Decision Records: the *why* behind the big
  choices, append-only.

## ADR index

| # | Decision |
|---|----------|
| [0001](adr/0001-record-architecture-decisions.md) | Record architecture decisions (this process) |
| [0002](adr/0002-modular-cloud-run-microservices.md) | One Cloud Run service per backend feature |
| [0003](adr/0003-own-circuit-simulation-engine.md) | Build our own circuit simulation engine |
| [0004](adr/0004-server-authoritative-identity-and-isolation.md) | Server-authoritative identity and per-user isolation |
| [0005](adr/0005-consent-gated-analytics.md) | Consent-gated analytics |

## Related, already in the repo

- [`../CLAUDE.md`](../CLAUDE.md) / [`../AGENTS.md`](../AGENTS.md) — product brief,
  design system, engineering standards, and working rules.
- [`../ops/observability.md`](../ops/observability.md) — logging, metrics,
  tracing, alerting, audit trail.
- [`../ops/disaster-recovery.md`](../ops/disaster-recovery.md) — backups, RTO/RPO,
  restore runbook (paired with `../ops/backup.sh`).
- [`../SECURITY.md`](../SECURITY.md) — security posture and disclosure.
- [`../README.md`](../README.md) — top-level project readme.

## Keeping these honest

The code is the source of truth. When an endpoint, service, or major decision
changes, update the relevant doc in the same PR. Each file carries a "last
reviewed" date; refresh it when you touch the file. A new or reversed decision is
a **new** ADR that supersedes the old one, not an edit to history.
