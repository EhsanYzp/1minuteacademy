-- SCALE-02: TTL / cleanup for stripe_webhook_events
--
-- Goal: prevent unbounded growth of stripe_webhook_events by periodically deleting old rows.
--
-- This migration:
-- 1) Adds a callable cleanup function: `public.cleanup_stripe_webhook_events()` (defaults to 30 days)
-- 2) Attempts to schedule a daily run via pg_cron (if available)
--
-- Notes:
-- - Supabase projects may or may not have pg_cron enabled.
-- - If pg_cron isn't available, you can run the cleanup manually (or from an external cron):
--     select public.cleanup_stripe_webhook_events();

create or replace function public.cleanup_stripe_webhook_events(retention_days integer default 30)
returns void
language plpgsql
security definer
as $$
declare
  days int := greatest(1, coalesce(retention_days, 30));
begin
  delete from public.stripe_webhook_events
  where first_seen_at < now() - make_interval(days => days);
end;
$$;

revoke all on function public.cleanup_stripe_webhook_events(integer) from public;

do $$
begin
  -- If pg_cron isn't available in this environment, skip scheduling.
  begin
    create extension if not exists pg_cron;
  exception
    when insufficient_privilege then
      raise notice 'pg_cron not available (insufficient_privilege); skipping scheduling cleanup_stripe_webhook_events.';
      return;
    when undefined_file then
      raise notice 'pg_cron not available (undefined_file); skipping scheduling cleanup_stripe_webhook_events.';
      return;
  end;

  if to_regclass('cron.job') is null then
    raise notice 'pg_cron installed but cron.job not found; skipping scheduling cleanup_stripe_webhook_events.';
    return;
  end if;

  -- Ensure the schedule is idempotent (unschedule previous job with same name).
  if exists (select 1 from cron.job where jobname = 'cleanup_stripe_webhook_events_daily') then
    perform cron.unschedule((select jobid from cron.job where jobname = 'cleanup_stripe_webhook_events_daily' limit 1));
  end if;

  perform cron.schedule(
    'cleanup_stripe_webhook_events_daily',
    '10 3 * * *',
    $cmd$select public.cleanup_stripe_webhook_events(30);$cmd$
  );
end $$;
