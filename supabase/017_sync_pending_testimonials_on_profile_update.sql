-- Sync pending testimonials when a user updates their profile
-- Motivation: testimonials snapshot author fields at insert time for stability/privacy.
-- For pending (unapproved) testimonials, we keep the snapshot fresh so users see their latest avatar/name.
--
-- Run this after 015_profiles_testimonials.sql

create or replace function public.sync_pending_testimonials_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only keep pending testimonials in sync; approved testimonials stay immutable.
  update public.testimonials t
    set
      author_name = coalesce(nullif(trim(new.display_name), ''), t.author_name),
      author_avatar_url = coalesce(nullif(trim(new.avatar_url), ''), null),
      updated_at = now()
  where t.user_id = new.user_id
    and t.approved = false;

  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_pending_testimonials on public.profiles;
create trigger trg_profiles_sync_pending_testimonials
after update of display_name, avatar_url on public.profiles
for each row execute procedure public.sync_pending_testimonials_from_profile();
