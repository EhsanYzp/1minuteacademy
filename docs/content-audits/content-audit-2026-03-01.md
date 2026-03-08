# Full Project Audit — 2026-03-01

> **Scope:** Content quality, frontend, backend, infrastructure, legal pages, SEO, code quality, testing, DX.
> **Previous product audits:** 2026-02-11, 2026-02-17, 2026-02-18.
> **Previous content audits:** 2026-02-21, 2026-02-22.

---

## Table of Contents

1. [Content Overview](#1--content-overview)
2. [Beat Quality Audit](#2--beat-quality-audit-script-output)
3. [Frontend & UI](#3--frontend--ui)
4. [Backend & Data](#4--backend--data)
5. [Infrastructure & Deployment](#5--infrastructure--deployment)
6. [SEO & Public Assets](#6--seo--public-assets)
7. [Legal & Informational Pages](#7--legal--informational-pages)
8. [Code Quality & Lint](#8--code-quality--lint)
9. [Testing](#9--testing)
10. [Carried-Forward Items](#10--carried-forward-items-from-previous-audits)
11. [New Findings](#11--new-findings)
12. [Priority Matrix](#12--priority-matrix)
13. [Recommended Execution Order](#13--recommended-execution-order)

---

## 1 · Content Overview

| Metric | Value |
|--------|------:|
| Categories | 54 |
| Courses | 540 (10 per category) |
| Chapters | 3,240 (6 per course) |
| Topics | 16,200 (5 per chapter) |
| Free topics | 3,240 (20%) |
| Pro-only topics | 12,960 (80%) |
| Course plans validated | ✅ 540 |
| Beat completeness | ✅ 16,200 / 16,200 |
| Topic JSON schema | ✅ 16,200 / 16,200 |
| Journey parity | ✅ OK |

All 54 categories have exactly 10 courses each. Content structure is uniform and fully validated by `content:validate` and `journey:parity`.

---

## 2 · Beat Quality Audit (script output)

> Scanned **16,200** topic files — found **141** issues across **116** files (0.72% issue rate).

### Summary by severity

| Severity | Count |
|----------|------:|
| High | 47 |
| Medium | 27 |
| Low | 67 |

### Summary by issue type

| Check | Severity | Count | Notes |
|-------|----------|------:|-------|
| `lowercase-start` | Low | 57 | Often intentional (e.g., "eBay", "k-NN", "fMRI", "t-SNE") — review case-by-case |
| `dangling-conjunction` | **High** | 43 | Sentence/list cut off at "…and." or "…or." — **truncation artifacts** |
| `markup-artifacts` | Medium | 11 | Contains `[text]` brackets — some are template formulas, some are real artifacts |
| `template-placeholders` | Medium | 10 | Contains `[audience]`, `[outcome]`, etc. — partially overlaps with markup-artifacts |
| `repeated-punct` | Low | 7 | Ends with `??`, `!!`, or `..` |
| `near-duplicate` | Medium | 5 | Two beats share first 40 characters |
| `unbalanced-ascii-quotes` | **High** | 3 | Odd number of `"` — likely missing close-quote |
| `too-short` | Low | 2 | Beat text under 20 characters |
| `unbalanced-parens` | **High** | 1 | Mismatched `(` and `)` |
| `repeated-word` | Low | 1 | Same word repeated at end |
| `contains-url` | Medium | 1 | Beat contains `http(s)://` |

### Key observations

- **Dangling conjunctions (43 high)** are the most impactful issue. These are truncated beats ending mid-sentence (e.g., "…bureaucracy, risk aversion, and."). They directly affect lesson quality.
- **Markup/template artifacts (11 + 10)** overlap significantly. Many are intentional (e.g., pitch formulas: "I help [audience] achieve [outcome]"). These need manual triage — some are genuinely broken, some are valid content.
- **Lowercase-start (57)** — mostly proper names or technical terms (eBay, k-NN, fMRI, pH). These are largely false positives and should be suppressed or allowlisted.
- **Unbalanced quotes (3 high)** and **unbalanced parens (1 high)** are genuine content bugs that break readability.

> Full detailed findings (per-file breakdown) follow in the appended beat-audit report below.

---

## 3 · Frontend & UI

### Architecture

| Metric | Value |
|--------|-------|
| Framework | React 19 + React Router 7 |
| Build tool | Vite 7 |
| Pages | 20 JSX page components |
| Components | 28 reusable components |
| Services | 17 service modules |
| Routes | 22 routes (incl. redirects) |
| Animations | Framer Motion page transitions |

### Bundle sizes (gzip-ready)

| Chunk | Size |
|-------|-----:|
| `vendor` (Supabase, Stripe, etc.) | 332 KB |
| `react` | 188 KB |
| `index` (app shell) | 61 KB |
| `motion` | 31 KB |
| Largest page: `LessonPage` | 27 KB |
| Largest page: `ProfilePage` | 25 KB |
| CSS total | ~189 KB across chunks |
| **dist/ total (excl. OG images)** | **~24 MB** |
| dist/ total (incl. 16,200 OG SVGs) | ~89 MB |

### UI findings

| ID | Priority | Issue |
|----|----------|-------|
| UI-01 | P1 | **FAQ page not updated** — still references old terminology ("module" instead of "lesson"), missing entries for certificates, lesson styles, reviews, sign-in methods, account deletion. An update was attempted but blocked by Unicode smart-quote encoding in the JSX source. |
| UI-02 | P1 | **Terms of Service stale** — says "Payment integration may be introduced later; until then, Pro access may be managed via account metadata." Stripe has been live for weeks. Missing subscription billing terms, cancellation policy, and user-generated content clause. |
| UI-03 | P1 | **Privacy Policy partially updated** — The main data-collection section was updated (Stripe, avatars, reviews, analytics, third-party services) ✅, but the footer disclaimer still says "may be updated as we add payments" when payments are already live. |
| UI-04 | P2 | **Cookies page stale** — says "If we add analytics in the future…" but Vercel Analytics (`@vercel/analytics`) is already in production. Missing the `← Home` back link that other legal pages have. Date still Feb 4, 2026. |
| UI-05 | P2 | **TopicsBrowserPage search** — search results in the `/topics` browser don't have the token-highlighting or Start buttons that the `/categories` search now has. Inconsistent search UX across the two browse surfaces. |

---

## 4 · Backend & Data

### Supabase

| Metric | Value |
|--------|-------|
| Migrations | 29 SQL files (001–029) |
| Tables | topics, categories, courses, chapters, user_stats, user_topic_progress, topic_ratings, profiles, testimonials, stripe_customers, user_certificates, rate_limit, stripe_webhook_events, stripe_checkout_session_cache |
| RPCs | get_topic_category_counts, search_topics_page, get_review_summary, sync_topics, claim_stripe_webhook_event, etc. |
| Storage buckets | avatars (2 MB limit), certificates (public read) |
| RLS | Enabled on all user-facing tables |

### API (Vercel/Netlify Functions)

| Endpoint | Purpose |
|----------|---------|
| `api/stripe/create-checkout-session.js` | Stripe Checkout (monthly/yearly) |
| `api/stripe/create-portal-session.js` | Stripe Customer Portal |
| `api/stripe/subscription-status.js` | Subscription status check |
| `api/stripe/webhook.js` | Stripe webhooks (invoice paid, subscription updated/deleted) |
| `api/account/pause.js` | Pause account |
| `api/account/resume.js` | Resume account |
| `api/account/delete.js` | Delete account |

### Data findings

| ID | Priority | Issue |
|----|----------|-------|
| DATA-01 | P2 | **Duplicate migration prefix** — Two files share prefix `015`: `015_catalog_architecture.sql` and `015_profiles_testimonials.sql`. This doesn't cause runtime issues (they're applied manually/sequentially), but it breaks the sequential numbering convention and could confuse future migration tooling. |
| DATA-02 | P2 | **package.json version `0.0.0`** — The app version is still the Vite default. Should be bumped to a meaningful semver (e.g., `1.0.0`) before any public release tracking. |

---

## 5 · Infrastructure & Deployment

| Aspect | Status |
|--------|--------|
| Hosting | Vercel (primary) + Netlify (fallback) |
| Vercel config | `vercel.json` — SPA rewrites, security headers, CSP, cache policy |
| Netlify config | `netlify.toml` + `public/_redirects` — Stripe function proxies, SPA fallback |
| CDN caching | Static assets cached, HTML no-cache |
| CSP | Supabase + Stripe + Vercel Analytics allowed |
| HSTS | Enabled |
| X-Frame-Options | DENY |

No infrastructure issues identified beyond what prior audits covered.

---

## 6 · SEO & Public Assets

| Asset | Status |
|-------|--------|
| `robots.txt` | ✅ Allow all, sitemap reference |
| `sitemap.xml` | ✅ 97,239 lines — all topics + pages |
| `llms.txt` | ✅ 514 lines |
| `topics.json` | ✅ 210,607 lines (16,200 topics) |
| `topics.txt` | ✅ 16,205 lines |
| `site.webmanifest` | ✅ Present |
| OG images | ✅ 16,200 SVGs generated |
| Favicons + icons | ✅ Generated (favicon.ico, apple-touch-icon, icon-192, icon-512) |

| ID | Priority | Issue |
|----|----------|-------|
| SEO-01 | P2 | **SITE_URL not set in local builds** — Build warns `SITE_URL/VITE_SITE_URL is not set. Using http://localhost:5173`. Sitemap and llms.txt URLs default to localhost. Production deploys likely set this via env, but local dev builds produce invalid sitemap URLs. Consider a `.env.example` or documentation reminder. |

---

## 7 · Legal & Informational Pages

### Current state comparison

| Page | Last Updated | Stale Content | Priority |
|------|-------------|---------------|----------|
| **FAQ** (`/faq`) | (no date shown) | ❌ Missing: certificates, lesson styles, reviews, sign-in methods, account deletion. Uses "module" in some places instead of "lesson". Tier description incomplete (no mention of ratings, streaks, lesson styles for Pro). | **P1** |
| **Terms** (`/terms`) | Feb 4, 2026 | ❌ Says payment "may be introduced later" — Stripe is live. Missing: subscription billing terms, cancellation policy, UGC clause for reviews. | **P1** |
| **Privacy** (`/privacy`) | ~~Feb 4~~ → March 1, 2026 | ⚠️ Partially updated — data collection section now accurate (Stripe, avatars, reviews, analytics, third parties). Footer still says "may be updated as we add payments". | **P1** |
| **Cookies** (`/cookies`) | Feb 4, 2026 | ❌ Says "If we add analytics in the future" — Vercel Analytics is already live. Missing back-link. Dev-mode tier override mention should be removed from public-facing copy. | **P2** |

---

## 8 · Code Quality & Lint

### ESLint summary: 81 problems (58 errors, 23 warnings) across 34 files

| Rule | Count | Severity |
|------|------:|----------|
| `no-unused-vars` | 39 | Error |
| `react-hooks/exhaustive-deps` | 20 | Warning |
| setState-in-effect (custom) | 8 | Error |
| `no-unsafe-finally` | 4 | Error |
| `react-hooks/rules-of-hooks` | 3 | Error |
| Unused eslint-disable directive | 3 | Warning |
| `react-refresh/only-export-components` | 2 | Warning |
| Impure function during render | 2 | Error |

### Top offending files

Errors span 34 files across pages, components, services, and engine. The biggest categories:

- **39 unused-vars** — dead imports, destructured-but-unused variables, unused function definitions. Easy batch fix.
- **20 exhaustive-deps** — useEffect/useMemo/useCallback missing dependencies. Needs case-by-case review (some are intentional suppressions).
- **8 setState-in-effect** — calling setState synchronously inside useEffect without proper guards. Can cause cascading renders.
- **3 rules-of-hooks** — hooks called conditionally or in non-component functions. Must fix.

| ID | Priority | Issue |
|----|----------|-------|
| CQ-15 | P1 | **3 `rules-of-hooks` violations** — Hooks called conditionally or outside React component/hook scope. This can cause runtime crashes. |
| CQ-16 | P2 | **39 `no-unused-vars`** — Dead code accumulation. One-time cleanup pass. |
| CQ-17 | P2 | **8 setState-in-effect** — Risk of cascading renders. Review each case. |
| CQ-18 | P2 | **20 `exhaustive-deps` warnings** — Suppressed or missing effect dependencies. Review for correctness. |

---

## 9 · Testing

| Type | Status |
|------|--------|
| Unit tests | ❌ None (no Vitest / Jest configured) |
| E2E tests | ❌ None (Playwright installed but `tests/` is empty, `test-results/` exists) |
| Visual regression | ❌ None |
| Build script tests | ❌ None |
| Content validation | ✅ Automated (`content:validate`, `journey:parity`, `_auditBeats.mjs`) |
| Lint | ⚠️ ESLint configured but 81 problems not enforced in CI |

| ID | Priority | Issue |
|----|----------|-------|
| TEST-01 | P1 | **No unit tests** — Core engine (journey compiler, lesson renderer, entitlements) has zero test coverage. Carried forward from prior audits. |
| TEST-02 | P1 | **No E2E tests** — Playwright is installed (`playwright-report/`, `test-results/` dirs exist) but no test files. Critical flows (auth, checkout, lesson playback) are untested. Carried forward. |
| TEST-03 | P2 | **Build scripts untested** — 17 scripts in `scripts/` with no automated tests. Carried forward. |
| TEST-04 | P2 | **No visual regression** — UI regressions can only be caught manually. Carried forward. |

---

## 10 · Carried-Forward Items from Previous Audits

| ID | Priority | Category | Status |
|----|----------|----------|--------|
| CQ-06 | P2 | Code Quality | ❌ No TypeScript — project remains pure JS/JSX |
| CQ-07 | P2 | Code Quality | ❌ No CI/CD pipeline — no GitHub Actions or similar |
| TEST-01 | P1 | Testing | ❌ No unit tests |
| TEST-02 | P1 | Testing | ❌ No E2E tests |
| TEST-03 | P2 | Testing | ❌ Build scripts untested |
| TEST-04 | P2 | Testing | ❌ No visual regression |

All 6 items remain unresolved from the 2026-02-18 audit.

---

## 11 · New Findings

### P1 — High impact

| ID | Category | Description |
|----|----------|-------------|
| UI-01 | Legal/UX | FAQ page outdated — missing features, stale terminology |
| UI-02 | Legal/UX | Terms of Service says payment "may be introduced later" — Stripe is live |
| UI-03 | Legal/UX | Privacy Policy footer disclaimer still references future payments |
| CQ-15 | Code Quality | 3 `rules-of-hooks` violations — potential runtime crashes |
| CONTENT-01 | Content | 43 dangling-conjunction beats (truncated sentences ending "…and.") |
| CONTENT-02 | Content | 3 unbalanced-ascii-quotes + 1 unbalanced-parens (readability bugs) |

### P2 — Strategic

| ID | Category | Description |
|----|----------|-------------|
| UI-04 | Legal/UX | Cookies page stale — analytics already live, missing back-link |
| UI-05 | UX | TopicsBrowserPage search lacks token highlighting and Start buttons |
| CQ-16 | Code Quality | 39 `no-unused-vars` across codebase |
| CQ-17 | Code Quality | 8 `setState-in-effect` warnings |
| CQ-18 | Code Quality | 20 `exhaustive-deps` warnings |
| DATA-01 | Data | Duplicate migration prefix `015` |
| DATA-02 | Data | package.json version still `0.0.0` |
| SEO-01 | SEO | SITE_URL not set warning in local builds |
| CONTENT-03 | Content | 11 markup-artifacts / 10 template-placeholders (manual triage needed) |
| CONTENT-04 | Content | 57 lowercase-start (mostly false positives — proper names/acronyms) |

---

## 12 · Priority Matrix

| Category | P0 | P1 | P2 |
|----------|----|----|-----|
| **Content** | — | CONTENT-01, CONTENT-02 | CONTENT-03, CONTENT-04 |
| **Legal / UX** | — | UI-01, UI-02, UI-03 | UI-04, UI-05 |
| **Code Quality** | — | CQ-15 | CQ-06, CQ-07, CQ-16, CQ-17, CQ-18 |
| **Testing** | — | TEST-01, TEST-02 | TEST-03, TEST-04 |
| **Data** | — | — | DATA-01, DATA-02 |
| **SEO** | — | — | SEO-01 |

**Totals: 0 P0 · 8 P1 · 13 P2 = 21 open items**

---

## 13 · Recommended Execution Order

### Immediate (P1 — this session)

1. **UI-01 + UI-02 + UI-03 + UI-04** — Fix all 4 legal/informational pages (FAQ, Terms, Privacy, Cookies). Blocked by smart-quote encoding in FaqPage.jsx — use terminal `sed` or full file rewrite.
2. **CONTENT-01** — Fix 43 dangling-conjunction beats (run `_fixBrokenBeats.mjs` or manual patch).
3. **CONTENT-02** — Fix 4 unbalanced quotes/parens in specific topic files.
4. **CQ-15** — Fix 3 `rules-of-hooks` violations (potential runtime crashes).

### Next sprint (P1 carried-forward)

5. **TEST-01** — Set up Vitest + core unit tests for engine, entitlements, services.
6. **TEST-02** — Write E2E tests with Playwright for auth, checkout, lesson playback.

### Backlog (P2)

7. **CQ-16** — Batch cleanup of 39 unused-vars.
8. **CQ-17 + CQ-18** — Review setState-in-effect and exhaustive-deps cases.
9. **CONTENT-03** — Manual triage of markup-artifacts and template-placeholders.
10. **UI-05** — Unify search UX across TopicsBrowserPage and CategoriesPage.
11. **DATA-01** — Rename duplicate 015 migration prefix.
12. **DATA-02** — Bump package.json version.
13. **SEO-01** — Add `.env.example` with SITE_URL documentation.
14. **CQ-06** — Consider TypeScript migration.
15. **CQ-07** — Set up CI/CD pipeline.

---

## Appendix: Full Beat Audit Report (script output)

The following detailed per-file findings were generated by `node scripts/_auditBeats.mjs`:

---

# Beat Audit Report

> Generated 2026-02-28T23:50:30.574Z
> Scanned **16200** topic files — found **141** issues across **116** files.
> Output: `docs/content-audits/content-audit-2026-03-01.md`

## Summary by severity

| Severity | Count |
|----------|------:|
| high | 47 |
| medium | 27 |
| low | 67 |

## Summary by issue type

| Check | Severity | Count |
|-------|----------|------:|
| lowercase-start | low | 57 |
| dangling-conjunction | high | 43 |
| markup-artifacts | medium | 11 |
| template-placeholders | medium | 10 |
| repeated-punct | low | 7 |
| near-duplicate | medium | 5 |
| unbalanced-ascii-quotes | high | 3 |
| too-short | low | 2 |
| unbalanced-parens | high | 1 |
| repeated-word | low | 1 |
| contains-url | medium | 1 |

## Detailed findings

### The Copyright Controversy

**File:** `content/topics/ai/ai--ai-and-creativity/ai--ai-and-creativity--ch02-visual-art/ai--ai-and-creativity--t-the-copyright-controversy.topic.json`

- **medium / markup-artifacts** — Beat "discovery" may contain JSON/HTML artifacts: "Artists can type 'in the style of [artist name]' and get eer"
- **medium / template-placeholders** — Beat "discovery" may contain template placeholders: "Artists can type 'in the style of [artist name]' and get eerily accurate imitati"

### k-Nearest Neighbors: You Are Who You're Near

**File:** `content/topics/ai/ai--science-of-ml/ai--science-of-ml--ch02-supervised/ai--science-of-ml--t-k-nearest-neighbors-you-are-who-you-re-near.topic.json`

- **low / lowercase-start** — Beat "buildup" starts with lowercase: "k-NN stores all training data and classi…"

### Dimensionality Reduction: Simplifying Complexity

**File:** `content/topics/ai/ai--science-of-ml/ai--science-of-ml--ch03-unsupervised/ai--science-of-ml--t-dimensionality-reduction-simplifying-complexity.topic.json`

- **low / lowercase-start** — Beat "climax" starts with lowercase: "t-SNE and UMAP create stunning visualiza…"

### Toulouse-Lautrec and the Art of the Poster

**File:** `content/topics/art/art--art-history-highlights/art--art-history-highlights--ch04-impressionism-and-post/art--art-history-highlights--t-toulouse-lautrec-and-the-art-of-the-poster.topic.json`

- **high / unbalanced-ascii-quotes** — Beat "hook" has an odd number of ASCII quotes (").

### Brand Positioning: Owning a Space in the Mind

**File:** `content/topics/art/art--branding-and-visual-identity/art--branding-and-visual-identity--ch01-brand-foundations/art--branding-and-visual-identity--t-brand-positioning-owning-a-space-in-the-mind.topic.json`

- **medium / markup-artifacts** — Beat "climax" may contain JSON/HTML artifacts: "The positioning statement formula: For [audience]."
- **medium / template-placeholders** — Beat "climax" may contain template placeholders: "The positioning statement formula: For [audience]."

### Web Fonts: Typography Goes Online

**File:** `content/topics/art/art--typography-essentials/art--typography-essentials--ch05-digital-type/art--typography-essentials--t-web-fonts-typography-goes-online.topic.json`

- **low / lowercase-start** — Beat "climax" starts with lowercase: "font-display: swap tells the browser to …"

### Why Incumbents Fail to Innovate

**File:** `content/topics/business/business--innovation-and-disruption/business--innovation-and-disruption--ch02-disruption-theory/business--innovation-and-disruption--t-why-incumbents-fail-to-innovate.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "…rriers: bureaucracy, risk aversion, and."

### Marketplace Business Models

**File:** `content/topics/business/business--innovation-and-disruption/business--innovation-and-disruption--ch04-business-models/business--innovation-and-disruption--t-marketplace-business-models.topic.json`

- **low / lowercase-start** — Beat "hook" starts with lowercase: "eBay connects 135 million buyers and sel…"

### Brand Loyalty: Beyond Rational Choice

**File:** `content/topics/business/business--marketing-psychology/business--marketing-psychology--ch04-brand/business--marketing-psychology--t-brand-loyalty-beyond-rational-choice.topic.json`

- **low / lowercase-start** — Beat "discovery" starts with lowercase: "fMRI scans show that knowing you're drin…"

### The Elevator Pitch Formula

**File:** `content/topics/career/career--personal-branding/career--personal-branding--ch03-storytelling-and-positioning/career--personal-branding--t-the-elevator-pitch-formula.topic.json`

- **medium / markup-artifacts** — Beat "discovery" may contain JSON/HTML artifacts: "The formula: 'I help [audience] achieve [outcome] by [method"
- **medium / template-placeholders** — Beat "discovery" may contain template placeholders: "The formula: 'I help [audience] achieve [outcome] by [method].' Problem-focused,"

### Crucial Conversations: When Stakes Are High

**File:** `content/topics/communication/communication--conflict-resolution/communication--conflict-resolution--ch05-high-stakes/communication--conflict-resolution--t-crucial-conversations-when-stakes-are-high.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "…icts career success, relationships, and."

### Hofstede's Cultural Dimensions

**File:** `content/topics/communication/communication--cross-cultural-communication/communication--cross-cultural-communication--ch02-cultural-dimensions/communication--cross-cultural-communication--t-hofstede-s-cultural-dimensions.topic.json`

- **high / dangling-conjunction** — Beat "twist" ends with a list/sentence cut off at conjunction: "…d ignores subcultures, generations, and."

### IQ vs. EQ: The Great Debate

**File:** `content/topics/communication/communication--emotional-intelligence/communication--emotional-intelligence--ch01-what-is-eq/communication--emotional-intelligence--t-iq-vs-eq-the-great-debate.topic.json`

- **high / dangling-conjunction** — Beat "discovery" ends with a list/sentence cut off at conjunction: "…les requiring leadership, teamwork, and."

### The Four-Branch Model of EQ

**File:** `content/topics/communication/communication--emotional-intelligence/communication--emotional-intelligence--ch01-what-is-eq/communication--emotional-intelligence--t-the-four-branch-model-of-eq.topic.json`

- **high / dangling-conjunction** — Beat "hook" ends with a list/sentence cut off at conjunction: "…: perceiving, using, understanding, and."

### Emotional Suppression: The Hidden Cost

**File:** `content/topics/communication/communication--emotional-intelligence/communication--emotional-intelligence--ch03-self-regulation/communication--emotional-intelligence--t-emotional-suppression-the-hidden-cost.topic.json`

- **high / dangling-conjunction** — Beat "discovery" ends with a list/sentence cut off at conjunction: "…ological stress, memory impairment, and."

### The Marshmallow Test Revisited

**File:** `content/topics/communication/communication--emotional-intelligence/communication--emotional-intelligence--ch03-self-regulation/communication--emotional-intelligence--t-the-marshmallow-test-revisited.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "…tion had better SAT scores, health, and."

### The Medium Is the Message

**File:** `content/topics/communication/communication--media-literacy/communication--media-literacy--ch01-how-media-shapes-thought/communication--media-literacy--t-the-medium-is-the-message.topic.json`

- **high / dangling-conjunction** — Beat "climax" ends with a list/sentence cut off at conjunction: "…ctively reshape how we think, feel, and."

### Listening Fatigue: Why We Tune Out

**File:** `content/topics/communication/communication--psychology-of-listening/communication--psychology-of-listening--ch01-science-of-listening/communication--psychology-of-listening--t-listening-fatigue-why-we-tune-out.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "…rking memory, emotional processing, and."

### The Four Levels of Listening

**File:** `content/topics/communication/communication--psychology-of-listening/communication--psychology-of-listening--ch01-science-of-listening/communication--psychology-of-listening--t-the-four-levels-of-listening.topic.json`

- **high / dangling-conjunction** — Beat "climax" ends with a list/sentence cut off at conjunction: "… suspend judgment, open your heart, and."

### Listening Up: How Leaders Hear Dissent

**File:** `content/topics/communication/communication--psychology-of-listening/communication--psychology-of-listening--ch05-listening-in-leadership/communication--psychology-of-listening--t-listening-up-how-leaders-hear-dissent.topic.json`

- **high / dangling-conjunction** — Beat "climax" ends with a list/sentence cut off at conjunction: "…cal feedback is expected, welcomed, and."

### The Listening Organization: Systems That Hear

**File:** `content/topics/communication/communication--psychology-of-listening/communication--psychology-of-listening--ch05-listening-in-leadership/communication--psychology-of-listening--t-the-listening-organization-systems-that-hear.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "…level meetings, anonymous feedback, and."

### Music and the Listening Brain

**File:** `content/topics/communication/communication--psychology-of-listening/communication--psychology-of-listening--ch06-deep-listening/communication--psychology-of-listening--t-music-and-the-listening-brain.topic.json`

- **high / dangling-conjunction** — Beat "discovery" ends with a list/sentence cut off at conjunction: "…ronger corpus callosum connections, and."

### The Listening Revolution: A Noisy World Needs Quiet Minds

**File:** `content/topics/communication/communication--psychology-of-listening/communication--psychology-of-listening--ch06-deep-listening/communication--psychology-of-listening--t-the-listening-revolution-a-noisy-world-needs-quiet-minds.topic.json`

- **high / dangling-conjunction** — Beat "discovery" ends with a list/sentence cut off at conjunction: "…ation skill in education, business, and."

### Advertising Rhetoric: The Hidden Persuaders

**File:** `content/topics/communication/communication--rhetoric-and-logic/communication--rhetoric-and-logic--ch05-rhetoric-in-modern-life/communication--rhetoric-and-logic--t-advertising-rhetoric-the-hidden-persuaders.topic.json`

- **high / dangling-conjunction** — Beat "discovery" ends with a list/sentence cut off at conjunction: "…sires: belonging, status, security, and."

### Political Rhetoric: How Leaders Persuade

**File:** `content/topics/communication/communication--rhetoric-and-logic/communication--rhetoric-and-logic--ch05-rhetoric-in-modern-life/communication--rhetoric-and-logic--t-political-rhetoric-how-leaders-persuade.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "… soundbites, slogans, dog whistles, and."

### Rhetoric of Science: How Researchers Persuade

**File:** `content/topics/communication/communication--rhetoric-and-logic/communication--rhetoric-and-logic--ch05-rhetoric-in-modern-life/communication--rhetoric-and-logic--t-rhetoric-of-science-how-researchers-persuade.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "…exigence), present methods (ethos), and."
- **high / dangling-conjunction** — Beat "twist" ends with a list/sentence cut off at conjunction: "…nstrained by evidence, peer review, and."

### Ferran Adrià and the Birth of Molecular Gastronomy

**File:** `content/topics/cooking/cooking--great-chefs-and-culinary-revolutions/cooking--great-chefs-and-culinary-revolutions--ch03-molecular-gastronomy/cooking--great-chefs-and-culinary-revolutions--t-ferran-adri-and-the-birth-of-molecular-gastronomy.topic.json`

- **low / lowercase-start** — Beat "twist" starts with lowercase: "elBulli received 2 million reservation r…"

### Moroccan Mint Tea: The National Ritual

**File:** `content/topics/cooking/cooking--tea-and-coffee-culture/cooking--tea-and-coffee-culture--ch03-tea-traditions/cooking--tea-and-coffee-culture--t-moroccan-mint-tea-the-national-ritual.topic.json`

- **high / dangling-conjunction** — Beat "punchline" ends with a list/sentence cut off at conjunction: "… Chinese tea, British trade routes, and."

### Tina Fey and the Second City: Improv as Comedy Training Ground

**File:** `content/topics/creativity/creativity--comedy-and-the-art-of-humor/creativity--comedy-and-the-art-of-humor--ch04-masters-of-comedy/creativity--comedy-and-the-art-of-humor--t-tina-fey-and-the-second-city-improv-as-comedy-training-ground.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "…rell, Amy Poehler, Stephen Colbert, and."

### Science Fiction: Exploring 'What If?' to Its Limit

**File:** `content/topics/creativity/creativity--creative-writing-secrets/creativity--creative-writing-secrets--ch05-genres-and-their-secrets/creativity--creative-writing-secrets--t-science-fiction-exploring-what-if-to-its-limit.topic.json`

- **medium / near-duplicate** — Beats "hook" and "punchline" start with the same 40 chars — possible copy-paste.

### Melody vs. Harmony: Two Creative Dimensions

**File:** `content/topics/creativity/creativity--creativity-in-music/creativity--creativity-in-music--ch01-how-music-is-born/creativity--creativity-in-music--t-melody-vs-harmony-two-creative-dimensions.topic.json`

- **high / dangling-conjunction** — Beat "climax" ends with a list/sentence cut off at conjunction: "…s themselves but in melody, rhythm, and."

### John Cage's 4'33": The Most Creative Silence in History

**File:** `content/topics/creativity/creativity--creativity-in-music/creativity--creativity-in-music--ch02-revolutionary-compositions/creativity--creativity-in-music--t-john-cage-s-4-33-the-most-creative-silence-in-history.topic.json`

- **high / unbalanced-ascii-quotes** — Beat "buildup" has an odd number of ASCII quotes (").
- **high / unbalanced-ascii-quotes** — Beat "climax" has an odd number of ASCII quotes (").

### Big Cities Are More Creative: The Geography Myth

**File:** `content/topics/creativity/creativity--creativity-myths-debunked/creativity--creativity-myths-debunked--ch05-environment-myths/creativity--creativity-myths-debunked--t-big-cities-are-more-creative-the-geography-myth.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "…n cities with diversity, tolerance, and."

### Inclusive Design: Building for Everyone by Designing for the Edges

**File:** `content/topics/creativity/creativity--design-thinking-and-innovation/creativity--design-thinking-and-innovation--ch02-empathy-and-human-centered-design/creativity--design-thinking-and-innovation--t-inclusive-design-building-for-everyone-by-designing-for-the-edges.topic.json`

- **high / dangling-conjunction** — Beat "hook" ends with a list/sentence cut off at conjunction: "…lions in noisy gyms, quiet offices, and."

### Journey Mapping: The Entire User Experience in One Visual

**File:** `content/topics/creativity/creativity--design-thinking-and-innovation/creativity--design-thinking-and-innovation--ch02-empathy-and-human-centered-design/creativity--design-thinking-and-innovation--t-journey-mapping-the-entire-user-experience-in-one-visual.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "…emotions, touchpoints, pain points, and."

### Design for Space: Innovating Beyond Earth

**File:** `content/topics/creativity/creativity--design-thinking-and-innovation/creativity--design-thinking-and-innovation--ch06-the-future-of-design/creativity--design-thinking-and-innovation--t-design-for-space-innovating-beyond-earth.topic.json`

- **high / dangling-conjunction** — Beat "discovery" ends with a list/sentence cut off at conjunction: "…sts $10,000 to launch), zero waste, and."
- **high / dangling-conjunction** — Beat "climax" ends with a list/sentence cut off at conjunction: "… systems, scratch-resistant lenses, and."

### Advertising: The Most Profitable Creative Art Form

**File:** `content/topics/creativity/creativity--the-business-of-creativity/creativity--the-business-of-creativity--ch05-creative-industries/creativity--the-business-of-creativity--t-advertising-the-most-profitable-creative-art-form.topic.json`

- **high / dangling-conjunction** — Beat "twist" ends with a list/sentence cut off at conjunction: "… in 6-second pre-rolls, banner ads, and."

### Creative Entrepreneurship: Why Artists Need Business Skills

**File:** `content/topics/creativity/creativity--the-business-of-creativity/creativity--the-business-of-creativity--ch06-the-future-of-creative-business/creativity--the-business-of-creativity--t-creative-entrepreneurship-why-artists-need-business-skills.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "…), cultivated dealer relationships, and."

### Meditation and Imagination: Clearing the Creative Stage

**File:** `content/topics/creativity/creativity--the-psychology-of-imagination/creativity--the-psychology-of-imagination--ch06-expanding-imaginative-capacity/creativity--the-psychology-of-imagination--t-meditation-and-imagination-clearing-the-creative-stage.topic.json`

- **high / dangling-conjunction** — Beat "climax" ends with a list/sentence cut off at conjunction: "…ciated with imagination, attention, and."

### Default Mode Network: Your Brain's Idea Factory

**File:** `content/topics/creativity/creativity--the-science-of-creativity/creativity--the-science-of-creativity--ch01-how-the-brain-creates/creativity--the-science-of-creativity--t-default-mode-network-your-brain-s-idea-factory.topic.json`

- **low / lowercase-start** — Beat "climax" starts with lowercase: "fMRI scans show the DMN is most active d…"

### Steelmanning: Making the Strongest Version of the Other Side

**File:** `content/topics/critical-thinking/critical-thinking--argumentation-and-debate/critical-thinking--argumentation-and-debate--ch02-building-strong-arguments/critical-thinking--argumentation-and-debate--t-steelmanning-making-the-strongest-version-of-the-other-side.topic.json`

- **high / unbalanced-parens** — Beat "discovery" has 0 "(" vs 2 ")" — possible truncation.

### The Art of Good Enough: When to Stop Deciding

**File:** `content/topics/critical-thinking/critical-thinking--decision-making-under-uncertainty/critical-thinking--decision-making-under-uncertainty--ch06-better-decisions-in-practice/critical-thinking--decision-making-under-uncertainty--t-the-art-of-good-enough-when-to-stop-deciding.topic.json`

- **low / too-short** — Beat "buildup" is only 15 chars: "Satisficing vs."

### Evidence-Based Thinking in Everyday Life

**File:** `content/topics/critical-thinking/critical-thinking--evidence-and-truth/critical-thinking--evidence-and-truth--ch06-evidence-in-practice/critical-thinking--evidence-and-truth--t-evidence-based-thinking-in-everyday-life.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "…ce rather than intuition, tradition, or."

### Intellectual Courage: Following Evidence Where It Leads

**File:** `content/topics/critical-thinking/critical-thinking--evidence-and-truth/critical-thinking--evidence-and-truth--ch06-evidence-in-practice/critical-thinking--evidence-and-truth--t-intellectual-courage-following-evidence-where-it-leads.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "…clusion is unpopular, uncomfortable, or."

### Data Manipulation: How Numbers Lie Honestly

**File:** `content/topics/critical-thinking/critical-thinking--media-literacy-and-information-warfare/critical-thinking--media-literacy-and-information-warfare--ch04-digital-manipulation/critical-thinking--media-literacy-and-information-warfare--t-data-manipulation-how-numbers-lie-honestly.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "…is tricks, cherry-picked timeframes, or."

### Medical Ethics: Triage and Impossible Choices

**File:** `content/topics/critical-thinking/critical-thinking--moral-reasoning-and-ethical-dilemmas/critical-thinking--moral-reasoning-and-ethical-dilemmas--ch06-ethics-in-practice/critical-thinking--moral-reasoning-and-ethical-dilemmas--t-medical-ethics-triage-and-impossible-choices.topic.json`

- **high / dangling-conjunction** — Beat "discovery" ends with a list/sentence cut off at conjunction: "…t-come first-served, random lottery, or."

### Belief Perseverance: Clinging to Debunked Ideas

**File:** `content/topics/critical-thinking/critical-thinking--the-psychology-of-belief/critical-thinking--the-psychology-of-belief--ch04-belief-persistence/critical-thinking--the-psychology-of-belief--t-belief-perseverance-clinging-to-debunked-ideas.topic.json`

- **low / too-short** — Beat "discovery" is only 11 chars: "Ross et al."

### The Semmelweis Reflex: Rejecting New Evidence

**File:** `content/topics/critical-thinking/critical-thinking--the-psychology-of-belief/critical-thinking--the-psychology-of-belief--ch04-belief-persistence/critical-thinking--the-psychology-of-belief--t-the-semmelweis-reflex-rejecting-new-evidence.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "…tradicts established norms, beliefs, or."

### Post-Quantum Cryptography: Preparing for the Unbreakable

**File:** `content/topics/cybersecurity/cybersecurity--cryptography-secrets-and-ciphers/cybersecurity--cryptography-secrets-and-ciphers--ch06-the-future-of-cryptography/cybersecurity--cryptography-secrets-and-ciphers--t-post-quantum-cryptography-preparing-for-the-unbreakable.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "… also can't solve: lattices, codes, and."

### The Whistleblower's Dilemma: Snowden, Manning, and Reality Winner

**File:** `content/topics/cybersecurity/cybersecurity--cybersecurity-law-and-ethics/cybersecurity--cybersecurity-law-and-ethics--ch03-ethical-hacking-and-disclosure/cybersecurity--cybersecurity-law-and-ethics--t-the-whistleblower-s-dilemma-snowden-manning-and-reality-winner.topic.json`

- **low / repeated-punct** — Beat "twist" ends with repeated punctuation: "…n prison.."

### Free Speech vs. Cybersecurity: Where's the Line?

**File:** `content/topics/cybersecurity/cybersecurity--cybersecurity-law-and-ethics/cybersecurity--cybersecurity-law-and-ethics--ch04-digital-rights-and-freedoms/cybersecurity--cybersecurity-law-and-ethics--t-free-speech-vs-cybersecurity-where-s-the-line.topic.json`

- **low / repeated-punct** — Beat "buildup" ends with repeated punctuation: "… details.."

### Cyber Insurance: Transferring Digital Risk

**File:** `content/topics/cybersecurity/cybersecurity--cybersecurity-law-and-ethics/cybersecurity--cybersecurity-law-and-ethics--ch05-cyber-law-in-action/cybersecurity--cybersecurity-law-and-ethics--t-cyber-insurance-transferring-digital-risk.topic.json`

- **low / repeated-punct** — Beat "hook" ends with repeated punctuation: "…lawsuits.."
- **low / repeated-punct** — Beat "twist" ends with repeated punctuation: "…clusion).."

### Quantum Computing and Crypto Law: Preparing for Q-Day

**File:** `content/topics/cybersecurity/cybersecurity--cybersecurity-law-and-ethics/cybersecurity--cybersecurity-law-and-ethics--ch06-the-future-of-cyber-governance/cybersecurity--cybersecurity-law-and-ethics--t-quantum-computing-and-crypto-law-preparing-for-q-day.topic.json`

- **low / repeated-punct** — Beat "hook" ends with repeated punctuation: "…readable.."

### Behavioral Biometrics: How You Type Reveals Who You Are

**File:** `content/topics/cybersecurity/cybersecurity--identity-and-authentication/cybersecurity--identity-and-authentication--ch03-biometric-security/cybersecurity--identity-and-authentication--t-behavioral-biometrics-how-you-type-reveals-who-you-are.topic.json`

- **low / repeated-punct** — Beat "twist" ends with repeated punctuation: "…e rhythm.."

### Decentralized Identity: Owning Your Digital Self

**File:** `content/topics/cybersecurity/cybersecurity--identity-and-authentication/cybersecurity--identity-and-authentication--ch06-the-future-of-identity/cybersecurity--identity-and-authentication--t-decentralized-identity-owning-your-digital-self.topic.json`

- **high / dangling-conjunction** — Beat "climax" ends with a list/sentence cut off at conjunction: "…ou decide what to share, with whom, and."

### Evil Twin Attacks: The Fake Wi-Fi Trap

**File:** `content/topics/cybersecurity/cybersecurity--network-security-fundamentals/cybersecurity--network-security-fundamentals--ch03-wireless-security/cybersecurity--network-security-fundamentals--t-evil-twin-attacks-the-fake-wi-fi-trap.topic.json`

- **high / dangling-conjunction** — Beat "discovery" ends with a list/sentence cut off at conjunction: "…intercept passwords, inject malware, or."

### SIEM: The Security Nerve Center

**File:** `content/topics/cybersecurity/cybersecurity--network-security-fundamentals/cybersecurity--network-security-fundamentals--ch05-monitoring-and-detection/cybersecurity--network-security-fundamentals--t-siem-the-security-nerve-center.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "…om every device, correlates events, and."

### IoT Security: Billions of Devices, Minimal Protection

**File:** `content/topics/cybersecurity/cybersecurity--network-security-fundamentals/cybersecurity--network-security-fundamentals--ch06-modern-network-architecture/cybersecurity--network-security-fundamentals--t-iot-security-billions-of-devices-minimal-protection.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "… cameras, sensors, medical devices, and."

### Cookies and Trackers: The Invisible Followers

**File:** `content/topics/cybersecurity/cybersecurity--privacy-in-the-digital-age/cybersecurity--privacy-in-the-digital-age--ch02-how-you-are-tracked/cybersecurity--privacy-in-the-digital-age--t-cookies-and-trackers-the-invisible-followers.topic.json`

- **high / dangling-conjunction** — Beat "twist" ends with a list/sentence cut off at conjunction: "…ou by your browser settings, fonts, and."

### China's Social Credit System: Scoring Citizens

**File:** `content/topics/cybersecurity/cybersecurity--privacy-in-the-digital-age/cybersecurity--privacy-in-the-digital-age--ch04-government-surveillance/cybersecurity--privacy-in-the-digital-age--t-china-s-social-credit-system-scoring-citizens.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "…government records, financial data, and."

### Dark Web Forums: The Underground Community

**File:** `content/topics/cybersecurity/cybersecurity--the-dark-web-and-cybercrime/cybersecurity--the-dark-web-and-cybercrime--ch01-layers-of-the-internet/cybersecurity--the-dark-web-and-cybercrime--t-dark-web-forums-the-underground-community.topic.json`

- **high / dangling-conjunction** — Beat "hook" ends with a list/sentence cut off at conjunction: "…– complete with tutorials, reviews, and."

### Exploit Brokers: Zero-Days for Sale

**File:** `content/topics/cybersecurity/cybersecurity--the-dark-web-and-cybercrime/cybersecurity--the-dark-web-and-cybercrime--ch02-dark-web-marketplaces/cybersecurity--the-dark-web-and-cybercrime--t-exploit-brokers-zero-days-for-sale.topic.json`

- **high / dangling-conjunction** — Beat "buildup" ends with a list/sentence cut off at conjunction: "…governments, intelligence agencies, and."

### Ransomware-as-a-Service: Crime Made Easy

**File:** `content/topics/cybersecurity/cybersecurity--the-dark-web-and-cybercrime/cybersecurity--the-dark-web-and-cybercrime--ch03-the-ransomware-economy/cybersecurity--the-dark-web-and-cybercrime--t-ransomware-as-a-service-crime-made-easy.topic.json`

- **low / repeated-punct** — Beat "buildup" ends with repeated punctuation: "…services.."

### p-Hacking: Torturing Data Until It Confesses

**File:** `content/topics/data/data--misleading-data-and-statistical-traps/data--misleading-data-and-statistical-traps--ch04-research-gone-wrong/data--misleading-data-and-statistical-traps--t-p-hacking-torturing-data-until-it-confesses.topic.json`

- **low / lowercase-start** — Beat "buildup" starts with lowercase: "p-hacking means trying many analyses unt…"
- **low / lowercase-start** — Beat "climax" starts with lowercase: "p-hacking is a major cause of the replic…"

### Citizen Science: Everyone's a Data Collector

**File:** `content/topics/data/data--open-data-and-transparency/data--open-data-and-transparency--ch04-scientific-openness/data--open-data-and-transparency--t-citizen-science-everyone-s-a-data-collector.topic.json`

- **low / lowercase-start** — Beat "discovery" starts with lowercase: "iNaturalist has collected over 150 milli…"

### The Replication Crisis: When Studies Don't Reproduce

**File:** `content/topics/data/data--statistics-that-changed-the-world/data--statistics-that-changed-the-world--ch06-modern-statistical-thinking/data--statistics-that-changed-the-world--t-the-replication-crisis-when-studies-don-t-reproduce.topic.json`

- **low / lowercase-start** — Beat "discovery" starts with lowercase: "p-hacking, small samples, and publicatio…"

### Thomas Piketty: Capital in the Twenty-First Century

**File:** `content/topics/economics/economics--great-economists-and-their-ideas/economics--great-economists-and-their-ideas--ch05-modern-innovators/economics--great-economists-and-their-ideas--t-thomas-piketty-capital-in-the-twenty-first-century.topic.json`

- **low / lowercase-start** — Beat "punchline" starts with lowercase: "r > g: two letters that explain why the …"

### Piketty's r > g: Capital Eats the Economy

**File:** `content/topics/economics/economics--the-economics-of-inequality/economics--the-economics-of-inequality--ch03-wealth-and-power/economics--the-economics-of-inequality--t-piketty-s-r-g-capital-eats-the-economy.topic.json`

- **low / lowercase-start** — Beat "climax" starts with lowercase: "r > g means capitalism, left alone, prod…"

### Curiosity: The Brain's Reward for Wondering

**File:** `content/topics/education/education--motivation-and-mindset/education--motivation-and-mindset--ch01-intrinsic-motivation/education--motivation-and-mindset--t-curiosity-the-brain-s-reward-for-wondering.topic.json`

- **low / lowercase-start** — Beat "discovery" starts with lowercase: "fMRI studies show the hippocampus lights…"

### eBay and the Trust Economy

**File:** `content/topics/entrepreneurship/entrepreneurship--business-models/entrepreneurship--business-models--ch05-network-effects/entrepreneurship--business-models--t-ebay-and-the-trust-economy.topic.json`

- **low / lowercase-start** — Beat "buildup" starts with lowercase: "eBay's challenge wasn't technology. It w…"
- **low / lowercase-start** — Beat "climax" starts with lowercase: "eBay proved that trust systems can repla…"

### Jack Ma: Rejected 30 Times, Built Alibaba

**File:** `content/topics/entrepreneurship/entrepreneurship--famous-founders/entrepreneurship--famous-founders--ch03-underdogs-and-outsiders/entrepreneurship--famous-founders--t-jack-ma-rejected-30-times-built-alibaba.topic.json`

- **low / lowercase-start** — Beat "twist" starts with lowercase: "eBay entered China with $100M. Ma had $2…"

### Scott Harrison: Making Charity Transparent

**File:** `content/topics/entrepreneurship/entrepreneurship--famous-founders/entrepreneurship--famous-founders--ch05-social-impact-founders/entrepreneurship--famous-founders--t-scott-harrison-making-charity-transparent.topic.json`

- **low / lowercase-start** — Beat "climax" starts with lowercase: "charity: water has funded over 137,000 p…"

### Hypothesis-Driven Development

**File:** `content/topics/entrepreneurship/entrepreneurship--lean-startup-method/entrepreneurship--lean-startup-method--ch02-build-measure-learn/entrepreneurship--lean-startup-method--t-hypothesis-driven-development.topic.json`

- **medium / markup-artifacts** — Beat "buildup" may contain JSON/HTML artifacts: "A startup hypothesis looks like this: 'We believe [customer]"
- **medium / template-placeholders** — Beat "buildup" may contain template placeholders: "A startup hypothesis looks like this: 'We believe [customer] will [action] becau"

### charity: water and Radical Transparency

**File:** `content/topics/entrepreneurship/entrepreneurship--social-entrepreneurship/entrepreneurship--social-entrepreneurship--ch04-famous-social-enterprises/entrepreneurship--social-entrepreneurship--t-charity-water-and-radical-transparency.topic.json`

- **low / lowercase-start** — Beat "climax" starts with lowercase: "charity: water has funded over 137,000 p…"

### Induced Pluripotent Stem Cells

**File:** `content/topics/ethics/ethics--bioethics/ethics--bioethics--ch04-stem-cells-and-cloning/ethics--bioethics--t-induced-pluripotent-stem-cells.topic.json`

- **low / lowercase-start** — Beat "discovery" starts with lowercase: "iPSCs can become almost any cell type—he…"

### i-D Magazine and Street Style

**File:** `content/topics/fashion/fashion--fashion-photography-and-media/fashion--fashion-photography-and-media--ch03-fashion-magazines/fashion--fashion-photography-and-media--t-i-d-magazine-and-street-style.topic.json`

- **low / lowercase-start** — Beat "discovery" starts with lowercase: "i-D pioneered 'straight-up' photography:…"
- **low / lowercase-start** — Beat "climax" starts with lowercase: "i-D proved fashion lives on sidewalks, n…"

### Soil pH and Plant Access

**File:** `content/topics/gardening/gardening--soil-science/gardening--soil-science--ch03-nutrients-and-chemistry/gardening--soil-science--t-soil-ph-and-plant-access.topic.json`

- **low / lowercase-start** — Beat "discovery" starts with lowercase: "pH controls nutrient solubility. Iron, f…"
- **low / lowercase-start** — Beat "punchline" starts with lowercase: "pH is the key that unlocks soil nutrient…"

### Robot Vacuums Map Your Home's DNA

**File:** `content/topics/home-diy/home-diy--smart-home-technology/home-diy--smart-home-technology--ch05-ai-assistants/home-diy--smart-home-technology--t-robot-vacuums-map-your-home-s-dna.topic.json`

- **low / lowercase-start** — Beat "twist" starts with lowercase: "iRobot considered selling Roomba floor p…"

### RNA: DNA's Messenger

**File:** `content/topics/medicine/medicine--genetics-and-heredity/medicine--genetics-and-heredity--ch01-the-code-of-life/medicine--genetics-and-heredity--t-rna-dna-s-messenger.topic.json`

- **low / lowercase-start** — Beat "twist" starts with lowercase: "mRNA vaccines use this trick to teach ce…"

### Vaccines as Drugs

**File:** `content/topics/medicine/medicine--how-drugs-work/medicine--how-drugs-work--ch04-common-drug-classes/medicine--how-drugs-work--t-vaccines-as-drugs.topic.json`

- **low / lowercase-start** — Beat "twist" starts with lowercase: "mRNA vaccines don't contain any virus at…"

### mRNA Therapeutics

**File:** `content/topics/medicine/medicine--how-drugs-work/medicine--how-drugs-work--ch06-the-future-of-drugs/medicine--how-drugs-work--t-mrna-therapeutics.topic.json`

- **low / lowercase-start** — Beat "hook" starts with lowercase: "mRNA vaccines were made in days. Now the…"
- **low / lowercase-start** — Beat "buildup" starts with lowercase: "mRNA delivers genetic instructions telli…"
- **low / lowercase-start** — Beat "climax" starts with lowercase: "mRNA could become a universal drug platf…"

### mRNA Vaccine Technology

**File:** `content/topics/medicine/medicine--the-history-of-medicine/medicine--the-history-of-medicine--ch06-medicine-today-and-tomorrow/medicine--the-history-of-medicine--t-mrna-vaccine-technology.topic.json`

- **low / lowercase-start** — Beat "discovery" starts with lowercase: "mRNA vaccines teach cells to build a vir…"
- **low / lowercase-start** — Beat "climax" starts with lowercase: "mRNA platforms could soon target cancer,…"

### COVID-19: A Modern Pandemic

**File:** `content/topics/medicine/medicine--the-science-of-epidemics/medicine--the-science-of-epidemics--ch02-famous-pandemics/medicine--the-science-of-epidemics--t-covid-19-a-modern-pandemic.topic.json`

- **low / lowercase-start** — Beat "twist" starts with lowercase: "mRNA vaccines were developed in under a …"

### Neuroscience and the Future

**File:** `content/topics/mental-health/mental-health--history-of-mental-health/mental-health--history-of-mental-health--ch06-mental-health-today/mental-health--history-of-mental-health--t-neuroscience-and-the-future.topic.json`

- **low / lowercase-start** — Beat "buildup" starts with lowercase: "fMRI and PET scans reveal how mental ill…"

### Affect Labeling: Name It to Tame It

**File:** `content/topics/mental-health/mental-health--the-science-of-emotions/mental-health--the-science-of-emotions--ch05-emotional-regulation/mental-health--the-science-of-emotions--t-affect-labeling-name-it-to-tame-it.topic.json`

- **low / lowercase-start** — Beat "discovery" starts with lowercase: "fMRI studies show labeling emotions decr…"

### eBay Overpays for Skype

**File:** `content/topics/negotiation/negotiation--negotiation-disasters/negotiation--negotiation-disasters--ch03-mergers-gone-wrong/negotiation--negotiation-disasters--t-ebay-overpays-for-skype.topic.json`

- **low / lowercase-start** — Beat "hook" starts with lowercase: "eBay bought Skype for $2.6 billion hopin…"
- **low / lowercase-start** — Beat "discovery" starts with lowercase: "eBay's customers actively preferred anon…"
- **low / lowercase-start** — Beat "twist" starts with lowercase: "eBay sold Skype to Microsoft four years …"

### How Curiosity Drives Learning

**File:** `content/topics/parenting/parenting--how-children-learn/parenting--how-children-learn--ch01-learning-brain/parenting--how-children-learn--t-how-curiosity-drives-learning.topic.json`

- **low / lowercase-start** — Beat "discovery" starts with lowercase: "fMRI studies show curiosity activates th…"

### Habit Stacking

**File:** `content/topics/physical-fitness/physical-fitness--psychology-of-fitness/physical-fitness--psychology-of-fitness--ch02-habit-formation/physical-fitness--psychology-of-fitness--t-habit-stacking.topic.json`

- **medium / markup-artifacts** — Beat "buildup" may contain JSON/HTML artifacts: "Habit stacking uses the formula: 'After I [current habit], I"
- **medium / template-placeholders** — Beat "buildup" may contain template placeholders: "Habit stacking uses the formula: 'After I [current habit], I will [new habit].' "

### Implementation Intentions

**File:** `content/topics/physical-fitness/physical-fitness--psychology-of-fitness/physical-fitness--psychology-of-fitness--ch06-behavior-change/physical-fitness--psychology-of-fitness--t-implementation-intentions.topic.json`

- **medium / markup-artifacts** — Beat "buildup" may contain JSON/HTML artifacts: "Implementation intentions use the format: 'When [situation],"
- **medium / template-placeholders** — Beat "buildup" may contain template placeholders: "Implementation intentions use the format: 'When [situation], I will [behavior].'"

### Cloud Computing and Collaboration

**File:** `content/topics/productivity/productivity--the-history-of-productivity/productivity--the-history-of-productivity--ch05-digital-productivity/productivity--the-history-of-productivity--t-cloud-computing-and-collaboration.topic.json`

- **low / repeated-word** — Beat "hook" has a repeated word near the end: "…ailing version 12 final final."

### Law of Demeter

**File:** `content/topics/programming/programming--clean-code-philosophy/programming--clean-code-philosophy--ch05-managing-complexity/programming--clean-code-philosophy--t-law-of-demeter.topic.json`

- **low / lowercase-start** — Beat "hook" starts with lowercase: "user.getAddress().getCity().getZipCode()…"

### Cognitive Neuroscience Emerges

**File:** `content/topics/psychology/psychology--history-of-psychology/psychology--history-of-psychology--ch04-the-cognitive-revolution/psychology--history-of-psychology--t-cognitive-neuroscience-emerges.topic.json`

- **low / lowercase-start** — Beat "discovery" starts with lowercase: "fMRI and PET scans let researchers see w…"

### Habit Stacking

**File:** `content/topics/psychology/psychology--the-psychology-of-habits/psychology--the-psychology-of-habits--ch02-the-habit-loop/psychology--the-psychology-of-habits--t-habit-stacking.topic.json`

- **medium / markup-artifacts** — Beat "discovery" may contain JSON/HTML artifacts: "BJ Fogg's 'after I' formula works: after [current habit], I "
- **medium / template-placeholders** — Beat "discovery" may contain template placeholders: "BJ Fogg's 'after I' formula works: after [current habit], I will [new habit]. Th"

### iBuyers: Algorithms That Flip Houses

**File:** `content/topics/real-estate/real-estate--history-of-real-estate/real-estate--history-of-real-estate--ch06-the-digital-shift/real-estate--history-of-real-estate--t-ibuyers-algorithms-that-flip-houses.topic.json`

- **low / lowercase-start** — Beat "discovery" starts with lowercase: "iBuyers used machine learning to price t…"

### iBuyers: Algorithms That Buy Your Home

**File:** `content/topics/real-estate/real-estate--the-future-of-real-estate/real-estate--the-future-of-real-estate--ch01-proptech-revolution/real-estate--the-future-of-real-estate--t-ibuyers-algorithms-that-buy-your-home.topic.json`

- **low / lowercase-start** — Beat "buildup" starts with lowercase: "iBuyers use algorithms to estimate home …"
- **low / lowercase-start** — Beat "climax" starts with lowercase: "iBuyers trade convenience for accuracy. …"

### The Neuroscience of Bonding

**File:** `content/topics/relationships/relationships--attachment-theory/relationships--attachment-theory--ch04-attachment-and-the-brain/relationships--attachment-theory--t-the-neuroscience-of-bonding.topic.json`

- **low / lowercase-start** — Beat "discovery" starts with lowercase: "fMRI studies show securely attached peop…"

### The Withdrawal Effect of Lost Love

**File:** `content/topics/relationships/relationships--breakups-and-heartbreak/relationships--breakups-and-heartbreak--ch01-the-science-of-heartbreak/relationships--breakups-and-heartbreak--t-the-withdrawal-effect-of-lost-love.topic.json`

- **low / lowercase-start** — Beat "discovery" starts with lowercase: "fMRI studies show the ventral tegmental …"

### The Chemistry of Best Friends

**File:** `content/topics/relationships/relationships--friendship-the-overlooked-bond/relationships--friendship-the-overlooked-bond--ch01-the-science-of-friendship/relationships--friendship-the-overlooked-bond--t-the-chemistry-of-best-friends.topic.json`

- **low / lowercase-start** — Beat "discovery" starts with lowercase: "fMRI studies show best friends process t…"

### Forced Marriage: When Choice Disappears

**File:** `content/topics/relationships/relationships--marriage-around-the-world/relationships--marriage-around-the-world--ch04-love-marriage-vs-arranged/relationships--marriage-around-the-world--t-forced-marriage-when-choice-disappears.topic.json`

- **medium / near-duplicate** — Beats "buildup" and "punchline" start with the same 40 chars — possible copy-paste.

### Why Betrayal Hurts Like Physical Pain

**File:** `content/topics/relationships/relationships--the-psychology-of-trust/relationships--the-psychology-of-trust--ch04-betrayal/relationships--the-psychology-of-trust--t-why-betrayal-hurts-like-physical-pain.topic.json`

- **low / lowercase-start** — Beat "buildup" starts with lowercase: "fMRI studies show the anterior insula an…"

### Why Smart People Stay in Bad Relationships

**File:** `content/topics/relationships/relationships--toxic-relationships/relationships--toxic-relationships--ch03-the-psychology-of-staying/relationships--toxic-relationships--t-why-smart-people-stay-in-bad-relationships.topic.json`

- **medium / near-duplicate** — Beats "climax" and "punchline" start with the same 40 chars — possible copy-paste.

### Neo-Paganism: Reviving Dead Religions

**File:** `content/topics/religion/religion--ancient-religions-and-lost-faiths/religion--ancient-religions-and-lost-faiths--ch06-why-religions-die/religion--ancient-religions-and-lost-faiths--t-neo-paganism-reviving-dead-religions.topic.json`

- **medium / near-duplicate** — Beats "climax" and "punchline" start with the same 40 chars — possible copy-paste.

### Literal vs. Metaphorical: The Interpretation Wars

**File:** `content/topics/religion/religion--sacred-texts-that-shaped-the-world/religion--sacred-texts-that-shaped-the-world--ch05-how-sacred-texts-work/religion--sacred-texts-that-shaped-the-world--t-literal-vs-metaphorical-the-interpretation-wars.topic.json`

- **medium / near-duplicate** — Beats "climax" and "punchline" start with the same 40 chars — possible copy-paste.

### The 30-Second Elevator Pitch

**File:** `content/topics/sales/sales--the-art-of-the-pitch/sales--the-art-of-the-pitch--ch02-elevator-pitches/sales--the-art-of-the-pitch--t-the-30-second-elevator-pitch.topic.json`

- **medium / markup-artifacts** — Beat "discovery" may contain JSON/HTML artifacts: "The best follow a clear pattern: 'We help [audience] solve ["
- **medium / template-placeholders** — Beat "discovery" may contain template placeholders: "The best follow a clear pattern: 'We help [audience] solve [problem] by [unique "

### Email Persuasion That Works

**File:** `content/topics/sales/sales--the-science-of-persuasion/sales--the-science-of-persuasion--ch05-digital-persuasion/sales--the-science-of-persuasion--t-email-persuasion-that-works.topic.json`

- **medium / markup-artifacts** — Beat "twist" may contain JSON/HTML artifacts: "Fake personalization backfires. 'Hi {FIRST_NAME}' is obvious"
- **medium / template-placeholders** — Beat "twist" may contain template placeholders: "Fake personalization backfires. 'Hi {FIRST_NAME}' is obvious and insulting to mo"

### Habit Stacking

**File:** `content/topics/self-care/self-care--healthy-habits/self-care--healthy-habits--ch02-building-habits/self-care--healthy-habits--t-habit-stacking.topic.json`

- **medium / markup-artifacts** — Beat "discovery" may contain JSON/HTML artifacts: "The formula: 'After [current habit], I will [new habit].' Sp"
- **medium / template-placeholders** — Beat "discovery" may contain template placeholders: "The formula: 'After [current habit], I will [new habit].' Specificity makes the "

### Peer Pressure and Belonging

**File:** `content/topics/sexual-health/sexual-health--puberty-and-adolescence/sexual-health--puberty-and-adolescence--ch03-emotional-changes/sexual-health--puberty-and-adolescence--t-peer-pressure-and-belonging.topic.json`

- **low / lowercase-start** — Beat "discovery" starts with lowercase: "fMRI studies show teen brains light up m…"

### Heartbreak in the Brain

**File:** `content/topics/sexual-health/sexual-health--sex-and-the-brain/sexual-health--sex-and-the-brain--ch04-love-and-attachment/sexual-health--sex-and-the-brain--t-heartbreak-in-the-brain.topic.json`

- **low / lowercase-start** — Beat "buildup" starts with lowercase: "fMRI studies show that viewing a photo o…"

### The Future of Sexual Neuroscience

**File:** `content/topics/sexual-health/sexual-health--sex-and-the-brain/sexual-health--sex-and-the-brain--ch06-brain-sex-and-society/sexual-health--sex-and-the-brain--t-the-future-of-sexual-neuroscience.topic.json`

- **low / lowercase-start** — Beat "buildup" starts with lowercase: "fMRI and PET scans now allow researchers…"

### Future of STI Prevention

**File:** `content/topics/sexual-health/sexual-health--the-science-of-stis/sexual-health--the-science-of-stis--ch06-global-impact/sexual-health--the-science-of-stis--t-future-of-sti-prevention.topic.json`

- **low / lowercase-start** — Beat "buildup" starts with lowercase: "mRNA technology, proven with COVID vacci…"

### The MRI: Magnets That Map Your Brain

**File:** `content/topics/technology/technology--biotech-and-the-human-body/technology--biotech-and-the-human-body--ch02-medical-devices/technology--biotech-and-the-human-body--t-the-mri-magnets-that-map-your-brain.topic.json`

- **low / lowercase-start** — Beat "climax" starts with lowercase: "fMRI can even show which parts of your b…"

### mRNA Vaccines: A New Era of Medicine

**File:** `content/topics/technology/technology--biotech-and-the-human-body/technology--biotech-and-the-human-body--ch05-vaccines-and-drug-tech/technology--biotech-and-the-human-body--t-mrna-vaccines-a-new-era-of-medicine.topic.json`

- **low / lowercase-start** — Beat "climax" starts with lowercase: "mRNA vaccines saved millions of lives an…"

### HTML: The Language of Web Pages

**File:** `content/topics/technology/technology--history-of-the-internet/technology--history-of-the-internet--ch02-from-arpanet-to-the-web/technology--history-of-the-internet--t-html-the-language-of-web-pages.topic.json`

- **medium / markup-artifacts** — Beat "discovery" may contain JSON/HTML artifacts: "HTML uses plain-text tags like <b> for bold and <a> for link"

### URLs: Addresses for Everything

**File:** `content/topics/technology/technology--history-of-the-internet/technology--history-of-the-internet--ch02-from-arpanet-to-the-web/technology--history-of-the-internet--t-urls-addresses-for-everything.topic.json`

- **medium / contains-url** — Beat "twist" contains a URL — verify it's intended.

### Roomba: The Robot in Your Home

**File:** `content/topics/technology/technology--robotics-and-automation/technology--robotics-and-automation--ch04-robots-in-daily-life/technology--robotics-and-automation--t-roomba-the-robot-in-your-home.topic.json`

- **low / lowercase-start** — Beat "buildup" starts with lowercase: "iRobot launched Roomba in 2002. It bumpe…"

### iOS vs Android: The Great Divide

**File:** `content/topics/technology/technology--the-smartphone-revolution/technology--the-smartphone-revolution--ch03-android-and-the-ecosystem/technology--the-smartphone-revolution--t-ios-vs-android-the-great-divide.topic.json`

- **low / lowercase-start** — Beat "buildup" starts with lowercase: "iOS is tightly controlled. Apple designs…"
- **low / lowercase-start** — Beat "punchline" starts with lowercase: "iOS sells polish. Android sells choice. …"
