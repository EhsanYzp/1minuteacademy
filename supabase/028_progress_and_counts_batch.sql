-- Batched counts + progress summaries (perf)

-- -----------------------------------------------------------------------------
-- RPC: get course counts in batch
-- -----------------------------------------------------------------------------
create or replace function public.get_course_counts_batch(
  p_course_ids text[]
)
returns table(course_id text, chapters bigint, topics bigint)
language sql
stable
set search_path = public
as $$
  with courses as (
    select unnest(coalesce(p_course_ids, array[]::text[])) as course_id
  ),
  chapter_counts as (
    select c.course_id, count(*)::bigint as chapters
    from public.chapters c
    where c.published = true
      and c.course_id = any(p_course_ids)
    group by c.course_id
  ),
  topic_counts as (
    select t.course_id, count(*)::bigint as topics
    from public.topics t
    where t.published = true
      and t.course_id = any(p_course_ids)
    group by t.course_id
  )
  select
    coalesce(courses.course_id, cc.course_id, tc.course_id) as course_id,
    coalesce(cc.chapters, 0)::bigint as chapters,
    coalesce(tc.topics, 0)::bigint as topics
  from courses
  left join chapter_counts cc on cc.course_id = courses.course_id
  left join topic_counts tc on tc.course_id = courses.course_id
  order by 1;
$$;

revoke all on function public.get_course_counts_batch(text[]) from public;
grant execute on function public.get_course_counts_batch(text[]) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC: get completed topic counts per course for the signed-in user
-- -----------------------------------------------------------------------------
create or replace function public.get_user_completed_topics_by_course(
  p_course_ids text[] default null
)
returns table(course_id text, completed_topics bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.course_id,
    count(*)::bigint as completed_topics
  from public.user_topic_progress utp
  join public.topics t on t.id = utp.topic_id
  where utp.user_id = auth.uid()
    and coalesce(utp.completed_count, 0) > 0
    and t.published = true
    and (
      p_course_ids is null
      or t.course_id = any(p_course_ids)
    )
  group by t.course_id
  order by 1;
$$;

revoke all on function public.get_user_completed_topics_by_course(text[]) from public;
grant execute on function public.get_user_completed_topics_by_course(text[]) to authenticated;

-- -----------------------------------------------------------------------------
-- RPC: get course counts per category (published)
-- -----------------------------------------------------------------------------
create or replace function public.get_category_course_counts()
returns table(category_id text, course_count bigint)
language sql
stable
set search_path = public
as $$
  select
    c.category_id,
    count(*)::bigint as course_count
  from public.courses c
  where c.published = true
  group by c.category_id
  order by 1;
$$;

revoke all on function public.get_category_course_counts() from public;
grant execute on function public.get_category_course_counts() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC: get topic counts per category (published)
-- -----------------------------------------------------------------------------
create or replace function public.get_category_topic_counts()
returns table(category_id text, topic_count bigint)
language sql
stable
set search_path = public
as $$
  select
    c.category_id,
    count(*)::bigint as topic_count
  from public.topics t
  join public.courses c on c.id = t.course_id
  where t.published = true
    and c.published = true
  group by c.category_id
  order by 1;
$$;

revoke all on function public.get_category_topic_counts() from public;
grant execute on function public.get_category_topic_counts() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC: get completed topic counts per category for signed-in user
-- -----------------------------------------------------------------------------
create or replace function public.get_user_completed_topics_by_category(
  p_category_ids text[] default null
)
returns table(category_id text, completed_topics bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.category_id,
    count(*)::bigint as completed_topics
  from public.user_topic_progress utp
  join public.topics t on t.id = utp.topic_id
  join public.courses c on c.id = t.course_id
  where utp.user_id = auth.uid()
    and coalesce(utp.completed_count, 0) > 0
    and t.published = true
    and c.published = true
    and (
      p_category_ids is null
      or c.category_id = any(p_category_ids)
    )
  group by c.category_id
  order by 1;
$$;

revoke all on function public.get_user_completed_topics_by_category(text[]) from public;
grant execute on function public.get_user_completed_topics_by_category(text[]) to authenticated;
