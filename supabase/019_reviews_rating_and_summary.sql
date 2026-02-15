-- Reviews (testimonials) rating + summary helper
-- Adds a required 1-5 star rating to each review and exposes an aggregate summary.
--
-- Run this after 015_profiles_testimonials.sql

alter table public.testimonials
add column if not exists rating smallint not null default 5;

-- Add constraint safely (idempotent)
do $$
begin
  alter table public.testimonials
  add constraint testimonials_rating_range check (rating between 1 and 5);
exception
  when duplicate_object then null;
end $$;

-- Summary helper for the UI (avg stars + count)
create or replace function public.get_review_summary()
returns table(avg_rating numeric, reviews_count bigint)
language sql
stable
as $$
  select
    coalesce(avg(rating)::numeric, 0) as avg_rating,
    count(*) as reviews_count
  from public.testimonials
  where approved = true;
$$;

grant execute on function public.get_review_summary() to anon, authenticated;
