# ADR 0001 — RLS strategy for public profile pages `/u/<login>`

- **Status:** Proposed
- **Decision:** TBD — to be decided before implementing profile pages in the Public Alpha.
- **Date:** 2026-05-03

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

**TBD.** Current leaning is **Option B** (isolated API endpoint). To be decided before implementing profile pages in the Public Alpha.

Decision criteria:
- If the public dataset is **more than plain `users`** (and in the Public Alpha it already is — rooms + kudos count), Option B beats Option C on join simplicity.
- Option A only wins if maintaining a server-side endpoint per public page becomes prohibitive, which is not the case here.

## Consequences

- **Option B (likely):** add `lib/api/public-profile.ts` with a typed function that runs queries via service-role and returns a `PublicProfile` shape. The Next endpoint `GET /api/u/[login]` calls that function. Integration tests verify that sensitive fields never appear in the payload.
- **Regardless of choice:** a future LGPD-compliance ADR should link here — public profile must respect `users.deleted_at` (404 if deleted).
