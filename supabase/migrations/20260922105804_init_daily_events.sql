-- Migration: init_daily_events
--
-- Daily Event for the Public Alpha, per ADR 0002 Option A: one event per
-- user per UTC day, one decision with two outcomes, bytes credited through
-- the ledger (ADR 0004) with source = 'daily_event'.
--
-- Which event a user sees today is decided in SQL (pick_daily_event) so
-- the page and the resolve RPC cannot disagree, and so the client never
-- chooses which event it resolves.

-- =====================================================================
-- Catalog
-- =====================================================================

create table public.daily_events_catalog (
  id         text primary key,
  -- Rotation order. Day 0 after signup shows the lowest sort_order, so
  -- the FTUE event must be seeded with the smallest value.
  sort_order integer not null unique,
  title      text not null,
  narrative  text not null,
  -- { label, outcome_text, bytes_delta }
  option_a   jsonb not null,
  option_b   jsonb not null,
  active     boolean not null default true
);

alter table public.daily_events_catalog enable row level security;

create policy "daily_events_catalog_select_active"
  on public.daily_events_catalog for select
  to authenticated
  using (active);

grant all    on table public.daily_events_catalog to service_role;
grant select on table public.daily_events_catalog to authenticated;

-- =====================================================================
-- Outcomes log
-- =====================================================================

create table public.daily_event_outcomes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  event_id     text not null references public.daily_events_catalog(id),
  choice       text not null check (choice in ('a', 'b')),
  -- Snapshot of the option applied, so a later catalog edit does not
  -- rewrite history.
  outcome_json jsonb not null,
  resolved_at  timestamptz not null default now(),
  -- Generated rather than date(resolved_at) in the constraint: date() on a
  -- timestamptz depends on the session timezone and is not immutable.
  resolved_on  date not null generated always as
               ((resolved_at at time zone 'utc')::date) stored,
  -- ADR 0002 Option A: one resolution per user per UTC day, any event.
  unique (user_id, resolved_on)
);

create index daily_event_outcomes_user_resolved_idx
  on public.daily_event_outcomes (user_id, resolved_at desc);

alter table public.daily_event_outcomes enable row level security;

create policy "daily_event_outcomes_select_own"
  on public.daily_event_outcomes for select
  using (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE: no policies. resolve_daily_event() is the writer.

grant all    on table public.daily_event_outcomes to service_role;
grant select on table public.daily_event_outcomes to authenticated;

-- =====================================================================
-- pick_daily_event(): deterministic rotation
-- =====================================================================
--
-- Day N after signup shows the N-th active event (mod pool size), ordered
-- by sort_order. No randomness, so a refresh never changes today's event,
-- and a pool of P events repeats only after P days. Runs as the caller:
-- authenticated users can read their own users row and the active catalog.
--
-- ponytail: rotation ignores which events the user already resolved. Fine
-- while the pool is small and rotation is the only source; revisit when
-- events get eligibility conditions (ADR 0002 Option C).

create or replace function public.pick_daily_event(p_user_id uuid)
returns text
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with pool as (
    select id, row_number() over (order by sort_order) - 1 as idx,
           count(*) over () as n
      from public.daily_events_catalog
     where active
  ),
  day as (
    select ((now() at time zone 'utc')::date
            - (created_at at time zone 'utc')::date) as d
      from public.users
     where id = p_user_id
  )
  select pool.id
    from pool, day
   where pool.idx = (day.d % pool.n);
$$;

grant execute on function public.pick_daily_event(uuid) to authenticated, service_role;

-- =====================================================================
-- resolve_daily_event(): atomic "pick → log outcome → credit ledger"
-- =====================================================================

create or replace function public.resolve_daily_event(
  p_user_id uuid,
  p_choice  text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id text;
  v_option   jsonb;
  v_outcome  uuid;
  v_today    text := ((now() at time zone 'utc')::date)::text;
begin
  if p_choice not in ('a', 'b') then
    raise exception 'resolve_daily_event: invalid choice %', p_choice;
  end if;

  perform 1 from public.users where id = p_user_id for update;
  if not found then
    raise exception 'resolve_daily_event: user % not found', p_user_id;
  end if;

  v_event_id := public.pick_daily_event(p_user_id);
  if v_event_id is null then
    raise exception 'daily_event_pool_empty';
  end if;

  select case p_choice when 'a' then option_a else option_b end
    into v_option
    from public.daily_events_catalog
   where id = v_event_id;

  begin
    insert into public.daily_event_outcomes (user_id, event_id, choice, outcome_json)
    values (p_user_id, v_event_id, p_choice, v_option)
    returning id into v_outcome;
  exception when unique_violation then
    raise exception 'already_resolved_today';
  end;

  -- One ledger row per user per UTC day; the date is the natural key.
  perform public.credit_bytes_tx(
    p_user_id,
    (v_option ->> 'bytes_delta')::bigint,
    'daily_event',
    v_today
  );

  return v_option;
end;
$$;

comment on function public.resolve_daily_event(uuid, text) is
  'Resolves today''s Daily Event for the user with choice a|b, logs the '
  'outcome and credits bytes_delta through the ledger. Raises '
  'already_resolved_today / daily_event_pool_empty. Service-role only.';

revoke execute on function public.resolve_daily_event(uuid, text)
  from public, anon, authenticated;
grant  execute on function public.resolve_daily_event(uuid, text)
  to service_role;
