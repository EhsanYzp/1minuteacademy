-- BILLING-FIX: Track cancel_at_period_end on stripe_customers
--
-- When a user cancels via the Stripe portal, Stripe keeps status = 'active'
-- until the end of the billing period but sets cancel_at_period_end = true.
-- Without this column we lose track of the cancellation intent and the DB
-- (and admin panel) continues to report the subscription as "active".
--
-- This migration adds:
--   cancel_at_period_end  boolean  (default false)
--   canceled_at           timestamptz  (when the user hit "cancel")

alter table public.stripe_customers
  add column if not exists cancel_at_period_end boolean not null default false;

alter table public.stripe_customers
  add column if not exists canceled_at timestamptz;
