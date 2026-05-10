-- Migration: init_credit_bytes_tx_batch
--
-- Per ADR 0005: a batched variant of credit_bytes_tx that accepts a JSON
-- array of (delta, source, source_ref) entries for a single user and
-- applies them in one round-trip.
--
-- Idempotency is unchanged from the single-row function: each entry's
-- INSERT into byte_transactions hits the same unique constraint, so
-- duplicates within the batch (or across batches, or against a previous
-- on-demand sync) are no-ops.
--
-- Failure mode: if any single credit raises (the user_id row vanished
-- mid-flight, for example), the entire batch's transaction rolls back.
-- The caller treats it as a transient error and retries the cron run.
-- The unique constraint makes the retry safe.

create or replace function public.credit_bytes_tx_batch(
  p_user_id uuid,
  p_credits jsonb
) returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_credit         jsonb;
  v_balance_after  bigint;
begin
  -- Validate shape: must be a JSON array. Empty array is allowed
  -- (no-op return of the user's current balance).
  if jsonb_typeof(p_credits) <> 'array' then
    raise exception 'credit_bytes_tx_batch: p_credits must be a jsonb array, got %', jsonb_typeof(p_credits);
  end if;

  -- Take a row lock on the user. Two concurrent batches for the same
  -- user serialise here. Across different users, batches run in
  -- parallel — the lock scope is the smallest that prevents race
  -- conditions on users.bytes reads inside this batch.
  perform 1
    from public.users
   where id = p_user_id
   for update;

  if not found then
    raise exception 'credit_bytes_tx_batch: user % not found', p_user_id;
  end if;

  -- Iterate the array. Each call hits the unique constraint
  -- independently; duplicates within p_credits are rejected by the
  -- ON CONFLICT in credit_bytes_tx and treated as no-ops.
  for v_credit in select * from jsonb_array_elements(p_credits)
  loop
    v_balance_after := public.credit_bytes_tx(
      p_user_id,
      (v_credit ->> 'delta')::bigint,
      v_credit ->> 'source',
      v_credit ->> 'source_ref'
    );
  end loop;

  -- If the array was empty, fetch the current balance to return.
  -- Otherwise v_balance_after holds the post-state of the last credit.
  if v_balance_after is null then
    select bytes into v_balance_after from public.users where id = p_user_id;
  end if;

  return v_balance_after;
end;
$$;

comment on function public.credit_bytes_tx_batch(uuid, jsonb) is
  'Batched idempotent byte credit. Returns balance_after of the last entry '
  '(or current balance if the batch was empty). Service-role only.';

-- =====================================================================
-- Lockdown
-- =====================================================================

revoke execute on function public.credit_bytes_tx_batch(uuid, jsonb)
  from public, anon, authenticated;
grant  execute on function public.credit_bytes_tx_batch(uuid, jsonb)
  to service_role;
