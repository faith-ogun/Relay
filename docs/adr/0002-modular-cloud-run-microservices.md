# ADR-0002: One Cloud Run service per backend feature

- **Status:** Accepted
- **Date:** 2026-06-26

## Context

The backend has distinct workloads with very different resource and latency
profiles: a long-lived WebSocket streaming bridge (live-bridge), a latency-
critical vision/quiz path, a one-shot camera inventory check, and a heavy
toolchain compile (avr-gcc, large image, CPU/RAM-hungry). Bundling them into one
service would force a single scaling policy, memory ceiling, deploy cadence, and
blast radius on all of them.

## Decision

Each feature is its own folder under `backend/` and deploys as its own Cloud Run
service, sized independently (CPU, memory, timeout, concurrency, min-instances).
They do **not** share a Python package; the small observability/auth spine
(`obs.py`, `cors.py`, `auth.py`, `ratelimit.py`, `resilience.py`) is duplicated
per service on purpose.

## Consequences

- A service can be deployed, rolled back, and reasoned about in isolation; a bad
  deploy of the compiler can't take down the live tutor.
- Per-service tuning: the compiler keeps a warm instance (large image, slow cold
  start); the vision services run cpu-boosted and scale to zero.
- Cost: the shared spine drifts if not maintained. We accept this and keep the
  copies in sync deliberately (it's small, stable code). A shared library would
  re-couple deploys, which is exactly what we're avoiding.
