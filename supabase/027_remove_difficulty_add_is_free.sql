-- 027: Replace difficulty column with is_free boolean
--
-- Gating model change: instead of difficulty-based access (Beginner = free,
-- everything else = Pro), each chapter now has exactly one free topic.
-- The new is_free boolean column controls access.

-- 1) Add is_free column
alter table public.topics
  add column if not exists is_free boolean not null default false;

-- 2) Backfill: mark existing Beginner topics as free (temporary bridge)
update public.topics set is_free = true where difficulty = 'Beginner';

-- 3) Drop difficulty column
alter table public.topics drop column if exists difficulty;

-- 4) Index for free-topic queries
create index if not exists topics_is_free_idx
on public.topics (is_free)
where published = true;

-- 5) Recreate search_topics_page RPC without difficulty
create or replace function public.search_topics_page(
  p_query text,
  p_subject text default null,
  p_limit integer default 36,
  p_offset integer default 0
)
returns table (
  id text,
  subject text,
  subcategory text,
  title text,
  emoji text,
  color text,
  description text,
  is_free boolean,
  total_count bigint
)
language plpgsql
security invoker
set search_path = public
stable
as $$
declare
  v_query text := nullif(btrim(p_query), '');
  v_subject text := nullif(btrim(p_subject), '');
  v_limit integer := greatest(1, least(200, coalesce(p_limit, 36)));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_ts tsquery;
begin
  if v_query is not null then
    begin
      v_ts := websearch_to_tsquery('simple', v_query);
    exception when others then
      v_ts := plainto_tsquery('simple', v_query);
    end;
  end if;

  return query
  with filtered as (
    select
      t.id,
      t.subject,
      t.subcategory,
      t.title,
      t.emoji,
      t.color,
      t.description,
      t.is_free
    from public.topics t
    where t.published = true
      and (
        v_subject is null
        or v_subject = 'All'
        or t.subject = v_subject
      )
      and (
        v_query is null
        or to_tsvector(
            'simple',
            coalesce(t.title, '') || ' ' ||
            coalesce(t.description, '') || ' ' ||
            coalesce(t.subject, '') || ' ' ||
            coalesce(t.subcategory, '')
          ) @@ v_ts
      )
  )
  select
    f.*,
    count(*) over() as total_count
  from filtered f
  order by f.title asc
  limit v_limit
  offset v_offset;
end;
$$;

-- 6) Recreate sync_topics_batch RPC without difficulty, with is_free
create or replace function public.sync_topics_batch(
  p_topics jsonb,
  p_insert_only boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_claims text;
  v_count integer := 0;
begin
  v_role := current_setting('request.jwt.claim.role', true);
  if v_role is null then
    v_claims := current_setting('request.jwt.claims', true);
    if v_claims is not null then
      begin
        v_role := (v_claims::jsonb ->> 'role');
      exception when others then
        v_role := null;
      end;
    end if;
  end if;

  if v_role is distinct from 'service_role' then
    raise exception 'forbidden';
  end if;

  if p_topics is null or jsonb_typeof(p_topics) <> 'array' then
    raise exception 'p_topics must be a JSON array';
  end if;

  if jsonb_array_length(p_topics) = 0 then
    return 0;
  end if;

  -- Ensure catalog parents exist
  with src as (
    select
      nullif(btrim(x.subject), '') as subject,
      nullif(btrim(x.subcategory), '') as subcategory,
      nullif(btrim(x.course_id), '') as course_id,
      nullif(btrim(x.chapter_id), '') as chapter_id
    from jsonb_to_recordset(p_topics) as x(
      subject text,
      subcategory text,
      course_id text,
      chapter_id text
    )
  ), normalized as (
    select
      subject, subcategory, course_id, chapter_id,
      coalesce(
        nullif(
          regexp_replace(
            lower(regexp_replace(coalesce(subject, 'General'), '[^a-zA-Z0-9]+', '-', 'g')),
            '(^-+|-+$)', '', 'g'
          ), ''
        ), 'general'
      ) as category_id
    from src
  )
  insert into public.categories (id, title, published)
  select distinct n.category_id, coalesce(n.subject, 'General'), true
  from normalized n
  on conflict (id) do nothing;

  with src as (
    select
      nullif(btrim(x.subject), '') as subject,
      nullif(btrim(x.subcategory), '') as subcategory,
      nullif(btrim(x.course_id), '') as course_id
    from jsonb_to_recordset(p_topics) as x(
      subject text,
      subcategory text,
      course_id text
    )
  ), normalized as (
    select
      subject, subcategory, course_id,
      coalesce(
        nullif(
          regexp_replace(
            lower(regexp_replace(coalesce(subject, 'General'), '[^a-zA-Z0-9]+', '-', 'g')),
            '(^-+|-+$)', '', 'g'
          ), ''
        ), 'general'
      ) as category_id
    from src
  )
  insert into public.courses (id, category_id, title, published)
  select distinct n.course_id, n.category_id,
    coalesce(n.subcategory, initcap(replace(n.course_id, '-', ' '))), true
  from normalized n
  where n.course_id is not null
  on conflict (id) do nothing;

  with src as (
    select
      nullif(btrim(x.course_id), '') as course_id,
      nullif(btrim(x.chapter_id), '') as chapter_id
    from jsonb_to_recordset(p_topics) as x(
      course_id text,
      chapter_id text
    )
  )
  insert into public.chapters (id, course_id, title, position, published)
  select distinct s.chapter_id, s.course_id,
    initcap(replace(s.chapter_id, '-', ' ')), 0, true
  from src s
  where s.course_id is not null and s.chapter_id is not null
  on conflict (id) do nothing;

  if p_insert_only then
    insert into public.topics (
      id, subject, subcategory, course_id, chapter_id,
      title, emoji, color, description, is_free,
      lesson, journey, published
    )
    select
      x.id,
      coalesce(nullif(btrim(x.subject), ''), 'General'),
      nullif(btrim(x.subcategory), ''),
      nullif(btrim(x.course_id), ''),
      case when nullif(btrim(x.course_id), '') is null then null
           else nullif(btrim(x.chapter_id), '') end,
      coalesce(nullif(btrim(x.title), ''), ''),
      coalesce(nullif(btrim(x.emoji), ''), '🎯'),
      coalesce(nullif(btrim(x.color), ''), '#4ECDC4'),
      coalesce(x.description, ''),
      coalesce(x.is_free, false),
      x.lesson,
      x.journey,
      coalesce(x.published, true)
    from jsonb_to_recordset(p_topics) as x(
      id text, subject text, subcategory text,
      course_id text, chapter_id text,
      title text, emoji text, color text,
      description text, is_free boolean,
      lesson jsonb, journey jsonb, published boolean
    )
    on conflict (id) do nothing;
  else
    insert into public.topics (
      id, subject, subcategory, course_id, chapter_id,
      title, emoji, color, description, is_free,
      lesson, journey, published
    )
    select
      x.id,
      coalesce(nullif(btrim(x.subject), ''), 'General'),
      nullif(btrim(x.subcategory), ''),
      nullif(btrim(x.course_id), ''),
      case when nullif(btrim(x.course_id), '') is null then null
           else nullif(btrim(x.chapter_id), '') end,
      coalesce(nullif(btrim(x.title), ''), ''),
      coalesce(nullif(btrim(x.emoji), ''), '🎯'),
      coalesce(nullif(btrim(x.color), ''), '#4ECDC4'),
      coalesce(x.description, ''),
      coalesce(x.is_free, false),
      x.lesson,
      x.journey,
      coalesce(x.published, true)
    from jsonb_to_recordset(p_topics) as x(
      id text, subject text, subcategory text,
      course_id text, chapter_id text,
      title text, emoji text, color text,
      description text, is_free boolean,
      lesson jsonb, journey jsonb, published boolean
    )
    on conflict (id) do update set
      subject = excluded.subject,
      subcategory = excluded.subcategory,
      course_id = excluded.course_id,
      chapter_id = excluded.chapter_id,
      title = excluded.title,
      emoji = excluded.emoji,
      color = excluded.color,
      description = excluded.description,
      is_free = excluded.is_free,
      lesson = excluded.lesson,
      journey = excluded.journey,
      published = excluded.published;
  end if;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.sync_topics_batch(jsonb, boolean) from public;
grant execute on function public.sync_topics_batch(jsonb, boolean) to service_role;
