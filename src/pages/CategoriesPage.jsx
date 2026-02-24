import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Seo from '../components/Seo';
import { getCategoryCourseCounts, getCategoryTopicCounts, listCategories } from '../services/catalog';
import { useAuth } from '../context/AuthContext';
import { getUserCompletedTopicsByCategory } from '../services/progress';
import './CategoriesFlow.css';

export default function CategoriesPage() {
  const { user, isSupabaseConfigured } = useAuth();
  const [categories, setCategories] = useState([]);
  const [courseCountsByCategoryId, setCourseCountsByCategoryId] = useState(() => new Map());
  const [topicCountsByCategoryId, setTopicCountsByCategoryId] = useState(() => new Map());
  const [completedTopicsByCategoryId, setCompletedTopicsByCategoryId] = useState(() => new Map());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [cats, courseCounts, topicCounts] = await Promise.all([
          listCategories(),
          getCategoryCourseCounts(),
          getCategoryTopicCounts(),
        ]);
        if (cancelled) return;
        setCategories(Array.isArray(cats) ? cats : []);
        setCourseCountsByCategoryId(courseCounts instanceof Map ? courseCounts : new Map());
        setTopicCountsByCategoryId(topicCounts instanceof Map ? topicCounts : new Map());
      } catch (e) {
        if (cancelled) return;
        setError(e?.message ?? 'Failed to load categories');
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCategoryProgress() {
      if (!isSupabaseConfigured || !user) {
        setCompletedTopicsByCategoryId(new Map());
        return;
      }

      try {
        const byCategory = await getUserCompletedTopicsByCategory();
        if (cancelled) return;
        setCompletedTopicsByCategoryId(byCategory instanceof Map ? byCategory : new Map());
      } catch {
        if (!cancelled) setCompletedTopicsByCategoryId(new Map());
      }
    }

    loadCategoryProgress();
    return () => {
      cancelled = true;
    };
  }, [isSupabaseConfigured, user]);

  const visibleCategories = useMemo(() => {
    const q = String(query ?? '').trim().toLowerCase();
    const rows = Array.isArray(categories) ? categories : [];
    if (!q) return rows;
    return rows.filter((cat) => {
      const hay = `${cat?.title ?? ''} ${cat?.description ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [categories, query]);

  return (
    <motion.div className="catflow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Seo
        title="Categories"
        description="Browse categories, then courses, chapters, and topics."
        path="/categories"
        canonicalPath="/categories"
      />
      <Header />

      <main className="catflow-main">
        <div className="catflow-hero">
          <Link className="catflow-back" to="/">← Home</Link>
          <h1>Categories</h1>
          <p>Pick a category to see its courses.</p>

          <div className="catflow-toolbar" role="region" aria-label="Category search">
            <label className="catflow-search">
              <span aria-hidden="true">🔎</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories (e.g., web3, programming…)"
                aria-label="Search categories"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                  ✕
                </button>
              )}
            </label>
          </div>
        </div>

        {loading && <p className="catflow-empty">Loading…</p>}
        {error && <p className="catflow-error">{error}</p>}

        {!loading && !error && (
          <div className="catflow-grid" aria-label="Categories">
            {visibleCategories.map((cat) => {
              const id = String(cat?.id ?? '').trim();
              const title = String(cat?.title ?? 'Untitled');
              const borderColor = cat?.color ? String(cat.color) : null;
              const courseCount = courseCountsByCategoryId.get(id) ?? 0;
              const completedTopics = completedTopicsByCategoryId.get(id) ?? 0;
              const totalTopics = topicCountsByCategoryId.get(id) ?? 0;
              const pct = totalTopics > 0
                ? Math.max(0, Math.min(100, Math.round((completedTopics / totalTopics) * 100)))
                : 0;

              return (
                <Link
                  key={id}
                  to={`/categories/${encodeURIComponent(id)}`}
                  className="catflow-card"
                  style={borderColor ? { '--card-accent': borderColor } : undefined}
                >
                  <div className="catflow-cardTop">
                    <h2 className="catflow-cardTitle catflow-cardTitleTop">{title}</h2>
                    <div className="catflow-badge">{courseCount} courses</div>
                  </div>

                  {user && totalTopics > 0 && completedTopics > 0 && (
                    <div className="catflow-progress" aria-label="Category progress">
                      <div className="catflow-progressTop">
                        <span>
                          <strong>{completedTopics}</strong> / <strong>{totalTopics}</strong> topics
                        </span>
                        <span><strong>{pct}%</strong></span>
                      </div>
                      <div className="catflow-progressTrack">
                        <div className="catflow-progressFill" style={{ '--progress-pct': `${pct}%` }} />
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}

            {visibleCategories.length === 0 && <p className="catflow-empty">No categories found.</p>}
          </div>
        )}
      </main>
    </motion.div>
  );
}
