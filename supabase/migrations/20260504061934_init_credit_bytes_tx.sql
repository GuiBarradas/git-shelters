-- Migration: init_credit_bytes_tx
-- The single, auditable code path for crediting (or spending) bytes.
-- See ADR 0004 for the rationale on why every byte mutation goes through here.

-- =====================================================================
-- credit_bytes_tx
-- =====================================================================

-- Atomically:
--   1. Insert a row in byte_transactions (idempotent via unique constraint).
--   2. Update users.bytes by p_delta and capture the new balance.
--   3. Backfill balance_after on the inserted row.
--
-- On a duplicate (same user + source + source_ref), no insert and no update;
-- returns the existing row's balance_after.
--
-- Returns the balance_after value (current bytes after this credit).
create or replace function public.credit_bytes_tx(
  p_user_id    uuid,
  p_delta      bigint,
  p_source     text,
  p_source_ref text
) returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted_id   uuid;
  v_balance_after bigint;
begin
  -- Step 1: try to insert the ledger row. The unique (user_id, source,
  -- source_ref) constraint dedups against re-runs (cron retry, manual
  -- re-credit, double-click, etc.). balance_after is a placeholder
  -- because we don't know the new balance until the bytes update returns.
  insert into public.byte_transactions (
    user_id, delta, source, source_ref, balance_after
  )
  values (
    p_user_id, p_delta, p_source, p_source_ref, 0
  )
  on conflict (user_id, source, source_ref) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    -- Conflict: this credit was already applied. Return the historical
    -- balance_after so the caller knows the state at the time of the
    -- original credit. NB: this is not the *current* balance; the caller
    -- treats this return value as "no-op acknowledged".
    select balance_after
      into v_balance_after
      from public.byte_transactions
     where user_id    = p_user_id
       and source     = p_source
       and source_ref = p_source_ref;
    return v_balance_after;
  end if;

  -- Step 2: atomic mutation of users.bytes. Postgres acquires a row lock
  -- on this user's row, so concurrent calls on the same user serialise
  -- and the captured balance reflects every prior credit deterministically.
  update public.users
     set bytes        = bytes + p_delta,
         last_seen_at = now()
   where id = p_user_id
  returning bytes into v_balance_after;

  if v_balance_after is null then
    -- The FK from byte_transactions.user_id should make this unreachable,
    -- but defending: if the user row vanished mid-flight, undo the insert
    -- and raise. Caller treats as transient.
    delete from public.byte_transactions where id = v_inserted_id;
    raise exception 'credit_bytes_tx: user % not found', p_user_id;
  end if;

  -- Step 3: backfill the placeholder balance_after on the row we inserted.
  -- This is the post-state snapshot the ledger guarantees (ADR 0004).
  update public.byte_transactions
     set balance_after = v_balance_after
   where id = v_inserted_id;

  return v_balance_after;
end;
$$;

comment on function public.credit_bytes_tx(uuid, bigint, text, text) is
  'Idempotent byte credit. Returns balance_after. Service-role only.';

-- =====================================================================
-- Lockdown
-- =====================================================================

-- Default Postgres grants execute to PUBLIC, which includes anon and
-- authenticated roles. We revoke and re-grant only to service_role so the
-- frontend cannot call this function via RPC; only server-side code with
-- the service-role key can.
revoke execute on function public.credit_bytes_tx(uuid, bigint, text, text)
  from public, anon, authenticated;
grant  execute on function public.credit_bytes_tx(uuid, bigint, text, text)
  to service_role;
