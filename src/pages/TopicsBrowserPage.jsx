import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import Header from '../components/Header';
import SubjectCard from '../components/SubjectCard';
import { getTopicCategoryCounts, listTopicsPage, searchTopicsPage } from '../services/topics';
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
  const [categoryCounts, setCategoryCounts] = useState(() => new Map([['All', 0]]));
  const [ratingMap, setRatingMap] = useState(() => new Map());
  const [completedIds, setCompletedIds] = useState(() => new Set());
  const [activeCategory, setActiveCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | completed | new
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isLocalDev = import.meta.env.DEV && contentSource === 'local';
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkTopic, setCheckTopic] = useState(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkReport, setCheckReport] = useState(null);
  const [checkError, setCheckError] = useState(null);
  const [checkOverrides, setCheckOverrides] = useState(() => new Map());
  const [checkPercent, setCheckPercent] = useState(0);
  const [checkPhase, setCheckPhase] = useState('');
  const eventSourceRef = useRef(null);

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const activeQueryRef = useRef('');
  const activeSubjectRef = useRef(null);

  const PAGE_SIZE = 36;

  async function runModuleCheck(topic) {
    if (!isLocalDev) return;
    if (!topic?.id) return;

    try {
      eventSourceRef.current?.close?.();
    } catch {
      // ignore
    }

    setCheckOpen(true);
    setCheckTopic(topic);
    setCheckLoading(true);
    setCheckReport(null);
    setCheckError(null);
    setCheckPercent(0);
    setCheckPhase('Starting…');

    try {
      // Prefer streaming progress via SSE.
      const es = new EventSource(`/__dev/module-check/stream?topic=${encodeURIComponent(topic.id)}`);
      eventSourceRef.current = es;

      es.addEventListener('progress', (ev) => {
        try {
          const p = JSON.parse(ev.data);
          if (typeof p?.percent === 'number') setCheckPercent(Math.max(0, Math.min(100, p.percent)));
          if (p?.message) setCheckPhase(String(p.message));
          else if (p?.phase) setCheckPhase(String(p.phase));
        } catch {
          // ignore
        }
      });

      es.addEventListener('done', (ev) => {
        try {
          const data = JSON.parse(ev.data);
          setCheckReport(data);
          if (!data?.ok) setCheckError(data?.error || 'Some checks failed');

          try {
            const raw = window.localStorage.getItem(`oma_module_check_overrides:${topic.id}`);
            const parsed = raw ? JSON.parse(raw) : null;
            const m = new Map(Object.entries(parsed || {}));
            setCheckOverrides(m);
          } catch {
            setCheckOverrides(new Map());
          }
        } catch (e) {
          setCheckError(String(e?.message ?? e));
        } finally {
          setCheckLoading(false);
          setCheckPercent(100);
          try {
            es.close();
          } catch {
            // ignore
          }
        }
      });

      es.addEventListener('error', (ev) => {
        // If the server returns an SSE error payload, surface it.
        try {
          if (ev?.data) {
            const payload = JSON.parse(ev.data);
            setCheckError(payload?.error || 'Module check stream error');
          } else {
            setCheckError('Module check stream error');
          }
        } catch {
          setCheckError('Module check stream error');
        } finally {
          setCheckLoading(false);
          try {
            es.close();
          } catch {
            // ignore
          }
        }
      });

      // Note: completion handled in the 'done' listener.
    } catch (e) {
      setCheckError(String(e?.message ?? e));
    } finally {
      // Loading is turned off by SSE 'done'/'error'.
    }
  }

  function applyOverrides(items, overrides) {
    const arr = Array.isArray(items) ? items : [];
    if (!overrides || overrides.size === 0) return arr;
    return arr.map((it) => {
      const next = overrides.get(it.id);
      if (next !== 'pass' && next !== 'fail') return it;
      return { ...it, status: next, details: it.details };
    });
  }

  function summaryFor(items) {
    return (Array.isArray(items) ? items : []).reduce(
      (acc, it) => {
        const s = it?.status;
        if (!s) return acc;
        acc[s] = (acc[s] ?? 0) + 1;
        return acc;
      },
      { pass: 0, fail: 0, warn: 0, manual: 0 }
    );
  }

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(handle);
  }, [query]);

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
  }, [topics]);

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

  const searchUiState = useMemo(() => {
    const q = String(query ?? '').trim();
    const dq = String(debouncedQuery ?? '').trim();
    const serverMode = contentSource !== 'local';

    if (!serverMode || !q) return 'idle';
    if (q !== dq) return 'debouncing';
    if (loading) return 'loading';
    return 'idle';
  }, [contentSource, query, debouncedQuery, loading]);

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
                    <span className="cat-count">{sidebarCounts.get(c) ?? 0}</span>
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

                <div className="mobile-category">
                  <select value={activeCategory} onChange={(e) => setActiveCategory(e.target.value)} aria-label="Category">
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c} ({sidebarCounts.get(c) ?? 0})
                      </option>
                    ))}
                  </select>
                </div>
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

              <div className="mobile-controls" aria-label="Browse controls">
                <div className="chip-row" aria-label="Categories">
                  {categories.map((c) => (
                    <button
                      key={`chip-${c}`}
                      type="button"
                      className={c === activeCategory ? 'chip active' : 'chip'}
                      onClick={() => setActiveCategory(c)}
                      title={`${c} (${sidebarCounts.get(c) ?? 0})`}
                    >
                      <span className="chip-name">{c}</span>
                      <span className="chip-count">{sidebarCounts.get(c) ?? 0}</span>
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
                      <SubjectCard
                        subject={t}
                        index={idx}
                        devTestLabel={checkLoading && checkTopic?.id === t.id ? 'Testing…' : 'Test'}
                        onDevTest={isLocalDev && !t?.comingSoon ? () => runModuleCheck(t) : null}
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
          </section>
        </div>
      </main>

      {checkOpen && (
        <div className="dev-check-modal" role="dialog" aria-modal="true">
          <div className="dev-check-modal-inner">
            <div className="dev-check-modal-header">
              <div className="dev-check-modal-title">Module check: {checkTopic?.title || checkTopic?.id}</div>
              <button
                type="button"
                className="dev-check-close"
                onClick={() => {
                  if (checkLoading) return;
                  setCheckOpen(false);
                }}
              >
                Close
              </button>
            </div>

            {checkLoading && <div className="dev-check-status">Running checks… (can take ~30–90s)</div>}
            {checkLoading && (
              <div className="dev-check-progress" aria-label="Module check progress">
                <div className="dev-check-progress-row">
                  <div className="dev-check-progress-text">{checkPhase || 'Running…'}</div>
                  <div className="dev-check-progress-pct">{Math.round(checkPercent)}%</div>
                </div>
                <div className="dev-check-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(checkPercent)}>
                  <div className="dev-check-bar-inner" style={{ width: `${Math.round(checkPercent)}%` }} />
                </div>
              </div>
            )}
            {checkError && !checkLoading && <div className="dev-check-error">{checkError}</div>}

            {checkReport && (
              <div className="dev-check-report">
                {(() => {
                  const mergedItems = applyOverrides(checkReport.items, checkOverrides);
                  const mergedSummary = summaryFor(mergedItems);
                  const ok = (mergedSummary.fail ?? 0) === 0 && (mergedSummary.manual ?? 0) === 0 && (mergedSummary.warn ?? 0) === 0;

                  return (
                    <>
                <div className="dev-check-summary">
                  <span className={ok ? 'dev-check-ok' : 'dev-check-bad'}>
                    {ok ? 'PASS' : 'FAIL'}
                  </span>
                  <span className="dev-check-summary-meta">
                    pass: {mergedSummary.pass ?? 0} · fail: {mergedSummary.fail ?? 0} · warn: {mergedSummary.warn ?? 0} · manual:{' '}
                    {mergedSummary.manual ?? 0}
                  </span>
                </div>

                <div className="dev-check-items">
                  {mergedItems.map((it) => {
                    const isManual = it.status === 'manual';
                    const showStatus = isManual ? 'fail' : it.status;

                    return (
                      <div key={`${it.id}-${it.title}`} className={`dev-check-item dev-check-${showStatus}`}>
                        <div className="dev-check-item-title">
                          <span className="dev-check-pill">{String(it.status).toUpperCase()}</span>
                          <span className="dev-check-item-text">{it.title}</span>
                          <span className="dev-check-item-actions">
                            <button
                              type="button"
                              className="dev-check-action"
                              onClick={() => {
                                const topicId = checkTopic?.id;
                                if (!topicId) return;
                                setCheckOverrides((prev) => {
                                  const next = new Map(prev);
                                  next.set(it.id, 'pass');
                                  try {
                                    window.localStorage.setItem(
                                      `oma_module_check_overrides:${topicId}`,
                                      JSON.stringify(Object.fromEntries(next.entries()))
                                    );
                                  } catch {
                                    // ignore
                                  }
                                  return next;
                                });
                              }}
                            >
                              Mark green
                            </button>
                            <button
                              type="button"
                              className="dev-check-action"
                              onClick={() => {
                                const topicId = checkTopic?.id;
                                if (!topicId) return;
                                setCheckOverrides((prev) => {
                                  const next = new Map(prev);
                                  next.set(it.id, 'fail');
                                  try {
                                    window.localStorage.setItem(
                                      `oma_module_check_overrides:${topicId}`,
                                      JSON.stringify(Object.fromEntries(next.entries()))
                                    );
                                  } catch {
                                    // ignore
                                  }
                                  return next;
                                });
                              }}
                            >
                              Mark red
                            </button>
                          </span>
                        </div>
                        {it.section && <div className="dev-check-item-section">{it.section}</div>}
                        {it.details && <pre className="dev-check-item-details">{String(it.details)}</pre>}
                      </div>
                    );
                  })}
                </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
