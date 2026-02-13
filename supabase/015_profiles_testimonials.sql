-- Profiles + Testimonials (social proof)
-- Run this in Supabase SQL editor after the earlier migrations.

-- -----------------------------------------------------------------------------
-- Profiles (public-facing fields live here, but we do NOT expose profiles publicly)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_len check (display_name is null or char_length(display_name) between 2 and 40)
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_owner_select" on public.profiles;
create policy "profiles_owner_select" on public.profiles
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "profiles_owner_insert" on public.profiles;
create policy "profiles_owner_insert" on public.profiles
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update" on public.profiles
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "profiles_owner_delete" on public.profiles;
create policy "profiles_owner_delete" on public.profiles
for delete to authenticated
using (user_id = auth.uid());

-- Auto-create profile row on signup (reads auth metadata if present)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(split_part(new.email, '@', 1)), '')
    ),
    nullif(trim(new.raw_user_meta_data->>'avatar_url'), '')
  )
  on conflict (user_id) do update set
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Testimonials
--   - Public can read only approved testimonials
--   - Authenticated users can submit (pending approval)
--   - Users can edit/delete only while unapproved
--   - We snapshot author name/avatar into the testimonial row for privacy + stability
-- -----------------------------------------------------------------------------
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  author_name text,
  author_avatar_url text,
  author_title text,
  quote text not null,
  platform text,
  platform_url text,
  approved boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint testimonials_quote_len check (char_length(quote) between 20 and 420),
  constraint testimonials_author_name_len check (author_name is null or char_length(author_name) between 2 and 60),
  constraint testimonials_platform_len check (platform is null or char_length(platform) <= 40)
);

drop trigger if exists trg_testimonials_updated_at on public.testimonials;
create trigger trg_testimonials_updated_at
before update on public.testimonials
for each row execute procedure public.set_updated_at();

-- Snapshot author fields from profiles (runs before NOT NULL/constraints apply)
create or replace function public.set_testimonial_author_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_avatar text;
begin
  if new.user_id is null then
    return new;
  end if;

  select p.display_name, p.avatar_url
  into v_name, v_avatar
  from public.profiles p
  where p.user_id = new.user_id;

  if coalesce(trim(new.author_name), '') = '' then
    new.author_name := coalesce(v_name, 'Member');
  end if;

  if coalesce(trim(new.author_avatar_url), '') = '' then
    new.author_avatar_url := v_avatar;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_testimonials_author_snapshot on public.testimonials;
create trigger trg_testimonials_author_snapshot
before insert on public.testimonials
for each row execute procedure public.set_testimonial_author_snapshot();

create index if not exists testimonials_approved_created_idx
on public.testimonials(approved, created_at desc);

-- Prevent spam: only one pending testimonial per user at a time
create unique index if not exists testimonials_one_pending_per_user
on public.testimonials(user_id)
where approved = false and user_id is not null;

alter table public.testimonials enable row level security;

-- Public can read approved testimonials; users can read their own (including pending)
drop policy if exists "testimonials_select_approved_or_owner" on public.testimonials;
create policy "testimonials_select_approved_or_owner" on public.testimonials
for select to anon, authenticated
using (approved = true or user_id = auth.uid());

-- Authenticated users can submit (always unapproved)
drop policy if exists "testimonials_owner_insert" on public.testimonials;
create policy "testimonials_owner_insert" on public.testimonials
for insert to authenticated
with check (user_id = auth.uid() and approved = false);

-- Users can edit/delete only while unapproved (cannot self-approve)
drop policy if exists "testimonials_owner_update_unapproved" on public.testimonials;
create policy "testimonials_owner_update_unapproved" on public.testimonials
for update to authenticated
using (user_id = auth.uid() and approved = false)
with check (user_id = auth.uid() and approved = false);

drop policy if exists "testimonials_owner_delete_unapproved" on public.testimonials;
create policy "testimonials_owner_delete_unapproved" on public.testimonials
for delete to authenticated
using (user_id = auth.uid() and approved = false);
