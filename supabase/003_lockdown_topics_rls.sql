-- 1MinuteAcademy - Topics write lockdown (P0.1)
--
-- Purpose:
-- - Remove the insecure policy that lets any authenticated user write to public.topics.
-- - Keep topics readable by everyone (published-only).
--
-- Run this in Supabase SQL editor (or as a migration) on existing projects.

-- Ensure RLS is enabled (no-op if already enabled)
alter table public.topics enable row level security;

-- Drop insecure write policy (if it exists from older installs)
drop policy if exists "topics_write_authed" on public.topics;

-- NOTE: service role keys bypass RLS, so content sync scripts using
-- SUPABASE_SERVICE_ROLE_KEY will continue to work without any write policy.

-- Optional: if you want admin users (NOT all authenticated users) to edit topics
-- from a trusted admin UI, uncomment and adapt one of the policy sets below.
--
-- Option A: Admin claim in app_metadata (recommended)
-- - Add an `app_metadata.role = 'admin'` claim to admin users.
-- - Then allow writes only for those users.
--
-- drop policy if exists "topics_admin_insert" on public.topics;
-- create policy "topics_admin_insert" on public.topics
-- for insert to authenticated
-- with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
--
-- drop policy if exists "topics_admin_update" on public.topics;
-- create policy "topics_admin_update" on public.topics
-- for update to authenticated
-- using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
-- with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
--
-- drop policy if exists "topics_admin_delete" on public.topics;
-- create policy "topics_admin_delete" on public.topics
-- for delete to authenticated
-- using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
