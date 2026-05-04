-- Migration: init_users
-- Creates the public.users table mirroring auth.users for game state, plus
-- the trigger that materialises a public.users row when a user signs up.
-- See ADR 0004 for the schema rationale.

-- =====================================================================
-- Table
-- =====================================================================

create table public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  -- GitHub numeric user id (stable, never collides). Required for any future
  -- migration to a different auth provider that needs to map back.
  github_id    bigint unique not null,
  -- Denormalised handle: lets /u/<login> look up without joining auth schema.
  github_login text not null,
  email        text,
  bytes        bigint not null default 0,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  -- Soft-delete marker for LGPD account deletion. Real anonymisation of
  -- linked rows happens in a separate scheduled job (out of Public Alpha).
  deleted_at   timestamptz
);

create index users_github_login_idx on public.users (github_login);

-- =====================================================================
-- RLS
-- =====================================================================

alter table public.users enable row level security;

create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id);

-- UPDATE limited to the user themselves. The bytes column is mutated via
-- the SECURITY DEFINER function credit_bytes_tx() (introduced in a later
-- migration), which bypasses this policy by running as table owner.
create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- INSERT and DELETE are intentionally NOT exposed to clients.
-- Inserts happen via the handle_new_user trigger (SECURITY DEFINER).
-- Deletes cascade from auth.users (enforced by the foreign key above).

-- =====================================================================
-- Signup trigger
-- =====================================================================

-- Why SECURITY DEFINER: the trigger fires inside the auth schema's INSERT,
-- but writes to public.users — which has RLS. Running as the function owner
-- (the migration role) lets us write past RLS for this specific bootstrap.
--
-- Why explicit search_path: SECURITY DEFINER functions are a known target
-- for search-path attacks. Pinning the path defends against malicious
-- temporary objects shadowing pg_catalog functions.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.users (id, github_id, github_login, email)
  values (
    new.id,
    -- raw_user_meta_data is the OAuth provider profile copy. For GitHub,
    -- provider_id is the numeric user id, user_name is the @handle.
    coalesce((new.raw_user_meta_data ->> 'provider_id')::bigint, 0),
    coalesce(
      new.raw_user_meta_data ->> 'user_name',
      new.email,
      'unknown'
    ),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Backfill
-- =====================================================================

-- Any auth.users row that already existed before this trigger was installed
-- (e.g., the initial dev account) needs a public.users row. Idempotent via
-- ON CONFLICT — re-running this migration is a no-op.
insert into public.users (id, github_id, github_login, email)
select
  au.id,
  coalesce((au.raw_user_meta_data ->> 'provider_id')::bigint, 0),
  coalesce(
    au.raw_user_meta_data ->> 'user_name',
    au.email,
    'unknown'
  ),
  au.email
from auth.users au
where not exists (
  select 1 from public.users pu where pu.id = au.id
);
