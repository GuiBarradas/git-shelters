-- Notices: packets addressed to one Maintainer that wait on the HUD until
-- opened. Opening one may pay bytes; the payout goes through the ledger
-- with the notice id as the ref, so it can never pay twice. The first
-- notice is the welcome packet (100 B), seeded here for everyone who is
-- already in and created on sign-up for everyone who comes next.

create table public.notices (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.users(id) on delete cascade,
  -- Stable key per notice kind and version, e.g. 'welcome:v1'; one per user.
  ref        text        not null,
  title      text        not null,
  body       text        not null,
  bytes      integer     not null default 0,
  created_at timestamptz not null default now(),
  opened_at  timestamptz,
  unique (user_id, ref)
);

create index notices_unread_idx on public.notices (user_id) where opened_at is null;

alter table public.notices enable row level security;

create policy "notices_select_own"
  on public.notices for select
  using (auth.uid() = user_id);

-- INSERT/UPDATE: no client policies. The server writes with the service role.

grant all    on table public.notices to service_role;
grant select on table public.notices to authenticated;

-- =====================================================================
-- open_notice(): mark opened and pay, once
-- =====================================================================

create or replace function public.open_notice(
  p_user_id   uuid,
  p_notice_id uuid
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bytes integer;
begin
  update public.notices
     set opened_at = coalesce(opened_at, now())
   where id = p_notice_id
     and user_id = p_user_id
  returning bytes into v_bytes;
  if not found then
    raise exception 'notice_not_found';
  end if;

  -- credit_bytes_tx is idempotent on (user, source, ref): a second open
  -- of the same notice is a no-op for the balance.
  if v_bytes > 0 then
    perform public.credit_bytes_tx(p_user_id, v_bytes, 'notice', p_notice_id::text);
  end if;
  return v_bytes;
end;
$$;

revoke execute on function public.open_notice(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.open_notice(uuid, uuid) to service_role;

-- Everyone already in the Repo gets the welcome packet too.
insert into public.notices (user_id, ref, title, body, bytes)
select id,
       'welcome:v1',
       'Welcome to the Repo',
       'The previous Maintainer left 100 B in the desk drawer and a note: "Build something before the lights go out." The Cache Storage is 50 B. So is a good start.',
       100
  from public.users
 where deleted_at is null
on conflict (user_id, ref) do nothing;
