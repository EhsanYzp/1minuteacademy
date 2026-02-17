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

---

### 🧹 Code Quality

#### CQ-01 · LessonPage.jsx is 921 lines with a 243-line `useMemo` *(Worse)*

**Where:** [src/pages/LessonPage.jsx](../../src/pages/LessonPage.jsx)

Grown from ~695 → **921 lines** (+33%) due to certificate-unlock detection and post-completion UI. The main `useMemo` is **~243 lines** containing 8 distinct inline JSX factories (completion screen, topbar, related topics, confetti, etc.). No `CompletionScreen` or `LessonTopbar` components have been extracted.

**Fix:** Extract into separate components: `CompletionScreen`, `LessonTopbar`, `RelatedTopics`.

---

#### CQ-02 · ProfilePage.jsx is 2,122 lines *(Worse)*

**Where:** [src/pages/ProfilePage.jsx](../../src/pages/ProfilePage.jsx)

Grown from ~1,335 → **2,122 lines** (+59%). Contains **7 inline tab sections** (overview, preferences, progress, badges, certificates, ratings, account) and **~40+ `useState` hooks**. The new Certificates tab alone adds ~300 lines.

**Fix:** Split into per-tab components: `OverviewTab`, `PreferencesTab`, `ProgressTab`, `BadgesTab`, `CertificatesTab`, `RatingsTab`, `AccountTab`.

---

#### CQ-03 · TopicsBrowserPage.jsx is 875 lines with embedded dev tooling *(Unchanged)*

**Where:** [src/pages/TopicsBrowserPage.jsx](../../src/pages/TopicsBrowserPage.jsx)

The dev-only module-check feature (~190 lines of state, SSE logic, and modal UI) remains inline in the production component.

**Fix:** Extract the module-check feature into a separate `DevModuleCheck` component.

---

#### CQ-04 · Duplicated utility functions across API files *(Unchanged)*

**Where:** `api/stripe/create-checkout-session.js`, `api/stripe/create-portal-session.js`, `api/stripe/subscription-status.js`

**5 duplicated functions** (`json`, `normalizeSiteUrl`, `getClientIp`, `readJsonBody`, `enforceRateLimit`) are copy-pasted across 3–4 files (15+ copies). The shared `api/account/_utils.js` already exports most of these but is not imported by any Stripe route.

**Fix:** Import from `api/account/_utils.js`. Add `normalizeSiteUrl` to the shared file. Delete the local copies.

---

#### CQ-08 · LearnPage.jsx contains two concatenated copies of itself *(New)*

**Where:** [src/pages/LearnPage.jsx](../../src/pages/LearnPage.jsx)

This 1,098-line file contains **two complete copies** of the same module concatenated:
- **Copy 1** (lines 1–593): Slot-machine UI. Has a duplicate `useState` declaration that would cause a runtime error if active.
- **Copy 2** (lines 594–1098): Simpler "reel" animation. This is the version that runs since the last `export default` wins.

The first 593 lines are dead code. The route currently redirects `/learn` to `/` anyway, so this file is never loaded.

**Fix:** Delete the file entirely (see CQ-09).

---

#### CQ-09 · Three dead Learn page variants on disk *(New)*

**Where:** [src/pages/LearnPage.jsx](../../src/pages/LearnPage.jsx), [src/pages/LearnHubPage.jsx](../../src/pages/LearnHubPage.jsx), [src/pages/LearnHubPageClean.jsx](../../src/pages/LearnHubPageClean.jsx)

All three files exist on disk but **none are imported or routed to** in `App.jsx`. The `/learn` route redirects to `/`. Together they contain ~2,200 lines of dead code with ~40 duplicated helper functions across the files.

**Fix:** Delete all three files. If any design is needed in the future, it can be rebuilt from git history.

---

#### CQ-10 · certificates.js `buildCertificateSvg` is a 120-line template string *(New)*

**Where:** [src/services/certificates.js](../../src/services/certificates.js) (lines 75–218)

The certificate SVG is built as a single 120-line template literal with inline styles, coordinates, and conditional sections. Any design change requires editing deeply nested SVG markup inside a JS string.

**Fix:** Consider extracting the SVG template into a separate file or a dedicated `CertificateTemplate.jsx` component.

---

### 🧪 Testing

#### TEST-01 · No unit tests exist *(Unchanged)*

No test runner (Vitest, Jest, or other) is configured. No `"test"` script exists in `package.json`. No test files (`*.test.js`, `*.spec.js`) exist anywhere. The `tests/` directory contains only a `.DS_Store` — even the Playwright E2E tests that were previously referenced appear to have been removed. `test-results/` and `playwright-report/` are stale artifacts.

**Fix:**
1. Add Vitest (`npm i -D vitest`).
2. Write unit tests for: `entitlements.js`, `passwordStrength.js`, `compileJourney.js`, `topics.local.js`, `seo.js`.
3. Add `"test": "vitest run"` to `package.json`.

---

#### TEST-02 · Stripe webhook handler is untested *(Unchanged, blocked by TEST-01)*

No webhook test files exist. Signature verification, user metadata updates, and idempotency logic are tested only by manual webhook sends.

**Fix:** Add unit tests with mocked Stripe events and Supabase responses.

---

---

## P2 — Strategic

### ⚡ Performance

#### PERF-08 · Self-host Google Fonts *(Unchanged)*

Three font families (Fredoka, Baloo 2, Caveat) are still loaded from `fonts.googleapis.com` via `<link>` tags in `index.html`. Each adds a DNS lookup, TCP connection, and TLS handshake.

**Fix:** Download the woff2 files and serve from `public/fonts/`.

---

#### PERF-09 · Image optimization pipeline *(Unchanged)*

No image optimization plugin or build-time compression exists. As more topic assets are added, unoptimized images will hurt LCP.

**Fix:** Add `vite-plugin-image-optimizer` or a build-time script to convert images to WebP/AVIF with responsive `srcset`.

---

#### PERF-12 · ProfilePage chunk is 43 KB — largest page chunk *(New)*

At 43 KB raw / 12 KB gzip, `ProfilePage` is the largest page-level chunk — more than double `LessonPage` (21 KB). This is a direct consequence of CQ-02 (2,122 lines in one file). Splitting into per-tab lazy components would significantly reduce initial chunk size.

---

### 🎨 UX

#### UX-05 · Auth callback shows plain text "Signing you in…" *(Unchanged)*

`AuthCallbackPage.jsx` shows a 🔐 emoji and plain text with no spinner or loading animation. On slow connections this looks like the page is broken.

**Fix:** Add a centered spinner or branded loading animation.

---

#### UX-06 · No skeleton loading states *(Unchanged)*

No skeleton components exist. Loading states use plain text ("Loading…", "Loading topics…", "Loading certificates…").

**Fix:** Add lightweight skeleton components (gray pulsing rectangles) for card grids, profile tabs, and topic headers.

---

#### UX-08 · No `<noscript>` fallback *(New)*

**Where:** [index.html](../../index.html)

If JavaScript fails to load or is disabled, the user sees a blank white page with no explanation.

**Fix:** Add `<noscript>` inside `<body>`: "1 Minute Academy requires JavaScript to run."

---

### 📈 Scalability

#### SCALE-04 · No client-side caching layer *(Unchanged)*

Every page load re-fetches data from Supabase. No in-memory cache, no stale-while-revalidate.

**Fix:** Add a lightweight cache (e.g., TanStack Query) with sensible `staleTime` values. Or add a simple `Map`-based cache with TTL in the service layer.

---

#### SCALE-05 · Content sync script has no transaction wrapping *(Partial)*

`syncTopicsToSupabase.mjs` now supports `--dry-run` and `--force` flags ✅, but still has **no transaction wrapping**. Inserts and upserts are separate calls — if the insert succeeds but the upsert fails, a partial sync results. There is also no batch chunking.

**Fix:** Wrap inserts + upserts in a transaction via an RPC. Add batch chunking for large catalogs.

---

#### SCALE-06 · Avatar storage bucket has no file-size or MIME restrictions *(New)*

**Where:** [supabase/016_avatars_storage.sql](../../supabase/016_avatars_storage.sql)

The RLS policies restrict writes to the owner's folder but don't enforce file size or MIME type at the database level. While the client validates MIME and enforces 2 MB, a malicious user could bypass this via direct Storage API calls.

**Fix:** Add a storage policy or trigger that rejects files over 5 MB or with non-image MIME types.

---

### 🔒 Security

#### SEC-06 · No rate limiting on client-side auth actions *(Unchanged)*

The login form has no client-side throttle. While Supabase has its own rate limits, a client-side cooldown prevents unnecessary load.

**Fix:** Add a short cooldown on the submit button after each attempt.

---

#### SEC-10 · IP rate-limit key is derived from `X-Forwarded-For` *(New)*

**Where:** All API routes using `getClientIp`

`getClientIp` reads `req.headers['x-forwarded-for']` and takes the first entry. If a client sends a forged header, that fake IP is used as the rate-limit key, potentially allowing bypass.

**Fix:** Verify that the deployment platform sanitizes `X-Forwarded-For`. Alternatively, use Vercel's `req.socket.remoteAddress` or `x-real-ip`.

---

### 🧹 Code Quality

#### CQ-05 · Seo component has no cleanup on unmount *(Unchanged)*

**Where:** [src/components/Seo.jsx](../../src/components/Seo.jsx)

`useEffect` mutates `<head>` tags but returns no cleanup function. During page transitions, meta tags from the previous page persist until the next page's effect fires. JSON-LD scripts are never removed. If a page sets `noindex` and the user navigates to a page without `<Seo>`, the directive persists.

**Fix:** Return a cleanup function that restores previous title, description, canonical, and removes JSON-LD scripts.

---

#### CQ-06 · No TypeScript *(Unchanged)*

Entire codebase is plain JS with no type annotations. Refactoring becomes risky at scale without type safety.

**Fix:** Consider incremental TypeScript adoption starting with services and utilities. `tsconfig.json` with `allowJs: true` lets you migrate gradually.

---

#### CQ-07 · No CI/CD pipeline definition in the repo *(Unchanged)*

No `.github/workflows/` or equivalent exists. No automated lint, test, or build verification on pull requests.

**Fix:** Add a GitHub Actions workflow: lint → test → build → content:validate on every PR.

---

#### CQ-11 · Dead `getContentSource` import in entitlements *(New)*

**Where:** [src/services/entitlements.js](../../src/services/entitlements.js)

Imports `getContentSource` from `./_contentSource` but never uses it.

**Fix:** Remove the unused import.

---

#### CQ-12 · ESLint only targets browser environment *(New)*

**Where:** [eslint.config.js](../../eslint.config.js)

ESLint is configured with browser globals only. Server-side code in `api/` and `scripts/` runs in Node.js but gets linted without Node.js globals.

**Fix:** Add a separate ESLint override for `api/**` and `scripts/**` with Node.js globals.

---

### 🧪 Testing

#### TEST-03 · Build scripts have no automated tests *(Unchanged)*

`syncTopicsToSupabase`, `validateContent`, `regenerateJourneys` are tested only by manual execution.

**Fix:** Add integration tests that run scripts against fixture data in a temp directory.

---

#### TEST-04 · No visual regression tests *(Unchanged)*

No Playwright or screenshot tests. `test-results/` and `playwright-report/` are stale artifacts with no active test configuration.

**Fix:** Add Playwright visual comparison tests for key pages (Home, Topics, Topic, Lesson, Profile).

---

---

## Summary matrix

| Category | P0 | P1 | P2 |
|---|---|---|---|
| **Security** | **SEC-08** 🆕, **SEC-09** 🆕 | — | SEC-06 ❌, **SEC-10** 🆕 |
| **Reliability** | **REL-04** 🆕 | — | — |
| **Performance** | — | **PERF-10** 🆕, **PERF-11** 🆕 | PERF-08 ❌, PERF-09 ❌, **PERF-12** 🆕 |
| **Accessibility** | — | **A11Y-09** ↑ | — |
| **UX** | — | **UX-07** ↑ | UX-05 ❌, UX-06 ❌, **UX-08** 🆕 |
| **Scalability** | — | — | SCALE-04 ❌, SCALE-05 ⚠️, **SCALE-06** 🆕 |
| **Code Quality** | — | CQ-01 ❌⊘, CQ-02 ❌⊘, CQ-03 ❌, CQ-04 ❌, **CQ-08** 🆕, **CQ-09** 🆕, **CQ-10** 🆕 | CQ-05 ❌, CQ-06 ❌, CQ-07 ❌, **CQ-11** 🆕, **CQ-12** 🆕 |
| **Testing** | — | TEST-01 ❌, TEST-02 ❌ | TEST-03 ❌, TEST-04 ❌ |

> ❌ = Not addressed | ❌⊘ = Worse than previous audit | ⚠️ = Partially addressed | 🆕 = New finding | ↑ = Escalated from P2

**Totals: 3 P0 · 12 P1 · 16 P2 = 31 open items** (16 new, 15 carried over)

---

## Recommended execution order

1. **SEC-08** — Fix or delete stale Netlify functions (open redirect + error leaks)
2. **SEC-09** — Validate `returnPath` in portal session to prevent open redirect
3. **REL-04** — Fix ErrorBoundary navigation reset
4. **UX-07** — Add a 404 page
5. **CQ-09** — Delete dead Learn page files (~2,200 lines of dead code)
6. **CQ-04** — Deduplicate API utility functions (5 functions × 3–4 files)
7. **CQ-02** — Split ProfilePage.jsx into per-tab components (2,122 → ~300 each)
8. **CQ-01** — Extract CompletionScreen and LessonTopbar from LessonPage.jsx
9. **A11Y-09** — Add `aria-hidden="true"` to confetti container
10. **TEST-01** — Set up Vitest + core unit tests
