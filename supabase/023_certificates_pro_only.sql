-- Certificates (Pro-only)
-- Award a category certificate when a Pro user completes all published topics in a subject.
-- Stores certificate metadata in DB and assets in a public Supabase Storage bucket.

-- -----------------------------------------------------------------------------
-- Storage bucket: certificates (public read; write restricted to owner folder)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', true)
on conflict (id)
do update set public = true;

drop policy if exists "certificates_public_read" on storage.objects;
create policy "certificates_public_read" on storage.objects
for select to anon, authenticated
using (bucket_id = 'certificates');

drop policy if exists "certificates_owner_insert" on storage.objects;
create policy "certificates_owner_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'certificates'
  and name like (auth.uid()::text || '/%')
);

drop policy if exists "certificates_owner_update" on storage.objects;
create policy "certificates_owner_update" on storage.objects
for update to authenticated
using (
  bucket_id = 'certificates'
  and name like (auth.uid()::text || '/%')
)
with check (
  bucket_id = 'certificates'
  and name like (auth.uid()::text || '/%')
);

drop policy if exists "certificates_owner_delete" on storage.objects;
create policy "certificates_owner_delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'certificates'
  and name like (auth.uid()::text || '/%')
);

-- -----------------------------------------------------------------------------
-- Table: user_certificates
-- -----------------------------------------------------------------------------
create table if not exists public.user_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  title text not null,
  recipient_name text,
  recipient_avatar_url text,
  total_topics integer not null default 0,
  completed_topics integer not null default 0,
  awarded_at timestamptz not null default now(),
  svg_path text,
  png_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_certificates_subject_len check (char_length(subject) between 2 and 80),
  constraint user_certificates_title_len check (char_length(title) between 2 and 120)
);

drop trigger if exists trg_user_certificates_updated_at on public.user_certificates;
create trigger trg_user_certificates_updated_at
before update on public.user_certificates
for each row execute procedure public.set_updated_at();

-- One certificate per user per subject.
create unique index if not exists user_certificates_user_subject_uq
on public.user_certificates(user_id, subject);

create index if not exists user_certificates_user_awarded_idx
on public.user_certificates(user_id, awarded_at desc);

alter table public.user_certificates enable row level security;

drop policy if exists "user_certificates_owner_select" on public.user_certificates;
create policy "user_certificates_owner_select" on public.user_certificates
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "user_certificates_owner_insert" on public.user_certificates;
create policy "user_certificates_owner_insert" on public.user_certificates
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "user_certificates_owner_update" on public.user_certificates;
create policy "user_certificates_owner_update" on public.user_certificates
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user_certificates_owner_delete" on public.user_certificates;
create policy "user_certificates_owner_delete" on public.user_certificates
for delete to authenticated
using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Helper: award certificate when user completed all topics in subject
-- -----------------------------------------------------------------------------
create or replace function public.award_category_certificate_if_earned(
  p_user_id uuid,
  p_topic_id text,
  p_is_pro boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject text;
  v_total integer;
  v_done integer;
  v_name text;
  v_avatar text;
  v_title text;
begin
  if p_user_id is null then
    return;
  end if;

  if not coalesce(p_is_pro, false) then
    return;
  end if;

  select coalesce(nullif(btrim(t.subject), ''), 'General')
  into v_subject
  from public.topics t
  where t.id = p_topic_id;

  if v_subject is null then
    return;
  end if;

  select count(*)::integer
  into v_total
  from public.topics t
  where t.published = true
    and coalesce(nullif(btrim(t.subject), ''), 'General') = v_subject;

  if coalesce(v_total, 0) <= 0 then
    return;
  end if;

  select count(*)::integer
  into v_done
  from public.user_topic_progress utp
  join public.topics t on t.id = utp.topic_id
  where utp.user_id = p_user_id
    and coalesce(utp.completed_count, 0) > 0
    and t.published = true
    and coalesce(nullif(btrim(t.subject), ''), 'General') = v_subject;

  if coalesce(v_done, 0) < v_total then
    return;
  end if;

  -- Snapshot recipient name/avatar from profiles for stability.
  select p.display_name, p.avatar_url
  into v_name, v_avatar
  from public.profiles p
  where p.user_id = p_user_id;

  v_title := v_subject || ' 1 Minute Expert';

  insert into public.user_certificates (
    user_id,
    subject,
    title,
    recipient_name,
    recipient_avatar_url,
    total_topics,
    completed_topics
  )
  values (
    p_user_id,
    v_subject,
    v_title,
    coalesce(nullif(btrim(v_name), ''), 'Member'),
    nullif(btrim(v_avatar), ''),
    v_total,
    v_done
  )
  on conflict (user_id, subject) do nothing;
end;
$$;

revoke all on function public.award_category_certificate_if_earned(uuid, text, boolean) from public;
grant execute on function public.award_category_certificate_if_earned(uuid, text, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Update RPC: complete_topic(...) now also awards certificates (Pro-only)
-- -----------------------------------------------------------------------------
create or replace function public.complete_topic(
  p_topic_id text,
  p_seconds integer
)
returns table (one_ma_balance integer, streak integer, awarded_one_ma integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_last date;
  v_streak integer;
  v_balance integer;
  v_awarded integer := 0;
  v_plan text;
  v_paused boolean;
  v_is_pro boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Ensure stats row exists
  insert into public.user_stats (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  -- Lock stats row
  select us.last_completed_date, us.streak, us.one_ma_balance
  into v_last, v_streak, v_balance
  from public.user_stats as us
  where us.user_id = v_user_id
  for update;

  -- Streak logic
  if v_last is null then
    v_streak := 1;
  elsif v_last = v_today then
    v_streak := v_streak;
  elsif v_last = (v_today - 1) then
    v_streak := v_streak + 1;
  else
    v_streak := 1;
  end if;

  -- Determine tier from auth metadata (mirrors frontend entitlements)
  select
    lower(coalesce(au.raw_user_meta_data->>'plan', au.raw_app_meta_data->>'plan', 'free')),
    coalesce((au.raw_user_meta_data->>'paused')::boolean, false)
  into v_plan, v_paused
  from auth.users au
  where au.id = v_user_id;

  v_is_pro := (v_plan in ('pro', 'premium')) and not v_paused;
  v_awarded := case when v_is_pro then 1 else 0 end;

  v_balance := coalesce(v_balance, 0) + v_awarded;

  update public.user_stats
    set one_ma_balance = v_balance,
        streak = v_streak,
        last_completed_date = v_today
  where user_id = v_user_id;

  -- Upsert per-topic progress
  insert into public.user_topic_progress (user_id, topic_id, best_seconds, completed_count, last_completed_at)
  values (v_user_id, p_topic_id, p_seconds, 1, now())
  on conflict (user_id, topic_id)
  do update set
    best_seconds = case
      when public.user_topic_progress.best_seconds is null then excluded.best_seconds
      when excluded.best_seconds < public.user_topic_progress.best_seconds then excluded.best_seconds
      else public.user_topic_progress.best_seconds
    end,
    completed_count = public.user_topic_progress.completed_count + 1,
    last_completed_at = now();

  -- Pro-only: award category certificate when all topics in subject are done.
  perform public.award_category_certificate_if_earned(v_user_id, p_topic_id, v_is_pro);

  return query select v_balance as one_ma_balance, v_streak as streak, v_awarded as awarded_one_ma;
end;
$$;

-- Backwards-compatible wrapper: old 3-arg signature (ignores xp)
create or replace function public.complete_topic(
  p_topic_id text,
  p_xp integer,
  p_seconds integer
)
returns table (one_ma_balance integer, streak integer, awarded_one_ma integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select * from public.complete_topic(p_topic_id, p_seconds);
end;
$$;

revoke all on function public.complete_topic(text, integer) from public;
revoke all on function public.complete_topic(text, integer, integer) from public;

grant execute on function public.complete_topic(text, integer) to authenticated;
grant execute on function public.complete_topic(text, integer, integer) to authenticated;
