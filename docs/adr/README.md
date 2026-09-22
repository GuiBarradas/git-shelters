# Architecture Decision Records

This directory captures architecture and design decisions with long-term consequences. Format follows [Michael Nygard's ADR convention](https://github.com/joelparkerhenderson/architecture-decision-record).

**When to write an ADR:**

- The decision has consequences that are hard to reverse (DB schema, auth choice, public data model).
- There are reasonable alternatives that a reviewer (or future-you in 6 months) will question.
- The decision spans code (it doesn't live in a single file).

**When NOT to write an ADR:**

- A naming convention choice.
- A local decision in a single file.
- A reversible refactor.

## Index

- [0001 — Public profile RLS strategy](./0001-public-profile-rls-strategy.md) — *Accepted* — `/u/<login>` reads via isolated API endpoint with service-role + strict column whitelist + CI-gated leak test.
- [0002 — Daily Event resolution cardinality](./0002-daily-event-resolution-cardinality.md) — *Accepted* — how many Daily Events a user can resolve per day.
- [0003 — Settings: route vs modal](./0003-settings-modal-vs-route.md) — *Accepted* — settings lives at a dedicated `/settings` route.
- [0004 — Bytes ledger and migration policy](./0004-bytes-ledger-and-migration-policy.md) — *Accepted* — append-only `byte_transactions` ledger with idempotency via unique constraint, Supabase CLI for forward-only migrations.
- [0005 — Vercel Cron sync policy](./0005-vercel-cron-sync-policy.md) — *Accepted* — every 15 min, one `credit_bytes_tx_batch` per user, `CRON_SECRET`-gated route handler, idempotency via the same unique constraint.
- [0006 — Anti-cheese filter scope for the Public Alpha](./0006-anti-cheese-filters-scope.md) — *Accepted* — bot rejection (pure) + daily 100-byte cap on `github_sync`; four other filters explicitly deferred with criteria for when they land.
- [0007 — LGPD: account export and deletion](./0007-lgpd-account-export-and-deletion.md) — *Accepted* — hard delete via auth cascade, JSON export, audit trail.
- [0008 — Analytics: server-side events only](./0008-analytics-server-side-events.md) — *Accepted* — typed `track()` into `analytics_events`, no third-party analytics, session end via beacon.

## Template

Copy to `NNNN-short-title-in-kebab.md`:

```markdown
# ADR NNNN — <title>

- **Status:** Proposed | Accepted | Deprecated | Superseded by ADR XXXX
- **Decision:** <final decision or TBD with deadline>
- **Related:** <links to other ADRs, issues, external resources>
- **Date:** YYYY-MM-DD

## Context

<the problem, the constraints, what's at stake>

## Options considered

### Option A — <name>

<description>

**Pros:** ...
**Cons:** ...

### Option B — <name>

(same)

## Decision

<which option, or TBD with decision criteria>

## Consequences

<what changes in code, in process, in other ADRs>
```

> **Note:** the long-form design document is kept private as an internal artifact. ADRs in this directory contain the architectural context relevant to readers of the public repo. Each ADR is intended to be self-contained.
