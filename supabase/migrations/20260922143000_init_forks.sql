-- Migration: init_forks
--
-- Forks are the survivors living in the bunker (design doc §6). This first
-- cut gives each one a name, a trait, a mood and a room, and nothing that
-- needs simulation yet: no stats, no jobs, no death. Enough to see someone
-- walking around and hear them talk.
--
-- Every account gets one starter Fork for free (ensure_starter_fork);
-- more are recruited for bytes through the ledger (recruit_fork).

create table public.forks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  name       text not null,
  -- One of the trait keys in src/lib/forks/catalog.ts. Free text so a new
  -- trait is a code change, not a migration.
  trait      text not null,
  mood       text not null default 'content',
  -- 0 = Main Branch, 1..3 = built rooms. Null = wandering the corridor.
  room_slot  smallint check (room_slot between 0 and 3),
  -- Deterministic look: the client derives skin/shirt/helmet from this.
  seed       integer not null default floor(random() * 2147483647)::integer,
  created_at timestamptz not null default now()
);

create index forks_user_idx on public.forks (user_id, created_at);

alter table public.forks enable row level security;

create policy "forks_select_own"
  on public.forks for select
  using (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE: no client policies. The two functions below write.

grant all    on table public.forks to service_role;
grant select on table public.forks to authenticated;

-- =====================================================================
-- ensure_starter_fork(): the free first survivor, idempotent
-- =====================================================================

create or replace function public.ensure_starter_fork(
  p_user_id uuid,
  p_name    text,
  p_trait   text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  -- Serialise on the user so two concurrent page renders cannot both
  -- decide the bunker is empty.
  perform 1 from public.users where id = p_user_id for update;
  if not found then
    raise exception 'ensure_starter_fork: user % not found', p_user_id;
  end if;

  select id into v_id from public.forks where user_id = p_user_id order by created_at limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.forks (user_id, name, trait, room_slot)
  values (p_user_id, p_name, p_trait, 0)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.ensure_starter_fork(uuid, text, text) from public, anon, authenticated;
grant  execute on function public.ensure_starter_fork(uuid, text, text) to service_role;

-- =====================================================================
-- recruit_fork(): pay bytes through the ledger, get a survivor
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
  v_id    uuid;
begin
  if p_cost <= 0 then
    raise exception 'recruit_fork: cost must be positive';
  end if;

  select bytes into v_bytes from public.users where id = p_user_id for update;
  if not found then
    raise exception 'recruit_fork: user % not found', p_user_id;
  end if;
  if v_bytes < p_cost then
    raise exception 'insufficient_bytes';
  end if;

  insert into public.forks (user_id, name, trait, room_slot)
  values (p_user_id, p_name, p_trait, 0)
  returning id into v_id;

  -- The new fork's id is the natural dedup key: one debit per survivor.
  perform public.credit_bytes_tx(p_user_id, -p_cost, 'recruit', v_id::text);
  return v_id;
end;
$$;

comment on function public.recruit_fork(uuid, text, text, bigint) is
  'Recruits a Fork for p_cost bytes, debited through the ledger with '
  'source = recruit. Raises insufficient_bytes. Service-role only.';

revoke execute on function public.recruit_fork(uuid, text, text, bigint) from public, anon, authenticated;
grant  execute on function public.recruit_fork(uuid, text, text, bigint) to service_role;
