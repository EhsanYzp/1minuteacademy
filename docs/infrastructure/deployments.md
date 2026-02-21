# Deployments: staging + production (Vercel)

This repo currently builds a Vite SPA with Vercel serverless functions under `/api`.

## Goal

- Add a **staging** environment (pre-production) that is safe to test.
- Keep **production** protected from accidental deploys.
- Still allow “ship straight to prod” when you intentionally want it.

## Recommended setup (simple + reliable)

### 1) Git branches

- `main` → Production
- `staging` → Staging
- feature branches → PR into `staging`

Release flow:

1. Feature branch → PR → `staging` (tests + staging deploy)
2. Verify on staging
3. PR `staging` → `main` (prod deploy)

Direct-to-prod remains possible by merging directly into `main`.

### 2) Vercel projects

Create **two** Vercel projects pointing to the same GitHub repo:

- **Project A: Production**
  - Production Branch: `main`
  - Domain: your real domain (e.g. `oneminuteacademy.com`)

- **Project B: Staging**
  - Production Branch: `staging`
  - Domain: a stable staging URL (e.g. `staging.oneminuteacademy.com`)
  - Turn on **Deployment Protection** (recommended): require auth/password so staging isn’t indexed.

Why two projects:

- You get a stable staging URL that updates when `staging` changes.
- You can isolate env vars/keys safely.

### 3) Supabase isolation (recommended)

Create a separate Supabase project for staging.

- Prod Supabase project → only used by Vercel Production env
- Staging Supabase project → only used by Vercel Staging project

Apply schema to staging using your SQL migrations in `supabase/*.sql`.

### 4) Stripe isolation

- Staging uses Stripe **test mode** keys + test webhooks.
- Production uses Stripe **live mode** keys + live webhooks.

## Environment variables

Configure variables per Vercel project.

Typical client vars:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL` (staging domain for staging; prod domain for prod)

Server vars (Vercel functions):

- `SUPABASE_SERVICE_ROLE_KEY` (if used server-side)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

If you use a single `SITE_URL` variable in server functions, keep it different per environment.

## CI / gates

This repo includes GitHub Actions CI at `.github/workflows/ci.yml` which runs on PRs/pushes to `staging` and `main`:

- `npm run content:validate`
- `npm run journey:parity`
- `npm run build`

Recommended GitHub settings:

- Require CI checks to pass before merging into `staging`/`main`.

## Optional upgrades

- Add Playwright smoke tests for: login → start lesson → checkout.
- Add a short release checklist (staging URL, Stripe webhooks, basic flows).
