---
status: ready (Phase 3 just shipped — material fresh)
target_publish: Friday after post 3
estimated_writing_time: 2.5h
source_material: bytes ledger schema + credit_bytes_tx + integration tests
---

# Post 4 — "Idempotent byte ledgers: how I made GitHub commits credit exactly once"

## Central thesis

When a side project's currency is "the user's real GitHub activity", the worst bug you can ship is double-crediting. A naive sync that retries on failure, or a cron job that overlaps with itself, will hand out free bytes faster than you can audit. The fix is not careful application code. It is a single line in a database migration: `unique (user_id, source, source_ref)`. The constraint becomes the gate; everything else is just plumbing around it.

## Why this post

- **It's exactly the kind of correctness story senior recruiters value.** "Here is the failure mode, here is the cheapest defense, here is the test that proves it." Concrete, contained, transferable.
- The architecture decision lives in [ADR 0004](../../docs/adr/0004-bytes-ledger-and-migration-policy.md) — the post can quote it and link.
- It teaches by example: append-only ledger, `SECURITY DEFINER` for the only mutation path, RLS that denies clients all writes, integration test that hits a real database.

## Suggested structure (1500–2000 words)

### Opening — the failure mode
- "Git Shelters is an idle game where commits, PRs, and issues you author on GitHub mint bytes you spend in-game. The day my cron retries credit the same commit twice is the day I have to audit, not iterate."
- Set up the obvious-but-wrong implementation: `update users set bytes = bytes + 1 where id = ?`. Show why retries break it.

### The reframing
- Treat byte history as an **append-only ledger**, not a counter.
- Every credit = a row. The current balance is materialised on `users.bytes` for cheap reads, but the row history is the source of truth.

### The single load-bearing line
- `unique (user_id, source, source_ref)` on `byte_transactions`.
- Show what `source` and `source_ref` mean: `('github_sync', 'push:33665324309')` for a GitHub push, `('daily_event', '<uuid>')` for a Daily Event resolution, etc.
- The constraint is enforced by Postgres, not the app. Two concurrent retries arrive 200 ms apart? They race at the database. One inserts. The other gets a `23505` (unique_violation) it can swallow.

### The function — INSERT first, UPDATE second
- The intuitive order (UPDATE the balance, then INSERT the audit row) has a race: two callers both observe `bytes = 100` and credit before either commits, leaving the second row with a stale `balance_after`.
- Inverting the order — `INSERT ... ON CONFLICT DO NOTHING RETURNING id` — uses the constraint as the gate. Only the winner reaches the UPDATE. Postgres row locks serialise the rest.
- Code excerpt of `credit_bytes_tx`. Comment on the atomicity assumption — the whole function is a single implicit transaction.

### Defense in depth
- RLS is enabled but provides ZERO write paths to clients on `byte_transactions`. The frontend cannot mint bytes even with a stolen anon key.
- `credit_bytes_tx` is `SECURITY DEFINER` — it runs as the table owner, bypassing RLS for the legitimate write. But `EXECUTE` is revoked from `public`, `anon`, `authenticated`, granted only to `service_role`. The function is unreachable from the browser.
- Integration test asserts the negative: anonymous clients calling the RPC get a permission error.
- This is the part recruiters actually care about — *every layer is a tripwire, and bypassing one does not bypass the rest*.

### The bug I shipped along the way
- I disabled "Auto-expose new tables and functions" in Supabase as a security choice. Then watched my service-role test fail with `permission denied for table users`.
- Bypassing RLS ≠ having a `GRANT`. Two distinct authorisation layers. The fix was a separate migration that explicitly granted access. The lesson — every `CREATE TABLE` migration includes its `GRANT`s — is now an erratum in the ADR.
- This is the most relatable kind of "I messed up and learned" content. Devs who have hit this exact issue will recognise it.

### The test that proves it
- Show the integration test against a real Supabase project. Snapshot/restore pattern, deterministic starting balance, `crypto.randomUUID()` in `source_ref` so reruns don't collide.
- Show the idempotency test specifically: two `credit_bytes_tx` calls with the same `(user_id, source, source_ref)` — second one returns the historical balance, no second row is inserted, `users.bytes` incremented exactly once.
- Pull quote from the assertion: `expect(second.data).toBe(107); // historical, NOT 114`.

### What the constraint costs
- One composite index (already needed for the dedup query path).
- A 23505 SQLSTATE that the application has to handle as a swallowable signal, not an error. ~3 lines of code.
- Honest accounting: cheap.

### The transferable rule
- Whenever your application has a mutation that *must* fire exactly once across retries, push the dedup down to the database. Application-level checks lose to concurrency. Constraints don't.

### Closing
- "The pure function from post 1 (`creditBytes`) decides what the credit *should* be. The schema from this post enforces that the credit *happens* exactly once. Together they let me lose sleep over different things."
- Link to next post (TBD — likely Vercel Cron + observability).

---

## Bluesky thread hooks (4–5 posts)

1. "When your game's currency is real GitHub activity, double-crediting is a fraud surface. Here's how I closed it with one line of SQL. 🧵"
2. "`unique (user_id, source, source_ref)` is the gate. Two concurrent retries race at the database, only one wins. No application-level check can match that under load."
3. "INSERT first, UPDATE second. The opposite order has a race that lets two callers credit balance from a stale read. Most idempotency bugs I see in the wild are the inverted version."
4. "Defense in depth: RLS denies all client writes. `EXECUTE` on the credit function is service-role only. Anon clients calling the RPC fail loudly. Negative test asserts it."
5. "Bonus: the bug I shipped along the way — bypassing RLS is NOT the same as having a `GRANT`. Two layers. [link to full post]"

## Visual

- Pulled quote of the unique constraint line, blown up.
- Snippet of `credit_bytes_tx` highlighting the INSERT-first ordering.
- Integration test pulled quote of the idempotency assertion.

## LinkedIn cross-post

YES — strong fit for the senior-recruiter US audience. "Defense in depth + integration test + ADR" reads as a portfolio paragraph by itself.

## What NOT to include

- The Supabase CLI setup story. That belongs in a different post about tooling.
- Vercel Cron specifics. That's the next post.
- Full ADR text. Link to it; do not inline.

## TODO before writing

- [ ] Pull the exact `credit_bytes_tx` source from `supabase/migrations/20260504064900_replace_credit_bytes_tx.sql`.
- [ ] Pull the exact assertion lines from `tests/integration/credit-bytes-tx.test.ts`.
- [ ] Decide on tone: more "post-mortem" or more "tutorial"? Tutorial reads better; post-mortem feels more honest. Lean post-mortem with tutorial-shaped sections inside.
