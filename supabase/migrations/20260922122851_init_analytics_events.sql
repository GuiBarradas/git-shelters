-- Migration: init_analytics_events
--
-- Product analytics for the Public Alpha gates (ADR 0008). Written only by
-- server code with the service-role key; never read by clients.
--
-- user_id is ON DELETE SET NULL, not CASCADE: an account deletion removes
-- identifiability but keeps the aggregate (funnel and retention counts
-- stay honest after churn). This is the LGPD rule from the design doc.

create table public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete set null,
  -- snake_case, closed union in src/lib/analytics/track.ts.
  event_name  text not null,
  props_json  jsonb not null default '{}',
  -- Client-side correlation id; null for server-originated events.
  session_id  text,
  occurred_at timestamptz not null default now()
);

-- Funnel and retention queries filter by user + event and scan by time.
create index analytics_events_user_event_occurred_idx
  on public.analytics_events (user_id, event_name, occurred_at desc);

-- Cohort queries scan by event over a time window regardless of user.
create index analytics_events_event_occurred_idx
  on public.analytics_events (event_name, occurred_at desc);

alter table public.analytics_events enable row level security;

-- No policies: service_role only.
grant all on table public.analytics_events to service_role;
