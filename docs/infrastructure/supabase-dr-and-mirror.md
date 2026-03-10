# Supabase DR + “Mirror DB” (low-cost)

## Reality check (why this is hard)
This app talks directly to Supabase from the browser (supabase-js) for:
- Auth sessions + token refresh
- PostgREST reads/writes + RPCs
- Storage (avatars/certificates)

A “mirror Postgres database” by itself **does not replace Supabase** unless you also mirror the API surface (Auth + PostgREST + RPC behavior + Storage URLs).
So the cheapest *useful* approach is **tiered failover**:
- Keep *browsing + lesson playback* working via a mirrored **public content** dataset.
- Degrade *auth/progress/reviews* gracefully during Supabase outages.

If you truly need “everything keeps working”, you’re effectively building/operating a second Supabase-like stack (not near-free).

## Goals
1) Always have a reliable backup of production data.
2) If Supabase is down, users still get a good experience (at least browsing + learning content).
3) Keep cost and operational burden minimal.

## A. Backups (cheap, strong)
### A1) Use Supabase backups/PITR (baseline)
- Enable automated backups and, if available on your plan, Point-In-Time Recovery.
- Document the restore procedure and run a restore drill periodically.

### A2) Independent exports to object storage (belt-and-suspenders)
- Nightly `pg_dump` (schema + data) of your application schemas to S3-compatible storage (Backblaze B2 / Cloudflare R2 are usually low cost).
- Encrypt at rest (server-side or client-side) and keep retention (e.g. 7 daily + 4 weekly + 12 monthly).

Notes:
- Store secrets outside git.
- Add a scheduled job (GitHub Actions cron or a small server) to run dumps.

## B. “Mirror DB” for failover (low-cost version)
### What we can realistically fail over
**Public catalog + lesson payloads** (read-only):
- categories
- courses
- chapters
- topics (including `lesson/journey` JSON)

What we cannot cheaply fail over 1:1:
- Supabase Auth (sign-in, token refresh)
- Storage buckets (avatars, certificates)
- Writes (progress, ratings, reviews) without building a queue + custom API

### B1) Mirror only the public content dataset to a cheap DB
Recommended mirror targets (cheap, easy):
- Turso (SQLite) or similar “edge SQLite” with a generous free tier
- Neon serverless Postgres (can be cheap, but truly always-on replication isn’t free)

Sync strategy (simple and robust):
- A scheduled job pulls *published* content from Supabase using a server-side key.
- Upsert into mirror tables.
- Keep a `last_synced_at` and a checksum/version per row.

Failover strategy in the app:
- Try Supabase first.
- If network error / timeout / 5xx → call a tiny read-only endpoint backed by the mirror DB.
- Show a banner: “We’re in read-only mode; progress saving is temporarily unavailable.”

### B2) Scope-limited UX guarantees
When Supabase is down:
- ✅ Browsing still works (categories → courses → chapters → topics)
- ✅ Topic + lesson content still loads (from mirror)
- ❌ Sign-in may not work (auth provider down)
- ❌ Progress/ratings/reviews writes disabled (or queued locally if implemented)

## C. If you insist on full hot failover (not cheap)
To keep *auth + writes + storage* working during a Supabase outage, you need a second full environment:
- Another Supabase project (or self-hosted) in another region/provider
- Continuous replication
- A front-door routing layer (health checks + automatic failover)
- Careful handling of writes to avoid split-brain

This is real SRE/infra work and will cost money + engineering time.

## D. Full failover options (covers Auth + Storage + Writes)
You have three “real” architecture choices. They differ mainly by how much you keep relying on Supabase as a client-side dependency.

### Option 1: Dual Supabase projects + automated switch (fastest path, still complex)
Goal: keep using Supabase features, but maintain a second Supabase project as standby (or active-active).

What you must solve:
- **Routing/failover:** the browser currently hardcodes `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` at build time. For true failover, you need runtime configuration (e.g. `/runtime-config.json`) and a client that can switch projects when health checks fail.
- **Auth compatibility:** tokens issued by Auth in project A generally won’t validate against project B unless you deliberately align JWT signing/verification across both. In practice, most teams avoid “shared Supabase Auth across projects” and instead move to an external IdP (see Option 3).
- **Writes + consistency:** if you allow writes to both during an incident, you must prevent split-brain. Active-passive is simpler (only one accepts writes), but failover will still force session/user refresh semantics.
- **RPC parity:** your database functions must be deployed identically in both.
- **Storage buckets:** you need either (a) independent buckets with a replication process, or (b) move storage to an external S3-compatible bucket so both environments read the same objects.

Typical result:
- Works, but “everything” includes a lot of edge cases (sessions mid-flight, uploads in progress, retries, partial writes).
- Cost: at least a second Supabase project + replication plumbing + monitoring.

### Option 2: Self-host Supabase (highest control, highest ops)
Goal: run the whole Supabase stack yourself in two regions/providers.

What you must solve:
- Run Postgres HA (streaming replication, failover orchestration), plus all Supabase services (auth, rest, realtime if used, storage API), plus secrets management.
- Build/operate a global router (health checks + failover).

Typical result:
- Most control and strongest “full failover” story.
- Cost is not just cloud spend; it’s ongoing operations.

### Option 3: Decouple from Supabase-as-a-client (cleanest reliability story)
Goal: stop calling Supabase directly from the browser. Put your own API in front so you can swap/dual-home dependencies.

Components:
- **Auth:** external identity provider with strong uptime and multi-region posture (e.g. Auth0, Clerk, Cognito). Your app uses OIDC/JWT from that IdP.
- **DB:** a database provider with multi-region / HA story you’re comfortable paying for (or a primary + replica + planned failover). You expose your own stable API so clients don’t care.
- **Storage:** S3-compatible storage with replication (or multi-region bucket) + CDN in front.

Typical result:
- This is the only path where “covers everything” is straightforward and testable.
- It requires building/owning an API surface (even if thin). Without that, the browser cannot transparently fail over Auth/Storage/Writes.

## E. Practical recommendation (budget-aware)
If you truly need “everything keeps working” during a Supabase outage, the budget-minimal, engineering-realistic path is:
1) Move Auth to an external IdP (stable tokens independent of Supabase).
2) Move Storage to S3/R2 with replication + CDN.
3) Put a thin API layer in front of DB writes (progress/ratings/reviews), with retries/idempotency.

If you can tolerate short maintenance windows during outages (good UX but not perfect continuity), Option 1 (dual Supabase with *manual* failover first, then automate) can be a stepping stone.

## Next implementation step (recommended)
Implement B1:
1) Create mirror schema (categories/courses/chapters/topics with lesson JSON).
2) Add a sync job (cron) from Supabase → mirror.
3) Add a read-only API endpoint that serves data from mirror.
4) Update client services to fallback to mirror on transient Supabase failure.
5) Add UI banner + disable/queue writes while in failover.
