# Scaling Plan (Brutal + Actionable)

Target: **thousands of modules** and **thousands of daily active users** with predictable performance, cost, and operational safety.

This doc is a prioritized backlog. We can pick items from the top and implement them one by one.

---

## How to use this plan

- **P0 (must do):** security/correctness issues that can cause data corruption or revenue loss.
- **P1 (next):** first performance bottlenecks you will hit with scale.
- **P2 (soon):** UX/perf degradations that hurt conversion and retention.
- **P3 (later):** future-proofing and operational maturity.

Each item includes:
- **Why it matters**
- **What to change**
- **Acceptance criteria** (what “done” looks like)

---

## P0 — Must do before real growth

### P0.1 Lock down `public.topics` writes (RLS policy) ✅ DONE

**Why it matters**
- Current policy allows **any authenticated user** to write to `public.topics` (including lesson JSON). At scale this is guaranteed vandalism / accidental corruption.

**What to change**
- Remove the “authenticated users can write topics” RLS policy in production.
- Ensure topic creation/updates only happen via:
  - a server-side admin API (service role), and/or
  - a dedicated admin role/claim.

**Acceptance criteria**
- Regular signed-in users cannot insert/update/delete rows in `public.topics`.
- Content sync scripts still work with `SUPABASE_SERVICE_ROLE_KEY`.

Notes
- This is currently defined in `supabase/001_init.sql` under `topics_write_authed`.

**Status**
- ✅ Implemented in this repo.

**What I changed**
- Removed the insecure `topics_write_authed` policy from the day-0 schema so new installs are safe by default.
- Added a dedicated migration you can run on existing Supabase projects to drop the policy: `supabase/003_lockdown_topics_rls.sql`.

**How to apply (existing Supabase project)**
- Run `supabase/003_lockdown_topics_rls.sql` in Supabase SQL editor.

---

### P0.2 Fix Stripe → user mapping durability (prevent “stuck Pro”) ✅ DONE

**Why it matters**
- Webhook handling currently depends on `subscription.metadata.user_id`. In real Stripe lifecycles, metadata is often missing or inconsistent.
- If you miss a downgrade event, users stay Pro forever.

**What to change**
- Create a durable mapping table, e.g. `public.stripe_customers`:
  - `user_id`, `customer_id`, `subscription_id`, `status`, `price_id`, `interval`, timestamps.
- In webhooks, resolve user by `customer_id` and/or stored mapping, not only metadata.
- Handle `customer.subscription.updated` (not just `...deleted`).

**Acceptance criteria**
- When a subscription is canceled/expired, user metadata is updated correctly every time.
- If metadata is missing, the system still downgrades reliably.

**Status**
- ✅ Implemented in this repo.

**What I changed**
- Added a server-only mapping table `public.stripe_customers` via `supabase/004_stripe_customers.sql`.
- Updated Stripe webhooks to resolve the user by `customer_id` / `subscription_id` (fallback) instead of relying only on Stripe metadata.
- Added handling for `customer.subscription.updated` (so plan changes propagate without waiting for deletion).

**How to apply (existing Supabase project)**
- Run `supabase/004_stripe_customers.sql` in Supabase SQL editor.

---

### P0.3 Rate limiting + abuse controls on serverless endpoints ✅ DONE

**Why it matters**
- Stripe endpoints and account endpoints are prime targets for abuse.

**What to change**
- Add basic rate limits / bot protection (Vercel Firewall / Edge middleware / simple IP-based throttling).
- Add idempotency for Stripe session creation and webhook event processing.

**Status**
- ✅ Implemented in this repo.

**What I changed**
- Added DB-backed rate limiting primitives: `public.api_rate_limits` + `public.rate_limit_check(key, window_seconds, max_count)`.
- Added webhook replay protection: `public.stripe_webhook_events` + `public.claim_stripe_webhook_event(event_id, event_type)`.
- Added Checkout-session idempotency cache table: `public.stripe_checkout_session_cache`.
- Wired rate limiting into:
  - Stripe: create checkout session, create portal session, subscription status.
  - Account: pause, resume, delete.
- Wired webhook idempotency into Stripe webhook handlers (Vercel + Netlify).

**How to apply (existing Supabase project)**
- Run `supabase/005_rate_limit_idempotency.sql` in Supabase SQL editor.

**Acceptance criteria**
- Repeated calls don’t create repeated Stripe sessions / inconsistent state.
- Webhooks are idempotent (replays don’t break state).

---

## P1 — First scaling bottlenecks (performance + cost)

### P1.1 Stop loading “all topics” on browse; add pagination (or infinite scroll) ✅ DONE

**Why it matters**
- Current browse behavior loads every topic and then does client-side filtering/search. With thousands of topics, initial load becomes slow and expensive.

**What to change**
- Add server-side pagination for topics list:
  - `limit` + cursor (preferred) or `limit` + `offset`.
- Only render a page of topics at a time.

**Status**
- ✅ Implemented in this repo.

**What I changed**
- Added a paginated topics fetch helper `listTopicsPage({ limit, offset, subject })` that uses Supabase `range()` + `count`.
- Updated the browse UI to load the first page (currently 36 topics) and fetch more via “Load more topics”.
- Pagination is category-aware: selecting a category triggers a paginated server-side `subject` filter.
- Added an RPC for accurate category totals (sidebar counts) without loading all topics: `public.get_topic_category_counts()`.

**Notes**
- Search/filter currently operates on the loaded subset of topics; P1.4 (server-side search) is the follow-up for searching the full catalog.
- Sidebar counts are now accurate immediately because they come from the RPC (not from the currently loaded page).
- If you’re applying this to an existing Supabase project, run `supabase/006_topic_category_counts.sql`.

**Acceptance criteria**
- Topics page loads quickly even with 10,000+ topics.
- Network payload remains roughly constant as topic count grows.

---

### P1.2 Stop aggregating ratings for every topic on browse ✅ DONE

**Why it matters**
- `get_topic_rating_summaries(topic_ids[])` over thousands of IDs becomes a large request and a heavy DB aggregate.

**What to change**
- Only fetch rating summaries for the currently visible page of topics.
- Add caching and/or precomputed aggregates:
  - Option A: materialized view refreshed periodically
  - Option B: `topic_rating_summaries` table updated by trigger

**Status**
- ✅ Implemented in this repo.

**What I changed**
- Browse ratings are fetched per page (not for the entire catalog).
- Added a precomputed summary table `public.topic_rating_summaries` maintained by triggers.
- Updated `public.get_topic_rating_summaries(topic_ids)` to read from the summary table (cheap lookups).
- Added RPC chunking in the client so even accidental large calls stay bounded.

**How to apply (existing Supabase project)**
- Run `supabase/007_topic_rating_summaries.sql` in Supabase SQL editor.

**Acceptance criteria**
- Ratings still appear quickly.
- The RPC request stays small and bounded.

---

### P1.3 Add missing indexes (ratings + progress) ✅ DONE

**Why it matters**
- Ratings aggregation filters by `topic_id`, but the table’s primary key is `(user_id, topic_id)`. That’s not optimal for `WHERE topic_id = ...`.
- Progress lists order by timestamps and need composite indexes for scale.

**What to change**
- Add index for ratings lookup by topic:
  - `create index concurrently topic_ratings_topic_id_idx on public.topic_ratings(topic_id);`
- Add index for per-user progress ordering:
  - `create index concurrently user_topic_progress_user_last_idx on public.user_topic_progress(user_id, last_completed_at desc);`

**Acceptance criteria**
- Ratings summaries remain fast as ratings volume grows.
- Profile progress loads fast for heavy users.

**Status**
- ✅ Implemented in this repo.

**What I changed**
- Added index `topic_ratings_topic_id_idx` on `public.topic_ratings(topic_id)`.
- Added index `user_topic_progress_user_last_idx` on `public.user_topic_progress(user_id, last_completed_at desc)`.

**How to apply (existing Supabase project)**
- Run `supabase/008_indexes_ratings_progress.sql` in Supabase SQL editor.

Notes
- Supabase SQL editor runs in a transaction, so this migration avoids `CONCURRENTLY`.
- If you need non-blocking index builds on a busy production DB, run the commented `CONCURRENTLY` statements from that file via `psql` (outside a transaction).

---

### P1.4 Make search server-side ✅ DONE

**Why it matters**
- Client-side `.includes()` search requires downloading everything first.

**What to change**
- Add DB-backed search:
  - Postgres full-text search (preferred) or `ilike` with trigram index.
- UI sends query + pagination params.

**Acceptance criteria**
- Search results appear without downloading the full catalog.

**Status**
- ✅ Implemented in this repo.

**What I changed**
- Added a GIN full-text search index on `public.topics` (published-only).
- Added an RPC `public.search_topics_page(query, subject, limit, offset)` that returns paginated results plus `total_count`.
- Updated the browse UI to use server-side search (debounced) when a query is present.

**How to apply (existing Supabase project)**
- Run `supabase/009_server_side_search.sql` in Supabase SQL editor.

---

## P2 — UX/perf degradations you’ll feel at scale

### P2.1 Bundle splitting / route-level code splitting

**Why it matters**
- Build output already warns about large chunks. This affects page load and conversion.

**What to change**
- Lazy-load heavier routes (Lesson/Review/Profile/Upgrade) via `React.lazy`.
- Consider reducing animation overhead in large lists.

**Acceptance criteria**
- First load JS decreases.
- Lighthouse / Web Vitals improve.

---

### P2.2 Virtualize large lists

**Why it matters**
- Rendering hundreds/thousands of cards hurts performance even if the data load is fine.

**What to change**
- Use list virtualization (e.g. `react-window`) for topics browse when list size is large.

**Acceptance criteria**
- Smooth scrolling with large catalogs.

---

### P2.3 Avoid fetching “lesson JSON” unless needed

**Why it matters**
- Lesson JSON can be large; browsing should only load metadata.

**What to change**
- Ensure list endpoints only return metadata fields.
- Fetch full lesson only on Topic/Lesson route.

**Acceptance criteria**
- Browse payload small, lesson payload only on demand.

---

## P3 — Content ops + maturity (future-proof)

### P3.1 Batch content sync to avoid payload/time limits

**Why it matters**
- Current sync script inserts/upserts in one request per category (insert/update). This will hit limits with thousands of modules.

**What to change**
- Chunk inserts/upserts (e.g. 100–500 rows per request).
- Consider storing `lesson_version` as a real column to avoid fetching remote `lesson` JSON just to compare versions.

**Acceptance criteria**
- Sync works reliably with 10,000+ topics.

---

### P3.2 Observability (errors + performance)

**Why it matters**
- At scale, silent failures kill retention. You need visibility.

**What to change**
- Add error tracking (Sentry or equivalent).
- Track key events: lesson start, completion, checkout start, checkout success, rating submitted.
- Add basic dashboards/alerts for webhook failures.

**Acceptance criteria**
- You can answer: “what broke?”, “for how many users?”, “when did it start?” within minutes.

---

### P3.3 Data model evolution for analytics/recommendations

**Why it matters**
- JSONB lesson storage is fine now, but step-level analytics and recommendations become difficult if everything is opaque JSON.

**What to change**
- Keep JSONB for rendering, but denormalize important fields into columns (duration, step_count, xp, version).
- Only extract steps into separate tables if/when you need step-level querying.

**Acceptance criteria**
- Browse/search/analytics queries remain fast and cheap.

---

## Suggested implementation order (recommended)

1) P0.1 Lock down topics RLS
2) P1.3 Add indexes
3) P1.1 Pagination + P1.2 ratings-per-page
4) P1.4 Server-side search
5) P3.1 Batch sync
6) P0.2 Stripe mapping table + webhook hardening ✅ DONE
7) P2.1 Code splitting + P2.2 virtualization

---

## What I need from you to start implementing

- Deploy target: Vercel only, or Vercel + Netlify?
- Topics browse: do you prefer **pagination (“Load more”)** or **infinite scroll**?
- Search: do you want full-text search (best) or “simple contains” (cheaper to start)?
