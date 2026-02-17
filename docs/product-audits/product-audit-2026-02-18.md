# Product Audit — 1 Minute Academy

> Generated: 2026-02-18
>
> Scope: performance, scalability, reliability, accessibility, security, UX, code quality, testing.
>
> This audit **re-verifies all 26 items implemented** in the 2026-02-17 audit and documents **new issues** discovered during re-audit (primarily regressions or gaps introduced by the fixes).

---

## How to read this document

- **P0** — Must fix. Blocks launch quality, user safety, or causes measurable harm today.
- **P1** — High impact. Should be done in the next sprint. Prevents real pain at scale or for specific user groups.
- **P2** — Strategic. Worth doing soon but can be scheduled. Improves long-term quality and developer velocity.

---

## Re-verification summary

All 26 implemented items from the 2026-02-17 audit were re-verified by reading the actual source code:

| ID | Item | Verdict |
|---|---|---|
| SEC-08 | Netlify functions hardened | ✅ Confirmed |
| SEC-09 | `returnPath` sanitized | ✅ Confirmed |
| REL-04 | ErrorBoundary resets on navigation | ✅ Confirmed |
| PERF-10 | `listTopics()` pagination | ✅ Confirmed |
| PERF-11 | Schema fallback removed | ✅ Confirmed |
| A11Y-09 | Confetti `aria-hidden` | ✅ Confirmed |
| UX-07 | 404 page | ✅ Confirmed |
| CQ-01 | LessonPage reduced (791 lines) | ✅ Confirmed |
| CQ-02 | ProfilePage reduced (1,453 lines) | ✅ Confirmed |
| CQ-03 | DevModuleCheck extracted (641 lines) | ✅ Confirmed |
| CQ-04 | Stripe routes use shared utils | ✅ Confirmed |
| CQ-08 | Dead LearnPage deleted | ✅ Confirmed |
| CQ-09 | Dead Learn variants deleted | ✅ Confirmed |
| CQ-10 | Certificate SVG extracted | ✅ Confirmed |
| PERF-08 | Self-hosted fonts | ✅ Confirmed |
| PERF-09 | Image optimization pipeline | ✅ Confirmed |
| PERF-12 | Profile tabs lazy-loaded | ✅ Confirmed |
| UX-05 | Auth callback spinner | ✅ Confirmed |
| UX-06 | Skeleton loading states | ✅ Confirmed |
| UX-08 | `<noscript>` fallback | ✅ Confirmed |
| SCALE-04 | Client-side TTL cache | ✅ Confirmed |
| SCALE-05 | Sync RPC + chunking | ✅ Confirmed |
| SCALE-06 | Avatar MIME/size constraints | ✅ Confirmed |
| SEC-06 | Auth cooldown | ⚠️ Partial — duration bug (see SEC-11) |
| SEC-10 | Hardened `getClientIp` | ✅ Confirmed |
| CQ-05 | Seo cleanup on unmount | ✅ Confirmed |
| CQ-11 | Dead import removed | ✅ Confirmed |
| CQ-12 | ESLint Node override | ✅ Confirmed |

**25 of 26 fixes confirmed solid. 1 has a bug (SEC-06 → SEC-11).**

---

## Open items from previous audits (carried forward)

These items were not addressed in the 2026-02-17 implementation cycle and remain open:

| ID | Priority | Category | Description |
|---|---|---|---|
| CQ-06 | P2 | Code Quality | No TypeScript |
| CQ-07 | P2 | Code Quality | No CI/CD pipeline |
| TEST-01 | P1 | Testing | No unit test framework |
| TEST-02 | P1 | Testing | No E2E test coverage |
| TEST-03 | P2 | Testing | Build scripts have no automated tests |
| TEST-04 | P2 | Testing | No visual regression tests |

---

## New findings

### P1 — High impact

#### SEC-11 · Auth cooldown timer expires at ~50% of intended duration *(New — introduced by SEC-06 fix)*

**Where:** [src/pages/LoginPage.jsx](../../src/pages/LoginPage.jsx) (line 54)

The cooldown duration arithmetic double-counts elapsed time:

```js
const cooldownMsLeft = Math.max(0, (Number(cooldownUntilMs) || 0) - (Date.now() + cooldownTick));
```

`cooldownUntilMs` is a future timestamp (`Date.now() + 2000`). On each 250 ms tick, `cooldownTick` increments by 250 **and** `Date.now()` also advances by ~250 ms. Both are subtracted from the target, so real time is counted approximately twice. A 2-second cooldown expires in ~1 second.

**Fix:** Remove `cooldownTick` from the arithmetic — it should only exist to trigger re-renders:

```js
const cooldownMsLeft = Math.max(0, (Number(cooldownUntilMs) || 0) - Date.now());
```

The interval (`setCooldownTick`) stays as-is since it drives the 250 ms re-render cadence.

> **Status:** ✅ Implemented — Removed `cooldownTick` from the `cooldownMsLeft` formula; now uses `Date.now()` only. `void cooldownTick` retains the re-render dependency. 2-second cooldown now lasts a full 2 seconds.

---

### P2 — Strategic

#### REL-05 · No ErrorBoundary around lazy-loaded profile tabs *(New — introduced by PERF-12 fix)*

**Where:** [src/pages/ProfilePage.jsx](../../src/pages/ProfilePage.jsx)

The seven lazy-loaded tab components are wrapped in `<Suspense>` (with a skeleton fallback), but there is no `ErrorBoundary` wrapping the `<Suspense>`. If a tab chunk fails to load (network error, stale deployment where the old chunk hash is gone), the error propagates to the global ErrorBoundary and crashes the entire page.

The app's top-level ErrorBoundary catches this, but the user sees the full crash UI instead of a scoped "failed to load tab — retry" message.

**Fix:** Wrap each tab's `<Suspense>` in a lightweight error boundary with a "Failed to load — Retry" fallback that only affects the tab panel, not the entire profile page.

> **Status:** ✅ Implemented — Wrapped `<Suspense>` in `<ErrorBoundary resetKey={activeTab}>` with an inline fallback that detects chunk-load errors and shows a scoped "Reload to update" button. Switching tabs resets the boundary.

---

#### PERF-13 · Cache module has no proactive eviction *(New — introduced by SCALE-04 fix)*

**Where:** [src/services/cache.js](../../src/services/cache.js)

The TTL cache uses lazy expiration only — expired entries are removed when read, never proactively. If keys are written but never re-read, they accumulate in the `Map` forever. Additionally, `withCache` does not deduplicate concurrent in-flight requests: two simultaneous calls for the same key will both invoke the loader.

In today's usage (short sessions, bounded key space of ~5–10 unique keys), this is not harmful. But it could grow if caching is expanded.

**Fix:**
- Option A: Add a periodic sweep (e.g., every 60s via `setInterval`) to prune expired entries.
- Option B: Cap the Map at a max size (e.g., 200 entries) with LRU-style eviction.
- Option C: Switch to a proven library like TanStack Query when the caching surface grows.

Also: consider deduplicating in-flight requests by storing the `Promise` itself in the cache until it resolves.

> **Status:** ✅ Implemented — Added a 60-second periodic sweep (`setInterval` with `.unref()`), a 200-entry max-size cap with LRU-style eviction, and in-flight request deduplication (stores the `Promise` in an `inflight` Map until resolved/rejected).

---

#### CQ-13 · Seo meta restore can leave stale tags when instances overlap *(New — introduced by CQ-05 fix)*

**Where:** [src/components/Seo.jsx](../../src/components/Seo.jsx)

During route transitions, both the old and new `<Seo>` instances may be briefly mounted. The cleanup of Instance A skips (correctly) because the current meta differs from what it set. But Instance B's cleanup — when *it* later unmounts — restores to Instance A's values, which are now orphaned.

In practice this is fleeting (the next route's `<Seo>` fires immediately), and the JSON-LD owner-ID scoping is correct. But a crawler hitting the page during the transition gap could see stale OG tags.

**Fix:** This is inherent to the "capture previous → restore" pattern with overlapping mounts. If it causes real issues, consider a global singleton approach (one `<SeoManager>` at the top of the tree that receives props via context) instead of per-route instances.

> **Status:** ✅ Implemented — Replaced the capture-restore pattern with a global `seoStack` registry. Each `<Seo>` instance pushes its state on mount and removes it on unmount; the DOM always reflects the topmost stack entry. Overlapping instances during route transitions are now handled correctly.

---

#### CQ-14 · ESLint React plugins leak to Node files *(New — introduced by CQ-12 fix)*

**Where:** [eslint.config.js](../../eslint.config.js)

The first config block matches `**/*.{js,jsx}`, which includes API and script files. It applies `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh` via `extends`. The Node-files override only *adds* `globals.node` — it does **not** remove the React plugins. Result:

1. React Hooks lint rules run on Node API files. Any future `use`-prefixed function name will trigger a false positive.
2. ESLint flat config **merges** globals across matching config objects, so Node files get both `globals.browser` **and** `globals.node`.

**Fix:** Narrow the first block's `files` to `src/**/*.{js,jsx}` so React plugins and browser globals only apply to client code:

```js
{
  files: ['src/**/*.{js,jsx}'],
  extends: [ js.configs.recommended, reactHooks, reactRefresh ],
  languageOptions: { globals: globals.browser, ... },
},
{
  files: ['api/**/*.{js,mjs}', 'scripts/**/*.{js,mjs}', 'netlify/functions/**/*.{js,mjs}'],
  extends: [ js.configs.recommended ],
  languageOptions: { globals: globals.node, ... },
},
```

> **Status:** ✅ Implemented — First block narrowed to `src/**/*.{js,jsx}`; Node override now independently extends `js.configs.recommended` with its own `languageOptions` (ecmaVersion, node globals, module sourceType) and `no-unused-vars` rule. React plugins no longer apply to API/script files.

---

## Summary matrix

| Category | P0 | P1 | P2 |
|---|---|---|---|
| **Security** | — | ~~SEC-11~~ ✅ | — |
| **Reliability** | — | — | ~~REL-05~~ ✅ |
| **Performance** | — | — | ~~PERF-13~~ ✅ |
| **Accessibility** | — | — | — |
| **UX** | — | — | — |
| **Scalability** | — | — | — |
| **Code Quality** | — | — | CQ-06 ❌, CQ-07 ❌, ~~CQ-13~~ ✅, ~~CQ-14~~ ✅ |
| **Testing** | — | TEST-01 ❌, TEST-02 ❌ | TEST-03 ❌, TEST-04 ❌ |

> ❌ = Not addressed (carried forward) | ✅ = Implemented this cycle

**Totals: 0 P0 · 2 P1 · 4 P2 = 6 open items** (all carried forward from prior audits)

All 5 new findings resolved. Down from 31 open items → 6 open items (81% reduction across all audit cycles).

---

## Recommended execution order

1. ~~**SEC-11** — Fix cooldown arithmetic (one-line change)~~ ✅
2. ~~**CQ-14** — Narrow ESLint file patterns to stop React plugins leaking to Node code~~ ✅
3. **TEST-01** — Set up Vitest + core unit tests
4. **TEST-02** — Add E2E test coverage
5. ~~**REL-05** — Add tab-level ErrorBoundary in ProfilePage~~ ✅
6. ~~**PERF-13** — Add periodic cache sweep or max-size cap~~ ✅
7. ~~**CQ-13** — Consider singleton Seo manager (if stale-tag issue surfaces in crawlers)~~ ✅

