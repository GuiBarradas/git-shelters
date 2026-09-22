-- Dorm (design doc §5.2): a room that adds beds. The bunker starts with
-- two beds on the Main Branch; every Dorm adds two more, and recruit_fork
-- refuses once the beds are full. The cap lives here, next to the room
-- costs, because the database is the authority on what bytes buy;
-- src/lib/forks/catalog.ts mirrors the numbers for the UI.

alter table public.rooms drop constraint rooms_kind_check;
alter table public.rooms
  add constraint rooms_kind_check check (kind in ('cache_storage', 'power_plant', 'dorm'));

-- =====================================================================
-- build_room(): the Dorm costs 100
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
-- recruit_fork(): no bed, no survivor
-- =====================================================================

create or replace function public.recruit_fork(
  p_user_id uuid,
  p_name    text,
  p_trait   text,
  p_cost    bigint
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bytes bigint;
  v_beds  integer;
  v_id    uuid;
begin
  if p_cost <= 0 then
    raise exception 'recruit_fork: cost must be positive';
  end if;

  -- The row lock also serialises two recruits racing for the last bed.
  select bytes into v_bytes from public.users where id = p_user_id for update;
  if not found then
    raise exception 'recruit_fork: user % not found', p_user_id;
  end if;

  if v_bytes < p_cost then
    raise exception 'insufficient_bytes';
  end if;

  select 2 + 2 * count(*) into v_beds
    from public.rooms
   where user_id = p_user_id and kind = 'dorm';
  if (select count(*) from public.forks where user_id = p_user_id) >= v_beds then
    raise exception 'no_beds';
  end if;

  insert into public.forks (user_id, name, trait, room_slot)
  values (p_user_id, p_name, p_trait, 0)
  returning id into v_id;

  perform public.credit_bytes_tx(p_user_id, -p_cost, 'recruit', v_id::text);
  return v_id;
end;
$$;

comment on function public.recruit_fork(uuid, text, text, bigint) is
  'Recruits a Fork for p_cost bytes, debited through the ledger with '
  'source = recruit. Raises no_beds (2 + 2 per Dorm) or insufficient_bytes. '
  'Service-role only.';
