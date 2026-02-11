# Product Audit — 1 Minute Academy

> Generated: 2026-02-11
>
> Scope: performance, scalability, reliability, accessibility, security, UX, code quality, testing.
>
> Goal: prepare the platform for 1,000s of pages, strong Core Web Vitals, WCAG 2.1 AA compliance, zero known security vulnerabilities, and a consistently excellent user experience.

---

## How to read this document

- **P0** — Must fix. Blocks launch quality, user safety, or causes measurable harm today.
- **P1** — High impact. Should be done in the next sprint. Prevents real pain at scale or for specific user groups.
- **P2** — Strategic. Worth doing soon but can be scheduled. Improves long-term quality and developer velocity.

Each item has a short rationale and a concrete action.

---

## P0 — Critical

### 🔒 Security

#### SEC-01 · Open redirect in Stripe checkout success/cancel URLs

**Where:** [api/stripe/create-checkout-session.js](../api/stripe/create-checkout-session.js)

The `success_url` and `cancel_url` passed to Stripe are built from a `siteUrl` that falls back to `req.headers.origin` when `SITE_URL` is not set. An attacker can forge the `Origin` header, causing Stripe to redirect the user to a malicious domain after payment.

**Fix:** Always require `process.env.SITE_URL` to be set; return 500 if it isn't. Never fall back to request headers for redirect targets. Apply the same change in `create-portal-session.js`.

**Status:** Implemented (2026-02-11)

**Summary:** Removed request-header inference (`Origin` / forwarded host) for redirect base URLs and now exclusively uses `process.env.SITE_URL` in both checkout and portal session endpoints.

---

#### SEC-02 · No CORS headers on API endpoints

**Where:** all files in `api/`

None of the serverless functions set `Access-Control-Allow-Origin` or handle `OPTIONS` preflight requests. If you ever need to call these APIs from a different subdomain (preview deploys, staging), requests will fail silently.

**Fix:** Add a small CORS middleware or helper that:
- Responds to `OPTIONS` with the allowed origin, methods, and headers.
- Sets `Access-Control-Allow-Origin` on every response (use the configured `SITE_URL`, not `*`).

**Status:** Implemented (2026-02-11)

**Summary:** Added a shared CORS helper for all Vercel `api/` routes that (1) returns `204` for allowed `OPTIONS` preflights, (2) sets `Access-Control-Allow-Origin` only for the configured `SITE_URL` origin (plus localhost in non-production), and (3) adds `Vary: Origin`.

---

#### SEC-03 · Error responses can leak internals

**Where:** [api/stripe/webhook.js](../api/stripe/webhook.js), [api/stripe/create-checkout-session.js](../api/stripe/create-checkout-session.js)

Catch blocks return `e.message` directly to the client. If a Supabase/Stripe SDK throws with a connection string or stack fragment, that leaks to the caller.

**Fix:** Return a generic `"Server error"` message in 5xx responses; log the real error with `console.error`.

**Status:** Implemented (2026-02-11)

**Summary:** Tightened all Vercel `api/` routes to avoid echoing arbitrary exception messages to clients (including Stripe handlers). Errors are logged server-side; client responses use fixed, safe error strings.

---

#### SEC-04 · Missing Content-Security-Policy header

**Where:** [index.html](../index.html), [netlify.toml](../netlify.toml)

No CSP is set anywhere. This leaves the app open to injected scripts (e.g., browser extensions, compromised CDNs).

**Fix:** Add a `<meta http-equiv="Content-Security-Policy">` in `index.html` (or a response header in `netlify.toml` / `vercel.json`) with at least:
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://*.supabase.co https://api.stripe.com;
```
Tighten iteratively.

**Status:** Implemented (2026-02-11)

**Summary:** Added a baseline `Content-Security-Policy` response header for both Netlify and Vercel deploys (configured in `netlify.toml` and `vercel.json`) to reduce risk of script injection while allowing required fonts, Supabase connections, and Vercel Analytics.

---

### 🛡️ Reliability

#### REL-01 · No error boundary — uncaught render error = white screen

**Where:** [src/App.jsx](../src/App.jsx), [src/main.jsx](../src/main.jsx)

There is no React `ErrorBoundary` anywhere in the component tree. A single uncaught error in any page component crashes the entire app with a blank white screen and no recovery path.

**Fix:**
1. Install `react-error-boundary` (or write a minimal class component).
2. Wrap `<Routes>` (or each route) in an `ErrorBoundary` with a user-friendly fallback ("Something went wrong — go back to Home").
3. Optionally report errors to a monitoring service (Sentry, LogRocket).

**Status:** Implemented (2026-02-11)

**Summary:** Added a top-level UI error boundary that wraps the routing tree and renders a friendly recovery screen (Home + Reload) instead of a white screen on uncaught render errors.

---

#### REL-02 · Timer drift when browser throttles background tabs

**Where:** [src/pages/LessonPage.jsx](../src/pages/LessonPage.jsx)

The countdown timer decrements a counter inside a `setInterval`. Modern browsers throttle intervals in background tabs to 1 call/sec or less, causing the 60-second lesson to last much longer if the user switches tabs.

**Fix:** Record `startTime = Date.now()` when the timer starts. On each tick compute `elapsed = Date.now() - startTime`. Derive remaining seconds from the wall clock, not from a decrementing counter.

**Status:** Implemented (2026-02-11)

**Summary:** Replaced the decrementing `setInterval` countdown with a wall-clock deadline (`Date.now()`), so the timer stays accurate even when the tab is background-throttled.

---

#### REL-03 · No navigation guard during active lesson

**Where:** [src/pages/LessonPage.jsx](../src/pages/LessonPage.jsx)

Users can accidentally navigate away or close the tab mid-lesson with no warning, losing all progress.

**Fix:** Add a `beforeunload` handler while the lesson timer is running. Optionally use React Router's `useBlocker` to warn on in-app navigation.

**Status:** Implemented (2026-02-11)

**Summary:** Added a `beforeunload` guard and an in-app navigation blocker (React Router) while the lesson timer is active to warn users before leaving mid-lesson.

---

### ⚡ Performance

#### PERF-01 · No route-level code splitting — entire app in one 700 KB bundle

**Where:** [src/App.jsx](../src/App.jsx)

Every page is eagerly imported. The initial JS download includes code for the lesson engine, profile page, review mode, Stripe integration, etc. — even if the user only visits the landing page.

**Fix:**
1. Convert heavy page imports to `React.lazy()`:
   ```jsx
   const LessonPage = React.lazy(() => import('./pages/LessonPage'));
   const ReviewPage = React.lazy(() => import('./pages/ReviewPage'));
   const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
   const TopicsBrowserPage = React.lazy(() => import('./pages/TopicsBrowserPage'));
   const UpgradePage = React.lazy(() => import('./pages/UpgradePage'));
   ```
2. Wrap `<Routes>` in `<Suspense fallback={<LoadingScreen />}>`.
3. Configure `build.rollupOptions.output.manualChunks` in `vite.config.js` to split `framer-motion`, `stripe`, and `@supabase/supabase-js` into separate vendor chunks.

**Impact:** Should cut the initial bundle from ~700 KB to ~200–300 KB.

**Status:** Implemented (2026-02-11)

**Summary:** Added route-level code splitting via `React.lazy()` + `Suspense` in `src/App.jsx` with a lightweight `RouteLoading` fallback, and configured Vite/Rollup `manualChunks` to split key vendor libraries for improved caching. Follow-up: adjusted chunking to keep React’s `scheduler` bundled with the React chunk to avoid a production-only circular chunk import that could break app boot.

---

#### PERF-02 · Render-blocking Google Fonts `@import` in CSS

**Where:** [src/index.css](../src/index.css) (line 1)

```css
@import url('https://fonts.googleapis.com/css2?family=...');
```

This blocks rendering until the font CSS is downloaded and parsed.

**Fix:** Move to `<link rel="preconnect" href="https://fonts.googleapis.com">` + `<link rel="stylesheet" href="...">` with `display=swap` in `index.html`. Or self-host the fonts for zero external dependency.

**Status:** Implemented (2026-02-11)

**Summary:** Removed the Google Fonts `@import` from `src/index.css` and added `preconnect` + `stylesheet` links in `index.html` to avoid render-blocking CSS imports.

---

#### PERF-03 · `listTopics()` downloads full catalog for 6 related items

**Where:** [src/pages/TopicPage.jsx](../src/pages/TopicPage.jsx)

The related-topics feature calls `listTopics()`, which does an unbounded `SELECT` of all published topics, just to filter for 6 related items client-side.

**Fix:** Add a server-side RPC (e.g., `get_related_topics(p_topic_id, p_limit)`) that filters by subject/subcategory in SQL and returns only the needed rows. Or use `listTopicsPage` with a subject filter and `limit: 6`.

**Status:** Implemented (2026-02-11)

**Summary:** Replaced the Topic page “related topics” loader to use a bounded query (`listRelatedTopics`) that filters by subject/subcategory and limits results (default 6), avoiding a full catalog download.

---

### ♿ Accessibility

#### A11Y-01 · Focus indicators removed globally

**Where:** [src/index.css](../src/index.css) (line 101), [src/components/Header.css](../src/components/Header.css), [src/pages/TopicsBrowserPage.css](../src/pages/TopicsBrowserPage.css), [src/pages/LoginPage.css](../src/pages/LoginPage.css), [src/pages/ProfilePage.css](../src/pages/ProfilePage.css)

Multiple CSS files contain `outline: none` on buttons/inputs. Only 2 elements in the entire app have `:focus-visible` styles. Keyboard users cannot see which element is focused. **WCAG 2.4.7 failure.**

**Fix:**
1. Remove all `outline: none` rules.
2. Add a global `:focus-visible` style:
   ```css
   *:focus-visible {
     outline: 2px solid var(--color-primary);
     outline-offset: 2px;
   }
   ```
3. Use `:focus-visible` (not `:focus`) so mouse users don't see outlines.

**Status:** Implemented (2026-02-11)

**Summary:** Removed `outline: none` from interactive controls and added a global `*:focus-visible` outline style to restore visible keyboard focus (WCAG 2.4.7).

---

#### A11Y-02 · No global `prefers-reduced-motion` support

**Where:** Only [src/pages/Home.css](../src/pages/Home.css) honors `prefers-reduced-motion`. All other pages, the Timer, confetti, SubjectCard infinite float animation, and Framer Motion transitions run unrestricted. **WCAG 2.3.3 failure.**

**Fix:** Add a global reduced-motion rule:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
Also pass `reducedMotion="user"` to Framer Motion's `<LazyMotion>` or `<MotionConfig>`.

**Status:** Implemented (2026-02-11)

**Summary:** Added a global reduced-motion stylesheet fallback (disables most CSS transitions/animations and smooth scrolling) and wrapped the app in Framer Motion’s `MotionConfig` with `reducedMotion="user"` so motion respects the user preference.

---

#### A11Y-03 · Timer has no accessible announcement

**Where:** [src/components/Timer.jsx](../src/components/Timer.jsx)

The countdown timer is purely visual. Screen reader users have no awareness of time remaining during a lesson.

**Fix:** Add `role="timer"` and `aria-live="assertive"` to the timer element. Announce at key moments (30s, 10s, 5s) with a visually hidden live region.

**Status:** Implemented (2026-02-11)

**Summary:** Updated the `Timer` component to add `role="timer"` semantics and a screen-reader-only live region that announces time remaining at key moments (30s, 10s, 5s, and 0).

---

---

## P1 — High impact

### ⚡ Performance

#### PERF-04 · LessonPage re-renders ~20× per second

**Where:** [src/engine/story/StoryRenderer.jsx](../src/engine/story/StoryRenderer.jsx)

A 50ms `setInterval` drives the story beat progress bar, firing ~20 state updates per second. Each triggers a full component re-render.

**Fix:** Use `requestAnimationFrame` with a CSS `transition` for the progress bar width. Or throttle state updates to 200–500ms (the visual difference is imperceptible).

**Status:** Implemented (2026-02-11)

**Summary:** Removed the 50ms progress ticker and now derives beat/quiz progression from the 1Hz lesson timer (`timeRemaining`), reducing StoryRenderer re-renders from ~20/sec to ~1/sec while preserving wall-clock catch-up behavior.

---

#### PERF-05 · SubjectCard infinite float animation on every card

**Where:** [src/components/SubjectCard.jsx](../src/components/SubjectCard.jsx)

Each topic card runs a perpetual Framer Motion spring animation on the emoji. On the browse page with 36+ visible cards, this consumes significant CPU/GPU.

**Fix:** Replace with a CSS `@keyframes` animation that pauses on `prefers-reduced-motion: reduce` and only activates on `:hover`.

**Status:** Implemented (2026-02-11)

**Summary:** Removed the infinite Framer Motion emoji animation from `SubjectCard` and replaced it with a lightweight CSS `@keyframes` float that only runs on hover/focus (and is disabled for reduced motion), cutting idle CPU/GPU usage on the Topics grid.

---

#### PERF-06 · ProfilePage downloads full topic catalog

**Where:** [src/pages/ProfilePage.jsx](../src/pages/ProfilePage.jsx)

The profile page calls `listTopics()` just to enrich progress rows with topic titles/emojis — a join the server could handle.

**Fix:** Return enriched progress rows from a server-side query or RPC that joins `user_topic_progress` with `topics`.

**Status:** Implemented (2026-02-11)

**Summary:** Removed the ProfilePage `listTopics()` full-catalog fetch; progress rows already include a `topics (...)` join, subject totals now use `getTopicCategoryCounts()`, and topic metadata for the Ratings tab is fetched via `listTopicsByIds()` (only the IDs needed).

---

### 🔒 Security

#### SEC-05 · OAuth redirect URL uses `window.location.origin`

**Where:** [src/context/AuthContext.jsx](../src/context/AuthContext.jsx)

The OAuth `redirectTo` is built from `window.location.origin`. In certain proxy/CDN configurations, this could be manipulated.

**Fix:** Use `import.meta.env.VITE_SITE_URL` as the base URL for OAuth redirects, with `window.location.origin` as a fallback only in dev mode.

**Status:** Implemented (2026-02-11)

**Summary:** Centralized auth redirect URL construction in `AuthContext` so OAuth/signup/password-reset redirects use `VITE_SITE_URL` in production (and only fall back to `window.location.origin` in dev), preventing proxy/CDN origin manipulation from affecting redirect targets.

---

### ♿ Accessibility

#### A11Y-04 · Mobile nav has no focus trap

**Where:** [src/components/Header.jsx](../src/components/Header.jsx)

When the mobile hamburger menu is open, keyboard focus can tab behind the overlay into obscured content.

**Fix:** Implement a focus trap inside the open nav menu. Close on `Escape`. Return focus to the hamburger button on close.

**Status:** Implemented (2026-02-11)

**Summary:** Added a mobile-nav focus trap in `Header`: when the menu opens, focus moves into the menu; `Tab`/`Shift+Tab` wrap within the menu; `Escape` closes; and focus returns to the hamburger toggle on close.

---

#### A11Y-05 · Quiz options lack proper semantics

**Where:** [src/engine/story/StoryRenderer.jsx](../src/engine/story/StoryRenderer.jsx)

Quiz answer options use `<button>` elements but lack `role="radiogroup"` / `role="radio"` semantics. Screen readers don't announce this as a single-choice question set.

**Fix:** Wrap options in a container with `role="radiogroup"` + `aria-labelledby` (the question). Each option gets `role="radio"` + `aria-checked` and roving `tabIndex`, with arrow-key navigation (`←/→/↑/↓`, `Home`, `End`) and `Space`/`Enter` to select.

**Status:** Implemented (2026-02-11)

**Summary:** Updated `StoryRenderer` quiz options to use `radiogroup`/`radio` semantics with `aria-checked`, roving focus, and arrow-key navigation so screen readers announce the set as a single-choice question and keyboard users can navigate options predictably.

---

#### A11Y-06 · Pricing feature comparison uses divs instead of `<table>`

**Where:** [src/pages/UpgradePage.jsx](../src/pages/UpgradePage.jsx)

The 3-column comparison grid is built with `<div>`s. Screen reader users cannot navigate it as a data table.

**Fix:** Use semantic `<table>`, `<thead>`, `<th scope="col">`, and `<td>` elements.

**Status:** Implemented (2026-02-11)

**Summary:** Replaced the div-based comparison grid on the Pricing page with a semantic `<table>` (caption + `<thead>/<tbody>`, column headers via `<th scope="col">`, and feature names as row headers via `<th scope="row">`) so assistive tech can navigate the comparison as a real data table.

---

### 🎨 UX


#### UX-01 · No "show password" toggle

**Where:** [src/pages/LoginPage.jsx](../src/pages/LoginPage.jsx), sign-up form

Users can't verify what they've typed, leading to failed sign-in attempts, especially on mobile.

**Fix:** Add a visibility toggle button (eye icon) inside password input fields.

**Status:** Implemented (2026-02-11)

**Summary:** Added an in-field show/hide password toggle to the password input on the sign-in/sign-up form, improving entry accuracy on mobile and reducing failed sign-ins from mistyped passwords.

---

#### UX-02 · Post-checkout polling has no visual feedback

**Where:** [src/pages/ProfilePage.jsx](../src/pages/ProfilePage.jsx)

After Stripe checkout success, the app polls subscription status every 2.5s for up to 30s with only a text counter. The user stares at a static screen.

**Fix:** Add a progress bar or pulsing skeleton. Show "It's taking longer than expected — you can refresh the page" after 10s.

**Status:** Implemented (2026-02-11)

**Summary:** Improved the post-checkout Pro activation banner with a lightweight progress indicator and a clear “taking longer than expected” hint after 10 seconds, so users aren’t staring at static text while polling completes.

---

### 📈 Scalability

#### SCALE-01 · `api_rate_limits` table has no TTL / cleanup

**Where:** [supabase/005_rate_limit_idempotency.sql](../supabase/005_rate_limit_idempotency.sql)

Rate-limit rows accumulate indefinitely. Over months of traffic this becomes a storage and query-performance concern.

**Fix:** Add a scheduled job (pg_cron or an external cron) to `DELETE FROM api_rate_limits WHERE window_start < now() - interval '1 day'`.

**Status:** Implemented (2026-02-11)

**Summary:** Added a TTL cleanup function and a best-effort daily pg_cron schedule (with a safe fallback to run the cleanup via an external cron) to prevent unbounded growth of `api_rate_limits`.

---

#### SCALE-02 · `stripe_webhook_events` table has no TTL

**Where:** Same migration file.

Webhook idempotency rows also grow unboundedly.

**Fix:** Periodically purge events older than 30 days.

**Status:** Implemented (2026-02-11)

**Summary:** Added a retention cleanup function for `stripe_webhook_events` (30-day default) with a best-effort daily pg_cron schedule and a safe fallback to run cleanup via an external cron.

---

### 🧹 Code Quality

#### CQ-01 · LessonPage.jsx is 650+ lines with a 250-line `useMemo`

**Where:** [src/pages/LessonPage.jsx](../src/pages/LessonPage.jsx)

A single `useMemo` containing inline JSX factories for the completion screen, top bar, and timer makes the file very hard to read or test.

**Fix:** Extract into separate components: `CompletionScreen`, `LessonTopbar`.

---

#### CQ-02 · ProfilePage.jsx is 1,250+ lines

**Where:** [src/pages/ProfilePage.jsx](../src/pages/ProfilePage.jsx)

Contains overview, preferences, progress, ratings, and account management all in one file.

**Fix:** Split into per-tab components: `OverviewTab`, `PreferencesTab`, `ProgressTab`, `RatingsTab`, `AccountTab`.

---

#### CQ-03 · TopicsBrowserPage.jsx is 875+ lines with embedded dev tooling

**Where:** [src/pages/TopicsBrowserPage.jsx](../src/pages/TopicsBrowserPage.jsx)

Production UI and dev-only module-check feature (SSE, overrides, modal) are in one file.

**Fix:** Extract the module-check feature into a separate `DevModuleCheck` component.

---

#### CQ-04 · Duplicated utility functions across API files

**Where:** `api/stripe/create-checkout-session.js`, `api/stripe/create-portal-session.js`

`normalizeSiteUrl`, `getClientIp`, `enforceRateLimit`, `readJsonBody` are copy-pasted. A fix in one isn't propagated to the other.

**Fix:** Import from the existing shared `api/account/_utils.js`, which already exports most of these.

---

### 🧪 Testing

#### TEST-01 · No unit tests exist

**Where:** Entire project

There is no test runner configured (no Vitest, no Jest). Business-critical modules (`entitlements.js`, `passwordStrength.js`, journey compilation) have zero test coverage. A typo in `getTopicGate()` could lock all users out.

**Fix:**
1. Add Vitest (`npm i -D vitest`).
2. Write unit tests for: `entitlements.js`, `passwordStrength.js`, `compileJourney.js`, `topics.local.js`, `seo.js`.
3. Add `"test": "vitest run"` to `package.json`.

---

#### TEST-02 · Stripe webhook handler is untested

**Where:** [api/stripe/webhook.js](../api/stripe/webhook.js)

Signature verification, user metadata updates, and idempotency logic are tested only by manual webhook sends. A bug here silently fails to activate Pro for paying customers — a direct revenue impact.

**Fix:** Add unit tests with mocked Stripe events and Supabase responses.

---

---

## P2 — Strategic

### ⚡ Performance

#### PERF-07 · Vite config has no chunk splitting strategy

**Where:** [vite.config.js](../vite.config.js)

The Vite config is minimal (just `plugins: [react()]`). There's no `manualChunks`, no `build.target`, no compression plugin.

**Fix:**
```js
build: {
  target: 'es2020',
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom', 'react-router-dom'],
        motion: ['framer-motion'],
        supabase: ['@supabase/supabase-js'],
      },
    },
  },
},
```
Add `vite-plugin-compression` for gzip/brotli precompression.

---

#### PERF-08 · Self-host Google Fonts

**Where:** [src/index.css](../src/index.css)

Three font families are loaded from Google Fonts CDN (Fredoka, Baloo 2, Caveat). Each adds a DNS lookup, TCP connection, and TLS handshake.

**Fix:** Download the woff2 files and serve from `public/fonts/`. Eliminates external dependency and reduces TTFB for font loading.

---

#### PERF-09 · Image optimization pipeline

**Where:** No image optimization exists

The project has no image compression or format conversion. As more topic assets are added, unoptimized images will hurt LCP.

**Fix:** Add `vite-plugin-image-optimizer` or a build-time script to convert images to WebP/AVIF with responsive `srcset`.

---

### 🎨 UX

#### UX-04 · No 404 page

**Where:** [src/App.jsx](../src/App.jsx)

Unmatched routes silently render nothing (no catch-all `*` route).

**Fix:** Add a `<Route path="*" element={<NotFoundPage />} />` with a friendly "Page not found" design and a link back to Home.

---

#### UX-05 · Auth callback shows plain text "Signing you in…"

**Where:** [src/pages/AuthCallbackPage.jsx](../src/pages/AuthCallbackPage.jsx)

No spinner or visual feedback during the OAuth callback, which can take 1–3 seconds.

**Fix:** Add a centered spinner or branded loading animation.

---

#### UX-06 · No skeleton loading states

**Where:** Topics browser, Profile page, Topic page

Pages show either nothing or a brief flash before content loads. No skeleton placeholders.

**Fix:** Add lightweight skeleton components (gray pulsing rectangles) for card grids, profile tabs, and topic headers.

---

### 📈 Scalability

#### SCALE-03 · ProfilePage downloads all topics to enrich progress

**Where:** [src/pages/ProfilePage.jsx](../src/pages/ProfilePage.jsx)

Already noted as PERF-06, but also a scalability concern: as topics grow to 1,000+, this becomes an increasingly large download.

**Fix:** Server-side join in the progress query, or a dedicated `listTopicsByIds()` RPC.

---

#### SCALE-04 · No client-side caching layer

**Where:** All services in `src/services/`

Every page load re-fetches topics, ratings, progress from Supabase. No in-memory cache, no stale-while-revalidate.

**Fix:** Add a lightweight cache (e.g., TanStack Query / React Query) with sensible `staleTime` values. Or add a simple `Map`-based cache with TTL in the service layer.

---

#### SCALE-05 · Content sync script has no dry-run or rollback

**Where:** [scripts/syncTopicsToSupabase.mjs](../scripts/syncTopicsToSupabase.mjs)

The sync script upserts directly to production with no preview, diff, or rollback mechanism.

**Fix:** Add a `--dry-run` flag that prints what would change. Consider wrapping upserts in a transaction.

---

### 🔒 Security

#### SEC-06 · No rate limiting on client-side auth actions

**Where:** [src/pages/LoginPage.jsx](../src/pages/LoginPage.jsx)

The login form has no client-side throttle. While Supabase has its own rate limits, a client-side cooldown (e.g., disable button for 2s after submit) prevents unnecessary load.

**Fix:** Add a short cooldown on the submit button after each attempt.

---

#### SEC-07 · Supabase anon key is in client bundle

**Where:** [src/lib/supabaseClient.js](../src/lib/supabaseClient.js)

This is standard for Supabase SPAs and protected by RLS, but worth noting: ensure all tables have RLS enabled and no table is world-writable via the anon key. Audit RLS policies periodically.

**Fix:** Add a CI check that verifies RLS is enabled on all public tables (`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity`).

---

### ♿ Accessibility

#### A11Y-07 · Confetti elements announced by screen readers

**Where:** Lesson completion confetti

Decorative confetti `<div>`s are not hidden from the accessibility tree.

**Fix:** Add `aria-hidden="true"` to the confetti container.

---

#### A11Y-08 · Locked topic cards lack accessible state

**Where:** [src/components/SubjectCard.jsx](../src/components/SubjectCard.jsx)

Locked/Pro-only cards have `pointerEvents: 'none'` but no `aria-disabled` or explanation of why the card can't be clicked.

**Fix:** Add `aria-disabled="true"` and `aria-label="Pro only — upgrade to unlock"`.

---

### 🧹 Code Quality

#### CQ-05 · Seo component has no cleanup on unmount

**Where:** [src/components/Seo.jsx](../src/components/Seo.jsx)

The `useEffect` imperatively mutates `<head>` tags but has no cleanup function to restore previous values. During page transitions, meta tags from the previous page can briefly leak into the new one.

**Fix:** Return a cleanup function from the `useEffect` that restores the previous title, description, and canonical values.

---

#### CQ-06 · No TypeScript

**Where:** Entire project

The codebase is plain JS with no type annotations. As the project scales, refactoring becomes risky without type safety.

**Fix:** Consider incremental TypeScript adoption: rename files to `.tsx`/`.ts` one module at a time, starting with services and utilities. `tsconfig.json` with `allowJs: true` lets you migrate gradually.

---

#### CQ-07 · No CI/CD pipeline definition in the repo

**Where:** No `.github/workflows/` or similar

There's no automated lint, test, or build verification on pull requests.

**Fix:** Add a GitHub Actions workflow that runs: lint → test → build → content:validate on every PR.

---

### 🧪 Testing

#### TEST-03 · Build scripts have no automated tests

**Where:** `scripts/` directory

`syncTopicsToSupabase`, `validateContent`, `regenerateJourneys` are tested only by manual execution.

**Fix:** Add integration tests that run the scripts against fixture data in a temp directory.

---

#### TEST-04 · No visual regression tests

**Where:** Project-wide

There are no screenshot or snapshot tests to catch unintended UI changes.

**Fix:** Add Playwright visual comparison tests for key pages (Home, Topics, Topic, Lesson, Profile).

---

---

## Summary matrix

| Category | P0 | P1 | P2 |
|---|---|---|---|
| **Security** | SEC-01, SEC-02, SEC-03, SEC-04 | SEC-05 | SEC-06, SEC-07 |
| **Reliability** | REL-01, REL-02, REL-03 | — | — |
| **Performance** | PERF-01, PERF-02, PERF-03 | PERF-04, PERF-05, PERF-06 | PERF-07, PERF-08, PERF-09 |
| **Accessibility** | A11Y-01, A11Y-02, A11Y-03 | A11Y-04, A11Y-05, A11Y-06 | A11Y-07, A11Y-08 |
| **UX** | — | UX-01, UX-02, UX-03 | UX-04, UX-05, UX-06 |
| **Scalability** | — | SCALE-01, SCALE-02 | SCALE-03, SCALE-04, SCALE-05 |
| **Code Quality** | — | CQ-01, CQ-02, CQ-03, CQ-04 | CQ-05, CQ-06, CQ-07 |
| **Testing** | — | TEST-01, TEST-02 | TEST-03, TEST-04 |

## Recommended execution order (top 10)

1. **REL-01** — Add ErrorBoundary (prevents white-screen crashes)
2. **SEC-01** — Fix open redirect in checkout URLs
3. **A11Y-01** — Restore focus indicators globally
4. **PERF-01** — Add React.lazy code splitting
5. **PERF-02** — Move Google Fonts out of CSS `@import`
6. **A11Y-02** — Add global `prefers-reduced-motion`
7. **SEC-04** — Add Content-Security-Policy
8. **REL-02** — Fix timer drift
9. **TEST-01** — Set up Vitest + core unit tests
10. **SEC-02** — Add CORS headers to API functions
