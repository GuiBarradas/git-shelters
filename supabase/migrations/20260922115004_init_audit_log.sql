-- Migration: init_audit_log
--
-- LGPD / security trail (ADR 0007). One row per sensitive account action.
-- user_id has no foreign key on purpose: the row must survive the user's
-- deletion as proof that the deletion happened. The uuid alone is not
-- personal data once every table it pointed to is gone.

create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  -- 'account.delete' | 'account.export' | ... free text, same reasoning
  -- as byte_transactions.source.
  action      text not null,
  meta_json   jsonb not null default '{}',
  -- Reserved for a salted hash; never a raw IP. Unused in the Public Alpha.
  ip_hash     text,
  occurred_at timestamptz not null default now()
);

create index audit_log_user_occurred_idx
  on public.audit_log (user_id, occurred_at desc);

alter table public.audit_log enable row level security;

-- No policies: clients never read or write this. Server code with the
-- service-role key is the only writer.
grant all on table public.audit_log to service_role;
