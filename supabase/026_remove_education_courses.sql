-- Migration: Remove all education courses from the database
-- The education category itself is kept; only its courses, chapters,
-- topics, and related data are deleted.
-- This migration is idempotent — safe to run multiple times.

-- 1. Delete topic-level data (FK constraints require child-first order)
DELETE FROM topic_ratings    WHERE topic_id LIKE 'education--%';
DELETE FROM topic_progress   WHERE topic_id LIKE 'education--%';
DELETE FROM topics           WHERE id       LIKE 'education--%';

-- 2. Delete chapters
DELETE FROM chapters         WHERE course_id LIKE 'education--%';

-- 3. Delete courses (keeps the "education" category row)
DELETE FROM courses          WHERE id        LIKE 'education--%';
