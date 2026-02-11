# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once releases are tagged.

## [Unreleased]

### Added
- Locked Pro-only topics (Intermediate/Advanced) on the Topics page for guest/free users (shows a lock badge and disables navigation).
- Route-level Pro-only gate on the topic page to prevent direct URL access without Pro.
- Difficulty filter on the Topics page: All / Beginner / Intermediate / Advanced (persisted in the URL via `?difficulty=` for shareable links).
- Topics page redesigned with a minimal sticky filter bar (Search + Category + Subcategory + Difficulty + Status + Reset) for a cleaner desktop/mobile experience.
- Multiple lesson presentation styles for story-based lessons (Focus/Dark/Cards/Split/Minimal/Bold), with a preference selector in the profile.
- Added additional Pro-only lesson presentation styles: Paper / Terminal / Glass.
- In-lesson presentation style switcher (available from lesson/review top bars).
- Journey-level presentation protocol (`journey.protocol.presentation`) to define default and supported presentation styles.
- SEO infrastructure: per-route meta tags (title/description/canonical/OG/Twitter) via a lightweight `Seo` component.
- SEO assets: `robots.txt`, generated `sitemap.xml`, generated `llms.txt`, and a first-party `favicon.svg` + web manifest.
- Build-time icon generation for a full favicon/PWA set (`favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`).
- SEO implementation plan doc: `docs/seo-plan.md` with P0/P1/P2 tasks and pipeline guidance.
- Default OpenGraph image at `/og/og-image.png` and build-time generation of topic-specific OG images under `/og/topics/`.
- Structured data (JSON-LD): `ItemList` on Topics and `LearningResource` on Topic pages.
- Topic pages now include a “Related topics” section to improve internal linking.
- LLM/crawler-friendly topics catalog endpoints: `/topics.json` and `/topics.txt` (generated at build time from published topics).

### Changed
- Topics page polish: headline uses “1-minute”, Status labels are clearer (“To watch”/“Watched”), and the sticky filter bar now stays fully visible under the sticky header.
- Centralized topic access gating in `src/services/entitlements.js` via `getTopicGate()`.
- Presentation-style entitlements: Guest + Free users can choose Focus + Dark; other styles are marked Pro-only.
- Pricing page updated to include lesson presentation styles and remove redundant Free-plan copy.
- Profile page reorganized into tabs (Overview / Preferences / Progress / Ratings / Account) to reduce clutter.
- Profile page tabs are now sticky while scrolling.
- Header: improved mobile topbar with a compact layout and hamburger menu.
- Profile page: tab-specific subtitle; progress list simplified; mobile header branding adjusted.
- Netlify SPA routing now explicitly passes through SEO/static files (robots/sitemap/manifest/icons) to avoid being rewritten to `/index.html`.
- Pricing page SEO now supports both `/pricing` and `/upgrade` paths while keeping the canonical URL on `/pricing`.
- Topic page: refreshed “Related topics” section styling to be more noticeable and consistent with the rest of the page.
- Performance: route-level code splitting for pages (React `lazy` + `Suspense`) and improved vendor chunking via Vite `manualChunks`.
- Performance: moved Google Fonts loading from CSS `@import` to HTML `<link>` tags with `preconnect`.
- Performance: Topic page “Related topics” now uses a bounded query (subject/subcategory + limit) instead of downloading the full topics catalog.
- Performance: reduced Story beat rendering overhead by removing the 50ms StoryRenderer progress ticker and deriving beat/quiz progression from the 1Hz lesson timer.
- Accessibility: restored visible keyboard focus by removing `outline: none` and adding a global `:focus-visible` outline.
- Accessibility: added global `prefers-reduced-motion` support (reduced CSS transitions/animations + Framer Motion `reducedMotion="user"`).
- Accessibility: lesson timer now includes screen reader announcements at key moments.

### Fixed
- Prevented the “click into Pro-only then discover it’s locked” UX for free users.
- Dark (Spotlight) style: review-mode navigation bar is now visible.
- Split (Visual + Text) style: improved alignment and reduced layout/scroll issues on long-content modules.
- Split (Visual + Text) style: removed the thin vertical gutter line.
- Profile page: fixed a crash when loading topics from Supabase (undefined client reference).
- Security: hardened Stripe checkout success/cancel URLs and billing portal return URL to use `SITE_URL` only (prevents open redirect via forged request headers).
- Security: added strict CORS headers + `OPTIONS` preflight handling for all `api/` endpoints (allows `SITE_URL` origin; no wildcard).
- Security: tightened API error handling to avoid echoing arbitrary exception messages to clients (logs server-side; client sees fixed safe messages).
- Security: added a baseline Content-Security-Policy header for Netlify/Vercel deploys.
- Reliability: added a top-level React ErrorBoundary to prevent white-screen crashes and provide a recovery UI.
- Reliability: fixed lesson timer drift by basing the countdown on wall-clock time (accurate after background-tab throttling).
- Reliability: added navigation guards during active lessons (beforeunload + in-app route change prompt) to prevent accidental loss of progress.
- Reliability: fixed lesson start crash caused by `useBlocker` running under `BrowserRouter` by migrating to a React Router data router.
- Build: fixed a production blank-screen boot crash caused by a circular chunk dependency (`vendor` ↔ `react`) by bundling React’s `scheduler` with the React chunk.
- Build/Deploy: prevented SPA rewrites from swallowing missing `/assets/*` chunks and added cache headers (`index.html` no-cache; hashed assets immutable) to avoid stale HTML referencing non-existent lazy-route bundles.
- UI: improved the ErrorBoundary message for lazy-route load failures (dynamic import/chunk fetch) to prompt “Reload to update”.
