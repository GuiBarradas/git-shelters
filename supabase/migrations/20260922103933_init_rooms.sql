-- Migration: init_rooms
--
-- Bunker rooms for the Public Alpha: one floor, slots 1..3 buildable.
-- Slot 0 (Main Branch) is free and always present, so it is not stored —
-- the client renders it unconditionally. Only paid rooms live here.
--
-- Spending goes through the same ledger as crediting (ADR 0004): build_room()
-- debits via credit_bytes_tx() with source = 'build', so users.bytes stays
-- the single materialised balance and every byte movement is auditable.

-- =====================================================================
-- Table
-- =====================================================================

create table public.rooms (
  user_id  uuid     not null references public.users(id) on delete cascade,
  slot     smallint not null check (slot between 1 and 3),
  kind     text     not null check (kind in ('cache_storage', 'power_plant')),
  level    smallint not null default 1,
  built_at timestamptz not null default now(),
  primary key (user_id, slot)
);

-- =====================================================================
-- RLS + grants (opt-in exposure, see grant_table_access migration)
-- =====================================================================

alter table public.rooms enable row level security;

create policy "rooms_select_own"
  on public.rooms for select
  using (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE: no policies => denied for every client.
-- The only writer is build_room() below (SECURITY DEFINER).

grant all    on table public.rooms to service_role;
grant select on table public.rooms to authenticated;

-- =====================================================================
-- build_room(): atomic "check balance → insert room → debit ledger"
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
  -- Costs are authoritative here. src/lib/rooms/catalog.ts mirrors them
  -- for display only; if they drift, the database wins.
  v_cost := case p_kind
    when 'cache_storage' then 50
    when 'power_plant'   then 80
  end;
  if v_cost is null then
    raise exception 'build_room: unknown kind %', p_kind;
  end if;

  -- Row lock serialises concurrent builds for the same user, so two
  -- clicks racing on the last affordable room cannot both pass the
  -- balance check. credit_bytes_tx() below re-locks the same row inside
  -- this transaction, which is a no-op.
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
  'Raises insufficient_bytes / slot_occupied. Returns the new balance. '
  'Service-role only.';

revoke execute on function public.build_room(uuid, smallint, text)
  from public, anon, authenticated;
grant  execute on function public.build_room(uuid, smallint, text)
  to service_role;
