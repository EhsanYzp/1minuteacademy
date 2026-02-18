-- SCALE-05: Atomic topic sync RPC for scripts
--
-- Provides a single-statement upsert/insert-only path so the sync script can
-- avoid partial writes (insert succeeds, upsert fails) and can chunk safely.

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
  -- PostgREST/Supabase may expose JWT claims either as individual settings
  -- (request.jwt.claim.<name>) or as a single JSON blob (request.jwt.claims).
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

  -- Never allow browser/client execution. This RPC is intended for the
  -- service role key used by scripts.
  if v_role is distinct from 'service_role' then
    raise exception 'forbidden';
  end if;

  if p_topics is null or jsonb_typeof(p_topics) <> 'array' then
    raise exception 'p_topics must be a JSON array';
  end if;

  if jsonb_array_length(p_topics) = 0 then
    return 0;
  end if;

  -- Ensure catalog parents exist before inserting/upserting topics.
  -- The catalog can be empty (fresh DB) while topics reference course_id/chapter_id.
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
      subject,
      subcategory,
      course_id,
      chapter_id,
      coalesce(
        nullif(
          regexp_replace(
            lower(regexp_replace(coalesce(subject, 'General'), '[^a-zA-Z0-9]+', '-', 'g')),
            '(^-+|-+$)',
            '',
            'g'
          ),
          ''
        ),
        'general'
      ) as category_id
    from src
  )
  insert into public.categories (id, title, published)
  select distinct
    n.category_id,
    coalesce(n.subject, 'General'),
    true
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
      subject,
      subcategory,
      course_id,
      coalesce(
        nullif(
          regexp_replace(
            lower(regexp_replace(coalesce(subject, 'General'), '[^a-zA-Z0-9]+', '-', 'g')),
            '(^-+|-+$)',
            '',
            'g'
          ),
          ''
        ),
        'general'
      ) as category_id
    from src
  )
  insert into public.courses (id, category_id, title, published)
  select distinct
    n.course_id,
    n.category_id,
    coalesce(n.subcategory, initcap(replace(n.course_id, '-', ' '))),
    true
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
  select distinct
    s.chapter_id,
    s.course_id,
    initcap(replace(s.chapter_id, '-', ' ')),
    0,
    true
  from src s
  where s.course_id is not null and s.chapter_id is not null
  on conflict (id) do nothing;

  if p_insert_only then
    insert into public.topics (
      id,
      subject,
      subcategory,
      course_id,
      chapter_id,
      title,
      emoji,
      color,
      description,
      difficulty,
      lesson,
      journey,
      published
    )
    select
      x.id,
      coalesce(nullif(btrim(x.subject), ''), 'General'),
      nullif(btrim(x.subcategory), ''),
      nullif(btrim(x.course_id), ''),
      case
        when nullif(btrim(x.course_id), '') is null then null
        else nullif(btrim(x.chapter_id), '')
      end,
      coalesce(nullif(btrim(x.title), ''), ''),
      coalesce(nullif(btrim(x.emoji), ''), '🎯'),
      coalesce(nullif(btrim(x.color), ''), '#4ECDC4'),
      coalesce(x.description, ''),
      coalesce(nullif(btrim(x.difficulty), ''), 'Beginner'),
      x.lesson,
      x.journey,
      coalesce(x.published, true)
    from jsonb_to_recordset(p_topics) as x(
      id text,
      subject text,
      subcategory text,
      course_id text,
      chapter_id text,
      title text,
      emoji text,
      color text,
      description text,
      difficulty text,
      lesson jsonb,
      journey jsonb,
      published boolean
    )
    on conflict (id) do nothing;
  else
    insert into public.topics (
      id,
      subject,
      subcategory,
      course_id,
      chapter_id,
      title,
      emoji,
      color,
      description,
      difficulty,
      lesson,
      journey,
      published
    )
    select
      x.id,
      coalesce(nullif(btrim(x.subject), ''), 'General'),
      nullif(btrim(x.subcategory), ''),
      nullif(btrim(x.course_id), ''),
      case
        when nullif(btrim(x.course_id), '') is null then null
        else nullif(btrim(x.chapter_id), '')
      end,
      coalesce(nullif(btrim(x.title), ''), ''),
      coalesce(nullif(btrim(x.emoji), ''), '🎯'),
      coalesce(nullif(btrim(x.color), ''), '#4ECDC4'),
      coalesce(x.description, ''),
      coalesce(nullif(btrim(x.difficulty), ''), 'Beginner'),
      x.lesson,
      x.journey,
      coalesce(x.published, true)
    from jsonb_to_recordset(p_topics) as x(
      id text,
      subject text,
      subcategory text,
      course_id text,
      chapter_id text,
      title text,
      emoji text,
      color text,
      description text,
      difficulty text,
      lesson jsonb,
      journey jsonb,
      published boolean
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
      difficulty = excluded.difficulty,
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
