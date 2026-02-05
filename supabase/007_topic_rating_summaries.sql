-- P1.2: Precomputed rating summaries (avoid heavy aggregates at scale)
--
-- Adds a small summary table maintained by triggers so the browse UI can
-- fetch ratings in O(visible_topics) time without running AVG()/COUNT() over
-- a large ratings table on every request.

-- Summary table
create table if not exists public.topic_rating_summaries (
  topic_id text primary key references public.topics(id) on delete cascade,
  avg_rating numeric(10,2) not null,
  ratings_count bigint not null,
  updated_at timestamptz not null default now()
);

alter table public.topic_rating_summaries enable row level security;

-- Server-only table access (clients call the RPC).
revoke all on table public.topic_rating_summaries from anon, authenticated;

-- Recompute one topic summary
create or replace function public.recompute_topic_rating_summary(p_topic_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg numeric(10,2);
  v_count bigint;
begin
  if p_topic_id is null or btrim(p_topic_id) = '' then
    return;
  end if;

  select
    avg(tr.rating)::numeric(10,2),
    count(*)::bigint
  into v_avg, v_count
  from public.topic_ratings tr
  where tr.topic_id = p_topic_id;

  if coalesce(v_count, 0) = 0 then
    delete from public.topic_rating_summaries s where s.topic_id = p_topic_id;
    return;
  end if;

  insert into public.topic_rating_summaries(topic_id, avg_rating, ratings_count, updated_at)
  values (p_topic_id, v_avg, v_count, now())
  on conflict (topic_id)
  do update set
    avg_rating = excluded.avg_rating,
    ratings_count = excluded.ratings_count,
    updated_at = now();
end;
$$;

revoke all on function public.recompute_topic_rating_summary(text) from public;

-- Trigger to keep summary fresh
create or replace function public.trg_topic_ratings_recompute_summary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.recompute_topic_rating_summary(new.topic_id);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    perform public.recompute_topic_rating_summary(new.topic_id);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.recompute_topic_rating_summary(old.topic_id);
    return old;
  end if;

  return null;
end;
$$;

revoke all on function public.trg_topic_ratings_recompute_summary() from public;

drop trigger if exists trg_topic_ratings_recompute_summary on public.topic_ratings;
create trigger trg_topic_ratings_recompute_summary
after insert or update or delete on public.topic_ratings
for each row execute procedure public.trg_topic_ratings_recompute_summary();

-- Backfill once
insert into public.topic_rating_summaries(topic_id, avg_rating, ratings_count, updated_at)
select
  tr.topic_id,
  avg(tr.rating)::numeric(10,2) as avg_rating,
  count(*)::bigint as ratings_count,
  now() as updated_at
from public.topic_ratings tr
group by tr.topic_id
on conflict (topic_id)
do update set
  avg_rating = excluded.avg_rating,
  ratings_count = excluded.ratings_count,
  updated_at = now();

-- Update the public aggregation RPC to read from the summary table
create or replace function public.get_topic_rating_summaries(topic_ids text[])
returns table (topic_id text, avg_rating numeric, ratings_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.topic_id,
    s.avg_rating,
    s.ratings_count
  from public.topic_rating_summaries s
  where s.topic_id = any(topic_ids);
$$;

revoke all on function public.get_topic_rating_summaries(text[]) from public;
grant execute on function public.get_topic_rating_summaries(text[]) to anon;
grant execute on function public.get_topic_rating_summaries(text[]) to authenticated;
