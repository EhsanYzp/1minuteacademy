-- P1.1 follow-up: accurate category totals without loading all topics
-- Provides an RPC to return counts per subject for published topics.

create or replace function public.get_topic_category_counts()
returns table(subject text, topic_count bigint)
language sql
stable
set search_path = public
as $$
  select
    coalesce(nullif(btrim(t.subject), ''), 'General') as subject,
    count(*)::bigint as topic_count
  from public.topics as t
  where t.published = true
  group by 1
  order by 1;
$$;

revoke all on function public.get_topic_category_counts() from public;
grant execute on function public.get_topic_category_counts() to anon, authenticated;
