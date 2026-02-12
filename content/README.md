# Content Authoring (Scales to 1,000s of topics)

This repo is designed so you **do not create per-topic React components**.
Instead, each topic/module is **data** stored in Supabase (`public.topics.lesson`) and rendered by the lesson engine.

Optionally, a topic can include a **schema-first** `journey` spec (see `content/schema/journey.schema.json`) to make the Topic Start / Completion / Review pages deterministic and consistent across modules.

## Journey (schema-first pages)

If `journey` is present on a topic JSON, the app will use it to render:
- Topic Start CTAs (start/upgrade/review)
- Lesson Completion panels + actions

`journey` is validated by `npm run content:validate`.

### Actions

CTA blocks support these `action.type` values:
- `startLesson` → `/lesson/:topicId`
- `goToReview` → `/review/:topicId`
- `goToTopics` → `/topics` (topics browser)
- `goToUpgrade` → `/upgrade`
- `goToProfile` → `/me`
- `goToLogin` → `/login`
- `tryAgain` / `openReview` are used on the in-lesson completion screen

### Syncing to Supabase

To persist `journey` in Supabase, apply the migration in `supabase/011_topic_journey_spec.sql` and then run `npm run content:sync`.

## Folder layout

- `content/topics/<Subject>/<topicId>.topic.json`
  - Source-of-truth JSON for topics you want to publish.
  - Example: `content/topics/Blockchain & Web3/blockchain.topic.json`

- `content/schema/`
  - JSON Schemas used to validate topic/lesson shape before syncing.

## Workflow

1) Add/edit topic JSON under `content/topics/`
2) Validate locally:

- `npm run content:validate`

3) Sync to Supabase:

- Set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (scripts only)
- Run: `npm run content:sync`

Staging tip:
- Create `.env.staging.local` (with `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for the staging Supabase project)
- Run: `npm run content:sync:staging`

Notes:
- The sync script auto-loads `.env.local` (you do not need to export env vars manually).
- Find the service role key in Supabase Dashboard → Project Settings → API → Project API keys → `service_role`.
- Never put the service role key in any `VITE_...` variable.

## Notes

- The app itself uses the **anon key** and only reads published topics.
- The sync script uses **service role** and must never be bundled into the frontend.

After syncing, verify:
- Landing page shows your published topics.
- After completing a lesson, `/me` and the landing page should reflect **✅ Completed**.

## Scaffold (auto-pick steps)

To create a new module with an automatically selected 4–5 step mix (from the recipe pool):

- `npm run content:scaffold -- --id <topicId> --subject "<Subject>" --title "<Title>" --description "<One-liner>"`
