# ADR 0007 — LGPD: account export and deletion

- **Status:** Accepted
- **Decision:** Hard delete through the auth cascade, JSON export through one service-role function, both audited in a table that survives the user.
- **Related:** [ADR 0001](./0001-public-profile-rls-strategy.md), [ADR 0003](./0003-settings-modal-vs-route.md), [ADR 0004](./0004-bytes-ledger-and-migration-policy.md)
- **Date:** 2026-09-22

## Context

Brazil's LGPD (art. 18) gives every user the right to obtain a copy of their data and to have it eliminated. The GDPR says the same. A public launch without both controls is a legal blocker, not polish, so the Public Alpha ships them before the landing page.

The data involved is small and fully known: one `users` row, the byte ledger, rooms, Daily Event outcomes and the GitHub sync cursor. Sign-in identities live in Supabase's `auth` schema. No GitHub token is stored anywhere in our tables; Supabase holds the OAuth identity, and the public events feed needs no token at all.

## Options considered

### Deletion

**A — Soft delete: set `users.deleted_at`, keep the rows.**
Cheap, reversible, and the column already exists. But the data is still there, which is not elimination. Every reader (cron, profile, exports) has to remember the flag forever. A leak of the database leaks "deleted" users too.

**B — Hard delete through `auth.admin.deleteUser`.**
Removing the `auth.users` row cascades into `public.users` and from there into every game table by foreign key. The OAuth identity goes with it. One call, nothing to remember, nothing left to leak. Irreversible, which is what the law asks for.

**C — Hard delete of game tables, keep the auth row.**
Halfway: the person could sign in again into an empty bunker. Confusing, and the identity row is itself personal data.

→ **Decision: B.** `deleted_at` stays as a vestigial column; the profile check on it is harmless. If a soft-delete grace period is ever wanted, that becomes a new ADR.

### Export

**A — Client-side: the browser queries each table through RLS and assembles JSON.**
No server code, but four round-trips, and `github_sync_state` has no client policy by design.

**B — One server function with the service-role key, scoped to the authenticated user id.**
Same shape as ADR 0001: a single auditable place, explicit column lists, served as a download. Internal row ids are omitted because they identify rows, not the person.

→ **Decision: B.** `exportAccount` in `lib/api/account.ts`, served by `GET /api/account/export` with `Content-Disposition: attachment` and `Cache-Control: no-store`.

### Confirmation UX

A native `confirm()` dialog is invisible to tests and easy to click through. The delete form instead asks the user to type their GitHub login; the Server Action compares it against the session's login and does nothing on mismatch. The HTML `pattern` attribute gives the same check client-side for immediate feedback.

### Audit trail

`audit_log(user_id, action, meta_json, ip_hash, occurred_at)` with no foreign key on `user_id`, so the deletion row outlives the user. A bare uuid is not personal data once every table it pointed to is gone. `ip_hash` is reserved and unused; we do not touch IPs in the Public Alpha.

## Consequences

- Migration `init_audit_log`: table, index, RLS with no policies, `service_role` grant only.
- `lib/api/account.ts`: `exportAccount(admin, userId)` and `deleteAccount(admin, userId)`. Both write the audit row first.
- `app/api/account/export/route.ts` and `app/settings/actions.ts` (`deleteOwnAccount`) authenticate with the session client, then call the library with the admin client.
- `/settings` (ADR 0003, now accepted) hosts both controls. `/legal/privacy` and `/legal/terms` are static pages linked from a fixed footer on every route.
- No consent banner: the only cookie is the sign-in session, which is strictly necessary. When analytics lands, revisit.
- Integration test `tests/integration/account.test.ts` creates a throwaway auth user, plays a little, exports, deletes, and asserts every table is empty and the audit rows remain. This is the first suite with its own fixture instead of the maintainer's account.
- The privacy notice is written against the code. Any new data source changes the notice in the same PR.
