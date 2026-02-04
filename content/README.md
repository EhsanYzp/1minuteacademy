# Content Authoring (Scales to 1,000s of topics)

This repo is designed so you **do not create per-topic React components**.
Instead, each topic/module is **data** stored in Supabase (`public.topics.lesson`) and rendered by the lesson engine.

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
