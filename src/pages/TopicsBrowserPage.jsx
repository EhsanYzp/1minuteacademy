import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Seo from '../components/Seo';
import SubjectCard from '../components/SubjectCard';
import DevModuleCheck from '../components/topics/DevModuleCheck';
import { getTopicCategoryCounts, listTopicsPage, searchTopicsPage } from '../services/topics';
import { listUserTopicProgress } from '../services/progress';
import { getTopicRatingSummaries } from '../services/ratings';
import { useAuth } from '../context/AuthContext';
import { getContentSource } from '../services/_contentSource';
import { getCurrentTier, getTopicGate } from '../services/entitlements';
import { toAbsoluteUrl } from '../services/seo';
import './TopicsBrowserPage.css';

const CANONICAL_CATEGORIES = [
  'AI & Agents',
  'Programming Fundamentals',
  'Web & Mobile Development',
  'Data & Analytics',
  'Cloud & DevOps',
  'Cybersecurity',
  'Blockchain & Web3',
  'Quantum & Physics',
  'Product & Startups',
  'Design & UX',
  'Finance & Economics',
  'Career & Communication',
  'General',
];

function norm(s) {
  return String(s ?? '').trim();
}

function normSubcategory(topic) {
  const v = norm(topic?.subcategory);
  return v || 'General';
}

function includesQuery(topic, q) {
  if (!q) return true;
  const hay = `${topic.title ?? ''} ${topic.description ?? ''} ${topic.subject ?? ''} ${topic.subcategory ?? ''}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

const DIFFICULTY_FILTERS = ['all', 'beginner', 'intermediate', 'advanced', 'premium'];

export default function TopicsBrowserPage() {
  const { user, isSupabaseConfigured } = useAuth();
  const contentSource = getContentSource();
  const tier = getCurrentTier(user);
  const [searchParams, setSearchParams] = useSearchParams();

  const [topics, setTopics] = useState([]);
  const [totalTopics, setTotalTopics] = useState(null);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState(() => new Map([['All', 0]]));
  const [ratingMap, setRatingMap] = useState(() => new Map());
  const [completedIds, setCompletedIds] = useState(() => new Set());
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeSubcategory, setActiveSubcategory] = useState('All');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | completed | new
  const [difficultyFilter, setDifficultyFilter] = useState('all'); // all | beginner | intermediate | advanced | premium
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function resetBrowseState() {
    setActiveCategory('All');
    setActiveSubcategory('All');
    setFilter('all');
    setDifficultyFilter('all');
    setQuery('');
  }

  const urlDifficulty = useMemo(() => {
    const raw = String(searchParams.get('difficulty') ?? 'all').toLowerCase();
    return DIFFICULTY_FILTERS.includes(raw) ? raw : 'all';
  }, [searchParams]);

  useEffect(() => {
    // Sync UI state from URL (supports shareable links + browser back/forward).
    setDifficultyFilter((prev) => (prev === urlDifficulty ? prev : urlDifficulty));
  }, [urlDifficulty]);

  useEffect(() => {
    // Sync URL from UI state (without clobbering other query params).
    const current = String(searchParams.get('difficulty') ?? 'all').toLowerCase();
    const desired = String(difficultyFilter ?? 'all').toLowerCase();

    const nextDesired = DIFFICULTY_FILTERS.includes(desired) ? desired : 'all';
    if (nextDesired === 'all') {
      if (!searchParams.has('difficulty')) return;
      const next = new URLSearchParams(searchParams);
      next.delete('difficulty');
      setSearchParams(next, { replace: true });
      return;
    }

    if (current === nextDesired) return;
    const next = new URLSearchParams(searchParams);
    next.set('difficulty', nextDesired);
    setSearchParams(next, { replace: true });
  }, [difficultyFilter, searchParams, setSearchParams]);

  const isLocalDev = import.meta.env.DEV && contentSource === 'local';

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const activeQueryRef = useRef('');
  const activeSubjectRef = useRef(null);

  const PAGE_SIZE = 36;

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    // Keep the filter bar sticky *below* the sticky header.
    const headerEl = document.querySelector('.header');
    if (!headerEl) return;

    const update = () => {
      const h = Math.max(0, Math.ceil(headerEl.getBoundingClientRect().height || 0));
      document.documentElement.style.setProperty('--oma-header-h', `${h}px`);
    };

    update();

    let ro = null;
    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      ro = new ResizeObserver(() => update());
      try {
        ro.observe(headerEl);
      } catch {
        // ignore
      }
    }

    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      try {
        ro?.disconnect?.();
      } catch {
        // ignore
      }
    };
  }, []);

  async function mergeRatingsForRows(rows) {
    const ids = (Array.isArray(rows) ? rows : []).map((t) => t.id).filter(Boolean);
    if (ids.length === 0) return;
    try {
      const map = await getTopicRatingSummaries(ids);
      if (!mountedRef.current) return;
      setRatingMap((prev) => {
        const next = new Map(prev);
        for (const [k, v] of map.entries()) next.set(k, v);
        return next;
      });
    } catch {
      // ignore
    }
  }

  async function loadPage({ offset, append, subject, searchQuery, requestId }) {
    const q = String(searchQuery ?? '').trim();
    const page = q
      ? await searchTopicsPage({ query: q, limit: PAGE_SIZE, offset, subject })
      : await listTopicsPage({ limit: PAGE_SIZE, offset, subject });
    const rows = Array.isArray(page?.items) ? page.items : [];

    if (!mountedRef.current) return;
    if (typeof requestId === 'number' && requestIdRef.current !== requestId) return;

    setTotalTopics(typeof page?.total === 'number' ? page.total : null);
    setNextOffset(typeof page?.nextOffset === 'number' ? page.nextOffset : offset + rows.length);
    setHasMore(Boolean(page?.hasMore));

    setTopics((prev) => {
      if (!append) return rows;
      const seen = new Set(prev.map((t) => t.id));
      const merged = prev.slice();
      for (const r of rows) {
        if (r?.id && !seen.has(r.id)) merged.push(r);
      }
      return merged;
    });

    await mergeRatingsForRows(rows);
  }

  async function handleLoadMore() {
    if (loadingMore || loading) return;
    if (!hasMore) return;
    try {
      setLoadingMore(true);
      await loadPage({
        offset: nextOffset,
        append: true,
        subject: activeSubjectRef.current,
        searchQuery: activeQueryRef.current,
        requestId: requestIdRef.current,
      });
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;

    let mounted = true;

    async function loadCountsOnce() {
      try {
        const { counts, total } = await getTopicCategoryCounts();
        if (!mounted) return;
        const next = new Map(counts);
        next.set(
          'All',
          typeof total === 'number' ? total : Array.from(counts.values()).reduce((a, b) => a + (Number(b) || 0), 0)
        );
        setCategoryCounts(next);
      } catch {
        if (mounted) setCategoryCounts(new Map([['All', 0]]));
      }
    }

    loadCountsOnce();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    async function load() {
      try {
        const requestId = (requestIdRef.current += 1);
        setLoading(true);
        setError(null);
        setRatingMap(new Map());

        const subject = activeCategory === 'All' ? null : activeCategory;
        const q = String(debouncedQuery ?? '').trim();
        activeSubjectRef.current = subject;
        activeQueryRef.current = q;

        // First page for the active category/search.
        setTopics([]);
        setTotalTopics(null);
        setNextOffset(0);
        setHasMore(false);
        await loadPage({ offset: 0, append: false, subject, searchQuery: q, requestId });
      } catch (e) {
        if (!mountedRef.current) return;
        setError(e);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    load();
    return () => {
      mountedRef.current = false;
    };
  }, [activeCategory, debouncedQuery]);

  useEffect(() => {
    setActiveSubcategory('All');
  }, [activeCategory]);

  useEffect(() => {
    let mounted = true;

    async function loadProgress() {
      if (contentSource !== 'local') {
        if (!isSupabaseConfigured || !user) {
          setCompletedIds(new Set());
          return;
        }
      }

      try {
        const rows = await listUserTopicProgress();
        if (!mounted) return;

        const ids = new Set(
          (Array.isArray(rows) ? rows : [])
            .filter((r) => Number(r?.completed_count ?? 0) > 0)
            .map((r) => r.topic_id)
        );
        setCompletedIds(ids);
      } catch {
        if (mounted) setCompletedIds(new Set());
      }
    }

    loadProgress();
    return () => {
      mounted = false;
    };
  }, [contentSource, isSupabaseConfigured, user]);

  const sidebarCounts = useMemo(() => {
    const counts = new Map();

    // Seed canonical categories so they exist even if empty.
    for (const c of CANONICAL_CATEGORIES) counts.set(c, 0);

    for (const [k, v] of categoryCounts.entries()) counts.set(k, v);

    // Ensure All exists.
    if (!counts.has('All')) {
      const total = Array.from(counts.entries())
        .filter(([k]) => k !== 'All')
        .reduce((acc, [, v]) => acc + (Number(v) || 0), 0);
      counts.set('All', total);
    }

    return counts;
  }, [categoryCounts]);

  const categories = useMemo(() => {
    const discovered = new Set();
    for (const k of sidebarCounts.keys()) {
      if (k !== 'All') discovered.add(k);
    }

    const out = ['All', ...CANONICAL_CATEGORIES];

    const canonicalSet = new Set(CANONICAL_CATEGORIES);
    const extra = Array.from(discovered)
      .filter((c) => c && !canonicalSet.has(c))
      .sort((a, b) => String(a).localeCompare(String(b)));

    out.push(...extra);
    return out;
  }, [sidebarCounts]);

  useEffect(() => {
    if (!categories.includes(activeCategory)) setActiveCategory('All');
  }, [categories, activeCategory]);

  const visibleTopics = useMemo(() => {
    const q = query.trim();
    const shouldClientFilterQuery = contentSource === 'local';

    let out = topics
      .map((t) => {
        const summary = ratingMap.get(t.id) ?? null;
        return {
          ...t,
          completed: completedIds.has(t.id),
          ratingAvg: summary?.avg_rating ?? null,
          ratingCount: summary?.ratings_count ?? 0,
        };
      })
      .filter((t) => (shouldClientFilterQuery ? includesQuery(t, q) : true));

    if (activeCategory !== 'All') {
      out = out.filter((t) => (norm(t.subject) || 'General') === activeCategory);
    }

    if (activeCategory !== 'All' && activeSubcategory !== 'All') {
      out = out.filter((t) => normSubcategory(t) === activeSubcategory);
    }

    if (filter === 'completed') out = out.filter((t) => t.completed);
    if (filter === 'new') out = out.filter((t) => !t.completed);

    if (difficultyFilter !== 'all') {
      out = out.filter((t) => String(t?.difficulty ?? 'Beginner').toLowerCase() === difficultyFilter);
    }

    out.sort((a, b) => {
      // Completed first, then alphabetical
      const ac = a.completed ? 1 : 0;
      const bc = b.completed ? 1 : 0;
      if (ac !== bc) return bc - ac;
      return String(a.title).localeCompare(String(b.title));
    });

    return out;
  }, [topics, ratingMap, completedIds, activeCategory, activeSubcategory, query, filter, difficultyFilter, contentSource]);

  const subcategoryCounts = useMemo(() => {
    if (activeCategory === 'All') return new Map([['All', 0]]);

    const counts = new Map();
    counts.set('All', 0);

    for (const t of Array.isArray(topics) ? topics : []) {
      if ((norm(t?.subject) || 'General') !== activeCategory) continue;
      const sc = normSubcategory(t);
      counts.set(sc, (counts.get(sc) ?? 0) + 1);
      counts.set('All', (counts.get('All') ?? 0) + 1);
    }

    return counts;
  }, [topics, activeCategory]);

  const subcategories = useMemo(() => {
    if (activeCategory === 'All') return [];
    const keys = Array.from(subcategoryCounts.keys()).filter((k) => k && k !== 'All');
    keys.sort((a, b) => String(a).localeCompare(String(b)));
    return ['All', ...keys];
  }, [subcategoryCounts, activeCategory]);

  const searchUiState = useMemo(() => {
    const q = String(query ?? '').trim();
    const dq = String(debouncedQuery ?? '').trim();
    const serverMode = contentSource !== 'local';

    if (!serverMode || !q) return 'idle';
    if (q !== dq) return 'debouncing';
    if (loading) return 'loading';
    return 'idle';
  }, [contentSource, query, debouncedQuery, loading]);

  const itemListJsonLd = useMemo(() => {
    const items = (Array.isArray(topics) ? topics : [])
      .filter((t) => t && t.id && t.title)
      .slice(0, 60);
    if (items.length === 0) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Topics',
      itemListElement: items.map((t, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: String(t.title),
        url: toAbsoluteUrl(`/topic/${encodeURIComponent(String(t.id))}`),
      })),
    };
  }, [topics]);

  return (
    <motion.div className="topics-browser" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Seo
        title="Topics"
        description="Browse 1 minute lessons by category, difficulty, and search."
        path="/topics"
        canonicalPath="/topics"
        jsonLd={itemListJsonLd}
      />
      <Header />

      <main className="topics-browser-main">
        <div className="topics-browser-hero">
          <Link className="topics-back" to="/">← Home</Link>
          <h1>Pick your next 1 minute lesson</h1>
          <p>Browse by category, search, and jump right in.</p>
        </div>

        {error && (
          <div className="topics-browser-error">
            <strong>Couldn’t load topics.</strong>
            <div className="topics-browser-error-sub">{error.message ?? String(error)}</div>
          </div>
        )}

        <div className="topics-browser-layout">
          <section className="topics-content">
            <div className="topics-toolbar topics-toolbar--sticky" role="region" aria-label="Topic filters">
              <div className="toolbar-row">
                <label className="search">
                  <span className="search-icon">🔎</span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search topics (e.g., quantum, blockchain, agents…)"
                    aria-label="Search topics"
                  />

                  {searchUiState !== 'idle' && (
                    <span className="search-status" aria-live="polite">
                      <span className={searchUiState === 'loading' ? 'search-spinner' : 'search-spinner subtle'} aria-hidden="true" />
                      <span className="search-status-text">{searchUiState === 'loading' ? 'Searching' : '…'}</span>
                    </span>
                  )}

                  {query && (
                    <button type="button" className="clear" onClick={() => setQuery('')} aria-label="Clear search">
                      ✕
                    </button>
                  )}
                </label>
              </div>

              <div className="toolbar-filters" aria-label="Filters">
                <div className="filter-group">
                  <label className="filter-label" htmlFor="topics-filter-category">Category</label>
                  <select
                    id="topics-filter-category"
                    value={activeCategory}
                    onChange={(e) => setActiveCategory(e.target.value)}
                    aria-label="Category"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}{typeof (sidebarCounts.get(c) ?? null) === 'number' ? ` (${sidebarCounts.get(c) ?? 0})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label className="filter-label" htmlFor="topics-filter-subcategory">Subcategory</label>
                  <select
                    id="topics-filter-subcategory"
                    value={activeSubcategory}
                    onChange={(e) => setActiveSubcategory(e.target.value)}
                    disabled={activeCategory === 'All' || subcategories.length === 0}
                    aria-label="Subcategory"
                  >
                    {(activeCategory === 'All' || subcategories.length === 0) ? (
                      <option value="All">All</option>
                    ) : (
                      subcategories.map((sc) => (
                        <option key={sc} value={sc}>
                          {sc}{typeof (subcategoryCounts.get(sc) ?? null) === 'number' ? ` (${subcategoryCounts.get(sc) ?? 0})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="filter-group">
                  <label className="filter-label" htmlFor="topics-filter-difficulty">Difficulty</label>
                  <select
                    id="topics-filter-difficulty"
                    value={difficultyFilter}
                    onChange={(e) => setDifficultyFilter(e.target.value)}
                    aria-label="Difficulty"
                  >
                    <option value="all">All</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label className="filter-label" htmlFor="topics-filter-status">Status</label>
                  <select
                    id="topics-filter-status"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    aria-label="Status"
                  >
                    <option value="all">All</option>
                    <option value="new">To watch</option>
                    <option value="completed">Watched</option>
                  </select>
                </div>

                <button type="button" className="toolbar-reset" onClick={resetBrowseState}>
                  Reset
                </button>
              </div>

              <div className="toolbar-sub">
                Showing <strong>{visibleTopics.length}</strong> result(s)
                {(() => {
                  const fallbackTotal = sidebarCounts.get(activeCategory) ?? null;
                  const displayTotal = typeof totalTopics === 'number' ? totalTopics : fallbackTotal;
                  if (typeof displayTotal === 'number') {
                    return (
                      <>
                        {' '}• Loaded <strong>{topics.length}</strong> / <strong>{displayTotal}</strong>
                        {activeCategory !== 'All' ? <> in <strong>{activeCategory}</strong></> : null}
                      </>
                    );
                  }
                  return <>{' '}• Loaded <strong>{topics.length}</strong></>;
                })()}
                {contentSource === 'local' ? ' (Local Preview)' : user ? '' : ' (sign in to track completion)'}
              </div>
            </div>

            {loading ? (
              <div className="topics-loading">Loading topics…</div>
            ) : visibleTopics.length === 0 ? (
              <div className="topics-empty">No topics match your search/filter. Try a different keyword.</div>
            ) : (
              <DevModuleCheck enabled={isLocalDev}>
                {({ enabled, runModuleCheck, getDevTestLabel }) => (
                  <>
                    <div className="topics-grid">
                      {visibleTopics.map((t, idx) => (
                        <motion.div
                          key={t.id}
                          initial={{ y: 8, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: Math.min(0.2, idx * 0.02) }}
                        >
                          <SubjectCard
                            subject={t}
                            gate={getTopicGate({ tier, topicRow: t })}
                            devTestLabel={getDevTestLabel(t.id)}
                            onDevTest={enabled && !t?.comingSoon ? () => runModuleCheck(t) : null}
                          />
                        </motion.div>
                      ))}
                    </div>

                    {hasMore && (
                      <div className="topics-loadmore">
                        <button type="button" className="loadmore-btn" onClick={handleLoadMore} disabled={loadingMore}>
                          {loadingMore ? 'Loading…' : 'Load more topics'}
                        </button>
                        <div className="loadmore-sub">Load more to expand your results without downloading everything.</div>
                      </div>
                    )}
                  </>
                )}
              </DevModuleCheck>
            )}
          </section>
        </div>
      </main>
    </motion.div>
  );
}
