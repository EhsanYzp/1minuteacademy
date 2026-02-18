-- Category -> Course -> Chapter -> Topic (catalog v1)
--
-- This migration introduces a normalized catalog structure while keeping
-- topic rows compatible with the existing app (subject/subcategory used
-- as category/course display values).

-- 1) Catalog tables
create table if not exists public.categories (
  id text primary key,
  title text not null,
  emoji text,
  color text,
  description text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- Public read access is controlled via RLS (published-only).
alter table public.categories enable row level security;
grant select on table public.categories to anon;
grant select on table public.categories to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'categories_public_read'
  ) then
    execute 'create policy categories_public_read on public.categories for select using (published = true)';
  end if;
end $$;

-- If the table already existed (from a partial/older migration), ensure columns exist.
alter table public.categories
  add column if not exists title text,
  add column if not exists emoji text,
  add column if not exists color text,
  add column if not exists description text,
  add column if not exists published boolean,
  add column if not exists created_at timestamptz;

alter table public.categories
  alter column published set default true,
  alter column created_at set default now();

create table if not exists public.courses (
  id text primary key,
  category_id text not null references public.categories(id) on delete cascade,
  title text not null,
  emoji text,
  color text,
  description text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;
grant select on table public.courses to anon;
grant select on table public.courses to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'courses'
      and policyname = 'courses_public_read'
  ) then
    execute 'create policy courses_public_read on public.courses for select using (published = true)';
  end if;
end $$;

-- If the table already existed (from a partial/older migration), ensure columns exist.
alter table public.courses
  add column if not exists category_id text,
  add column if not exists title text,
  add column if not exists emoji text,
  add column if not exists color text,
  add column if not exists description text,
  add column if not exists published boolean,
  add column if not exists created_at timestamptz;

alter table public.courses
  alter column published set default true,
  alter column created_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'courses_category_id_fkey'
  ) then
    alter table public.courses
      add constraint courses_category_id_fkey
      foreign key (category_id)
      references public.categories(id)
      on delete cascade;
  end if;
end $$;

create index if not exists courses_category_id_idx
on public.courses (category_id)
where published = true;

create table if not exists public.chapters (
  id text primary key,
  course_id text not null references public.courses(id) on delete cascade,
  title text not null,
  position integer not null default 0,
  description text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.chapters enable row level security;
grant select on table public.chapters to anon;
grant select on table public.chapters to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chapters'
      and policyname = 'chapters_public_read'
  ) then
    execute 'create policy chapters_public_read on public.chapters for select using (published = true)';
  end if;
end $$;

-- If the table already existed (from a partial/older migration), ensure columns exist.
alter table public.chapters
  add column if not exists course_id text,
  add column if not exists title text,
  add column if not exists position integer,
  add column if not exists description text,
  add column if not exists published boolean,
  add column if not exists created_at timestamptz;

alter table public.chapters
  alter column position set default 0,
  alter column published set default true,
  alter column created_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chapters_course_id_fkey'
  ) then
    alter table public.chapters
      add constraint chapters_course_id_fkey
      foreign key (course_id)
      references public.courses(id)
      on delete cascade;
  end if;
end $$;

create index if not exists chapters_course_id_position_idx
on public.chapters (course_id, position)
where published = true;

-- 2) Topics table (source-of-truth for lesson content)
-- Recreate if it was deleted. Keep legacy columns (subject/subcategory) so the
-- existing UI/business logic can continue to work during the transition.
create table if not exists public.topics (
  id text primary key,
  -- legacy-compatible fields
  subject text not null,
  subcategory text not null,

  -- new catalog linkage
  course_id text references public.courses(id) on delete set null,
  chapter_id text references public.chapters(id) on delete set null,

  title text not null,
  emoji text not null default '🎯',
  color text not null default '#4ECDC4',
  description text not null default '',
  difficulty text not null default 'Beginner',
  published boolean not null default true,

  -- lesson payloads
  story jsonb,
  quiz jsonb,
  journey jsonb,
  lesson jsonb,

  created_at timestamptz not null default now()
);

alter table public.topics enable row level security;
grant select on table public.topics to anon;
grant select on table public.topics to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'topics'
      and policyname = 'topics_public_read'
  ) then
    execute 'create policy topics_public_read on public.topics for select using (published = true)';
  end if;
end $$;

-- If the table already existed (from a partial/older migration), ensure columns exist.
alter table public.topics
  add column if not exists subject text,
  add column if not exists subcategory text,
  add column if not exists course_id text,
  add column if not exists chapter_id text,
  add column if not exists title text,
  add column if not exists emoji text,
  add column if not exists color text,
  add column if not exists description text,
  add column if not exists difficulty text,
  add column if not exists published boolean,
  add column if not exists story jsonb,
  add column if not exists quiz jsonb,
  add column if not exists journey jsonb,
  add column if not exists lesson jsonb,
  add column if not exists created_at timestamptz;

alter table public.topics
  alter column emoji set default '🎯',
  alter column color set default '#4ECDC4',
  alter column description set default '',
  alter column difficulty set default 'Beginner',
  alter column published set default true,
  alter column created_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'topics_course_id_fkey'
  ) then
    alter table public.topics
      add constraint topics_course_id_fkey
      foreign key (course_id)
      references public.courses(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'topics_chapter_id_fkey'
  ) then
    alter table public.topics
      add constraint topics_chapter_id_fkey
      foreign key (chapter_id)
      references public.chapters(id)
      on delete set null;
  end if;
end $$;

create index if not exists topics_course_id_idx
on public.topics (course_id)
where published = true;

create index if not exists topics_chapter_id_idx
on public.topics (chapter_id)
where published = true;

create index if not exists topics_subject_subcategory_idx
on public.topics (subject, subcategory)
where published = true;

-- Search index for the existing RPC search_topics_page
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

-- 3) RPC: category counts (legacy-compatible)
create or replace function public.get_topic_category_counts()
returns table (
  subject text,
  topic_count bigint
)
language sql
security invoker
set search_path = public
stable
as $$
  select
    coalesce(nullif(btrim(t.subject), ''), 'General') as subject,
    count(*)::bigint as topic_count
  from public.topics t
  where t.published = true
  group by 1
  order by 1 asc;
$$;

revoke all on function public.get_topic_category_counts() from public;
grant execute on function public.get_topic_category_counts() to anon;
grant execute on function public.get_topic_category_counts() to authenticated;

-- 4) RPC: paginated topic search (legacy-compatible)
-- NOTE: Keep name/signature used by the app.
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

-- 5) No seed data in this migration.
