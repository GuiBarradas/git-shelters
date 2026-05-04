-- Migration: init_github_sync_state
-- One row per user, tracking the GitHub events sync cursor and backfill state.
-- Read and written exclusively by server-side code (SECURITY DEFINER fn or
-- service-role). RLS denies all client access by default.

-- =====================================================================
-- Table
-- =====================================================================

create table public.github_sync_state (
  user_id         uuid primary key references public.users(id) on delete cascade,
  -- Last time a sync run completed successfully for this user.
  last_synced_at  timestamptz,
  -- Cursor for the GitHub events API. We persist the most recent event id
  -- we have already credited, so the next sync skips past it.
  last_event_id   text,
  -- Lifecycle of the initial 30-day backfill.
  -- Values: 'pending' | 'in_progress' | 'done' | 'failed'.
  -- text rather than enum for the same reason as byte_transactions.source.
  backfill_status text not null default 'pending',
  -- Timestamp of when the backfill state last changed; lets a watchdog
  -- detect 'in_progress' rows that have been stuck for hours.
  backfill_at     timestamptz default now()
);

-- Watchdog query: find sync states stuck in_progress.
create index github_sync_state_inprogress_idx
  on public.github_sync_state (backfill_at)
  where backfill_status = 'in_progress';

-- =====================================================================
-- RLS
-- =====================================================================

alter table public.github_sync_state enable row level security;

-- No policies. All access denied for clients (anon and authenticated).
-- The Vercel Cron runner (introduced in Phase 3.5) uses the service-role
-- key, which bypasses RLS, to read/write this table. The frontend never
-- needs direct access — it reads the materialised users.bytes instead.
