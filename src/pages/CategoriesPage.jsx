import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Seo from '../components/Seo';
import { listCategories, listCourses } from '../services/catalog';
import { useAuth } from '../context/AuthContext';
import { listUserCompletedTopicProgressWithCourseIds } from '../services/progress';
import './CategoriesFlow.css';

export default function CategoriesPage() {
  const { user, isSupabaseConfigured } = useAuth();
  const [categories, setCategories] = useState([]);
  const [courses, setCourses] = useState([]);
  const [startedCourseIds, setStartedCourseIds] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [cats, allCourses] = await Promise.all([listCategories(), listCourses()]);
        if (cancelled) return;
        setCategories(Array.isArray(cats) ? cats : []);
        setCourses(Array.isArray(allCourses) ? allCourses : []);
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

    async function loadStartedCourses() {
      if (!isSupabaseConfigured || !user) {
        setStartedCourseIds(new Set());
        return;
      }

      try {
        const rows = await listUserCompletedTopicProgressWithCourseIds();
        if (cancelled) return;
        const next = new Set();
        for (const r of Array.isArray(rows) ? rows : []) {
          const courseId = String(r?.topics?.course_id ?? '').trim();
          if (courseId) next.add(courseId);
        }
        setStartedCourseIds(next);
      } catch {
        if (!cancelled) setStartedCourseIds(new Set());
      }
    }

    loadStartedCourses();
    return () => {
      cancelled = true;
    };
  }, [isSupabaseConfigured, user]);

  const courseCountsByCategory = useMemo(() => {
    const m = new Map();
    for (const c of Array.isArray(courses) ? courses : []) {
      const categoryId = String(c?.category_id ?? '').trim();
      if (!categoryId) continue;
      m.set(categoryId, (m.get(categoryId) ?? 0) + 1);
    }
    return m;
  }, [courses]);

  const startedCourseCountsByCategory = useMemo(() => {
    const m = new Map();
    for (const c of Array.isArray(courses) ? courses : []) {
      const categoryId = String(c?.category_id ?? '').trim();
      const courseId = String(c?.id ?? '').trim();
      if (!categoryId || !courseId) continue;
      if (!startedCourseIds?.has?.(courseId)) continue;
      m.set(categoryId, (m.get(categoryId) ?? 0) + 1);
    }
    return m;
  }, [courses, startedCourseIds]);

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
              const courseCount = courseCountsByCategory.get(id) ?? 0;
              const started = startedCourseCountsByCategory.get(id) ?? 0;
              const pct = courseCount > 0 ? Math.max(0, Math.min(100, Math.round((started / courseCount) * 100))) : 0;

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

                  {user && courseCount > 0 && started > 0 && (
                    <div className="catflow-progress" aria-label="Category progress">
                      <div className="catflow-progressTop">
                        <span>
                          Started <strong>{started}</strong> of <strong>{courseCount}</strong> courses
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
