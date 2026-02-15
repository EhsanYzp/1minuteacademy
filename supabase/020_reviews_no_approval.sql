-- Reviews: remove approval workflow
-- After this migration, reviews are immediately public by default (no moderation).
-- Safe to run after 015_profiles_testimonials.sql and 019_reviews_rating_and_summary.sql

-- 1) Backfill: make existing pending rows public
update public.testimonials
set approved = true,
    approved_at = coalesce(approved_at, now())
where approved = false;

-- 2) Default new rows to approved
alter table public.testimonials
  alter column approved set default true;

-- 3) Drop the "one pending per user" constraint index (no longer relevant)
drop index if exists public.testimonials_one_pending_per_user;

-- 4) RLS policies: public can read all; authenticated can insert/update/delete their own
--    (We keep RLS enabled, just remove the moderation gates.)

alter table public.testimonials enable row level security;

drop policy if exists "testimonials_select_approved_or_owner" on public.testimonials;
create policy "testimonials_select_public" on public.testimonials
for select to anon, authenticated
using (true);

drop policy if exists "testimonials_owner_insert" on public.testimonials;
create policy "testimonials_owner_insert" on public.testimonials
for insert to authenticated
with check (user_id = auth.uid() and approved = true);

drop policy if exists "testimonials_owner_update_unapproved" on public.testimonials;
create policy "testimonials_owner_update" on public.testimonials
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and approved = true);

drop policy if exists "testimonials_owner_delete_unapproved" on public.testimonials;
create policy "testimonials_owner_delete" on public.testimonials
for delete to authenticated
using (user_id = auth.uid());
