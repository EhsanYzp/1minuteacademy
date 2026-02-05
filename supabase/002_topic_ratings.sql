-- Topic ratings (1-5 stars)
-- Run this in Supabase SQL editor after 001_init.sql.

-- Table: per-user rating per topic
create table if not exists public.topic_ratings (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  topic_id text not null references public.topics(id) on delete cascade,
  rating smallint not null check (rating >= 1 and rating <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

drop trigger if exists trg_topic_ratings_updated_at on public.topic_ratings;
create trigger trg_topic_ratings_updated_at
before update on public.topic_ratings
for each row execute procedure public.set_updated_at();

alter table public.topic_ratings enable row level security;

-- Ratings: users can read/write only their own rating.
drop policy if exists "topic_ratings_owner_select" on public.topic_ratings;
create policy "topic_ratings_owner_select" on public.topic_ratings
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "topic_ratings_owner_insert" on public.topic_ratings;
create policy "topic_ratings_owner_insert" on public.topic_ratings
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "topic_ratings_owner_update" on public.topic_ratings;
create policy "topic_ratings_owner_update" on public.topic_ratings
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- (Optional) allow users to delete their own rating.
drop policy if exists "topic_ratings_owner_delete" on public.topic_ratings;
create policy "topic_ratings_owner_delete" on public.topic_ratings
for delete to authenticated
using (user_id = auth.uid());

-- Public aggregation function (no PII): avg + count per topic
create or replace function public.get_topic_rating_summaries(topic_ids text[])
returns table (topic_id text, avg_rating numeric, ratings_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    tr.topic_id,
    avg(tr.rating)::numeric(10,2) as avg_rating,
    count(*)::bigint as ratings_count
  from public.topic_ratings tr
  where tr.topic_id = any(topic_ids)
  group by tr.topic_id;
$$;

revoke all on function public.get_topic_rating_summaries(text[]) from public;
grant execute on function public.get_topic_rating_summaries(text[]) to anon;
grant execute on function public.get_topic_rating_summaries(text[]) to authenticated;
