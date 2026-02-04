# 1MinuteAcademy – Platform Architecture (scales to 1,000s of modules)

The key idea: **modules are data** (JSON in Supabase), and the app is a **renderer**.
You do *not* create React components per module.

## What scales

### 1) Content (thousands of modules)
- Stored in Supabase table: `public.topics`
  - `id`, `subject`, `title`, `emoji`, `color`, `description`, `difficulty`, `published`
  - `lesson` (JSON): `{ totalSeconds, xp, steps: [...] }`
- Optional local authoring source-of-truth:
  - `content/topics/<Subject>/<topicId>.topic.json`
  - Validated with JSON schema in `content/schema/`
  - Bulk synced with `npm run content:sync`

### 2) Engine (small, stable code)
- Folder: `src/engine/`
- `LessonRenderer` selects the active step based on time remaining.
- `src/engine/stepTypes/` contains a *small set* of reusable step types:
  - `intro`, `tapReveal`, `buildChain`, `summary`

When you add thousands of modules, you mostly add JSON files/rows — the engine code stays almost constant.

### 3) Accounts + progress
- Auth: Supabase Auth
- Progress tables:
  - `public.user_stats` (xp, streak)
  - `public.user_topic_progress` (completed count, best seconds)
- Completion is written atomically via RPC `public.complete_topic(...)`

## Suggested repo layout

- `src/`
  - `engine/` (lesson runtime)
    - `LessonRenderer.jsx`
    - `stepTypes/` (reusable interactive blocks)
  - `pages/` (Home/Topic/Lesson/Login)
  - `services/` (Supabase queries + RPC calls)
  - `context/` (Auth session)
  - `components/` (UI pieces)

- `content/` (authoring at scale)
  - `topics/` (thousands of *.topic.json files)
  - `schema/` (JSON schema validation)
  - `README.md` (workflow)

- `scripts/`
  - `validateContent.mjs` (fast CI/local validation)
  - `syncTopicsToSupabase.mjs` (bulk upsert)

## Adding 1,000 modules – the actual process
1. Create `content/topics/<Subject>/<id>.topic.json`
2. `npm run content:validate`
3. `npm run content:sync`
4. App instantly serves the new module (no frontend build needed)

## When you need new code
Only when you want a **new step type** (a new interaction pattern).
Then you:
- Add a component under `src/engine/stepTypes/`
- Add the mapping in `src/engine/LessonRenderer.jsx`
- Expand the allowed `type` enum in `content/schema/step.schema.json`
