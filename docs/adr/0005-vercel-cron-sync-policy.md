## ADR 0005 — Vercel Cron sync policy

- **Status:** Accepted
- **Decision:** A Vercel Cron job hits an authenticated route handler every 15 minutes, pulls each user's recent public GitHub events, and credits bytes via a single batched RPC (`credit_bytes_tx_batch`) per user. The route is gated by a shared `CRON_SECRET`. Idempotency is the database's job — the unique constraint already established in [ADR 0004](./0004-bytes-ledger-and-migration-policy.md) keeps duplicate cron firings, retries, and overlaps with the on-demand "Sync" button safe by construction.
- **Related:** [ADR 0001](./0001-public-profile-rls-strategy.md), [ADR 0004](./0004-bytes-ledger-and-migration-policy.md)
- **Date:** 2026-05-04

## Context

Phase 3.3 left the project with bytes that only update when the user clicks "Sync". That is fine for proving the loop is wired, but it is not an idle game — by definition, an idle game makes progress while the player is away. The Public Alpha promises persistent state and a daily Daily Event; both depend on the server independently observing GitHub activity.

Vercel Cron is the cheapest serverless scheduler that integrates natively with the existing Next.js deploy and the Vercel free tier. The decisions below set its policy.

## Options considered

### How often does the cron fire?

**A — Every 1 minute.**
Maximum freshness. But: 60 invocations/hour × N users iterated × `fetch` to GitHub → easy way to burn through both the Vercel hobby plan's daily invocation cap and GitHub's 5000-req/hour authenticated rate limit if the user list grows.

**B — Every 15 minutes.**
4/hour × N users. Matches the GDD's polling cadence (§10.2). Player who pushes a commit at 14:00 sees the cube turn green by 14:15 at the latest — fast enough that the loop feels live, slow enough that headroom is real.

**C — On webhook only, no cron.**
GitHub webhooks would push events instantly. But: requires a public, authenticated webhook endpoint, signature verification, and replay protection. GDD §10.2 explicitly defers webhooks to post–Public Alpha. Cron is the bridge.

→ **Decision: B (every 15 minutes).** A user-facing "Sync now" button covers the impatient case (Phase 3.3, already shipped). The cron covers idle.

### How does the cron authenticate?

**A — Shared `CRON_SECRET` in a custom header.**
The standard Vercel pattern. Vercel injects an `Authorization: Bearer ${CRON_SECRET}` header on every cron invocation. The handler compares against the env var and 401s otherwise.

**B — Network-level allowlist.**
Restrict the route to Vercel cron source IPs. Brittle (IPs rotate), invisible to local testing, and Vercel does not advertise a stable list.

**C — No auth (route is public).**
Anyone with the URL can pulse the cron. Trivially weaponisable to drain the GitHub rate limit or trigger amplified writes against the database.

→ **Decision: A.** `CRON_SECRET` is generated once, lives in Vercel project env vars, and is mirrored in `.env.local` for local invocation tests. Never committed.

### How many round-trips per user?

**A — One `credit_bytes_tx` RPC per push event.**
What Phase 3.3 currently does. Simple. But: a user with 30 PushEvents in their backlog spawns 30 sequential RPCs, each round-trip ~50–150 ms against the remote DB. Cron times grow linearly with active users × backlog.

**B — One `credit_bytes_tx_batch(jsonb[])` RPC per user.**
A single round-trip carries all credits for that user as a JSON array. The function iterates inside Postgres, calling `credit_bytes_tx` per element. Idempotency unchanged (the same unique constraint applies row by row). N round-trips collapse to 1.

**C — One mega-RPC for all users in one call.**
Tempting, but conflates partial failure handling (one user's bad data should not bring down the others) and bloats the parameter payload past comfortable JSON sizes.

→ **Decision: B.** Per-user batching strikes the right granularity: one user's failure isolates to that user, payloads stay bounded by per-user activity.

### What if a cron run overlaps with another?

**A — Distributed lock per user (advisory lock or `select ... for update`).**
Maximum safety. Adds complexity and a failure mode (lock not released on crash).

**B — Trust the unique constraint.**
Two overlapping runs both attempt to insert the same `(user_id, source, source_ref)` rows. Only one wins per row; the others are no-ops via `ON CONFLICT DO NOTHING`. Done.

→ **Decision: B.** This is the second time the unique constraint pays off — and the third reason it was the load-bearing decision in ADR 0004. Locks would be a worse answer to the same problem.

### Does the cron read every user's full event stream every time?

**A — Yes, fetch the last 100 events per user every run.**
Simple. But: 100 events × 4 runs/hour = 400 fetches per active user per hour. Most are no-ops (already credited). Wasteful against GitHub's rate limit even when authenticated.

**B — Maintain a cursor in `github_sync_state.last_event_id` and fetch only events newer than it.**
GitHub's events API supports the `since` parameter and event IDs are monotonic. After the first sync, each subsequent run fetches only the delta.

→ **Decision: B for the long-term shape, A for the Public Alpha start.** Per-user cursor needs the events API helper, the column already exists (`github_sync_state.last_event_id` from ADR 0004), but wiring it cleanly is its own sub-chunk. Phase 3.5 ships **A with a hard `SYNC_FETCH_LIMIT` of 30 events per user**, and a follow-up issue tracks the migration to B before user count grows past ~50.

### Which users does the cron iterate?

**A — All users, every run.**
Simple. Scales linearly with total user count, including dormant accounts.

**B — Only users active in the last 7 days.**
Cheaper as the project matures. Requires a query against `users.last_seen_at` (which is already maintained by `credit_bytes_tx`).

→ **Decision: A in the Public Alpha.** Users will be measured in dozens, not thousands. When the count makes A wasteful, it is a one-line change to add a `where last_seen_at > now() - interval '7 days'` filter. Premature optimisation.

## Decision summary

- **Schedule:** `*/15 * * * *` (every 15 minutes).
- **Auth:** `Authorization: Bearer ${CRON_SECRET}`, env var only, never committed.
- **Granularity:** one `credit_bytes_tx_batch(jsonb)` call per user, all that user's pending credits in one array.
- **Concurrency:** unique constraint enforces idempotency; no application-level locks.
- **Fetch policy:** read the public events feed for each iterated user, capped at `SYNC_FETCH_LIMIT = 30` events. Cursor migration tracked as a follow-up.
- **User scope:** all users, no dormancy filter, until counts make it expensive.
- **Observability:** Sentry breadcrumbs at start/end of each cron invocation, plus per-user error capture without aborting the whole run.

## Consequences

- New migration `<timestamp>_init_credit_bytes_tx_batch.sql` adds the function and grants `EXECUTE` only to `service_role`.
- New route handler `app/api/cron/sync/route.ts` reads `CRON_SECRET`, paginates over `public.users`, fetches events per user, calls the batch RPC per user, captures per-user exceptions to Sentry without aborting.
- New env vars: `CRON_SECRET` (generated random) in `.env.local` and Vercel project settings.
- New `vercel.json` declares the cron schedule and the path.
- `app/sync/actions.ts` (the on-demand button server action) is refactored to call the same batch RPC, sharing the byte-mapping code with the cron handler. One source of truth for "given this user and these events, what credits should land".
- An integration test for `credit_bytes_tx_batch` mirrors the per-row idempotency test from ADR 0004's harness, plus a "partial failure" assertion (one bad row in the batch does not roll back the rest — or it does, depending on transaction shape; the test pins the behaviour).
- A follow-up task tracks migrating from `SYNC_FETCH_LIMIT=30` polling to cursor-based fetch using `github_sync_state.last_event_id`.
- Observability target: a Sentry breadcrumb timeline of "cron started → user N processed → cron ended" per run, surfacing latency and per-user failure counts. Alert threshold to be calibrated after first week.

## Errata anticipated

When the cursor migration lands, this ADR gets an erratum updating the "Fetch policy" line. When user counts grow large enough to make all-user iteration expensive, the dormancy filter gets its own erratum. Both are predictable evolutions, not pivots.

## Errata

### 2026-05-04 — Cursor-migration trigger metric

The original "Fetch policy" decision (§"Does the cron read every user's full event stream every time?") committed to `SYNC_FETCH_LIMIT = 30` for the Public Alpha and named cursor migration as a follow-up — but did not say *when* to migrate. That made the follow-up an item that quietly never got prioritised.

Concrete trigger: **migrate to cursor-based fetch when the cron observes any single user closing the `SYNC_FETCH_LIMIT` ceiling on ≥ 5% of the run's iterations over a rolling 24h window**, OR when the active-user count crosses ~10. Whichever fires first.

Operationalisation (no code yet, just intent): the cron handler can log a Sentry breadcrumb / metric tag when `events.length >= SYNC_FETCH_LIMIT` for a given user. Aggregating that signal weekly is enough to catch the trend before users start silently losing events. Until that signal fires, the simpler limit-based fetch keeps shipping.

### 2026-05-04 — Constant-time comparison on `CRON_SECRET`

The original auth check used a plain `!==` on the `Authorization` header. Strict-equality timing-attack surface against a 256-bit hex secret is theoretical, but the cost of `crypto.timingSafeEqual` is zero and matches industry baseline for cron auth. Updated to length-prefix-then-`timingSafeEqual` in `route.ts`. Behaviour unchanged for legitimate callers; closes the timing channel by construction.
