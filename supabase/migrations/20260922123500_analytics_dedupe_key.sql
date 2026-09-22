-- Migration: analytics_dedupe_key
--
-- Idempotency for events that must land at most once per key: the first
-- of anything (dedupe_key = 'first'), signup events ('once'), and
-- session_start (one per 30-minute bucket). A read-then-insert throttle
-- raced under concurrent renders and wrote three starts in 500 ms; a
-- unique constraint cannot race. NULL keys stay distinct, so unkeyed
-- events insert freely.

alter table public.analytics_events
  add column dedupe_key text;

alter table public.analytics_events
  add constraint analytics_events_dedupe_unique
  unique (user_id, event_name, dedupe_key);
