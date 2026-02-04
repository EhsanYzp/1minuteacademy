import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import SubjectCard from '../components/SubjectCard';
import { listTopics } from '../services/topics';
import { listUserTopicProgress } from '../services/progress';
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
  const [completedIds, setCompletedIds] = useState(() => new Set());
  const [activeCategory, setActiveCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | completed | new
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await listTopics();
        if (!mounted) return;
        setTopics(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!mounted) return;
        setError(e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
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
      .map((t) => ({ ...t, completed: completedIds.has(t.id) }))
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
  }, [topics, completedIds, activeCategory, query, filter]);

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
                Showing <strong>{visibleTopics.length}</strong> topic(s)
                {contentSource === 'local' ? ' (Local Preview)' : user ? '' : ' (sign in to track completion)'}
              </div>
            </div>

            {loading ? (
              <div className="topics-loading">Loading topics…</div>
            ) : visibleTopics.length === 0 ? (
              <div className="topics-empty">No topics match your search/filter. Try a different keyword.</div>
            ) : (
              <div className="topics-grid">
                {visibleTopics.map((t, idx) => (
                  <motion.div key={t.id} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: Math.min(0.2, idx * 0.02) }}>
                    <SubjectCard subject={t} index={idx} />
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </motion.div>
  );
}
