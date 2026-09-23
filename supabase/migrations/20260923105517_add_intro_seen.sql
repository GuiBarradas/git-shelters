-- The intro (design doc §21.2, the lore cinematic) plays once per
-- account, on the first authenticated visit. Stored on the user row so a
-- new device or a cleared browser does not replay it.

alter table public.users
  add column intro_seen_at timestamptz;
