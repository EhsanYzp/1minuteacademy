-- P0.3: Rate limiting + idempotency primitives
--
-- This migration adds:
-- - A simple DB-backed rate limiter function `public.rate_limit_check()`
-- - A Stripe webhook event claim table/function to make webhook processing idempotent
-- - A cache table for Stripe Checkout session creation idempotency

-- =========================
-- Rate limiting (DB-backed)
-- =========================

create table if not exists public.api_rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (key, window_start)
);

alter table public.api_rate_limits enable row level security;

revoke all on table public.api_rate_limits from anon, authenticated;

create or replace function public.rate_limit_check(
  key text,
  window_seconds integer,
  max_count integer
)
returns table(
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
as $$
declare
  now_ts timestamptz := now();
  bucket_start timestamptz;
  bucket_end timestamptz;
  next_count integer;
begin
  if window_seconds is null or window_seconds <= 0 then
    raise exception 'window_seconds must be > 0';
  end if;
  if max_count is null or max_count <= 0 then
    raise exception 'max_count must be > 0';
  end if;

  bucket_start := to_timestamp(floor(extract(epoch from now_ts) / window_seconds) * window_seconds);
  bucket_end := bucket_start + make_interval(secs => window_seconds);

  insert into public.api_rate_limits as rl (key, window_start, count, updated_at)
  values (rate_limit_check.key, bucket_start, 1, now_ts)
  on conflict (key, window_start)
  do update set count = rl.count + 1, updated_at = now_ts
  returning count into next_count;

  allowed := next_count <= max_count;
  remaining := greatest(0, max_count - next_count);
  reset_at := bucket_end;
  return next;
end;
$$;

revoke all on function public.rate_limit_check(text, integer, integer) from public;

-- ==============================
-- Stripe webhook idempotency
-- ==============================

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  type text,
  status text not null default 'processing',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);

alter table public.stripe_webhook_events enable row level security;

revoke all on table public.stripe_webhook_events from anon, authenticated;

create or replace function public.claim_stripe_webhook_event(
  event_id text,
  event_type text
)
returns boolean
language plpgsql
security definer
as $$
declare
  existing_status text;
begin
  insert into public.stripe_webhook_events(event_id, type, status, first_seen_at, last_seen_at)
  values (claim_stripe_webhook_event.event_id, claim_stripe_webhook_event.event_type, 'processing', now(), now())
  on conflict (event_id) do nothing;

  select status into existing_status
  from public.stripe_webhook_events
  where stripe_webhook_events.event_id = claim_stripe_webhook_event.event_id
  for update;

  if existing_status = 'succeeded' then
    update public.stripe_webhook_events
      set last_seen_at = now()
      where stripe_webhook_events.event_id = claim_stripe_webhook_event.event_id;
    return false;
  end if;

  update public.stripe_webhook_events
    set type = claim_stripe_webhook_event.event_type,
        status = 'processing',
        last_seen_at = now(),
        last_error = null
    where stripe_webhook_events.event_id = claim_stripe_webhook_event.event_id;

  return true;
end;
$$;

revoke all on function public.claim_stripe_webhook_event(text, text) from public;

-- ==============================
-- Stripe Checkout idempotency cache
-- ==============================

create table if not exists public.stripe_checkout_session_cache (
  cache_key text primary key,
  user_id uuid not null,
  price_id text not null,
  interval text not null,
  checkout_session_id text,
  checkout_url text,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists stripe_checkout_session_cache_user_idx on public.stripe_checkout_session_cache(user_id);

alter table public.stripe_checkout_session_cache enable row level security;

revoke all on table public.stripe_checkout_session_cache from anon, authenticated;
