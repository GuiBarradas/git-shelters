-- Badges (design doc §4.4 achievements, §3.3 region badge, alpha badge).
--
-- The catalog lives in code (src/lib/badges/catalog.ts): a badge is a
-- name, a blurb and a predicate over state the bunker already has. This
-- table only remembers what was earned and when, so a rule can change
-- later without stripping anyone. Byte bonuses go through the ledger
-- with source = 'badge' and the badge id as the ref: one payout, ever.

create table public.user_badges (
  user_id   uuid        not null references public.users(id) on delete cascade,
  badge_id  text        not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

alter table public.user_badges enable row level security;

create policy "user_badges_select_own"
  on public.user_badges for select
  using (auth.uid() = user_id);

-- INSERT/DELETE: no client policies. The award runs with the service role.

grant all    on table public.user_badges to service_role;
grant select on table public.user_badges to authenticated;
