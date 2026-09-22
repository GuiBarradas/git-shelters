-- Migration: init_resources
--
-- Cache (food) and Uptime (power), the two room-produced resources from
-- the design doc §4/§5. No scheduler: the simulation is a pure function
-- run when the player shows up (catch-up offline, §10.3.1), and this
-- migration only stores its result. Bytes stay in the ledger; these two
-- are plain columns because they are not money and never need auditing.

alter table public.users
  add column cache        integer     not null default 40,
  add column uptime       integer     not null default 100,
  add column last_tick_at timestamptz not null default now();

-- =====================================================================
-- apply_tick(): write a simulation result exactly once
-- =====================================================================
--
-- Two concurrent renders both compute the same tick from the same
-- last_tick_at; only the first write wins because the UPDATE is guarded
-- by the value it read. The loser gets false and simply re-reads.

create or replace function public.apply_tick(
  p_user_id       uuid,
  p_expected_tick timestamptz,
  p_new_tick      timestamptz,
  p_cache         integer,
  p_uptime        integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows integer;
begin
  update public.users
     set cache        = greatest(0, p_cache),
         uptime       = least(100, greatest(0, p_uptime)),
         last_tick_at = p_new_tick
   where id = p_user_id
     and last_tick_at = p_expected_tick
     and p_new_tick > p_expected_tick;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

revoke execute on function public.apply_tick(uuid, timestamptz, timestamptz, integer, integer) from public, anon, authenticated;
grant  execute on function public.apply_tick(uuid, timestamptz, timestamptz, integer, integer) to service_role;

-- =====================================================================
-- assign_fork(): move a survivor to a room the player owns
-- =====================================================================

create or replace function public.assign_fork(
  p_user_id uuid,
  p_fork_id uuid,
  p_slot    smallint
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_slot <> 0 and not exists (
    select 1 from public.rooms where user_id = p_user_id and slot = p_slot
  ) then
    raise exception 'room_not_built';
  end if;

  update public.forks
     set room_slot = p_slot
   where id = p_fork_id
     and user_id = p_user_id;
  if not found then
    raise exception 'fork_not_found';
  end if;
end;
$$;

revoke execute on function public.assign_fork(uuid, uuid, smallint) from public, anon, authenticated;
grant  execute on function public.assign_fork(uuid, uuid, smallint) to service_role;
