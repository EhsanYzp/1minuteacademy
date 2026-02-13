-- Avatars storage bucket + RLS policies
-- Run this in Supabase SQL editor after the earlier migrations.

-- Create bucket (public read; write restricted by RLS policies below)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id)
do update set public = true;

-- Policies live on storage.objects
-- NOTE: Supabase enables RLS on storage.objects by default.

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
for select to anon, authenticated
using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'avatars'
  and name like (auth.uid()::text || '/%')
);

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
for update to authenticated
using (
  bucket_id = 'avatars'
  and name like (auth.uid()::text || '/%')
)
with check (
  bucket_id = 'avatars'
  and name like (auth.uid()::text || '/%')
);

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'avatars'
  and name like (auth.uid()::text || '/%')
);
