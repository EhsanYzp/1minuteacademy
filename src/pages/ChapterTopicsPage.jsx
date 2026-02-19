import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Seo from '../components/Seo';
import Breadcrumbs from '../components/Breadcrumbs';
import { getCourse, listCategories, listChapters, listTopicsForChapter } from '../services/catalog';
import { useAuth } from '../context/AuthContext';
import { getContentSource } from '../services/_contentSource';
import { listUserTopicProgressForChapter } from '../services/progress';
import './CategoriesFlow.css';

const DIFFICULTY_FILTERS = ['all', 'beginner', 'intermediate', 'advanced', 'premium'];

function norm(s) {
  return String(s ?? '').trim();
}

function includesQuery(row, q) {
  if (!q) return true;
  const hay = `${row?.title ?? ''} ${row?.description ?? ''}`.toLowerCase();
  return hay.includes(String(q).toLowerCase());
}

export default function ChapterTopicsPage() {
  const { categoryId, courseId, chapterId } = useParams();
  const category = norm(categoryId);
  const course = norm(courseId);
  const chapter = norm(chapterId);

  const { user, isSupabaseConfigured } = useAuth();
  const contentSource = getContentSource();

  const [categoryRow, setCategoryRow] = useState(null);
  const [courseRow, setCourseRow] = useState(null);
  const [chapterRow, setChapterRow] = useState(null);
  const [topics, setTopics] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | completed | new
  const [difficultyFilter, setDifficultyFilter] = useState('all'); // all | beginner | intermediate | advanced | premium
  const [completedIds, setCompletedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        const rows = await listUserTopicProgressForChapter({ courseId: course, chapterId: chapter });
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
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [cats, courseData, chapterRows, topicRows] = await Promise.all([
          listCategories(),
          getCourse(course),
          listChapters({ courseId: course }),
          listTopicsForChapter({ courseId: course, chapterId: chapter }),
        ]);

        if (cancelled) return;
        const catRow = (Array.isArray(cats) ? cats : []).find((c) => String(c?.id ?? '') === category) ?? null;
        const chRow = (Array.isArray(chapterRows) ? chapterRows : []).find((c) => String(c?.id ?? '') === chapter) ?? null;
        setCategoryRow(catRow);
        setCourseRow(courseData);
        setChapterRow(chRow);
        setTopics(Array.isArray(topicRows) ? topicRows : []);
      } catch (e) {
        if (cancelled) return;
        setError(e?.message ?? 'Failed to load topics');
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    if (course && chapter) load();
    return () => {
      cancelled = true;
    };
  }, [category, course, chapter]);

  const categoryTitle = String(categoryRow?.title ?? category);
  const courseTitle = String(courseRow?.title ?? 'Course');
  const chapterTitle = String(chapterRow?.title ?? 'Chapter');

  const chapterBasePath = `/categories/${encodeURIComponent(category)}/courses/${encodeURIComponent(course)}/chapters/${encodeURIComponent(chapter)}`;

  const fromChapterState = useMemo(
    () => ({
      fromChapter: {
        categoryId: category,
        courseId: course,
        chapterId: chapter,
        categoryTitle,
        courseTitle,
        chapterTitle,
      },
    }),
    [category, course, chapter, categoryTitle, courseTitle, chapterTitle]
  );

  const visibleTopics = useMemo(() => {
    const q = String(query ?? '').trim();
    let rows = (Array.isArray(topics) ? topics : [])
      .map((t) => ({
        ...t,
        completed: Boolean(t?.id && completedIds?.has?.(t.id)),
      }));

    if (q) rows = rows.filter((t) => includesQuery(t, q));

    if (statusFilter === 'completed') rows = rows.filter((t) => t.completed);
    if (statusFilter === 'new') rows = rows.filter((t) => !t.completed);

    if (difficultyFilter !== 'all') {
      const desired = String(difficultyFilter ?? 'all').toLowerCase();
      const safeDesired = DIFFICULTY_FILTERS.includes(desired) ? desired : 'all';
      if (safeDesired !== 'all') {
        rows = rows.filter((t) => String(t?.difficulty ?? 'Beginner').toLowerCase() === safeDesired);
      }
    }

    rows.sort((a, b) => {
      // Watched first, then alphabetical (same as old /topics behavior)
      const ac = a.completed ? 1 : 0;
      const bc = b.completed ? 1 : 0;
      if (ac !== bc) return bc - ac;
      return String(a?.title ?? '').localeCompare(String(b?.title ?? ''));
    });

    return rows;
  }, [topics, query, completedIds, statusFilter, difficultyFilter]);

  function resetFilters() {
    setQuery('');
    setStatusFilter('all');
    setDifficultyFilter('all');
  }

  return (
    <motion.div className="catflow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Seo
        title={`${chapterTitle} — Topics`}
        description="Browse topics in this chapter."
        path={`/categories/${encodeURIComponent(category)}/courses/${encodeURIComponent(course)}/chapters/${encodeURIComponent(chapter)}`}
        canonicalPath={`/categories/${encodeURIComponent(category)}/courses/${encodeURIComponent(course)}/chapters/${encodeURIComponent(chapter)}`}
      />
      <Header />

      <main className="catflow-main">
        <div className="catflow-hero">
          <Link
            className="catflow-back"
            to={`/categories/${encodeURIComponent(category)}/courses/${encodeURIComponent(course)}`}
          >
            ← Chapters
          </Link>

          <Breadcrumbs
            items={[
              { label: 'Categories', to: '/categories' },
              { label: categoryTitle || 'Category', to: `/categories/${encodeURIComponent(category)}` },
              { label: courseTitle, to: `/categories/${encodeURIComponent(category)}/courses/${encodeURIComponent(course)}` },
              { label: chapterTitle, to: `/categories/${encodeURIComponent(category)}/courses/${encodeURIComponent(course)}/chapters/${encodeURIComponent(chapter)}` },
            ]}
          />

          <h1>{chapterTitle}</h1>
          {chapterRow?.description ? <p>{String(chapterRow.description)}</p> : <p>Pick a topic to start.</p>}

          <div className="catflow-toolbar" role="region" aria-label="Topic search">
            <div className="catflow-toolbarStack">
              <label className="catflow-search">
                <span aria-hidden="true">🔎</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search topics in this chapter"
                  aria-label="Search topics"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                    ✕
                  </button>
                )}
              </label>

              <div className="catflow-filtersRow" aria-label="Filters">
                <label className="catflow-filter">
                  <span className="catflow-filterLabel">Difficulty</span>
                  <select
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
                </label>

                <label className="catflow-filter">
                  <span className="catflow-filterLabel">Status</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Status"
                  >
                    <option value="all">All</option>
                    <option value="new">To watch</option>
                    <option value="completed">Watched</option>
                  </select>
                </label>

                <button type="button" className="catflow-reset" onClick={resetFilters}>
                  Reset
                </button>
              </div>
            </div>

            <div className="catflow-toolbarSub">
              Showing <strong>{visibleTopics.length}</strong> topic(s)
              {contentSource === 'local' ? ' (Local Preview)' : user ? '' : ' (sign in to track watched)'}
            </div>
          </div>
        </div>

        {loading && <p className="catflow-empty">Loading…</p>}
        {error && <p className="catflow-error">{error}</p>}

        {!loading && !error && (
          <div className="catflow-list" aria-label="Topics">
            {visibleTopics.map((t) => {
              const id = norm(t?.id);
              const title = String(t?.title ?? id);
              const desc = String(t?.description ?? '');
              const difficulty = String(t?.difficulty ?? '').trim();
              const completed = Boolean(t?.completed);
              const accent = t?.color ? String(t.color) : '';

              return (
                <div
                  key={id}
                  className="catflow-row"
                  style={accent ? { '--row-accent': accent } : undefined}
                >
                  <div className="catflow-rowMeta">
                    <h3 className="catflow-rowTitle">
                      {completed && (
                        <span className="catflow-check" aria-label="Completed" title="Completed">
                          ✓
                        </span>
                      )}
                      <span className="catflow-rowTitleText">{title}</span>
                    </h3>
                    {desc && <p className="catflow-rowDesc">{desc}</p>}
                    <div className="catflow-rowBadges">
                      {difficulty && <span className="catflow-pill">{difficulty}</span>}
                    </div>
                  </div>

                  <div className="catflow-actions">
                    <Link className="catflow-button" to={`${chapterBasePath}/topic/${encodeURIComponent(id)}`} state={fromChapterState}>Details</Link>
                    <Link className="catflow-button primary" to={`${chapterBasePath}/lesson/${encodeURIComponent(id)}`} state={fromChapterState}>Start</Link>
                  </div>
                </div>
              );
            })}

            {visibleTopics.length === 0 && <p className="catflow-empty">No topics found.</p>}
          </div>
        )}
      </main>
    </motion.div>
  );
}
