-- 1MinuteAcademy - Supabase schema (day 0)
-- Run this in Supabase SQL editor.

-- Extensions
create extension if not exists pgcrypto;

-- Utility: updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Topics: single source of truth for content
create table if not exists public.topics (
  id text primary key,
  subject text not null default 'General',
  title text not null,
  emoji text not null default '🎯',
  color text not null default '#4ECDC4',
  description text not null default '',
  difficulty text not null default 'Beginner',
  lesson jsonb not null,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_topics_updated_at on public.topics;
create trigger trg_topics_updated_at
before update on public.topics
for each row execute procedure public.set_updated_at();

-- User stats (xp + streak)
create table if not exists public.user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0,
  streak integer not null default 0,
  last_completed_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_user_stats_updated_at on public.user_stats;
create trigger trg_user_stats_updated_at
before update on public.user_stats
for each row execute procedure public.set_updated_at();

-- Per-topic progress
create table if not exists public.user_topic_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id text not null references public.topics(id) on delete cascade,
  best_seconds integer,
  completed_count integer not null default 0,
  last_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

-- New installs: speed up profile ordering queries (no need for CONCURRENTLY here)
create index if not exists user_topic_progress_user_last_idx
on public.user_topic_progress(user_id, last_completed_at desc);

drop trigger if exists trg_user_topic_progress_updated_at on public.user_topic_progress;
create trigger trg_user_topic_progress_updated_at
before update on public.user_topic_progress
for each row execute procedure public.set_updated_at();

-- RLS
alter table public.topics enable row level security;
alter table public.user_stats enable row level security;
alter table public.user_topic_progress enable row level security;

-- Topics: readable by everyone
drop policy if exists "topics_select_all" on public.topics;
create policy "topics_select_all" on public.topics
for select using (published = true);

-- IMPORTANT (Security): do NOT allow normal authenticated users to write topics.
-- Content is production-critical and should only be written by trusted admin paths.
-- Recommended options:
--   1) Use the service role key from server-side code / scripts (bypasses RLS)
--   2) Add an explicit admin-only policy (see supabase/003_lockdown_topics_rls.sql)

-- Stats/progress: only owner
drop policy if exists "user_stats_owner" on public.user_stats;
create policy "user_stats_owner" on public.user_stats
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user_topic_progress_owner" on public.user_topic_progress;
create policy "user_topic_progress_owner" on public.user_topic_progress
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- RPC: complete a topic => award XP + update streak + progress, atomically
create or replace function public.complete_topic(
  p_topic_id text,
  p_xp integer,
  p_seconds integer
)
returns table (xp integer, streak integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_last date;
  v_streak integer;
  v_xp integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Ensure stats row exists
  insert into public.user_stats (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select us.last_completed_date, us.streak, us.xp
  into v_last, v_streak, v_xp
  from public.user_stats as us
  where us.user_id = v_user_id
  for update;

  -- Streak logic
  if v_last is null then
    v_streak := 1;
  elsif v_last = v_today then
    -- same day, keep streak
    v_streak := v_streak;
  elsif v_last = (v_today - 1) then
    v_streak := v_streak + 1;
  else
    v_streak := 1;
  end if;

  v_xp := coalesce(v_xp, 0) + coalesce(p_xp, 0);

  update public.user_stats
    set xp = v_xp,
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

  return query select v_xp as xp, v_streak as streak;
end;
$$;

-- Allow authenticated users to call the RPC
revoke all on function public.complete_topic(text, integer, integer) from public;
grant execute on function public.complete_topic(text, integer, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- CONTENT SEEDS (DAY 0 ONLY)
--
-- These inserts are meant for initial bootstrapping / examples.
-- For ongoing content work (adding/editing modules), avoid re-running this file
-- as your workflow. Instead, author JSON in content/topics/** and publish with:
--   npm run content:sync -- --topic <topicId>
--
-- The sync script is version-gated by lesson.version to avoid accidental
-- overwrites of manual Supabase edits.
-- -----------------------------------------------------------------------------

-- Seed: blockchain topic (data-driven lesson)
insert into public.topics (id, subject, title, emoji, color, description, difficulty, lesson, published)
values (
  'blockchain',
  'Blockchain & Web3',
  'What is Blockchain?',
  '🔗',
  '#4ECDC4',
  'Learn how blockchain works in 60 seconds with interactive mini-games!',
  'Beginner',
  jsonb_build_object(
    'version', 1,
    'totalSeconds', 60,
    'xp', 50,
    'steps', jsonb_build_array(
      jsonb_build_object(
        'id', 'intro',
        'type', 'intro',
        'seconds', 8,
        'title', 'Blockchain = Digital Notebook',
        'emoji', '🔗',
        'text', 'Everyone can read it, nobody can cheat.'
      ),
      jsonb_build_object(
        'id', 'block',
        'type', 'tapReveal',
        'seconds', 16,
        'title', 'What is a Block?',
        'prompt', 'Tap to open the block!',
        'items', jsonb_build_array(
          jsonb_build_object('icon','📝','text','Data'),
          jsonb_build_object('icon','🔢','text','Unique ID'),
          jsonb_build_object('icon','🔙','text','Link to previous')
        )
      ),
      jsonb_build_object(
        'id', 'chain',
        'type', 'buildChain',
        'seconds', 18,
        'title', 'Chaining Blocks',
        'target', 2,
        'genesisLabel', 'Genesis',
        'blockLabel', 'Block',
        'hint', 'Add 2 blocks to build the chain!'
      ),
      jsonb_build_object(
        'id', 'summary',
        'type', 'summary',
        'seconds', 18,
        'title', 'You Did It!',
        'points', jsonb_build_array(
          '🧱 Blocks store data',
          '⛓️ Blocks link together',
          '🔒 Tampering breaks the chain'
        ),
        'uses', jsonb_build_array('💰','🗳️','📋','🏥'),
        'congrats', '🎉 Blockchain Expert! 🎉'
      )
    )
  ),
  true
)
on conflict (id) do update set
  subject = excluded.subject,
  title = excluded.title,
  emoji = excluded.emoji,
  color = excluded.color,
  description = excluded.description,
  difficulty = excluded.difficulty,
  lesson = excluded.lesson,
  published = excluded.published;

-- Seed: quantum topic (data-driven lesson)
insert into public.topics (id, subject, title, emoji, color, description, difficulty, lesson, published)
values (
  'quantum',
  'Quantum & Physics',
  'Quantum Computing (in 60s)',
  '⚛️',
  '#A06CD5',
  'A friendly, game-like intro to qubits, superposition, and why quantum is special.',
  'Beginner',
  jsonb_build_object(
    'version', 1,
    'totalSeconds', 60,
    'xp', 60,
    'steps', jsonb_build_array(
      jsonb_build_object(
        'id', 'intro',
        'type', 'intro',
        'seconds', 10,
        'title', 'Quantum = Weird (and useful)',
        'emoji', '⚛️',
        'text', 'Quantum computers use qubits—tiny systems that behave in surprising ways.'
      ),
      jsonb_build_object(
        'id', 'qubit',
        'type', 'tapReveal',
        'seconds', 16,
        'title', 'Qubit (vs bit)',
        'prompt', 'Tap to reveal the difference!',
        'successText', '✅ You got the qubit idea.',
        'items', jsonb_build_array(
          jsonb_build_object('icon','0️⃣','text','A bit is 0 OR 1'),
          jsonb_build_object('icon','🌀','text','A qubit can be a mix (superposition)'),
          jsonb_build_object('icon','📏','text','Measuring forces a single result')
        )
      ),
      jsonb_build_object(
        'id', 'entangle',
        'type', 'tapReveal',
        'seconds', 16,
        'title', 'Entanglement',
        'prompt', 'Tap to reveal the magic link!',
        'successText', '✅ Entangled = correlated, not telepathy.',
        'items', jsonb_build_array(
          jsonb_build_object('icon','🔗','text','Two qubits can share one combined state'),
          jsonb_build_object('icon','🎲','text','Outcomes are correlated when measured'),
          jsonb_build_object('icon','🚫','text','No faster-than-light messaging')
        )
      ),
      jsonb_build_object(
        'id', 'summary',
        'type', 'summary',
        'seconds', 18,
        'title', 'So what’s it good for?',
        'points', jsonb_build_array(
          '⚛️ Qubits can be superposed',
          '🔗 Entanglement creates correlations',
          '🧮 Some problems get big speedups'
        ),
        'uses', jsonb_build_array('🔐','🧪','📈','🧠'),
        'congrats', '🎉 Quantum Curious! 🎉'
      )
    )
  ),
  true
)
on conflict (id) do update set
  subject = excluded.subject,
  title = excluded.title,
  emoji = excluded.emoji,
  color = excluded.color,
  description = excluded.description,
  difficulty = excluded.difficulty,
  lesson = excluded.lesson,
  published = excluded.published;
