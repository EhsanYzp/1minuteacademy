# Content Generation Playbook

This document is the single reference for creating new 1MinuteAcademy modules (topics) at scale.

## Goal

Create modules as **data** (JSON) so you can ship thousands of topics without adding new React pages/components per module.

A module = one row in Supabase `public.topics` (or one local JSON file that can be synced into that table).

## Where content lives

### Local authoring (recommended for drafting)

- `content/topics/<Subject>/<topicId>.topic.json`
  - Example: `content/topics/Technology/quantum.topic.json`

Draft-only (ignored by git):
- `content/_drafts/`
- `content/_local/`

### Production

- Supabase table: `public.topics`
  - Column `lesson` is the whole lesson JSON

## Topic JSON format (high level)

Required fields:
- `id`: stable slug (used in URLs like `/topic/:id` and `/lesson/:id`)
- `subject`: category grouping (e.g. `Technology`)
- `title`, `emoji`, `color`, `description`, `difficulty`, `published`
- `lesson`: `{ version, totalSeconds, xp, steps: [...] }`

Validation:
- Schemas live in `content/schema/`
- Run `npm run content:validate` before preview/sync

## Step types (reusable interactions)

A lesson is a timed sequence of steps. Each step has a `type` which maps to a reusable React component.

Current supported step types:
- `intro`
- `tapReveal`
- `buildChain`
- `summary`

These are implemented in `src/engine/stepTypes/` and mapped in `src/engine/LessonRenderer.jsx`.

### Rule of thumb

- Adding a new topic should only require editing JSON.
- Only add new step types when you need a brand-new interaction pattern.

## Preview vs publish

### Local preview (fast iteration)

1. Add/edit JSON under `content/topics/**`
2. Validate: `npm run content:validate`
3. Run: `npm run dev:local`

In local preview:
- The app reads topics/lessons from `content/topics/**`
- XP/streak are stored in `localStorage`
- `/lesson/:topicId` does not require login
- Header shows a `LOCAL PREVIEW` badge

### Publish to Supabase (production)

1. Ensure JSON validates (`npm run content:validate`)
2. Set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (scripts only)
3. Run: `npm run content:sync`

This bulk upserts all topic JSON files into `public.topics`.

Notes:
- The sync script auto-loads `.env.local`.
- Find the key in Supabase Dashboard → Project Settings → API → Project API keys → `service_role`.
- Guardrail: the sync script refuses to run if `VITE_SUPABASE_SERVICE_ROLE_KEY` is set.

## Content guidelines (so it fits in 60 seconds)

- Keep text short; prefer 1–2 sentences per step.
- Use 3–4 steps per lesson for clarity.
- Sum of all `steps[].seconds` should equal `lesson.totalSeconds` (target: 60).
- Prefer simple interactions that a user can complete quickly (tap reveal, quick build, 3-option checks).

## Adding a new step type (code change)

When you need a new interaction pattern:
1. Add a new component under `src/engine/stepTypes/`
2. Map it in `src/engine/LessonRenderer.jsx`
3. Add the new type to `content/schema/step.schema.json`
4. Run `npm run build`

This is the only time adding content requires a frontend build/deploy.
