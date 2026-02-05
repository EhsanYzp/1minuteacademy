-- P1.6: Add subcategories to topics
--
-- Adds an optional `subcategory` column to `public.topics` and updates
-- server-side search to include it.

alter table public.topics
add column if not exists subcategory text;

-- Default existing rows to 'General' for nicer grouping.
update public.topics
set subcategory = 'General'
where subcategory is null;

create index if not exists topics_subject_subcategory_idx
on public.topics (subject, subcategory)
where published = true;

-- Rebuild search index to include subcategory.
drop index if exists public.topics_search_tsv_idx;
create index if not exists topics_search_tsv_idx
on public.topics
using gin (
  to_tsvector(
    'simple',
    coalesce(title, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(subject, '') || ' ' ||
    coalesce(subcategory, '')
  )
)
where published = true;

-- NOTE: Postgres cannot change a function's OUT parameter row type with
-- `create or replace function`. We must drop it first.
drop function if exists public.search_topics_page(text, text, integer, integer);

-- Update RPC: search topics with pagination and an optional subject filter.
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
  difficulty text,
  total_count bigint
)
language plpgsql
security definer
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
      t.difficulty
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

revoke all on function public.search_topics_page(text, text, integer, integer) from public;
grant execute on function public.search_topics_page(text, text, integer, integer) to anon;
grant execute on function public.search_topics_page(text, text, integer, integer) to authenticated;
