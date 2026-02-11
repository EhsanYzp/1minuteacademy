-- SCALE-01: TTL / cleanup for api_rate_limits
--
-- Goal: prevent unbounded growth of api_rate_limits by periodically deleting old buckets.
--
-- This migration:
-- 1) Adds a callable cleanup function: `public.cleanup_api_rate_limits()`
-- 2) Attempts to schedule a daily run via pg_cron (if available)
--
-- Notes:
-- - Supabase projects may or may not have pg_cron enabled.
-- - If pg_cron isn't available, you can run the cleanup manually (or from an external cron):
--     select public.cleanup_api_rate_limits();

create or replace function public.cleanup_api_rate_limits()
returns void
language sql
security definer
as $$
  delete from public.api_rate_limits
  where window_start < now() - interval '1 day';
$$;

revoke all on function public.cleanup_api_rate_limits() from public;

do $$
begin
  -- If pg_cron isn't available in this environment, skip scheduling.
  begin
    create extension if not exists pg_cron;
  exception
    when insufficient_privilege then
      raise notice 'pg_cron not available (insufficient_privilege); skipping scheduling cleanup_api_rate_limits.';
      return;
    when undefined_file then
      raise notice 'pg_cron not available (undefined_file); skipping scheduling cleanup_api_rate_limits.';
      return;
  end;

  if to_regclass('cron.job') is null then
    raise notice 'pg_cron installed but cron.job not found; skipping scheduling cleanup_api_rate_limits.';
    return;
  end if;

  -- Ensure the schedule is idempotent (unschedule previous job with same name).
  if exists (select 1 from cron.job where jobname = 'cleanup_api_rate_limits_daily') then
    perform cron.unschedule((select jobid from cron.job where jobname = 'cleanup_api_rate_limits_daily' limit 1));
  end if;

  perform cron.schedule(
    'cleanup_api_rate_limits_daily',
    '0 3 * * *',
    $cmd$select public.cleanup_api_rate_limits();$cmd$
  );
end $$;
