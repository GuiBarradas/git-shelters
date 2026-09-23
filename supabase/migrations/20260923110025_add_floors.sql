-- Floors (design doc §5.1, "the bunker has floors"). The ground floor
-- grows to four buildable slots (1..4) beside the Main Branch; a lower
-- floor adds five more (5..9), reachable only once an Elevator stands
-- somewhere on the ground floor. The gate lives here, next to the room
-- costs: the database decides what bytes buy and where.

alter table public.rooms drop constraint rooms_slot_check;
alter table public.rooms
  add constraint rooms_slot_check check (slot between 1 and 9);

alter table public.rooms drop constraint rooms_kind_check;
alter table public.rooms
  add constraint rooms_kind_check check (kind in ('cache_storage', 'power_plant', 'dorm', 'workshop', 'elevator'));

alter table public.forks drop constraint forks_room_slot_check;
alter table public.forks
  add constraint forks_room_slot_check check (room_slot between 0 and 9);

-- =====================================================================
-- build_room(): the Elevator costs 120; the lower floor needs one
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
    when 'elevator'      then 120
  end;
  if v_cost is null then
    raise exception 'build_room: unknown kind %', p_kind;
  end if;

  -- An elevator only makes sense on the ground floor; the lower floor
  -- only opens once one exists.
  if p_kind = 'elevator' and p_slot > 4 then
    raise exception 'elevator_ground_only';
  end if;
  if p_slot > 4 and not exists (
    select 1 from public.rooms where user_id = p_user_id and kind = 'elevator'
  ) then
    raise exception 'no_elevator';
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

comment on function public.build_room(uuid, smallint, text) is
  'Builds a room in an empty slot and debits its cost through the ledger. '
  'Raises insufficient_bytes / slot_occupied / no_elevator (slots 5..9 '
  'need an Elevator) / elevator_ground_only. Returns the new balance.';
