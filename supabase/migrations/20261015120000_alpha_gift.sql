-- Alpha gift: 20 days of public alpha, a 150 B packet for everyone in the
-- Repo today. It waits on the HUD like the welcome packet and pays through
-- open_notice(), so the ledger ref (the notice id) keeps it from paying
-- twice. Players who sign up later do not get it.

insert into public.notices (user_id, ref, title, body, bytes)
select id,
       'alpha-20-days:v1',
       '20 days on the air',
       'The Repo has answered for 20 days. A crate fell through the static, stamped ALPHA, with 150 B inside and a note: "Thanks for keeping the lights on while the 404 Lands were still being drawn."',
       150
  from public.users
 where deleted_at is null
on conflict (user_id, ref) do nothing;
