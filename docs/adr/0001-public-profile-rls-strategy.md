# ADR 0001 — RLS strategy for public profile pages `/u/<login>`

- **Status:** Accepted
- **Decision:** **Option B** — isolated API endpoint with service-role key + strict column whitelist + integration test promoted to CI gate.
- **Date:** 2026-05-03 (proposed) · 2026-05-04 (accepted)

## Context

The Public Alpha ships read-only public profile pages at `/u/<login>`. These pages need to display data from **another user's** bunker (rooms, public byte balance, kudos count) without the visitor being authenticated as the bunker's owner. This conflicts with the default RLS principle we adopted: SELECT only when `auth.uid() = user_id`.

We need to decide **how** these public reads happen without breaking the RLS model for private data (GitHub token, audit_log, etc.). The decision has implications for security, maintenance complexity, and PR review cost.

## Options considered

### Option A — Bent RLS policy with a `is_public_profile_lookup()` SQL helper

Create SQL functions `is_public_profile_lookup()` and `user_is_public_lookup(uid)` that verify (a) the caller is anonymous (no `auth.uid`), (b) the request came from an authorized path/context. SELECT policies on the relevant tables add `OR is_public_profile_lookup()`.

**Pros:**
- Keeps RLS as the single authorization layer — "defense in depth at the database" principle.
- Works with the public Supabase client on the front end (no proxy).

**Cons:**
- Hard to audit: "request came from authorized path" depends on custom headers or a JWT claim that the caller can forge if there's no upstream check.
- It compounds: every new public column becomes another policy exception.
- A policy bug = private data leak. High surface area.

### Option B — Isolated API endpoint with service-role key + strict column whitelist (current preferred direction)

A `GET /api/u/[login]` endpoint in Next.js uses the service-role key (RLS bypass) and returns **only** explicitly whitelisted columns: `users.github_login, users.created_at, users.region_id`, `rooms.room_type, rooms.level, rooms.position`, plus an aggregated `kudos_count`. Anything else is forbidden by construction (it's just not selected).

**Pros:**
- Authorization is testable TS code: `select('github_login, created_at, region_id')`. Code review catches obvious leaks.
- RLS stays restricted to `auth.uid() = id` on every table — simple model.
- Easy to audit: `git grep service_role` finds every bypass.
- Allows edge caching (`Cache-Control` public) without exposing private data.

**Cons:**
- Requires a dedicated endpoint per public page type. More code.
- The service-role key must live in the server environment (already required by any Next API architecture anyway).
- If the endpoint has a bug, RLS doesn't catch you — all the trust lives in the endpoint code.

### Option C — `users_public` VIEW exposed via open RLS

Create `VIEW users_public AS SELECT id, github_login, created_at, region_id FROM users` and grant public SELECT on it. The front end queries `users_public` directly via the Supabase client.

**Pros:**
- The schema is the source of truth for what's public. Hard to accidentally expose a new column.
- No custom endpoint — front end uses the Supabase client directly.

**Cons:**
- Works for plain `users` data but is awkward for data needing joins/aggregates (kudos, rooms per user).
- Double maintenance: schema changes → view must update.
- Mixes models (RLS blocks `users`, view opens a subset) — confusing for the next dev.

## Decision

**Option B accepted.** Isolated API endpoint `GET /api/u/[login]` using the Supabase service-role key (RLS bypass) with a strict, explicit column whitelist. Integration tests asserting that no sensitive field ever appears in the response are promoted to a **CI gate** (test failure blocks merge).

Decision criteria that drove the call:
- The public dataset is more than plain `users` (rooms + aggregated kudos count) — Option C is awkward for joins/aggregates.
- Option A's RLS-bent helpers fail silently on misconfiguration; Option B's whitelist failures are caught by TypeScript, code review, and tests.
- Option B is the only path that allows safe **edge caching** of public profiles (`Cache-Control: public, s-maxage=...`), which keeps Vercel free-tier sustainable under viral growth.
- Option B keeps the model simple as the project evolves toward a possible later anonymous-mode pivot.

## Defense-in-depth model under Option B

The isolated endpoint is one layer of four — bypassing RLS does **not** mean bypassing security:

1. **RLS** stays restricted to `auth.uid() = id` on every table. Anything not flowing through the public endpoint is fully protected.
2. **Service-role key** is server-only (Vercel env var, never bundled to client).
3. **Service-role usage** is funneled through a **single typed function** (`lib/api/public-profile.ts`) — auditable with `git grep service_role`.
4. **The function uses `.select(...)` with an explicit column whitelist**, so adding a sensitive column to a table does not implicitly expose it.

The CI integration test is the failsafe: if a future change accidentally widens the whitelist, the test fails before merge.

## Consequences

- Add `lib/api/public-profile.ts` with a typed `getPublicProfile(login: string): Promise<PublicProfile | null>` function. Returns `null` if the user does not exist or has `deleted_at` set (LGPD).
- Endpoint route at `app/api/u/[login]/route.ts` calls that function and returns JSON with `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600`.
- The page route `app/u/[login]/page.tsx` consumes the same function server-side (no double round trip).
- Integration test `tests/integration/public-profile-leak.test.ts` (or equivalent under Vitest with a Supabase mock or test container): asserts that the response payload, stringified, contains none of `email`, `github_token`, `auth_id`, `ip_hash`, or any column outside the documented whitelist. This test is part of the standard `pnpm test` run, which is required green for CI.
- A future LGPD-compliance ADR should link here — public profile must 404 when `users.deleted_at` is set.
- The whitelist of fields exposed by `getPublicProfile` is documented inline in `lib/api/public-profile.ts` and is the source of truth.
