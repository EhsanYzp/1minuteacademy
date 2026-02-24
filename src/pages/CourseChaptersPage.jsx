import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Seo from '../components/Seo';
import Breadcrumbs from '../components/Breadcrumbs';
import { getCourse, listCategories, listChapters, listTopicsForCourse } from '../services/catalog';
import { useAuth } from '../context/AuthContext';
import { getContentSource } from '../services/_contentSource';
import { listUserTopicProgressForCourse } from '../services/progress';
import useShowProgressVisuals from '../lib/useShowProgressVisuals';
import './CategoriesFlow.css';

function norm(s) {
  return String(s ?? '').trim();
}

export default function CourseChaptersPage() {
  const { categoryId, courseId } = useParams();
  const category = norm(categoryId);
  const course = norm(courseId);

  const { user, isSupabaseConfigured } = useAuth();
  const contentSource = getContentSource();
  const showProgressVisuals = useShowProgressVisuals();

  const [categoryRow, setCategoryRow] = useState(null);
  const [courseRow, setCourseRow] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [topics, setTopics] = useState([]);
  const [completedIds, setCompletedIds] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadProgress() {
      if (!showProgressVisuals) {
        setCompletedIds(new Set());
        return;
      }

      if (contentSource !== 'local') {
        if (!isSupabaseConfigured || !user) {
          setCompletedIds(new Set());
          return;
        }
      }

      try {
        const rows = await listUserTopicProgressForCourse({ courseId: course });
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

    if (course) loadProgress();
    return () => {
      mounted = false;
    };
  }, [showProgressVisuals, contentSource, isSupabaseConfigured, user, course]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [cats, courseData, chapterRows, topicRows] = await Promise.all([
          listCategories(),
          getCourse(course),
          listChapters({ courseId: course }),
          listTopicsForCourse({ courseId: course }),
        ]);
        if (cancelled) return;
        const catRow = (Array.isArray(cats) ? cats : []).find((c) => String(c?.id ?? '') === category) ?? null;
        setCategoryRow(catRow);
        setCourseRow(courseData);
        setChapters(Array.isArray(chapterRows) ? chapterRows : []);
        setTopics(Array.isArray(topicRows) ? topicRows : []);
      } catch (e) {
        if (cancelled) return;
        setError(e?.message ?? 'Failed to load course');
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    if (course) load();
    return () => {
      cancelled = true;
    };
  }, [category, course]);

  const courseTitle = useMemo(() => String(courseRow?.title ?? 'Course'), [courseRow]);

  const topicsByChapter = useMemo(() => {
    const m = new Map();
    let unassigned = 0;

    for (const t of Array.isArray(topics) ? topics : []) {
      const ch = norm(t?.chapter_id ?? t?.chapterId);
      if (!ch) {
        unassigned += 1;
        continue;
      }
      if (!m.has(ch)) m.set(ch, []);
      m.get(ch).push(t);
    }

    return { byChapter: m, unassigned };
  }, [topics]);

  const progressByChapter = useMemo(() => {
    const out = new Map();
    for (const t of Array.isArray(topics) ? topics : []) {
      const topicId = norm(t?.id);
      const chapterId = norm(t?.chapter_id ?? t?.chapterId);
      if (!topicId || !chapterId) continue;
      if (!completedIds?.has?.(topicId)) continue;
      out.set(chapterId, (out.get(chapterId) ?? 0) + 1);
    }
    return out;
  }, [topics, completedIds]);

  const courseProgress = useMemo(() => {
    const total = (Array.isArray(topics) ? topics : []).length;
    if (!total) return { completed: 0, total: 0, pct: 0 };
    let completed = 0;
    for (const t of Array.isArray(topics) ? topics : []) {
      const topicId = norm(t?.id);
      if (topicId && completedIds?.has?.(topicId)) completed += 1;
    }
    const pct = Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
    return { completed, total, pct };
  }, [topics, completedIds]);

  const visibleChapters = useMemo(() => {
    const q = String(query ?? '').trim().toLowerCase();
    const rows = Array.isArray(chapters) ? chapters : [];
    if (!q) return rows;
    return rows.filter((ch) => {
      const hay = `${ch?.title ?? ''} ${ch?.description ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [chapters, query]);

  const categoryTitle = String(categoryRow?.title ?? category);

  return (
    <motion.div className="catflow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Seo
        title={`${courseTitle} — Chapters`}
        description="Browse chapters and topics."
        path={`/categories/${encodeURIComponent(category)}/courses/${encodeURIComponent(course)}`}
        canonicalPath={`/categories/${encodeURIComponent(category)}/courses/${encodeURIComponent(course)}`}
      />
      <Header />

      <main className="catflow-main">
        <div className="catflow-hero">
          <Link className="catflow-back" to={`/categories/${encodeURIComponent(category)}`}>← Courses</Link>
          <Breadcrumbs
            items={[
              { label: 'Categories', to: '/categories' },
              { label: categoryTitle || 'Category', to: `/categories/${encodeURIComponent(category)}` },
              { label: courseTitle, to: `/categories/${encodeURIComponent(category)}/courses/${encodeURIComponent(course)}` },
            ]}
          />
          <h1>{courseTitle}</h1>
          {courseRow?.description ? <p>{String(courseRow.description)}</p> : <p>Pick a chapter to see its topics.</p>}

          {showProgressVisuals && user && courseProgress.total > 0 && (
            <div className="catflow-progress" aria-label="Course progress">
              <div className="catflow-progressTop">
                <span>
                  Completed <strong>{courseProgress.completed}</strong> of <strong>{courseProgress.total}</strong> topics
                </span>
                <span><strong>{courseProgress.pct}%</strong></span>
              </div>
              <div className="catflow-progressTrack">
                <div className="catflow-progressFill" style={{ '--progress-pct': `${courseProgress.pct}%` }} />
              </div>
            </div>
          )}

          <div className="catflow-toolbar" role="region" aria-label="Chapter search">
            <label className="catflow-search">
              <span aria-hidden="true">🔎</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chapters"
                aria-label="Search chapters"
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
          <>
            <h2 className="catflow-sectionTitle">Chapters</h2>
            <div className="catflow-grid" aria-label="Chapters">
              {visibleChapters.map((ch) => {
                const chapterId = norm(ch?.id);
                const title = String(ch?.title ?? 'Chapter');
                const desc = String(ch?.description ?? '');
                const count = (topicsByChapter.byChapter.get(chapterId) ?? []).length;
                const completed = progressByChapter.get(chapterId) ?? 0;
                const pct = count > 0 ? Math.max(0, Math.min(100, Math.round((completed / count) * 100))) : 0;

                return (
                  <Link
                    key={chapterId}
                    to={`/categories/${encodeURIComponent(category)}/courses/${encodeURIComponent(course)}/chapters/${encodeURIComponent(chapterId)}`}
                    className="catflow-card"
                  >
                    <div className="catflow-cardTop">
                      <h3 className="catflow-cardTitle catflow-cardTitleTop">{title}</h3>
                      <div className="catflow-badge">{count} topics</div>
                    </div>
                    <p className="catflow-cardDesc">{desc}</p>

                    {showProgressVisuals && user && count > 0 && (
                      <div className="catflow-progress" aria-label="Chapter progress">
                        <div className="catflow-progressTop">
                          <span>
                            <strong>{completed}</strong> / <strong>{count}</strong> topics
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

              {visibleChapters.length === 0 && <p className="catflow-empty">No chapters found.</p>}
            </div>

            {topicsByChapter.unassigned > 0 && (
              <p className="catflow-empty">
                {topicsByChapter.unassigned} topic(s) in this course are not assigned to a chapter yet.
              </p>
            )}
          </>
        )}
      </main>
    </motion.div>
  );
}
