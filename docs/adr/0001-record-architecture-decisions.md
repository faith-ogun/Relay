# ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-06-26

## Context

Ohmlet is a commercial product built to last. Several non-obvious architectural
choices have already been made (own simulation engine, microservices, server-
authoritative isolation, consent-gated analytics). New contributors — human or
agent — need the *why*, not just the *what*, so they don't relitigate settled
decisions or accidentally undo a deliberate constraint.

## Decision

We keep lightweight Architecture Decision Records in `docs/adr/`, one file per
decision, numbered sequentially (`NNNN-title.md`). Each records context, the
decision, and consequences. ADRs are append-only: a decision that changes gets a
new ADR that supersedes the old one (the old one's status becomes *Superseded by
ADR-XXXX*) rather than being edited away.

Format: short and prose-first. No tooling required beyond Markdown.

## Consequences

- The reasoning behind a choice survives staff/context turnover.
- A reviewer can point at an ADR instead of re-explaining in PR comments.
- Cost: a few minutes per significant decision. Worth it.
