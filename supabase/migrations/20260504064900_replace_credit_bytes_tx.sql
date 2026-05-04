-- Migration: replace_credit_bytes_tx
--
-- Refines credit_bytes_tx after mentor review:
--   1. Drop the DELETE-on-error path that violated the immutable-ledger
--      invariant from ADR 0004. Postgres aborts the function transaction
--      on RAISE, rolling back the INSERT automatically — the manual DELETE
--      was both redundant and a documentation contradiction.
--   2. Document the atomicity assumption around the two-step balance_after
--      backfill (placeholder 0 → real value).
--   3. Document that the value returned on conflict is *historical* and
--      should not be confused with the current balance.

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
  -- source_ref) constraint is the gate against duplicates: two concurrent
  -- callers with the same key race at the database, and only one wins.
  -- balance_after is a placeholder here — backfilled after step 2 returns
  -- the real post-state balance.
  insert into public.byte_transactions (
    user_id, delta, source, source_ref, balance_after
  )
  values (
    p_user_id, p_delta, p_source, p_source_ref, 0
  )
  on conflict (user_id, source, source_ref) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    -- Conflict path: this credit was already applied. The returned value
    -- is the *historical* balance_after captured at the time of the
    -- original credit — NOT the current balance of users.bytes. Callers
    -- that need the live balance must read users.bytes separately.
    -- This is fine for sync flows where the caller ignores the return,
    -- but UI code that surfaces it must be aware.
    select balance_after
      into v_balance_after
      from public.byte_transactions
     where user_id    = p_user_id
       and source     = p_source
       and source_ref = p_source_ref;
    return v_balance_after;
  end if;

  -- Step 2: atomic mutation of users.bytes. The row lock acquired by
  -- this UPDATE serialises concurrent callers on the same user, so the
  -- returned balance reflects every prior commit deterministically.
  update public.users
     set bytes        = bytes + p_delta,
         last_seen_at = now()
   where id = p_user_id
  returning bytes into v_balance_after;

  if v_balance_after is null then
    -- The FK from byte_transactions.user_id makes this unreachable in
    -- practice, but defend against schema drift / out-of-band auth.users
    -- deletion. RAISE aborts the function transaction; Postgres rolls
    -- back the INSERT automatically, preserving the immutable-ledger
    -- invariant from ADR 0004 (no rows ever deleted from byte_transactions).
    raise exception 'credit_bytes_tx: user % not found', p_user_id;
  end if;

  -- Step 3: backfill the placeholder balance_after on the row inserted
  -- in step 1.
  --
  -- ATOMICITY ASSUMPTION: the entire function body executes inside a
  -- single implicit transaction (PL/pgSQL default). Steps 1, 2, and 3
  -- commit together or all roll back — there is no observable state
  -- where a row exists with balance_after = 0. If a future caller
  -- wraps this function inside an explicit savepoint that is later
  -- released without committing the outer transaction, this invariant
  -- breaks. Document any such wrapping at call site.
  update public.byte_transactions
     set balance_after = v_balance_after
   where id = v_inserted_id;

  return v_balance_after;
end;
$$;

comment on function public.credit_bytes_tx(uuid, bigint, text, text) is
  'Idempotent byte credit. Returns balance_after (historical on conflict, '
  'current on success). Service-role only.';
