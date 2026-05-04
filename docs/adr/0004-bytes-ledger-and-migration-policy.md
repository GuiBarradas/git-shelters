# ADR 0004 — Bytes ledger schema and migration policy

- **Status:** Accepted
- **Decision:** Persist player bytes in an **immutable append-only ledger** (`byte_transactions`) with a unique idempotency constraint. Schema lives under **versioned, forward-only SQL migrations** managed by the Supabase CLI. The Public Alpha ships only the tables strictly needed for the byte loop; everything else is documented but not created.
- **Related:** [ADR 0001](./0001-public-profile-rls-strategy.md) (RLS strategy), [ADR 0002](./0002-daily-event-resolution-cardinality.md) (Daily Event cardinality)
- **Date:** 2026-05-04

## Context

The Public Alpha credits the player with **Bytes** — the in-game currency — based on real GitHub activity. Up to this point, byte counting has been computed per-request from a live GitHub API call. That stops working the moment we want any of:

- Persistence across reloads (today's "1 byte" is tomorrow's "0 bytes" with no memory).
- Anti-cheese filters that mutate state (a byte once credited stays credited, even if the upstream event is later filtered).
- Catch-up over arbitrary offline windows (need to know what was already credited).
- Eventual public profile pages (per ADR 0001) that read from a stable source, not a third-party API on every request.
- Idempotent re-sync (a cron retry cannot double-credit).

We need a schema. The schema decisions below have second-order effects (recruiter signal, auditability, anti-fraud surface), so they justify an ADR rather than just a migration commit message.

## Options considered

### Source of truth for byte balance

**A — Update `users.bytes` directly on each event.**
Simple write. No history. Bug → silent drift. Idempotency hard (need to track applied event IDs somewhere anyway).

**B — Append-only ledger (`byte_transactions`); `users.bytes` is a denormalized cache.**
Each credit is a row. Balance is the sum (or maintained via trigger / `SECURITY DEFINER` function). History intact. Idempotency = unique constraint on `(user_id, source, source_ref)`. Auditable.

**C — Event store with projections.**
Full event-sourcing. Overkill for a solo-dev idle game.

→ **Decision: B.** History matters for anti-cheese investigation (was this byte credited on a now-deleted commit?), for catch-up (read backwards from `last_synced_at`), and for the recruiter signal of "this dev thought about correctness". `users.bytes` is updated atomically inside the same `SECURITY DEFINER` function that inserts the row, so reads stay O(1).

### Idempotency strategy

**A — Application-level dedup** (caller checks "did I already credit this commit?").
Race-prone. Two cron retries arriving 200 ms apart both pass the check, both insert.

**B — Database-level unique constraint** on `(user_id, source, source_ref)`.
The database enforces it under any concurrency. Conflicts surface as a recoverable error (`ON CONFLICT DO NOTHING` or 23505 SQLSTATE).

→ **Decision: B.** No bug at this layer is recoverable in production — picking the strongest available guarantee is the only defensible call. The cost is one composite index.

### `source` taxonomy

`source` is a `text` field on each row that names where the credit came from. The Public Alpha uses these values:

| `source` | When it fires | `source_ref` |
|---|---|---|
| `github_sync` | A GitHub PushEvent crediting commits | `push_id` from the GitHub event payload |
| `github_backfill` | The 30-day backfill at first connection | `push_id` (same as above; the constraint dedups against future syncs) |
| `daily_event` | A Daily Event resolved by the player | `daily_event_outcomes.id` (UUID) |
| `room_build` | A negative entry when the player builds a room | `rooms.id` (UUID) |
| `manual_grant` | Reserved for migration/admin one-offs | Free-form audit string |

`source` is a free `text` (not enum) deliberately — adding a new source in a future release should be a no-op SQL change, not a `ALTER TYPE` ceremony. We document the taxonomy here and revisit if it sprawls.

### Retention policy

The ledger is **immutable**. No row is ever deleted from `byte_transactions` for any business reason — not rollback, not "fix bug, recredit", not anything. To reverse a credit, insert a compensating row with negative `delta`. This preserves the audit trail.

Two exceptions:

1. **LGPD account deletion** — when the player exercises their right to erasure (per GDD §20), the user's row is soft-deleted (`users.deleted_at`). A scheduled job (out of scope of the Public Alpha) will eventually anonymize linked rows by setting `byte_transactions.user_id = NULL`. The credit history stays for fraud forensics; identifiability is removed.
2. **Test data** — local development seeds may be wiped via `supabase db reset`. Production data is never wiped.

### Migration tooling

**A — Hand-rolled SQL files in `db/migrations/`, applied via `psql`.**
Cheap. No tooling. No schema diff, no remote reset, no TypeScript types.

**B — Supabase CLI (`supabase migration new`, `supabase db push`).**
Standard. Timestamped filenames, `supabase db reset` (local), `supabase db push` (remote), `supabase gen types typescript` for free TS types from the live schema. Local dev needs Docker.

→ **Decision: B, without Docker.** Trade-off: no local DB. We work directly against the remote development project (`zafrilgndutkjkaoqzzr.supabase.co`) until a `staging` project is needed. The cost (no offline dev) is acceptable for a solo dev — the upside (CLI ergonomics, schema drift detection, generated types) is high.

### Migration policy

- **Forward-only in the Public Alpha.** No `down.sql`. Pre-launch, the database is treated as experimental and resettable. After v1.0 ships, every migration must be backward-compatible with the deployed code at the moment of apply (add nullable column → deploy code → backfill → tighten constraint, in three migrations across three deploys).
- **RLS is enabled in the same migration that creates the table.** A table without RLS is treated as a bug and rejected at code review.
- **Seed data lives in `supabase/seed.sql`,** not migrations. Migrations describe schema, seeds describe content.

## Decision summary

The Public Alpha schema, in the order it will be created:

1. `users` — denormalized cache of `auth.users` plus `bytes` and `last_seen_at`. Trigger on `auth.users` insert creates the corresponding row.
2. `byte_transactions` — immutable ledger. `unique(user_id, source, source_ref)`. RLS denies INSERT/UPDATE/DELETE except via the `credit_bytes_tx()` `SECURITY DEFINER` function.
3. `github_sync_state` — one row per user. Tracks `last_synced_at`, last GitHub event cursor, backfill status.

**Not in the Public Alpha** (deferred to later iterations, intentionally):

- `regions`, `user_regions` — region selection lives entirely in client memory until a 2nd region exists.
- `bunkers`, `rooms` — first room construction is a separate phase.
- `forks`, `daily_events_*` — different phases.
- `oauth_tokens` table — OAuth tokens stay in Supabase Auth's own tables (`auth.identities`); we do not duplicate.

## Consequences

- The first migration after this ADR is `<timestamp>_init_users.sql` (and the `on_auth_user_created` trigger).
- The second is `<timestamp>_init_byte_transactions.sql` plus the `credit_bytes_tx()` function.
- The third is `<timestamp>_init_github_sync_state.sql`.
- An integration test (Vitest + a real Supabase test DB or a postgres-js mock) asserts that `credit_bytes_tx()` is idempotent: calling it twice with the same `(user_id, source, source_ref)` returns the same `balance_after` and creates exactly one row.
- TypeScript types are generated from the schema via `pnpm db:types` and committed to `src/lib/supabase/database.types.ts`.
- Each `source` value used in code lives in a single TS const (e.g., `BYTE_SOURCES.GITHUB_SYNC`) so the taxonomy in this ADR has one mirror in code.
- A future migration that adds a `source` value updates this ADR's taxonomy table.
- Future ADRs needed: `0005-vercel-cron-sync` (idempotency under retry), `0006-anti-cheese-filters` (when the filter list grows), `0007-lgpd-deletion-job` (the actual anonymization job).

## Errata

### 2026-05-04 — GRANTs must accompany every CREATE TABLE

The first batch of migrations created RLS-protected tables but did not include explicit `GRANT` statements. With the project-level "Automatically expose new tables and functions" toggle disabled (a deliberate security choice), the absence of grants caused `service_role` queries to fail with `permission denied for table users` — bypassing RLS is not the same as having a table-level grant.

A patch migration (`20260504062751_grant_table_access.sql`) repaired the existing tables. From this errata onward, **every migration that creates a table must include the appropriate `GRANT` statements in the same file**, mirroring the rule already in place for RLS:

| Role | Default privilege |
|---|---|
| `service_role` | `grant all` — full access; used by `SECURITY DEFINER` functions and the public-profile endpoint (ADR 0001) |
| `authenticated` | narrowly scoped per-table — RLS still gates rows, but a grant is required to talk to the table at all |
| `anon` | no grant — only the isolated `/api/u/[login]` endpoint reads as anon, via service_role |

### 2026-05-04 — Observability layer: Sentry installed before any deploy

Production-bound systems without observability are systems you debug by guessing. Sentry was installed before the Vercel Cron / public deploy work because the cron is exactly the failure mode that hides without alerting (silent rate-limit, expired token, race in `last_synced_at`).

Layout:

| File | Purpose |
|---|---|
| `sentry.client.config.ts` | Browser SDK init — DSN exposed, sampling, replay-on-error |
| `sentry.server.config.ts` | Node runtime SDK init — server components, route handlers, server actions, and the proxy (`src/proxy.ts`, which runs on Node in Next 16, not on the edge) |
| `instrumentation.ts` | Next 13.4+ entrypoint; only the Node branch is wired (no edge runtime in this project) |
| `next.config.ts` | Wrapped with `withSentryConfig` for build-time sourcemap upload |
| `src/app/global-error.tsx` | Last-resort boundary — catches root-layout crashes |
| `src/app/error.tsx` | Route-level error boundary — reports + tone-appropriate UI |

End-to-end pipeline validated against a Server Component throw: error rendered the in-world error UI, propagated to Sentry, surfaced as a new issue in the dashboard within seconds. Sanity-test route deleted post-validation.

> **Erratum within this entry, 2026-05-04:** an earlier draft of this section claimed `sentry.edge.config.ts` was needed because `src/proxy.ts` runs on the edge. In Next 16 the proxy file convention runs on **Node**, and the project does not opt any Route Handler into `runtime: 'edge'`. The edge config was vestigial; it has been deleted and the corresponding branch in `instrumentation.ts` removed.

### 2026-05-04 — `credit_bytes_tx` refinements after mentor review

A follow-up migration (`20260504064900_replace_credit_bytes_tx.sql`) replaces the original function with three corrections:

1. **Drop the `DELETE FROM byte_transactions` recovery branch.** It violated the immutable-ledger invariant declared in this ADR. Postgres aborts the function transaction on `RAISE`, so the manual delete was both redundant and a documentation contradiction. Replaced by `RAISE EXCEPTION` only.
2. **Document the atomicity assumption.** The two-step `balance_after` flow (placeholder `0` on insert, real value on backfill) is atomic only because the function body runs in a single implicit Postgres transaction. A comment now flags the wrapping pattern that would break this.
3. **Document the historical-balance return on conflict.** When the unique constraint dedups a duplicate call, the returned `balance_after` is the value from the *original* credit, not the live `users.bytes`. Inline comment clarifies this so a future UI surface does not misinterpret it.

A negative integration test (`tests/integration/credit-bytes-tx.test.ts`) asserts that anonymous clients cannot RPC the function — guard against accidental REGRANT in future migrations.
