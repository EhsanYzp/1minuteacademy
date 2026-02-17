-- SCALE-06: Enforce avatar upload constraints (MIME + size) at the database layer.
--
-- The bucket is public-read, but writes must be:
-- - within the user's folder (<uid>/...)
-- - image-only MIME types (no SVG)
-- - <= 5 MB

-- Allowed image types (intentionally excludes SVG for security reasons)
-- jpeg, png, webp, avif, gif

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'avatars'
  and name like (auth.uid()::text || '/%')
  and lower(
    coalesce(
      metadata->>'mimetype',
      metadata->>'mimeType',
      metadata->>'contentType',
      metadata->>'content_type',
      ''
    )
  ) = any (array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])
  and (metadata->>'size') is not null
  and ((metadata->>'size')::bigint <= 5242880)
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
  and lower(
    coalesce(
      metadata->>'mimetype',
      metadata->>'mimeType',
      metadata->>'contentType',
      metadata->>'content_type',
      ''
    )
  ) = any (array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])
  and (metadata->>'size') is not null
  and ((metadata->>'size')::bigint <= 5242880)
);
