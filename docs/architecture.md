# 1MinuteAcademy – Platform Architecture (scales to 1,000s of modules)

The key idea: **modules are data** (JSON in Supabase), and the app is a **renderer**.
You do *not* create React components per module.

## What scales

### 1) Content (thousands of modules)
- Stored in Supabase table: `public.topics`
  - `id`, `subject`, `title`, `emoji`, `color`, `description`, `difficulty`, `published`
  - `lesson` (JSON): `{ totalSeconds, xp, steps: [...] }`

#### Content sources (dev vs prod)

- **Production source of truth:** Supabase `public.topics`.
- **Local iteration source:** JSON files under `content/topics/**`.
  - Validate: `npm run content:validate`
  - Preview in-app without Supabase pushes: `npm run dev:local`
  - Publish to Supabase when ready: `npm run content:sync`

#### Drafts (not committed)

Use these for experiments you don’t want in git:
- `content/_drafts/`
- `content/_local/`

### 2) Engine (small, stable code)
- Folder: `src/engine/`
- `LessonRenderer` selects the active step based on time remaining.
- `src/engine/stepTypes/` contains a *small set* of reusable primitives (interaction patterns).
- For variety at scale, lessons can also use `type: recipe` + `recipeId` to select from a large recipe catalog.

When you add thousands of modules, you mostly add JSON files/rows — the engine code stays almost constant.

### 3) Accounts + progress
- Auth: Supabase Auth
- Progress tables:
  - `public.user_stats` (xp, streak)
  - `public.user_topic_progress` (completed count, best seconds)
- Completion is written atomically via RPC `public.complete_topic(...)`

#### User experience surfaces

- Profile route: `/me`
  - Shows XP/streak + per-topic progress.
- Landing page topic cards
  - Shows a **✅ Completed** badge when `user_topic_progress.completed_count > 0` for that topic.

#### Progress data sources

- Supabase mode (`npm run dev` / production)
  - Writes: RPC `public.complete_topic(...)`
  - Reads: `public.user_stats` + `public.user_topic_progress` (joined with `public.topics`)
- Local Preview mode (`npm run dev:local`)
  - Writes/reads progress from browser storage (localStorage)

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

### Fast iteration loop (no Supabase)
1. Create/edit `content/topics/<Subject>/<id>.topic.json`
2. `npm run content:validate`
3. `npm run dev:local` and test the lesson UI instantly

### Publish loop (Supabase)
1. `npm run content:sync` (bulk upsert to `public.topics`)
2. Run the normal app (`npm run dev` or production) to verify DB-backed behavior

Note: the sync script loads `.env.local` automatically (keep the service role key out of any `VITE_...` variable).

Result: adding/updating modules does **not** require a frontend build/deploy.

## When you need new code
Only when you want a **new step type** (a new interaction pattern).
Then you:
- Add a component under `src/engine/stepTypes/`
- Add the mapping in `src/engine/LessonRenderer.jsx`
- Expand the allowed `type` enum in `content/schema/step.schema.json`

This is the only time you need to rebuild/redeploy the frontend.
