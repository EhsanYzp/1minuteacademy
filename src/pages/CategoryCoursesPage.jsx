import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Seo from '../components/Seo';
import Breadcrumbs from '../components/Breadcrumbs';
import { getCourseCounts, listCategories, listCourses } from '../services/catalog';
import './CategoriesFlow.css';

async function mapWithConcurrency(items, limit, mapper) {
  const out = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx;
      idx += 1;
      out[i] = await mapper(items[i], i);
    }
  }

  const workers = [];
  for (let i = 0; i < Math.max(1, limit); i += 1) workers.push(worker());
  await Promise.all(workers);
  return out;
}

export default function CategoryCoursesPage() {
  const { categoryId } = useParams();
  const id = String(categoryId ?? '').trim();

  const [category, setCategory] = useState(null);
  const [courses, setCourses] = useState([]);
  const [countsByCourseId, setCountsByCourseId] = useState(() => new Map());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [cats, rows] = await Promise.all([listCategories(), listCourses({ categoryId: id })]);
        if (cancelled) return;
        const found = (Array.isArray(cats) ? cats : []).find((c) => String(c?.id ?? '') === id) ?? null;
        setCategory(found);
        setCourses(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (cancelled) return;
        setError(e?.message ?? 'Failed to load courses');
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    if (id) load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function loadCounts() {
      const rows = Array.isArray(courses) ? courses : [];
      if (rows.length === 0) return;

      try {
        const results = await mapWithConcurrency(rows, 4, async (c) => {
          const courseId = String(c?.id ?? '').trim();
          if (!courseId) return null;
          const counts = await getCourseCounts({ courseId });
          return { courseId, counts };
        });

        if (cancelled) return;
        const next = new Map();
        for (const r of results) {
          if (!r?.courseId) continue;
          next.set(r.courseId, r.counts ?? { chapters: null, topics: null });
        }
        setCountsByCourseId(next);
      } catch {
        // Non-fatal; keep page usable.
      }
    }

    loadCounts();
    return () => {
      cancelled = true;
    };
  }, [courses]);

  const title = useMemo(() => String(category?.title ?? 'Category'), [category]);
  const description = useMemo(() => String(category?.description ?? ''), [category]);

  const guidance = useMemo(() => {
    if (description) return `${description} Pick a course to see its chapters.`;
    if (!id) return 'Pick a course to see its chapters.';
    return `Pick a course in ${title} to see its chapters.`;
  }, [description, id, title]);

  const visibleCourses = useMemo(() => {
    const q = String(query ?? '').trim().toLowerCase();
    const rows = Array.isArray(courses) ? courses : [];
    if (!q) return rows;
    return rows.filter((c) => {
      const hay = `${c?.title ?? ''} ${c?.description ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [courses, query]);

  return (
    <motion.div className="catflow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Seo
        title={`${title} — Courses`}
        description={description || 'Browse courses in this category.'}
        path={`/categories/${encodeURIComponent(id)}`}
        canonicalPath={`/categories/${encodeURIComponent(id)}`}
      />
      <Header />

      <main className="catflow-main">
        <div className="catflow-hero">
          <Link className="catflow-back" to="/categories">← Categories</Link>
          <Breadcrumbs
            items={[
              { label: 'Categories', to: '/categories' },
              { label: title, to: `/categories/${encodeURIComponent(id)}` },
            ]}
          />
          <h1>{title}</h1>
          <p>{guidance}</p>

          <div className="catflow-toolbar" role="region" aria-label="Course search">
            <label className="catflow-search">
              <span aria-hidden="true">🔎</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search courses"
                aria-label="Search courses"
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
          <div className="catflow-grid" aria-label="Courses">
            {visibleCourses.map((c) => {
              const courseId = String(c?.id ?? '').trim();
              const courseTitle = String(c?.title ?? 'Untitled course');
              const desc = String(c?.description ?? '');
              const borderColor = c?.color ? String(c.color) : null;
              const counts = countsByCourseId.get(courseId) ?? null;
              const chapters = counts?.chapters;
              const topics = counts?.topics;

              const chaptersText = `${Number.isFinite(Number(chapters)) ? chapters : '—'} chapters`;
              const topicsText = `${Number.isFinite(Number(topics)) ? topics : '—'} topics`;

              return (
                <Link
                  key={courseId}
                  to={`/categories/${encodeURIComponent(id)}/courses/${encodeURIComponent(courseId)}`}
                  className="catflow-card"
                  style={borderColor ? { '--card-accent': borderColor } : undefined}
                >
                  <div className="catflow-cardTop">
                    <h2 className="catflow-cardTitle catflow-cardTitleTop">{courseTitle}</h2>
                    <div className="catflow-badges" aria-label="Course stats">
                      <div className="catflow-badge">{chaptersText}</div>
                      <div className="catflow-badge">{topicsText}</div>
                    </div>
                  </div>
                  <p className="catflow-cardDesc">{desc}</p>
                </Link>
              );
            })}

            {visibleCourses.length === 0 && <p className="catflow-empty">No courses found.</p>}
          </div>
        )}
      </main>
    </motion.div>
  );
}
