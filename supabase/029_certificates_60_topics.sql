-- Certificates: award when a user completes >= 60 topics in a category (subject)
--
-- This updates the existing certificate awarding rule from:
--   "complete all published topics in a subject"
-- to:
--   "complete at least 60 published topics in that subject".
--
-- Notes:
-- - We keep the existing `public.user_certificates` table.
-- - We keep the existing `public.complete_topic(...)` hook, which already calls
--   `public.award_category_certificate_if_earned(...)`.
-- - Certificates remain Pro-only (guests and free users do not earn them).

create or replace function public.award_category_certificate_if_earned(
  p_user_id uuid,
  p_topic_id text,
  p_is_pro boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject text;
  v_done integer;
  v_required integer := 60;
  v_name text;
  v_avatar text;
  v_title text;
begin
  if p_user_id is null then
    return;
  end if;

  if not coalesce(p_is_pro, false) then
    return;
  end if;

  select coalesce(nullif(btrim(t.subject), ''), 'General')
  into v_subject
  from public.topics t
  where t.id = p_topic_id;

  if v_subject is null then
    return;
  end if;

  select count(*)::integer
  into v_done
  from public.user_topic_progress utp
  join public.topics t on t.id = utp.topic_id
  where utp.user_id = p_user_id
    and coalesce(utp.completed_count, 0) > 0
    and t.published = true
    and coalesce(nullif(btrim(t.subject), ''), 'General') = v_subject;

  if coalesce(v_done, 0) < v_required then
    return;
  end if;

  -- Snapshot recipient name/avatar from profiles for stability.
  select p.display_name, p.avatar_url
  into v_name, v_avatar
  from public.profiles p
  where p.user_id = p_user_id;

  v_title := v_subject || ' 1 Minute Expert';

  insert into public.user_certificates (
    user_id,
    subject,
    title,
    recipient_name,
    recipient_avatar_url,
    total_topics,
    completed_topics
  )
  values (
    p_user_id,
    v_subject,
    v_title,
    coalesce(nullif(btrim(v_name), ''), 'Member'),
    nullif(btrim(v_avatar), ''),
    v_required,
    v_done
  )
  on conflict (user_id, subject) do update
  set
    -- Keep the original identity snapshot stable.
    title = public.user_certificates.title,
    recipient_name = public.user_certificates.recipient_name,
    recipient_avatar_url = public.user_certificates.recipient_avatar_url,
    -- Keep the requirement fixed at 60; keep the completion count fresh.
    total_topics = excluded.total_topics,
    completed_topics = greatest(public.user_certificates.completed_topics, excluded.completed_topics);
end;
$$;

revoke all on function public.award_category_certificate_if_earned(uuid, text, boolean) from public;
grant execute on function public.award_category_certificate_if_earned(uuid, text, boolean) to authenticated;
