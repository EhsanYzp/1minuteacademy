# SEO Plan (P0 / P1 / P2)

This repo is a Vite + React SPA (client-side routing). That means:
- **Metadata for each route** must be set on the client (or via SSR/prerender) for best indexing and link previews.
- **Social previews (OG/Twitter)** and some crawlers may not execute JS reliably.

This plan balances “do it now” wins with a scalable pipeline that keeps SEO artifacts up to date as you add new topics/modules.

## Current baseline (audit summary)

Observed in the repo before implementing SEO work:
- `index.html` had minimal head tags (no description/OG/Twitter/canonical).
- No `robots.txt` / `sitemap.xml` shipped from `public/`.
- No centralized meta management (no Helmet; no per-route head).
- Deploy configs (Netlify/Vercel) rewrite all SPA routes to `index.html`.

## What’s already implemented in this repo now

- Per-route SEO management via a lightweight custom component:
  - [src/components/Seo.jsx](../src/components/Seo.jsx)
  - [src/services/seo.js](../src/services/seo.js)
- Baseline head tags in [index.html](../index.html) (title/description/OG/Twitter/theme-color/manifest).
- Static assets:
  - [public/robots.txt](../public/robots.txt)
  - [public/favicon.svg](../public/favicon.svg)
  - [public/site.webmanifest](../public/site.webmanifest)
- Automated generation (runs on `npm run build`):
  - [scripts/generateSeoAssets.mjs](../scripts/generateSeoAssets.mjs)
  - Outputs: `public/sitemap.xml`, `public/llms.txt`
- Vercel rewrite updated to avoid hijacking SEO static files:
  - [vercel.json](../vercel.json)

## Environment variables (important)

Set these for correct canonical URLs and sitemap output:
- `VITE_SITE_URL` (used client-side for canonical/OG URLs)
- `SITE_URL` (used at build-time for sitemap/llms generation)

Recommended: set both to the same value, e.g. `https://1minute.academy`.

## P0 (must do first — indexability + hygiene)

1. **Canonical URL source of truth**
   - Set `VITE_SITE_URL` (client runtime) and `SITE_URL` (build-time generator) to the production origin, e.g. `https://1minute.academy`.
   - Netlify: Site settings → Build & deploy → Environment.
   - Vercel: Project → Settings → Environment Variables.
   - Verify canonical tags output the correct domain (no localhost) on `/`, `/topics`, and a few `/topic/<id>` pages.

2. **Sitemap + robots correctness**
   - Confirm `https://<domain>/robots.txt` and `https://<domain>/sitemap.xml` return 200.
   - Netlify SPA note: explicit pass-through rules were added in [public/_redirects](../public/_redirects) to ensure these files are never rewritten to `/index.html`.
   - Confirm sitemap contains:
     - `/`, `/topics`, `/pricing`, `/faq`, legal pages
     - `/topic/<id>` for all `published: true` topics
   - Generation is automated on build via `prebuild` (see `npm run seo:generate`).

3. **Noindex for private/utility routes**
   - Keep `noindex` on: `/login`, `/auth/callback`, `/auth/reset`, `/me`, `/lesson/:id`, `/review/:id`.
   - These are implemented via the [src/components/Seo.jsx](../src/components/Seo.jsx) component on each route.

4. **Favicons + PWA basics**
   - A full icon set is generated automatically on build:
     - `public/favicon.ico`
     - `public/apple-touch-icon.png`
     - `public/icons/icon-192.png`
     - `public/icons/icon-512.png`
   - Generator: [scripts/generateIcons.mjs](../scripts/generateIcons.mjs) (also runnable via `npm run icons:generate`).
   - Manifest references these icons: [public/site.webmanifest](../public/site.webmanifest)

5. **Search Console / Webmaster Tools**
   - Add the domain property in Google Search Console + Bing Webmaster Tools.
   - Submit sitemap and monitor coverage.
   - Recommended: set up a simple recurring check (weekly) that `/sitemap.xml` continues returning 200 and includes the expected URL count.

## P1 (high impact — better previews + rich results)

1. **OG/Twitter images**
   - Implemented default OG image: `public/og/og-image.png` (referenced from `index.html` and used as the default in the `Seo` component).
   - Implemented topic-specific OG images as SVGs generated at build time:
     - Pattern: `/og/topics/<encodedTopicId>.svg`
     - Generated from `content/topics/**/*.topic.json` (title/emoji/color)
   - Note: some social platforms are inconsistent with SVG previews; we keep Twitter image pinned to the PNG default on topic pages as a safe fallback.

2. **Structured data (JSON-LD)**
   - Home: `Organization` + `WebSite` (already added).
   - Topics listing: `ItemList` (implemented; capped to the first ~60 loaded topics to avoid huge JSON payloads).
   - Topic page: `LearningResource` with title/description/difficulty + `PT1M` timeRequired (implemented).

3. **Internal linking improvements**
   - Implemented a “Related topics” section on topic pages (same subject + subcategory when available).

4. **Content snippets**
   - Add an indexable excerpt on topic pages (already has `description`).
   - If you later move story content server-side, consider adding a short text-only summary for crawlers.

## P2 (strategic — SPA limitations, AI discovery, and scale)

1. **Prerender or SSR** (biggest long-term SEO lever)
   - Option A (lighter): prerender static routes (`/`, `/topics`, `/topic/<id>` for published topics) at build time.
   - Option B (heavier): move to SSR (e.g. Next.js) for true per-route HTML.

2. **LLM discovery enhancements**
   - Keep `llms.txt` generated from published topics.
   - Consider adding a short “data catalog” page (`/topics.txt` or `/topics.json`) containing clean titles/descriptions.

3. **Monitoring + regression prevention**
   - Add a CI step to verify:
     - `public/robots.txt` exists
     - `public/sitemap.xml` exists and contains at least N URLs
     - topic IDs are valid URLs (no spaces)

## Automation / pipeline design

The source of truth is `content/topics/**/*.topic.json`.

The automated SEO pipeline should:
- Validate topics (`npm run content:validate`).
- Generate SEO assets (`npm run seo:generate` runs automatically via `prebuild`).
- Build (`npm run build`).

When you add a new module/topic:
- You only edit the topic JSON.
- The sitemap + llms list update automatically on build.

## Verification checklist

- Visit these URLs in production:
  - `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/favicon.svg`
- Open a topic page and verify:
  - `<title>` matches the topic
  - canonical link exists
- Run locally:
  - `npm run seo:generate`
  - `npm run build`
