-- P1.4: Make topic search server-side (full-text + pagination)
--
-- Goal:
-- - Avoid downloading the full topics catalog just to search.
-- - Provide a fast, indexed, public-safe search RPC for browse.

-- Full-text search index (expression + partial on published)
-- Note: uses the 'simple' config to avoid surprising stemming and to work better
-- across mixed content.
create index if not exists topics_search_tsv_idx
on public.topics
using gin (
  to_tsvector(
    'simple',
    coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(subject, '')
  )
)
where published = true;

-- RPC: search topics with pagination and an optional subject filter.
-- Returns `total_count` via a window function so the client can show totals.
create or replace function public.search_topics_page(
  p_query text,
  p_subject text default null,
  p_limit integer default 36,
  p_offset integer default 0
)
returns table (
  id text,
  subject text,
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
            coalesce(t.title, '') || ' ' || coalesce(t.description, '') || ' ' || coalesce(t.subject, '')
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
