# ADR 0006 — Anti-cheese filter scope for the Public Alpha

- **Status:** Accepted
- **Decision:** Two pure filters ship in the Public Alpha — **bot rejection** (events whose actor is a known automation account) and **daily cap** (no more than 100 bytes per UTC day from `source = github_sync`). Four other filters from the original wishlist are deferred with explicit reasoning.
- **Related:** [ADR 0004](./0004-bytes-ledger-and-migration-policy.md) (bytes ledger), [ADR 0005](./0005-vercel-cron-sync-policy.md) (sync policy)
- **Date:** 2026-05-04

## Context

The product premise is "your real GitHub activity feeds your bunker". The premise breaks the moment the cheapest path to bytes is *gaming the system* rather than coding. Anti-cheese filters defend the premise.

The original wishlist had six filters. Shipping all six on day one is wrong: each has a different cost, a different attack surface it closes, and a different rate of false positives. Some close exploits that don't exist yet because the feature they target hasn't shipped. Some require expensive extra API calls per event that explode the cron's GitHub rate-limit budget.

This ADR picks the two that pay rent now and defers the rest with criteria for when they should land.

## Filters in scope (ship now)

### 1. Bot rejection (pure, free)

Reject events whose `actor.login` matches a bot pattern: `*[bot]` suffix, or one of the well-known automation accounts (`dependabot`, `github-actions`, `renovate`, etc.). The check is a pure function over the event payload — no extra API call, no DB read, easy to TDD.

**Closes:** the most accessible vector — a user enables Dependabot or Renovate and harvests bytes from automated dependency-bump commits authored on their behalf.

**False positive cost:** ~zero. Bot logins follow a strict naming convention enforced by GitHub.

### 2. Daily cap on `github_sync` bytes (DB-aware)

No user can credit more than 100 bytes from `source = github_sync` in a single UTC day. Applied at the credit layer: before calling `credit_bytes_tx_batch`, the caller queries the user's already-credited `github_sync` bytes for today and truncates the pending credits so the daily total stays at or below the cap.

**Closes:** scripted force-push of fabricated commit history. A 1000-commit branch produces 100 bytes, not 1000.

**False positive cost:** the heaviest legitimate committer is brushing the cap on big commit days. Acceptable, and the cap can be raised once we have data on real distributions.

**Implementation note:** the cap is applied at the application layer rather than as a database constraint or a check inside `credit_bytes_tx`, because it is not a per-row property — it is a sum over a sliding daily window. Pushing it into Postgres would require either a window-function query inside the function (slow) or a maintained running-total column (denormalisation). Application-layer is cheaper and keeps `credit_bytes_tx` honest as a per-row primitive.

## Filters deferred (explicit reasoning)

### Whitespace-only / trivial-diff detection

**Defer.** Requires a per-commit diff API call (each commit's content is not in the events feed). For 30 events × N users × 4 cron runs/hour, that explodes the GitHub authenticated rate-limit (5000/hour) faster than any real exploit explodes byte balances. The vector it closes — `prettier --write && git commit -am "format"` farming — is real but small (1 byte per commit, cap protects in aggregate).

Lands when (a) user count justifies the API budget and (b) we observe the exploit in the wild.

### Repo-age × star-count weighting

**Defer.** Requires a per-repo metadata fetch per event, same rate-limit problem. The closed vector — fabricating dozens of throwaway repos and pushing one commit each — is closed in aggregate by the daily cap (the throwaway commits compete for the same 100-byte budget as real ones).

Lands when we add per-repo bonuses or repo-creation-as-event credits (today neither is in the schema).

### Self-star detection

**Defer indefinitely.** We do not credit `WatchEvent` (stars). The vector does not exist in the current schema. Reopens only if star credits land.

### External PR (10+ stars on target repo) requirement

**Defer indefinitely.** We do not credit `PullRequestEvent` against external repos in the Public Alpha. The vector — creating fake repos to swap PRs with a friend account — does not exist in the current schema. Reopens when external-PR credits land.

## Decision summary

- **`rejectBotEvents(events)`** — pure function in `src/lib/anti-cheese/`, TDD-tested. Runs inside `eventsToCredits` (or before, depending on the ergonomics) to filter `*[bot]` and listed automation accounts.
- **`applyDailyCap(credits, capRemaining)`** — pure function in `src/lib/anti-cheese/`, TDD-tested. Receives the proposed credits and the room left under the cap, returns the (possibly truncated) credits to forward to the batch RPC.
- **Caller of `applyDailyCap`** — the sync entrypoints (`syncBytes` server action, `/api/cron/sync` route handler) query today's `github_sync` total before calling the batch RPC, derive `capRemaining = 100 - today_total`, and apply the cap.
- **`GitHubEvent` type extended** with `actor.login` (already present in the GitHub API response, just not declared on our type).
- **`source` column on `byte_transactions`** unchanged (still `github_sync`). Filtered events never reach the ledger; capped credits are truncated, not flagged.
- **Bot list** lives in code (`src/lib/anti-cheese/bot-list.ts`) and is the source of truth. Adding a new bot pattern is a code change, not a config one — the change goes through review.

## Consequences

- Two new test files, both Vitest unit (no DB needed): `tests/unit/lib/anti-cheese/reject-bot-events.test.ts` and `tests/unit/lib/anti-cheese/apply-daily-cap.test.ts`.
- The cron handler and `syncBytes` both gain a "fetch today's `github_sync` total" query before the credit step. Cheap (one indexed lookup per user).
- A future ADR 0008 may revisit the deferred filters when the user count makes the API budget viable, or when an actual exploit is observed and mitigation is needed.
- Daily cap is not retroactive: a user who farmed bytes before this ADR keeps them. The cap only constrains *new* credits.
- The cap is per UTC day, not per local day. Users in extreme timezones may notice the boundary; this matches our analytics convention (everything is UTC-bucketed).
