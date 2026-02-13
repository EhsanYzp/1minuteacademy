-- Sync approved + pending testimonials when a user updates their profile
--
-- 017 keeps only pending testimonials synced.
-- This migration expands that behavior to ALSO update approved testimonials,
-- so changing your profile photo updates published testimonials too.
--
-- Run this after 017 (and after 015/016).

create or replace function public.sync_all_testimonials_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_avatar text;
begin
  v_name := nullif(trim(new.display_name), '');
  v_avatar := nullif(trim(new.avatar_url), '');

  update public.testimonials t
    set
      author_name = coalesce(v_name, t.author_name),
      author_avatar_url = v_avatar,
      updated_at = now()
  where t.user_id = new.user_id;

  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_pending_testimonials on public.profiles;
create trigger trg_profiles_sync_pending_testimonials
after update of display_name, avatar_url on public.profiles
for each row execute procedure public.sync_all_testimonials_from_profile();

-- One-time backfill: apply latest profiles to existing testimonials now
update public.testimonials t
set
  author_name = coalesce(nullif(trim(p.display_name), ''), t.author_name),
  author_avatar_url = nullif(trim(p.avatar_url), ''),
  updated_at = now()
from public.profiles p
where t.user_id = p.user_id;
