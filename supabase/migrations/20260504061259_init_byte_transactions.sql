-- Migration: init_byte_transactions
-- Immutable append-only ledger. See ADR 0004 for the rationale (idempotency,
-- retention, source taxonomy).

-- =====================================================================
-- Table
-- =====================================================================

create table public.byte_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  -- Positive credits or negative spends; total balance is materialised on
  -- public.users.bytes and reconciled in credit_bytes_tx().
  delta         bigint not null,
  -- Free-text taxonomy. ADR 0004 lists the values used in the Public Alpha.
  -- Free text rather than enum so adding a new source is a no-op SQL change.
  source        text not null,
  -- Stable dedup key per source. Required (NOT NULL) because the unique
  -- constraint relies on it: in Postgres, NULL ≠ NULL, so a nullable
  -- column would let duplicate (user, source, NULL) rows slip through.
  source_ref    text not null,
  -- Snapshot of users.bytes immediately after this row was applied.
  -- Lets a reader reconstruct any historical balance without summing.
  balance_after bigint not null,
  created_at    timestamptz not null default now(),

  -- The idempotency guarantee. Re-applying the same source event yields a
  -- 23505 (unique_violation) at the database, which the writer handles as
  -- "already credited; no-op". Zero application-level race window.
  unique (user_id, source, source_ref)
);

-- Catch-up reads scan recent transactions for a user, newest first.
create index byte_transactions_user_created_idx
  on public.byte_transactions (user_id, created_at desc);

-- =====================================================================
-- RLS
-- =====================================================================

alter table public.byte_transactions enable row level security;

create policy "byte_transactions_select_own"
  on public.byte_transactions for select
  using (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE: deliberately no policies => denied for every client.
-- The only writer is credit_bytes_tx() (added in a later migration), which
-- runs SECURITY DEFINER and writes the row + updates users.bytes atomically.
-- This forces all balance changes through a single, auditable code path.
