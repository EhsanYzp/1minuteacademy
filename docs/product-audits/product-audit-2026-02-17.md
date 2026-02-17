# Product Audit — 1 Minute Academy

> Generated: 2026-02-17
>
> Scope: performance, scalability, reliability, accessibility, security, UX, code quality, testing.
>
> This audit covers **only open items** — issues that still need to be addressed. All items confirmed fixed from the 2026-02-11 audit (SEC-01–05, REL-01–03, PERF-01–07, A11Y-01–06, A11Y-08, UX-01–02, SCALE-01–03) have been re-verified and remain solid.

---

## How to read this document

- **P0** — Must fix. Blocks launch quality, user safety, or causes measurable harm today.
- **P1** — High impact. Should be done in the next sprint. Prevents real pain at scale or for specific user groups.
- **P2** — Strategic. Worth doing soon but can be scheduled. Improves long-term quality and developer velocity.

---

## P0 — Critical

### 🔒 Security

#### SEC-08 · Netlify functions have stale security — open redirect + no CORS + error leaks *(New)*

**Where:** [netlify/functions/stripe-create-checkout-session.mjs](../../netlify/functions/stripe-create-checkout-session.mjs), [netlify/functions/stripe-webhook.mjs](../../netlify/functions/stripe-webhook.mjs)

The Netlify serverless functions are an **earlier copy** of the Vercel API routes and have **not received** any security hardening applied since 2026-02-11:

1. **Open redirect via `Origin` header.** The checkout function uses `normalizeSiteUrl(event.headers?.origin) || normalizeSiteUrl(process.env.SITE_URL)`, trusting the request's `Origin` header for Stripe `success_url` and `cancel_url`. An attacker can set `Origin: https://evil.com` to redirect users to a malicious domain after payment.
2. **No CORS handling.** Neither function imports or calls `applyCors()`.
3. **Error messages leak internals.** Both functions return `e.message` directly in error responses.

**Fix:**
- If Netlify deploys are still active: port all Vercel security fixes (CORS, error sanitization, `SITE_URL`-only redirects).
- If Netlify is no longer the active deploy target: **delete the Netlify functions** entirely to avoid confusion and prevent accidental deployment of vulnerable code.

**Status:** Implemented (2026-02-17)

**Summary:** Hardened the legacy Netlify Stripe functions to rely on `SITE_URL` only for redirect targets, added CORS/OPTIONS handling, and stopped returning raw exception messages to clients.

**Re-audit (2026-02-18):** ✅ Confirmed. Both Netlify functions derive redirect URLs from `SITE_URL` only (no `Origin` fallback), handle `OPTIONS` with 204 + CORS headers, and catch blocks return generic error strings.

---

#### SEC-09 · Potential open redirect in `create-portal-session.js` via `returnPath` body parameter *(New)*

**Where:** [api/stripe/create-portal-session.js](../../api/stripe/create-portal-session.js)

The `returnPath` from the user's POST body is used as:

```js
return_url: new URL(returnPath, siteUrl).toString(),
```

If `returnPath` is an absolute URL like `https://evil.com`, `new URL()` returns it as-is, ignoring `siteUrl`. The only validation is a fallback to `/me` if the field is falsy.

**Fix:** Validate that `returnPath` starts with `/` and does not contain `://`:

```js
const safePath = (typeof returnPath === 'string' && returnPath.startsWith('/') && !returnPath.includes('://'))
  ? returnPath
  : '/me';
```

**Status:** Implemented (2026-02-17)

**Summary:** Sanitized `returnPath` to allow only safe in-site relative paths (default `/me`) before building Stripe Billing Portal `return_url`.

**Re-audit (2026-02-18):** ✅ Confirmed. `create-portal-session.js` validates `returnPath` starts with `/`, rejects `://` and `//`, and truncates to 1024 chars before passing to `new URL(safePath, siteUrl)`.

---

### 🛡️ Reliability

#### REL-04 · ErrorBoundary does not reset on navigation *(New)*

**Where:** [src/components/ErrorBoundary.jsx](../../src/components/ErrorBoundary.jsx)

Once the ErrorBoundary catches an error, `this.state.hasError` remains `true` permanently. There is no route-change listener to reset the state. If a user clicks "Go to Home" the boundary still shows its fallback.

**Fix:** Either:
1. Wrap ErrorBoundary inside a component that passes `location.key` as a `key` prop, forcing a remount on route changes.
2. Or implement `componentDidUpdate` to reset `hasError` when a `resetKey` prop (derived from `location.pathname`) changes.

**Status:** Implemented (2026-02-17)

**Summary:** Added a `resetKey` prop to `ErrorBoundary` and wired it to router `location.key` so the boundary clears its error state after navigation.

**Re-audit (2026-02-18):** ✅ Confirmed. `ErrorBoundary.jsx` implements `componentDidUpdate` checking `resetKey` and resets `hasError`. `App.jsx` passes `location.key` as `resetKey`.

---

---

## P1 — High impact

### ⚡ Performance

#### PERF-10 · `listTopics()` has no LIMIT — silent truncation at 1,000 rows *(New)*

**Where:** [src/services/topics.js](../../src/services/topics.js)

The `listTopics()` function (used by `TopicsBrowserPage`) performs an unbounded `SELECT` of all published topics with no `.limit()` call. Supabase's default row limit is 1,000, meaning results will be silently truncated once the catalog exceeds that. With 18 topics today this is harmless, but it's a time bomb.

**Fix:** Either:
1. Add explicit pagination with `.range()` and a "load more" UI.
2. Or at minimum add `.limit(2000)` to make the cap explicit and detectable.

**Status:** Implemented (2026-02-17)

**Summary:** Updated `listTopics()` to fetch results via explicit `.range()` pagination so it can’t silently truncate at 1,000 rows.

---

#### PERF-11 · Triple-query schema fallback in topics service *(New)*

**Where:** [src/services/topics.js](../../src/services/topics.js)

Functions like `listTopicsPage`, `listRelatedTopics`, and `getTopicBySlug` have a "missing column" fallback pattern: try full select → try without `subcategory` → try minimal select. This means **up to 3 Supabase queries per call** on schema errors. This was added for migration safety but the schema is now stable.

**Fix:** Remove the cascading fallback queries. If the schema is ever wrong, a clear error is better than silently degrading and tripling latency.

**Status:** Implemented (2026-02-17)

**Summary:** Removed the schema-error “missing column” fallback retries so topic list queries don’t run up to 3 times on failures.
**Re-audit (2026-02-18):** ✅ Confirmed. `topics.js` has zero `try/catch` cascading fallback blocks — errors throw directly.
---

### ♿ Accessibility

#### A11Y-09 · Confetti elements announced by screen readers *(Escalated from P2 A11Y-07)*

**Where:** [src/pages/LessonPage.jsx](../../src/pages/LessonPage.jsx) (line 878)

The lesson completion confetti container (`<div className="confetti-container">`) and its 12 animated `<motion.div>` children are fully visible to the accessibility tree. Screen readers will announce these decorative elements.

**Fix:** Add `aria-hidden="true"` to the confetti container:

```jsx
<div className="confetti-container" aria-hidden="true">
```

**Status:** Implemented (2026-02-17)

**Summary:** Marked the confetti container as `aria-hidden="true"` so decorative elements are ignored by screen readers.

**Re-audit (2026-02-18):** ✅ Confirmed. Confetti (extracted to `CompletionScreen.jsx`) renders with `aria-hidden="true"` on the container.

---

### 🎨 UX

#### UX-07 · No 404 page *(Escalated from P2 UX-04)*

**Where:** [src/App.jsx](../../src/App.jsx)

There is no catch-all `*` route in the router configuration. Any URL that doesn't match a defined route silently renders nothing — a blank content area with just the footer.

**Fix:** Add a `NotFoundPage` component and a catch-all route:

```jsx
{ path: '*', element: <NotFoundPage /> }
```

**Status:** Implemented (2026-02-17)

**Summary:** Added a `NotFoundPage` and a catch-all `*` route so unknown URLs show a proper 404 page instead of rendering blank.

**Re-audit (2026-02-18):** ✅ Confirmed. `App.jsx` has a `{ path: '*', element: <NotFoundPage /> }` catch-all route. `NotFoundPage` is lazy-loaded.

---

### 🧹 Code Quality

#### CQ-01 · LessonPage.jsx is 921 lines with a 243-line `useMemo` *(Worse)*

**Where:** [src/pages/LessonPage.jsx](../../src/pages/LessonPage.jsx)

Previously grown from ~695 → **921 lines** (+33%) due to certificate-unlock detection and post-completion UI.

**Fix:** Extract into separate components: `CompletionScreen`, `LessonTopbar` (and optionally `RelatedTopics`).

**Status:** Implemented (2026-02-17)

**Summary:** Extracted the lesson topbar and completion UI into `LessonTopbar` and `CompletionScreen`, reducing `LessonPage.jsx` from 921 → 791 lines and removing large inline JSX blocks.

**Re-audit (2026-02-18):** ✅ Confirmed. `LessonPage.jsx` is 791 lines. `CompletionScreen` and `LessonTopbar` are imported from separate files.

---

#### CQ-02 · ProfilePage.jsx is 2,122 lines *(Worse)*

**Where:** [src/pages/ProfilePage.jsx](../../src/pages/ProfilePage.jsx)

Previously grown from ~1,335 → **2,122 lines** (+59%). Contains **7 inline tab sections** (overview, preferences, progress, badges, certificates, ratings, account) and **~40+ `useState` hooks**. The new Certificates tab alone adds ~300 lines.

**Fix:** Split into per-tab components: `OverviewTab`, `PreferencesTab`, `ProgressTab`, `BadgesTab`, `CertificatesTab`, `RatingsTab`, `AccountTab`.

**Status:** Implemented (2026-02-17)

**Summary:** Extracted all tab sections into dedicated components under `src/components/profile/tabs/`, reducing `ProfilePage.jsx` from 2,122 → 1,437 lines and removing large inline JSX blocks.

**Re-audit (2026-02-18):** ✅ Confirmed. `ProfilePage.jsx` is 1,453 lines. Seven tab components are lazy-loaded from `src/components/profile/tabs/`.

---

#### CQ-03 · TopicsBrowserPage.jsx is 875 lines with embedded dev tooling *(Unchanged)*

**Where:** [src/pages/TopicsBrowserPage.jsx](../../src/pages/TopicsBrowserPage.jsx)

The dev-only module-check feature (~190 lines of state, SSE logic, and modal UI) remains inline in the production component.

**Fix:** Extract the module-check feature into a separate `DevModuleCheck` component.

**Status:** Implemented (2026-02-17)

**Summary:** Extracted the dev-only module-check UI/state/SSE streaming into `DevModuleCheck`, reducing `TopicsBrowserPage.jsx` from 875 → 640 lines while keeping behavior the same.

**Re-audit (2026-02-18):** ✅ Confirmed. `TopicsBrowserPage.jsx` is 641 lines. `DevModuleCheck` is imported from a separate component file.

---

#### CQ-04 · Duplicated utility functions across API files *(Unchanged)*

**Where:** `api/stripe/create-checkout-session.js`, `api/stripe/create-portal-session.js`, `api/stripe/subscription-status.js`

**5 duplicated functions** (`json`, `normalizeSiteUrl`, `getClientIp`, `readJsonBody`, `enforceRateLimit`) are copy-pasted across 3–4 files (15+ copies). The shared `api/account/_utils.js` already exports most of these but is not imported by any Stripe route.

**Fix:** Import from `api/account/_utils.js`. Add `normalizeSiteUrl` to the shared file. Delete the local copies.

**Status:** Implemented (2026-02-17)

**Summary:** Centralized shared Stripe route helpers in `api/account/_utils.js` (including adding `normalizeSiteUrl`) and refactored the Stripe API routes to import the shared utilities, removing local duplicate copies.

**Re-audit (2026-02-18):** ✅ Confirmed. All three Stripe route files import from `../account/_utils.js`. No local definitions of `json`, `getClientIp`, `readJsonBody`, or `enforceRateLimit` remain.

---

#### CQ-08 · LearnPage.jsx contains two concatenated copies of itself *(New)*

**Where:** [src/pages/LearnPage.jsx](../../src/pages/LearnPage.jsx)

This 1,098-line file contains **two complete copies** of the same module concatenated:
- **Copy 1** (lines 1–593): Slot-machine UI. Has a duplicate `useState` declaration that would cause a runtime error if active.
- **Copy 2** (lines 594–1098): Simpler "reel" animation. This is the version that runs since the last `export default` wins.

The first 593 lines are dead code. The route currently redirects `/learn` to `/` anyway, so this file is never loaded.

**Fix:** Delete the file entirely (see CQ-09).

**Status:** Implemented (2026-02-17)

**Summary:** Deleted `src/pages/LearnPage.jsx`, which contained two concatenated copies of itself and was dead code since `/learn` redirects to `/`.

**Re-audit (2026-02-18):** ✅ Confirmed. `src/pages/LearnPage.jsx` does not exist on disk.

---

#### CQ-09 · Three dead Learn page variants on disk *(New)*

**Where:** [src/pages/LearnPage.jsx](../../src/pages/LearnPage.jsx), [src/pages/LearnHubPage.jsx](../../src/pages/LearnHubPage.jsx), [src/pages/LearnHubPageClean.jsx](../../src/pages/LearnHubPageClean.jsx)

All three files exist on disk but **none are imported or routed to** in `App.jsx`. The `/learn` route redirects to `/`. Together they contain ~2,200 lines of dead code with ~40 duplicated helper functions across the files.

**Fix:** Delete all three files. If any design is needed in the future, it can be rebuilt from git history.

**Status:** Implemented (2026-02-17)

**Summary:** Deleted the dead Learn page variants (`LearnPage.jsx`, `LearnHubPage.jsx`, `LearnHubPageClean.jsx`) plus their unused `LearnPage.css`, since `/learn` redirects to `/` and none were routed/imported.

**Re-audit (2026-02-18):** ✅ Confirmed. All four files (`LearnPage.jsx`, `LearnHubPage.jsx`, `LearnHubPageClean.jsx`, `LearnPage.css`) are absent from disk.

---

#### CQ-10 · certificates.js `buildCertificateSvg` is a 120-line template string *(New)*

**Where:** [src/services/certificates.js](../../src/services/certificates.js) (lines 75–218)

The certificate SVG is built as a single 120-line template literal with inline styles, coordinates, and conditional sections. Any design change requires editing deeply nested SVG markup inside a JS string.

**Fix:** Consider extracting the SVG template into a separate file or a dedicated `CertificateTemplate.jsx` component.

**Status:** Implemented (2026-02-17)

**Summary:** Extracted the certificate SVG markup into `src/services/certificateSvgTemplate.js` and kept `buildCertificateSvg` as a thin wrapper that escapes/derives values before rendering the template.

**Re-audit (2026-02-18):** ✅ Confirmed. `certificates.js` imports `renderCertificateSvgTemplate` from `./certificateSvgTemplate`. Template file (123 lines) contains the full SVG markup.

---

## P2 — Strategic

### ⚡ Performance

#### PERF-08 · Self-host Google Fonts *(Unchanged)*

Three font families (Fredoka, Baloo 2, Caveat) are still loaded from `fonts.googleapis.com` via `<link>` tags in `index.html`. Each adds a DNS lookup, TCP connection, and TLS handshake.

**Fix:** Download the woff2 files and serve from `public/fonts/`.

**Status:** Implemented (2026-02-17)

**Summary:** Removed Google Fonts `<link>` loads from `index.html` and switched to locally bundled fonts via `@fontsource/*` imports (Fredoka, Baloo 2, Caveat) in `src/main.jsx`.

**Re-audit (2026-02-18):** ✅ Confirmed. `index.html` has no Google Fonts `<link>` tags. `main.jsx` imports `@fontsource/fredoka`, `@fontsource/baloo-2`, and `@fontsource/caveat`.

---

#### PERF-09 · Image optimization pipeline *(Unchanged)*

No image optimization plugin or build-time compression exists. As more topic assets are added, unoptimized images will hurt LCP.

**Fix:** Add `vite-plugin-image-optimizer` or a build-time script to convert images to WebP/AVIF with responsive `srcset`.

**Status:** Implemented (2026-02-17)

**Summary:** Added `vite-plugin-image-optimizer` and configured it in `vite.config.js` to apply build-time image compression for bundled assets.

**Re-audit (2026-02-18):** ✅ Confirmed. `vite.config.js` imports `viteImageOptimizer` and configures quality settings for jpg, png, webp, avif, and svg.

---

#### PERF-12 · ProfilePage chunk is 43 KB — largest page chunk *(New)*

At 43 KB raw / 12 KB gzip, `ProfilePage` is the largest page-level chunk — more than double `LessonPage` (21 KB). This is a direct consequence of CQ-02 (2,122 lines in one file). Splitting into per-tab lazy components would significantly reduce initial chunk size.

**Status:** Implemented (2026-02-17)

**Summary:** Updated `ProfilePage.jsx` to lazy-load its per-tab components via `React.lazy` + `Suspense`, so each tab’s UI code is split into its own chunk and only loaded when selected.

---

### 🎨 UX

#### UX-05 · Auth callback shows plain text "Signing you in…" *(Unchanged)*

`AuthCallbackPage.jsx` shows a 🔐 emoji and plain text with no spinner or loading animation. On slow connections this looks like the page is broken.

**Fix:** Add a centered spinner or branded loading animation.

**Status:** Implemented (2026-02-17)

**Summary:** Updated `AuthCallbackPage.jsx` to show a centered loading spinner via the shared `RouteLoading` component while authentication completes.

**Re-audit (2026-02-18):** ✅ Confirmed. `AuthCallbackPage.jsx` renders `<RouteLoading />` as its loading state.

---

#### UX-06 · No skeleton loading states *(Unchanged)*

No skeleton components exist. Loading states use plain text ("Loading…", "Loading topics…", "Loading certificates…").

**Fix:** Add lightweight skeleton components (gray pulsing rectangles) for card grids, profile tabs, and topic headers.

**Status:** Implemented (2026-02-17)

**Summary:** Added reusable skeleton components and replaced plain-text loading states with skeletons for the topics grid, topic header, and profile tab content.

**Re-audit (2026-02-18):** ✅ Confirmed. `Skeleton.jsx` and `SkeletonBlocks.jsx` exist and are used in `TopicsBrowserPage`, `TopicPage`, and `ProfilePage`.

---

#### UX-08 · No `<noscript>` fallback *(New)*

**Where:** [index.html](../../index.html)

If JavaScript fails to load or is disabled, the user sees a blank white page with no explanation.

**Fix:** Add `<noscript>` inside `<body>`: "1 Minute Academy requires JavaScript to run."

**Status:** Implemented (2026-02-17)

**Summary:** Added a simple `<noscript>` fallback message to `index.html` so users without JavaScript see an explanation instead of a blank page.

**Re-audit (2026-02-18):** ✅ Confirmed. `index.html` has a styled `<noscript>` block inside `<body>`.

---

### 📈 Scalability

#### SCALE-04 · No client-side caching layer *(Unchanged)*

Every page load re-fetches data from Supabase. No in-memory cache, no stale-while-revalidate.

**Fix:** Add a lightweight cache (e.g., TanStack Query) with sensible `staleTime` values. Or add a simple `Map`-based cache with TTL in the service layer.

**Status:** Implemented (2026-02-17)

**Summary:** Added a small TTL cache (`src/services/cache.js`) and cached Supabase-backed topic category counts (5 min) plus topic list/search paging results (60s) in `src/services/topics.js` to reduce repeated reads.

**Re-audit (2026-02-18):** ✅ Confirmed. `cache.js` exports `makeCacheKey`/`withCache`. `topics.js` wraps `getTopicCategoryCounts` (5 min), `listTopicsPage` (60s), and `searchTopicsPage` (60s). See PERF-13 (new finding) re: cache eviction.

---

#### SCALE-05 · Content sync script has no transaction wrapping *(Partial)*

`syncTopicsToSupabase.mjs` now supports `--dry-run` and `--force` flags ✅, but still has **no transaction wrapping**. Inserts and upserts are separate calls — if the insert succeeds but the upsert fails, a partial sync results. There is also no batch chunking.

**Fix:** Wrap inserts + upserts in a transaction via an RPC. Add batch chunking for large catalogs.

**Status:** Implemented (2026-02-17)

**Summary:** Added an atomic write path via a Supabase RPC (`supabase/024_sync_topics_rpc.sql`) and updated `scripts/syncTopicsToSupabase.mjs` to sync via the RPC in 200-row chunks, preventing partial insert/upsert syncs.

**Re-audit (2026-02-18):** ✅ Confirmed. `syncTopicsToSupabase.mjs` calls `supabase.rpc('sync_topics_batch', ...)` in a chunked loop (batch size 200). SQL file creates the RPC with service-role-only guard.

---

#### SCALE-06 · Avatar storage bucket has no file-size or MIME restrictions *(New)*

**Where:** [supabase/016_avatars_storage.sql](../../supabase/016_avatars_storage.sql)

The RLS policies restrict writes to the owner's folder but don't enforce file size or MIME type at the database level. While the client validates MIME and enforces 2 MB, a malicious user could bypass this via direct Storage API calls.

**Fix:** Add a storage policy or trigger that rejects files over 5 MB or with non-image MIME types.

**Status:** Implemented (2026-02-17)

**Summary:** Tightened avatar Storage write policies to enforce an image-only MIME allowlist and a 5 MB max size at the database layer (`supabase/025_avatars_storage_constraints.sql`), preventing direct API bypass of client-side validation.

**Re-audit (2026-02-18):** ✅ Confirmed. Insert and update policies both enforce MIME allowlist (5 types) and `size <= 5242880` via `metadata` JSON. Defensive `coalesce` across multiple MIME key variants.

---

### 🔒 Security

#### SEC-06 · No rate limiting on client-side auth actions *(Unchanged)*

The login form has no client-side throttle. While Supabase has its own rate limits, a client-side cooldown prevents unnecessary load.

**Fix:** Add a short cooldown on the submit button after each attempt.

**Status:** Implemented (2026-02-18)

**Summary:** Added a short client-side cooldown on auth actions (sign-in/sign-up/reset/OAuth/resend) in `LoginPage` to reduce rapid repeat attempts and unnecessary auth load.

**Re-audit (2026-02-18):** ⚠️ Partial. Cooldown is present and buttons are correctly disabled, but the duration arithmetic double-counts elapsed time (see SEC-11 new finding), causing the 2s cooldown to expire in ~1s.

---

#### SEC-10 · IP rate-limit key is derived from `X-Forwarded-For` *(New)*

**Where:** All API routes using `getClientIp`

`getClientIp` reads `req.headers['x-forwarded-for']` and takes the first entry. If a client sends a forged header, that fake IP is used as the rate-limit key, potentially allowing bypass.

**Fix:** Verify that the deployment platform sanitizes `X-Forwarded-For`. Alternatively, use Vercel's `req.socket.remoteAddress` or `x-real-ip`.

**Status:** Implemented (2026-02-18)

**Summary:** Hardened `getClientIp` to prefer platform-provided single-IP headers (e.g. `x-real-ip`) and avoid trusting the spoofable first entry of `X-Forwarded-For`.

**Re-audit (2026-02-18):** ✅ Confirmed. `getClientIp` prefers `x-real-ip`, then `x-vercel-forwarded-for`, then last XFF hop, then `socket.remoteAddress`. Edge cases handled correctly.

---

### 🧹 Code Quality

#### CQ-05 · Seo component has no cleanup on unmount *(Unchanged)*

**Where:** [src/components/Seo.jsx](../../src/components/Seo.jsx)

`useEffect` mutates `<head>` tags but returns no cleanup function. During page transitions, meta tags from the previous page persist until the next page's effect fires. JSON-LD scripts are never removed. If a page sets `noindex` and the user navigates to a page without `<Seo>`, the directive persists.

**Fix:** Return a cleanup function that restores previous title, description, canonical, and removes JSON-LD scripts.

**Status:** Implemented (2026-02-18)

**Summary:** Added `useEffect` cleanup in `Seo` to restore/clear head mutations (title/meta/canonical) and remove route-owned JSON-LD scripts on unmount.

**Re-audit (2026-02-18):** ✅ Confirmed. `Seo.jsx` returns a cleanup function that restores title/meta/canonical and removes JSON-LD scripts scoped by a unique owner ID. Minor edge case with overlapping instances noted (see CQ-13).

---

#### CQ-11 · Dead `getContentSource` import in entitlements *(New)*

**Where:** [src/services/entitlements.js](../../src/services/entitlements.js)

Imports `getContentSource` from `./_contentSource` but never uses it.

**Fix:** Remove the unused import.

**Status:** Implemented (2026-02-18)

**Summary:** Removed the unused `getContentSource` import from `src/services/entitlements.js`.

**Re-audit (2026-02-18):** ✅ Confirmed. No `getContentSource` import exists in `entitlements.js`.

---

#### CQ-12 · ESLint only targets browser environment *(New)*

**Where:** [eslint.config.js](../../eslint.config.js)

ESLint is configured with browser globals only. Server-side code in `api/` and `scripts/` runs in Node.js but gets linted without Node.js globals.

**Fix:** Add a separate ESLint override for `api/**` and `scripts/**` with Node.js globals.

**Status:** Implemented (2026-02-18)

**Summary:** Added an ESLint override for `api/**`, `scripts/**`, and `netlify/functions/**` to enable Node.js globals during linting.


