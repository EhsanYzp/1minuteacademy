-- Adds a schema-first journey spec to topics.
-- Safe, additive migration.

alter table public.topics
add column if not exists journey jsonb;

-- Optional index for future JSON path queries.
create index if not exists topics_journey_gin on public.topics using gin (journey);
