# Content Generation Playbook

This document is the single reference for creating new 1MinuteAcademy modules (topics) at scale.

## Goal

Create modules as **data** (JSON) so you can ship thousands of topics without adding new React pages/components per module.

A module = one row in Supabase `public.topics` (or one local JSON file that can be synced into that table).

## Where content lives

### Local authoring (recommended for drafting)

- `content/topics/<Subject>/<topicId>.topic.json`
  - Example: `content/topics/Quantum & Physics/quantum.topic.json`

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
- `lesson`: `{ version, totalSeconds, steps: [...] }`

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
 - `eitherOr` (one-tap snap choice)
 - `tapSprint` (6–12 fast taps)
 - `recipe` (wraps a recipeId into one of the primitives)

These are implemented in `src/engine/stepTypes/` and mapped in `src/engine/LessonRenderer.jsx`.

### Step recipes (200+ options without 200 components)

Instead of creating hundreds of React step components, we keep a **small primitive set** and a large **recipe catalog**.

Use this in topic JSON:
- `type: "recipe"`
- `recipeId: "eitherOr_thisOrThat_01"` (pick from the catalog)

Catalog:
- See [step-recipes.md](step-recipes.md)

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
- 1MA balance/streak are stored in `localStorage`
- `/lesson/:topicId` does not require login
- Header shows a `LOCAL PREVIEW` badge

Tip: after completing a lesson, check `/me` (Profile) and the landing page badges to verify progress behavior.

### Scaffold a new topic JSON

Simple (writes `content/topics/<Subject>/<topicId>.topic.json`):

- `npm run content:scaffold -- --id <topicId> --subject "<Subject>" --title "<Title>" --description "<One-liner>"`

Hierarchy (recommended; writes `content/topics/<categoryId>/<courseId>/<chapterId>/<topicId>.topic.json`):

- `npm run content:scaffold -- --id <topicId> --title "<Title>" --courseId <courseId> --chapterId <chapterId> --description "<One-liner>"`

Optional:
- `--seed <any>` to make generated defaults deterministic
- `--dry-run` to print JSON without writing a file

### Publish to Supabase (production)

1. Ensure JSON validates (`npm run content:validate`)
2. Set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (scripts only)
3. Run one of:
  - Sync a single topic (recommended): `npm run content:sync -- --topic <topicId>`
  - Bulk sync (safe by default): `npm run content:sync`

By default, the sync script is *safe*:
- Inserts new topics
- Updates existing topics **only when** `lesson.version` in local JSON is **higher** than what’s already in Supabase

This prevents accidental overwrites if you made manual edits in Supabase.

To intentionally publish edits to an existing module:
- Bump `lesson.version` in the local topic JSON, then re-run sync.

Advanced flags:
- Preview without writing: `npm run content:sync -- --dry-run`
- Force an update regardless of version: `npm run content:sync -- --topic <id> --force`
- Only insert new topics (never update): `npm run content:sync -- --insert-only`

Notes:
- The sync script auto-loads `.env.local`.
- Find the key in Supabase Dashboard → Project Settings → API → Project API keys → `service_role`.
- Guardrail: the sync script refuses to run if `VITE_SUPABASE_SERVICE_ROLE_KEY` is set.

## Important: don’t use SQL as your content workflow

Use [supabase/001_init.sql](supabase/001_init.sql) for schema/RLS/RPC. Avoid adding new modules by editing the SQL file.

Instead:
- Draft new modules in `content/topics/**`
- Preview with `npm run dev:local`
- Publish with `npm run content:sync -- --topic <id>`

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
