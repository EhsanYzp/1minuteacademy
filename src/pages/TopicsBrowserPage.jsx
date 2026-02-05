import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import Header from '../components/Header';
import SubjectCard from '../components/SubjectCard';
import { listTopicsPage } from '../services/topics';
import { listUserTopicProgress } from '../services/progress';
import { getTopicRatingSummaries } from '../services/ratings';
import { useAuth } from '../context/AuthContext';
import { getContentSource } from '../services/_contentSource';
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

function includesQuery(topic, q) {
  if (!q) return true;
  const hay = `${topic.title ?? ''} ${topic.description ?? ''} ${topic.subject ?? ''}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

export default function TopicsBrowserPage() {
  const { user, isSupabaseConfigured } = useAuth();
  const contentSource = getContentSource();

  const [topics, setTopics] = useState([]);
  const [totalTopics, setTotalTopics] = useState(null);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [ratingMap, setRatingMap] = useState(() => new Map());
  const [completedIds, setCompletedIds] = useState(() => new Set());
  const [activeCategory, setActiveCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | completed | new
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const mountedRef = useRef(false);

  const PAGE_SIZE = 36;

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

  async function loadPage({ offset, append }) {
    const page = await listTopicsPage({ limit: PAGE_SIZE, offset });
    const rows = Array.isArray(page?.items) ? page.items : [];

    if (!mountedRef.current) return;

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
      await loadPage({ offset: nextOffset, append: true });
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        setRatingMap(new Map());
        await loadPage({ offset: 0, append: false });
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
  }, []);

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

  const categoryCounts = useMemo(() => {
    const counts = new Map();

    // Seed canonical categories so they exist even if empty.
    for (const c of CANONICAL_CATEGORIES) counts.set(c, 0);

    for (const t of topics) {
      const c = norm(t.subject) || 'General';
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }

    counts.set('All', topics.length);
    return counts;
  }, [topics]);

  const categories = useMemo(() => {
    const discovered = new Set();
    for (const t of topics) discovered.add(norm(t.subject) || 'General');

    const out = ['All', ...CANONICAL_CATEGORIES];

    const canonicalSet = new Set(CANONICAL_CATEGORIES);
    const extra = Array.from(discovered)
      .filter((c) => c && !canonicalSet.has(c))
      .sort((a, b) => String(a).localeCompare(String(b)));

    out.push(...extra);
    return out;
  }, [topics]);

  useEffect(() => {
    if (!categories.includes(activeCategory)) setActiveCategory('All');
  }, [categories, activeCategory]);

  const visibleTopics = useMemo(() => {
    const q = query.trim();

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
      .filter((t) => includesQuery(t, q));

    if (activeCategory !== 'All') {
      out = out.filter((t) => (norm(t.subject) || 'General') === activeCategory);
    }

    if (filter === 'completed') out = out.filter((t) => t.completed);
    if (filter === 'new') out = out.filter((t) => !t.completed);

    out.sort((a, b) => {
      // Completed first, then alphabetical
      const ac = a.completed ? 1 : 0;
      const bc = b.completed ? 1 : 0;
      if (ac !== bc) return bc - ac;
      return String(a.title).localeCompare(String(b.title));
    });

    return out;
  }, [topics, ratingMap, completedIds, activeCategory, query, filter]);

  return (
    <motion.div className="topics-browser" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Header />

      <main className="topics-browser-main">
        <div className="topics-browser-hero">
          <h1>Pick your next 60-second lesson</h1>
          <p>Browse by category, search, and jump right in.</p>
        </div>

        {error && (
          <div className="topics-browser-error">
            <strong>Couldn’t load topics.</strong>
            <div className="topics-browser-error-sub">{error.message ?? String(error)}</div>
          </div>
        )}

        <div className="topics-browser-layout">
          <aside className="topics-sidebar">
            <div className="sidebar-block">
              <div className="sidebar-title">Categories</div>

              <div className="categories-list">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={c === activeCategory ? 'cat active' : 'cat'}
                    onClick={() => setActiveCategory(c)}
                  >
                    <span className="cat-name">{c}</span>
                    <span className="cat-count">{categoryCounts.get(c) ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="sidebar-block">
              <div className="sidebar-title">Filters</div>
              <div className="filters">
                <button type="button" className={filter === 'all' ? 'f active' : 'f'} onClick={() => setFilter('all')}>
                  All
                </button>
                <button
                  type="button"
                  className={filter === 'completed' ? 'f active' : 'f'}
                  onClick={() => setFilter('completed')}
                >
                  Completed
                </button>
                <button type="button" className={filter === 'new' ? 'f active' : 'f'} onClick={() => setFilter('new')}>
                  New
                </button>
              </div>
            </div>
          </aside>

          <section className="topics-content">
            <div className="topics-toolbar">
              <div className="toolbar-row">
                <label className="search">
                  <span className="search-icon">🔎</span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search topics (e.g., quantum, blockchain, agents…)"
                    aria-label="Search topics"
                  />
                  {query && (
                    <button type="button" className="clear" onClick={() => setQuery('')} aria-label="Clear search">
                      ✕
                    </button>
                  )}
                </label>

                <div className="mobile-category">
                  <select value={activeCategory} onChange={(e) => setActiveCategory(e.target.value)} aria-label="Category">
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c} ({categoryCounts.get(c) ?? 0})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="toolbar-sub">
                Showing <strong>{visibleTopics.length}</strong> result(s)
                {typeof totalTopics === 'number' ? (
                  <>
                    {' '}• Loaded <strong>{topics.length}</strong> / <strong>{totalTopics}</strong>
                  </>
                ) : (
                  <> • Loaded <strong>{topics.length}</strong></>
                )}
                {contentSource === 'local' ? ' (Local Preview)' : user ? '' : ' (sign in to track completion)'}
              </div>

              <div className="mobile-controls" aria-label="Browse controls">
                <div className="chip-row" aria-label="Categories">
                  {categories.map((c) => (
                    <button
                      key={`chip-${c}`}
                      type="button"
                      className={c === activeCategory ? 'chip active' : 'chip'}
                      onClick={() => setActiveCategory(c)}
                      title={`${c} (${categoryCounts.get(c) ?? 0})`}
                    >
                      <span className="chip-name">{c}</span>
                      <span className="chip-count">{categoryCounts.get(c) ?? 0}</span>
                    </button>
                  ))}
                </div>

                <div className="chip-row" aria-label="Filters">
                  <button type="button" className={filter === 'all' ? 'chip active' : 'chip'} onClick={() => setFilter('all')}>
                    All
                  </button>
                  <button
                    type="button"
                    className={filter === 'completed' ? 'chip active' : 'chip'}
                    onClick={() => setFilter('completed')}
                  >
                    Completed
                  </button>
                  <button type="button" className={filter === 'new' ? 'chip active' : 'chip'} onClick={() => setFilter('new')}>
                    New
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="topics-loading">Loading topics…</div>
            ) : visibleTopics.length === 0 ? (
              <div className="topics-empty">No topics match your search/filter. Try a different keyword.</div>
            ) : (
              <>
                <div className="topics-grid">
                  {visibleTopics.map((t, idx) => (
                    <motion.div key={t.id} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: Math.min(0.2, idx * 0.02) }}>
                      <SubjectCard subject={t} index={idx} />
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
          </section>
        </div>
      </main>
    </motion.div>
  );
}
