-- Migration: grant_table_access
--
-- Context: the Supabase project was created with the "Automatically expose
-- new tables and functions" toggle DISABLED. That toggle, when enabled,
-- grants table privileges to anon/authenticated/service_role on every newly
-- created table. We disabled it so that exposure is opt-in — but that means
-- we now have to grant access explicitly here.
--
-- Two layers of authorization apply on every query:
--   1. Table-level GRANT: does this role have permission to talk to the
--      table at all? (Postgres rejects with "permission denied" if not.)
--   2. RLS policy: which rows can this role see/modify?
--
-- service_role bypasses RLS layer 2, but still needs layer 1 grants — that
-- is the cause of the integration test failure ("permission denied for
-- table users"). This migration fixes it.

-- =====================================================================
-- service_role — full CRUD on every game table.
-- =====================================================================
-- Used by: Vercel Cron (GitHub sync), the public profile endpoint
-- (ADR 0001), and the credit_bytes_tx() SECURITY DEFINER function.
grant all on table public.users               to service_role;
grant all on table public.byte_transactions   to service_role;
grant all on table public.github_sync_state   to service_role;

-- =====================================================================
-- authenticated — narrowly scoped, RLS still gates per-row visibility.
-- =====================================================================
-- A signed-in user can read and update their own users row (RLS policy
-- `users_select_own` and `users_update_own` enforce auth.uid() = id), and
-- read their own byte ledger. Writes to byte_transactions are intentionally
-- forbidden — clients never mint bytes; the server does, via credit_bytes_tx.
grant select, update on table public.users             to authenticated;
grant select          on table public.byte_transactions to authenticated;

-- github_sync_state is internal plumbing. Even authenticated users never
-- need to read it from the client; the materialised users.bytes is enough
-- for the UI. No grant.

-- =====================================================================
-- anon — no direct access to game tables.
-- =====================================================================
-- Public profile pages do not query as anon; they go through the isolated
-- `/api/u/[login]` server endpoint that uses service_role under a strict
-- column whitelist (ADR 0001). Granting nothing here keeps that invariant
-- enforceable: any future code that tries to read game tables as anon will
-- fail loudly, not silently leak.
