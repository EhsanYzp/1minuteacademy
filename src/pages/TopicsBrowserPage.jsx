import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Seo from '../components/Seo';
import SubjectCard from '../components/SubjectCard';
import DevModuleCheck from '../components/topics/DevModuleCheck';
import { TopicsGridSkeleton } from '../components/SkeletonBlocks';
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

const FEATURED_TRACKS = [
  {
    key: 'ai_agents',
    title: 'AI & Agents Track',
    subject: 'AI & Agents',
    emoji: '🤖',
    blurb: 'Build intuition for modern AI systems, agents, and workflows.',
  },
  {
    key: 'fundamentals',
    title: 'Programming Fundamentals',
    subject: 'Programming Fundamentals',
    emoji: '🧠',
    blurb: 'The fastest path to stronger coding fundamentals.',
  },
  {
    key: 'cyber',
    title: 'Cybersecurity Essentials',
    subject: 'Cybersecurity',
    emoji: '🛡️',
    blurb: 'Threats, defenses, and practical security thinking.',
  },
  {
    key: 'cloud',
    title: 'Cloud & DevOps',
    subject: 'Cloud & DevOps',
    emoji: '☁️',
    blurb: 'Systems, reliability, and shipping faster with confidence.',
  },
  {
    key: 'data',
    title: 'Data & Analytics',
    subject: 'Data & Analytics',
    emoji: '📊',
    blurb: 'From data basics to analysis patterns you can reuse.',
  },
  {
    key: 'web_mobile',
    title: 'Web & Mobile Development',
    subject: 'Web & Mobile Development',
    emoji: '📱',
    blurb: 'Frontend + backend concepts, fast.',
  },
];

const CURATED_SUBJECTS = [
  'AI & Agents',
  'Programming Fundamentals',
  'Cybersecurity',
  'Cloud & DevOps',
  'Data & Analytics',
  'Web & Mobile Development',
];

function uniqById(rows) {
  const out = [];
  const seen = new Set();
  for (const r of Array.isArray(rows) ? rows : []) {
    const id = r?.id;
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(r);
  }
  return out;
}

function decorateTopicRow({ row, ratingSummaryMap, completedIds }) {
  const summary = ratingSummaryMap?.get?.(row?.id) ?? null;
  return {
    ...row,
    completed: Boolean(row?.id && completedIds?.has?.(row.id)),
    ratingAvg: summary?.avg_rating ?? null,
    ratingCount: summary?.ratings_count ?? 0,
  };
}

export default function TopicsBrowserPage() {
  const { user, isSupabaseConfigured } = useAuth();
  const contentSource = getContentSource();
  const tier = getCurrentTier(user);
  const [searchParams, setSearchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState('curated'); // curated | grid
  const gridRef = useRef(null);
  const lastGridStateRef = useRef(null);

  const [curated, setCurated] = useState(() => ({
    loading: true,
    error: null,
    trending: [],
    beginnerPicks: [],
    bySubject: {},
  }));

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
    setTopics([]);
    setTotalTopics(null);
    setNextOffset(0);
    setHasMore(false);
    lastGridStateRef.current = null;
    setViewMode('curated');

    // Clear URL-driven grid triggers.
    try {
      if (searchParams.has('difficulty')) {
        const next = new URLSearchParams(searchParams);
        next.delete('difficulty');
        setSearchParams(next, { replace: true });
      }
    } catch {
      // ignore
    }
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
    // If user has a difficulty pinned in the URL, assume they want the grid.
    if (urlDifficulty !== 'all') setViewMode('grid');
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
    if (String(query ?? '').trim()) setViewMode('grid');
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

    if (viewMode !== 'grid') {
      setLoading(false);
      return () => {
        mountedRef.current = false;
      };
    }

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
  }, [activeCategory, debouncedQuery, viewMode]);

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

  useEffect(() => {
    let mounted = true;
    const requestId = (requestIdRef.current += 1);

    async function loadCurated() {
      try {
        setCurated((prev) => ({ ...prev, loading: true, error: null }));

        const subjects = CURATED_SUBJECTS.slice();
        const pages = await Promise.all(
          subjects.map((subject) => listTopicsPage({ limit: 14, offset: 0, subject }))
        );

        if (!mounted || requestIdRef.current !== requestId) return;

        const bySubject = {};
        let pool = [];
        for (let i = 0; i < subjects.length; i += 1) {
          const subject = subjects[i];
          const items = Array.isArray(pages[i]?.items) ? pages[i].items : [];
          bySubject[subject] = items;
          pool.push(...items);
        }

        pool = uniqById(pool);

        let ratingSummaryMap = new Map();
        try {
          ratingSummaryMap = await getTopicRatingSummaries(pool.map((t) => t.id));
          if (!mounted || requestIdRef.current !== requestId) return;
          setRatingMap((prev) => {
            const next = new Map(prev);
            for (const [k, v] of ratingSummaryMap.entries()) next.set(k, v);
            return next;
          });
        } catch {
          ratingSummaryMap = new Map();
        }

        const decoratedPool = pool.map((t) => decorateTopicRow({ row: t, ratingSummaryMap, completedIds }));

        const trending = decoratedPool
          .slice()
          .sort((a, b) => {
            const ac = Number(a?.ratingCount ?? 0) || 0;
            const bc = Number(b?.ratingCount ?? 0) || 0;
            if (ac !== bc) return bc - ac;
            const aa = Number(a?.ratingAvg ?? 0) || 0;
            const ba = Number(b?.ratingAvg ?? 0) || 0;
            if (aa !== ba) return ba - aa;
            return String(a?.title ?? '').localeCompare(String(b?.title ?? ''));
          })
          .slice(0, 12);

        const beginnerPicks = decoratedPool
          .filter((t) => String(t?.difficulty ?? '').toLowerCase() === 'beginner')
          .slice(0, 12);

        const decoratedBySubject = {};
        for (const [subject, items] of Object.entries(bySubject)) {
          decoratedBySubject[subject] = (Array.isArray(items) ? items : [])
            .map((t) => decorateTopicRow({ row: t, ratingSummaryMap, completedIds }))
            .slice(0, 12);
        }

        setCurated({
          loading: false,
          error: null,
          trending,
          beginnerPicks,
          bySubject: decoratedBySubject,
        });
      } catch (e) {
        if (!mounted) return;
        setCurated({
          loading: false,
          error: e,
          trending: [],
          beginnerPicks: [],
          bySubject: {},
        });
      }
    }

    loadCurated();
    return () => {
      mounted = false;
    };
  }, [contentSource, completedIds]);

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

  function enterGridMode() {
    setViewMode('grid');
    setTimeout(() => {
      try {
        gridRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      } catch {
        // ignore
      }
    }, 0);
  }

  function saveGridState() {
    lastGridStateRef.current = {
      activeCategory,
      activeSubcategory,
      query,
      filter,
      difficultyFilter,
    };
  }

  function enterCuratedMode({ remember = true } = {}) {
    if (remember && viewMode === 'grid') saveGridState();

    setViewMode('curated');

    // Curated view is a clean exploration surface.
    setActiveCategory('All');
    setActiveSubcategory('All');
    setFilter('all');
    setQuery('');
    setDifficultyFilter('all');

    // Prevent URL params from snapping us back into grid.
    try {
      if (searchParams.has('difficulty')) {
        const next = new URLSearchParams(searchParams);
        next.delete('difficulty');
        setSearchParams(next, { replace: true });
      }
    } catch {
      // ignore
    }

    setTimeout(() => {
      try {
        window?.scrollTo?.({ top: 0, behavior: 'smooth' });
      } catch {
        // ignore
      }
    }, 0);
  }

  function resumeLastGrid() {
    const last = lastGridStateRef.current;
    if (!last) return;
    setActiveCategory(last.activeCategory ?? 'All');
    setActiveSubcategory(last.activeSubcategory ?? 'All');
    setFilter(last.filter ?? 'all');
    setQuery(last.query ?? '');
    setDifficultyFilter(last.difficultyFilter ?? 'all');
    enterGridMode();
  }

  function handleTrackClick(subject) {
    setQuery('');
    setFilter('all');
    setDifficultyFilter('all');
    setActiveSubcategory('All');
    setActiveCategory(subject);
    enterGridMode();
  }

  function handleBrowseAllClick() {
    setActiveCategory('All');
    setActiveSubcategory('All');
    setFilter('all');
    setDifficultyFilter('all');
    enterGridMode();
  }

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

                {viewMode === 'grid' && (
                  <button type="button" className="toolbar-explore" onClick={() => enterCuratedMode({ remember: true })}>
                    Back to explore
                  </button>
                )}
              </div>

              {viewMode === 'grid' ? (
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
              ) : (
                <div className="toolbar-sub toolbar-sub--curated">
                  Explore curated tracks below — or search to jump straight into a topic.
                  {contentSource === 'local' ? ' (Local Preview)' : user ? '' : ' (sign in to track completion)'}
                </div>
              )}
            </div>

            {viewMode === 'curated' ? (
              <div className="topics-curated" aria-label="Curated topic tracks">
                <div className="curated-cta-row">
                  {lastGridStateRef.current ? (
                    <button type="button" className="curated-primary" onClick={resumeLastGrid}>
                      Resume browsing
                    </button>
                  ) : (
                    <button type="button" className="curated-primary" onClick={handleBrowseAllClick}>
                      Browse all topics
                    </button>
                  )}
                  <div className="curated-quick">
                    <button type="button" className="curated-chip" onClick={() => { setDifficultyFilter('beginner'); enterGridMode(); }}>
                      Beginner
                    </button>
                    <button type="button" className="curated-chip" onClick={() => { setDifficultyFilter('intermediate'); enterGridMode(); }}>
                      Intermediate
                    </button>
                    <button type="button" className="curated-chip" onClick={() => { setDifficultyFilter('advanced'); enterGridMode(); }}>
                      Advanced
                    </button>
                    <button type="button" className="curated-chip" onClick={() => { setDifficultyFilter('premium'); enterGridMode(); }}>
                      Premium
                    </button>
                  </div>
                </div>

                <div className="curated-section">
                  <div className="curated-header">
                    <h2>Featured tracks</h2>
                    <div className="curated-sub">Pick an area, then we’ll show everything in it.</div>
                  </div>

                  <div className="track-grid" role="list">
                    {FEATURED_TRACKS.map((t) => {
                      const count = sidebarCounts.get(t.subject) ?? null;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          className="track-card"
                          onClick={() => handleTrackClick(t.subject)}
                          role="listitem"
                        >
                          <div className="track-emoji" aria-hidden="true">{t.emoji}</div>
                          <div className="track-meta">
                            <div className="track-title">{t.title}</div>
                            <div className="track-blurb">{t.blurb}</div>
                            <div className="track-foot">
                              <span className="track-pill">{t.subject}</span>
                              {typeof count === 'number' ? <span className="track-count">{count} topics</span> : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="curated-section">
                  <div className="curated-header">
                    <h2>Trending now</h2>
                    <div className="curated-sub">Popular picks based on community ratings.</div>
                  </div>

                  {curated.loading ? (
                    <TopicsGridSkeleton count={6} />
                  ) : curated.trending.length === 0 ? (
                    <div className="topics-empty">No trending topics yet — try searching above.</div>
                  ) : (
                    <div className="topics-carousel" role="region" aria-label="Trending topics">
                      <div className="topics-carousel-row">
                        {curated.trending.map((t) => (
                          <div key={t.id} className="topics-carousel-item">
                            <SubjectCard subject={t} gate={getTopicGate({ tier, topicRow: t })} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="curated-section">
                  <div className="curated-header">
                    <h2>Beginner-friendly</h2>
                    <div className="curated-sub">Fast wins to build momentum.</div>
                  </div>

                  {curated.loading ? (
                    <TopicsGridSkeleton count={6} />
                  ) : curated.beginnerPicks.length === 0 ? (
                    <div className="topics-empty">No beginner topics found — try another difficulty.</div>
                  ) : (
                    <div className="topics-carousel" role="region" aria-label="Beginner topics">
                      <div className="topics-carousel-row">
                        {curated.beginnerPicks.map((t) => (
                          <div key={t.id} className="topics-carousel-item">
                            <SubjectCard subject={t} gate={getTopicGate({ tier, topicRow: t })} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="curated-section">
                  <div className="curated-header">
                    <h2>Explore by area</h2>
                    <div className="curated-sub">Scroll a row, or jump into the full list for that area.</div>
                  </div>

                  {curated.error ? (
                    <div className="topics-browser-error">
                      <strong>Couldn’t load curated topics.</strong>
                      <div className="topics-browser-error-sub">{curated.error?.message ?? String(curated.error)}</div>
                    </div>
                  ) : null}

                  {CURATED_SUBJECTS.map((subject) => {
                    const items = curated.bySubject?.[subject] ?? [];
                    if (!curated.loading && items.length === 0) return null;
                    return (
                      <div key={subject} className="curated-row">
                        <div className="curated-row-head">
                          <div className="curated-row-title">{subject}</div>
                          <button type="button" className="curated-row-link" onClick={() => handleTrackClick(subject)}>
                            See all
                          </button>
                        </div>

                        {curated.loading ? (
                          <TopicsGridSkeleton count={6} />
                        ) : (
                          <div className="topics-carousel" role="region" aria-label={`${subject} topics`}>
                            <div className="topics-carousel-row">
                              {items.map((t) => (
                                <div key={t.id} className="topics-carousel-item">
                                  <SubjectCard subject={t} gate={getTopicGate({ tier, topicRow: t })} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div ref={gridRef}>
                {loading ? (
                  <TopicsGridSkeleton count={12} />
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
              </div>
            )}
          </section>
        </div>
      </main>
    </motion.div>
  );
}
