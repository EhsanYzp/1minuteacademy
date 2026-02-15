-- DEPRECATED / SUPERSEDED
--
-- This migration awarded "Minute Expert" minutes to any authenticated, non-paused user.
-- The product rule has since changed: Minute Expert + badges are Pro-only.
--
-- If this file has already been deployed, do NOT try to roll it back.
-- Instead, deploy `supabase/022_minute_expert_pro_only.sql`, which replaces
-- `public.complete_topic(...)` with the Pro-only awarding rule.
--
-- Keeping this file for historical context.

-- Award "Minute Expert" minutes to any authenticated, non-paused user.
--
-- Notes:
-- - The underlying counter remains user_stats.one_ma_balance.
-- - The RPC return shape stays: (one_ma_balance, streak, awarded_one_ma).
-- - Previously this awarded minutes only for Pro; this migration awards for Free + Pro.

create or replace function public.complete_topic(
  p_topic_id text,
  p_seconds integer
)
returns table (one_ma_balance integer, streak integer, awarded_one_ma integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_last date;
  v_streak integer;
  v_balance integer;
  v_awarded integer := 0;
  v_plan text;
  v_paused boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Ensure stats row exists
  insert into public.user_stats (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  -- Lock stats row
  select us.last_completed_date, us.streak, us.one_ma_balance
  into v_last, v_streak, v_balance
  from public.user_stats as us
  where us.user_id = v_user_id
  for update;

  -- Streak logic
  if v_last is null then
    v_streak := 1;
  elsif v_last = v_today then
    v_streak := v_streak;
  elsif v_last = (v_today - 1) then
    v_streak := v_streak + 1;
  else
    v_streak := 1;
  end if;

  -- Determine tier from auth metadata (mirrors frontend entitlements)
  select
    lower(coalesce(au.raw_user_meta_data->>'plan', au.raw_app_meta_data->>'plan', 'free')),
    coalesce((au.raw_user_meta_data->>'paused')::boolean, false)
  into v_plan, v_paused
  from auth.users au
  where au.id = v_user_id;

  -- New rule: award minutes to any authenticated learner (Free or Pro), but not paused.
  -- (Guests can't call this RPC because it's only granted to authenticated.)
  v_awarded := case when not v_paused then 1 else 0 end;

  v_balance := coalesce(v_balance, 0) + v_awarded;

  update public.user_stats
    set one_ma_balance = v_balance,
        streak = v_streak,
        last_completed_date = v_today
  where user_id = v_user_id;

  -- Upsert per-topic progress
  insert into public.user_topic_progress (user_id, topic_id, best_seconds, completed_count, last_completed_at)
  values (v_user_id, p_topic_id, p_seconds, 1, now())
  on conflict (user_id, topic_id)
  do update set
    best_seconds = case
      when public.user_topic_progress.best_seconds is null then excluded.best_seconds
      when excluded.best_seconds < public.user_topic_progress.best_seconds then excluded.best_seconds
      else public.user_topic_progress.best_seconds
    end,
    completed_count = public.user_topic_progress.completed_count + 1,
    last_completed_at = now();

  return query select v_balance as one_ma_balance, v_streak as streak, v_awarded as awarded_one_ma;
end;
$$;

-- Backwards-compatible wrapper: old 3-arg signature (ignores xp)
create or replace function public.complete_topic(
  p_topic_id text,
  p_xp integer,
  p_seconds integer
)
returns table (one_ma_balance integer, streak integer, awarded_one_ma integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select * from public.complete_topic(p_topic_id, p_seconds);
end;
$$;

revoke all on function public.complete_topic(text, integer) from public;
revoke all on function public.complete_topic(text, integer, integer) from public;

grant execute on function public.complete_topic(text, integer) to authenticated;
grant execute on function public.complete_topic(text, integer, integer) to authenticated;
