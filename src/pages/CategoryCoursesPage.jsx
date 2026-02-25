import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Seo from '../components/Seo';
import Breadcrumbs from '../components/Breadcrumbs';
import ProgressVisualsToggle from '../components/ProgressVisualsToggle';
import { getCourseCountsBatch, listCategories, listCourses } from '../services/catalog';
import { useAuth } from '../context/AuthContext';
import { getUserCompletedTopicsByCourse } from '../services/progress';
import useShowProgressVisuals from '../lib/useShowProgressVisuals';
import './CategoriesFlow.css';

export default function CategoryCoursesPage() {
  const { categoryId } = useParams();
  const id = String(categoryId ?? '').trim();

  const { user, isSupabaseConfigured } = useAuth();
  const showProgressVisuals = useShowProgressVisuals();

  const [category, setCategory] = useState(null);
  const [courses, setCourses] = useState([]);
  const [countsByCourseId, setCountsByCourseId] = useState(() => new Map());
  const [completedByCourseId, setCompletedByCourseId] = useState(() => new Map());
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
        if (cancelled) return;
        const courseIds = rows.map((c) => String(c?.id ?? '').trim()).filter(Boolean);
        const next = await getCourseCountsBatch({ courseIds });
        if (!cancelled) setCountsByCourseId(next);
      } catch {
        // Non-fatal; keep page usable.
      }
    }

    loadCounts();
    return () => {
      cancelled = true;
    };
  }, [courses]);

  useEffect(() => {
    let cancelled = false;

    async function loadCourseProgress() {
      const rows = Array.isArray(courses) ? courses : [];
      if (!showProgressVisuals) {
        setCompletedByCourseId(new Map());
        return;
      }
      if (!isSupabaseConfigured || !user || rows.length === 0) {
        setCompletedByCourseId(new Map());
        return;
      }

      try {
        const courseIds = rows.map((c) => String(c?.id ?? '').trim()).filter(Boolean);
        if (cancelled) return;
        const next = await getUserCompletedTopicsByCourse({ courseIds });
        if (!cancelled) setCompletedByCourseId(next);
      } catch {
        if (!cancelled) setCompletedByCourseId(new Map());
      }
    }

    loadCourseProgress();
    return () => {
      cancelled = true;
    };
  }, [showProgressVisuals, courses, isSupabaseConfigured, user]);

  const title = useMemo(() => String(category?.title ?? 'Category'), [category]);
  const description = useMemo(() => String(category?.description ?? ''), [category]);

  const guidance = useMemo(() => {
    if (description) return `${description} Pick a course to see its chapters.`;
    if (!id) return 'Pick a course to see its chapters.';
    return `Pick a course in ${title} to see its chapters.`;
  }, [description, id, title]);

  const visibleCourses = useMemo(() => (Array.isArray(courses) ? courses : []), [courses]);

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

          <div className="catflow-toolbarBare" role="region" aria-label="Course toolbar">
            <div className="catflow-controlsRow">
              <ProgressVisualsToggle />
            </div>
          </div>
        </div>

        {loading && <p className="catflow-empty">Loading…</p>}
        {error && <p className="catflow-error">{error}</p>}

        {!loading && !error && (
          <div className="catflow-grid" aria-label="Courses">
            {visibleCourses.map((c) => {
              const courseId = String(c?.id ?? '').trim();
              const courseTitle = String(c?.title ?? 'Untitled course');
              const borderColor = c?.color ? String(c.color) : null;
              const counts = countsByCourseId.get(courseId) ?? null;
              const chapters = counts?.chapters;
              const topics = counts?.topics;

              const totalTopics = Number.isFinite(Number(topics)) ? Number(topics) : null;
              const completedTopics = completedByCourseId.get(courseId) ?? 0;
              const pct = totalTopics && totalTopics > 0
                ? Math.max(0, Math.min(100, Math.round((completedTopics / totalTopics) * 100)))
                : 0;

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

                  {showProgressVisuals && user && totalTopics && totalTopics > 0 && completedTopics > 0 && (
                    <div className="catflow-progress" aria-label="Course progress">
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

            {visibleCourses.length === 0 && <p className="catflow-empty">No courses found.</p>}
          </div>
        )}
      </main>
    </motion.div>
  );
}
