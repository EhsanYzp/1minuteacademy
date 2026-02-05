-- P1.3: Add missing indexes (ratings + progress)
--
-- Notes:
-- - These are safe, additive changes.
-- - Supabase SQL editor runs statements inside a transaction, so
--   `CREATE INDEX CONCURRENTLY` will fail there.
-- - The statements below intentionally do NOT use CONCURRENTLY so they work
--   in the Supabase SQL editor.
-- - If you're on a busy production DB and need minimal write-locking, use the
--   CONCURRENTLY variants (see bottom) via psql/outside a transaction.

-- Ratings: speed up lookups by topic_id (PK is (user_id, topic_id))
create index if not exists topic_ratings_topic_id_idx
on public.topic_ratings(topic_id);

-- Progress: speed up profile progress ordering per user
create index if not exists user_topic_progress_user_last_idx
on public.user_topic_progress(user_id, last_completed_at desc);

-- Optional (busy prod): run these OUTSIDE a transaction via psql
-- create index concurrently if not exists topic_ratings_topic_id_idx
-- on public.topic_ratings(topic_id);
--
-- create index concurrently if not exists user_topic_progress_user_last_idx
-- on public.user_topic_progress(user_id, last_completed_at desc);
