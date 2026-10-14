-- Migration: bunker_previews
-- Private owner previews for the share card: one PNG per account at
-- <auth.uid()>/scene.png. Owners read/write only their own object through
-- RLS; anonymous users get nothing. The public card route reads it with the
-- service role only after checking the profile is live.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bunker-previews', 'bunker-previews', false, 3145728, array['image/png'])
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "bunker_previews_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'bunker-previews'
    and name = ((select auth.uid())::text || '/scene.png')
    and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.deleted_at is null)
  );

create policy "bunker_previews_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'bunker-previews'
    and name = ((select auth.uid())::text || '/scene.png')
    and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.deleted_at is null)
  );

create policy "bunker_previews_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'bunker-previews'
    and name = ((select auth.uid())::text || '/scene.png')
    and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.deleted_at is null)
  )
  with check (
    bucket_id = 'bunker-previews'
    and name = ((select auth.uid())::text || '/scene.png')
    and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.deleted_at is null)
  );

create policy "bunker_previews_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'bunker-previews'
    and name = ((select auth.uid())::text || '/scene.png')
    and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.deleted_at is null)
  );
