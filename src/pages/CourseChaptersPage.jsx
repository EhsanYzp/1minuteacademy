import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Seo from '../components/Seo';
import Breadcrumbs from '../components/Breadcrumbs';
import { getCourse, listCategories, listChapters, listTopicsForCourse } from '../services/catalog';
import './CategoriesFlow.css';

function norm(s) {
  return String(s ?? '').trim();
}

export default function CourseChaptersPage() {
  const { categoryId, courseId } = useParams();
  const category = norm(categoryId);
  const course = norm(courseId);

  const [categoryRow, setCategoryRow] = useState(null);
  const [courseRow, setCourseRow] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [topics, setTopics] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          <h1>{courseRow?.emoji ? `${courseRow.emoji} ` : ''}{courseTitle}</h1>
          {courseRow?.description ? <p>{String(courseRow.description)}</p> : <p>Pick a chapter to see its topics.</p>}

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

                return (
                  <Link
                    key={chapterId}
                    to={`/categories/${encodeURIComponent(category)}/courses/${encodeURIComponent(course)}/chapters/${encodeURIComponent(chapterId)}`}
                    className="catflow-card"
                  >
                    <div className="catflow-cardTop">
                      <div className="catflow-emoji">📖</div>
                      <div className="catflow-badge">{count} topics</div>
                    </div>
                    <h3 className="catflow-cardTitle">{title}</h3>
                    <p className="catflow-cardDesc">{desc}</p>
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
