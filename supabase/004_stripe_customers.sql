-- 1MinuteAcademy - Stripe customer/subscription mapping (P0.2)
--
-- Purpose:
-- - Persist a durable mapping between Supabase users and Stripe customer/subscription IDs.
-- - Make webhooks reliable even when Stripe metadata is missing.
--
-- Run this after 001_init.sql.

create table if not exists public.stripe_customers (
  customer_id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  subscription_id text,
  status text,
  price_id text,
  interval text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh
-- Depends on public.set_updated_at() from 001_init.sql

drop trigger if exists trg_stripe_customers_updated_at on public.stripe_customers;
create trigger trg_stripe_customers_updated_at
before update on public.stripe_customers
for each row execute procedure public.set_updated_at();

-- Useful for lookups by subscription
create unique index if not exists stripe_customers_subscription_id_uq
  on public.stripe_customers(subscription_id)
  where subscription_id is not null;

create index if not exists stripe_customers_user_id_idx
  on public.stripe_customers(user_id);

-- Lock down access: server-only table
alter table public.stripe_customers enable row level security;

revoke all on table public.stripe_customers from anon;
revoke all on table public.stripe_customers from authenticated;

-- No RLS policies intentionally: only service role should read/write.
