-- Migration: Remove all education courses from the database
-- The education category itself is kept; only its courses, chapters,
-- topics, and related data are deleted.
-- This migration is idempotent — safe to run multiple times.

-- 1. Delete topic-level data (FK constraints require child-first order)
DELETE FROM public.topic_ratings       WHERE topic_id LIKE 'education--%';
DELETE FROM public.user_topic_progress WHERE topic_id LIKE 'education--%';
DELETE FROM public.topics              WHERE id       LIKE 'education--%';

-- 2. Delete chapters
DELETE FROM public.chapters            WHERE course_id LIKE 'education--%';

-- 3. Delete courses (keeps the "education" category row)
DELETE FROM public.courses             WHERE id        LIKE 'education--%';
