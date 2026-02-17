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
  v_role text := current_setting('request.jwt.claim.role', true);
  v_count integer := 0;
begin
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

  if p_insert_only then
    insert into public.topics (
      id,
      subject,
      subcategory,
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
