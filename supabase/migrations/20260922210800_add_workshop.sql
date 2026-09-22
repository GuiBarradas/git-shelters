-- Workshop (design doc §5.2): packs Payload, the ammunition combat will
-- spend. Payload is the third room-produced resource after Cache and
-- Uptime: a plain column, simulated by the same pure tick and written by
-- apply_tick(). Blueprints (§4.3) are not here yet; the Workshop packs
-- basic rounds without them.

alter table public.users
  add column payload integer not null default 0;

alter table public.rooms drop constraint rooms_kind_check;
alter table public.rooms
  add constraint rooms_kind_check check (kind in ('cache_storage', 'power_plant', 'dorm', 'workshop'));

-- =====================================================================
-- build_room(): the Workshop costs 150
-- =====================================================================

create or replace function public.build_room(
  p_user_id uuid,
  p_slot    smallint,
  p_kind    text
) returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cost  bigint;
  v_bytes bigint;
begin
  v_cost := case p_kind
    when 'cache_storage' then 50
    when 'power_plant'   then 80
    when 'dorm'          then 100
    when 'workshop'      then 150
  end;
  if v_cost is null then
    raise exception 'build_room: unknown kind %', p_kind;
  end if;

  select bytes into v_bytes
    from public.users
   where id = p_user_id
     for update;

  if not found then
    raise exception 'build_room: user % not found', p_user_id;
  end if;

  if v_bytes < v_cost then
    raise exception 'insufficient_bytes';
  end if;

  begin
    insert into public.rooms (user_id, slot, kind)
    values (p_user_id, p_slot, p_kind);
  exception when unique_violation then
    raise exception 'slot_occupied';
  end;

  -- ponytail: source_ref = slot assumes rooms are never demolished in the
  -- Public Alpha. When demolition exists, key the ref on the rooms row
  -- (e.g. slot || ':' || built_at) so a rebuild is not a ledger no-op.
  return public.credit_bytes_tx(p_user_id, -v_cost, 'build', p_slot::text);
end;
$$;

-- =====================================================================
-- apply_tick(): now stores Payload too
-- =====================================================================

drop function public.apply_tick(uuid, timestamptz, timestamptz, integer, integer);

create or replace function public.apply_tick(
  p_user_id       uuid,
  p_expected_tick timestamptz,
  p_new_tick      timestamptz,
  p_cache         integer,
  p_uptime        integer,
  p_payload       integer
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
         payload      = greatest(0, p_payload),
         last_tick_at = p_new_tick
   where id = p_user_id
     and last_tick_at = p_expected_tick
     and p_new_tick > p_expected_tick;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

revoke execute on function public.apply_tick(uuid, timestamptz, timestamptz, integer, integer, integer) from public, anon, authenticated;
grant  execute on function public.apply_tick(uuid, timestamptz, timestamptz, integer, integer, integer) to service_role;
