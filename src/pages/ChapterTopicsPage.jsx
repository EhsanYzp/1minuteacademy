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
import { getCurrentTier, getTopicGate } from '../services/entitlements';
import './CategoriesFlow.css';

function norm(s) {
  return String(s ?? '').trim();
}

export default function ChapterTopicsPage() {
  const { categoryId, courseId, chapterId } = useParams();
  const category = norm(categoryId);
  const course = norm(courseId);
  const chapter = norm(chapterId);

  const { user, isSupabaseConfigured } = useAuth();
  const tier = getCurrentTier(user);
  const contentSource = getContentSource();

  const [categoryRow, setCategoryRow] = useState(null);
  const [courseRow, setCourseRow] = useState(null);
  const [chapterRow, setChapterRow] = useState(null);
  const [topics, setTopics] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all'); // all | completed | new
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
    let rows = (Array.isArray(topics) ? topics : [])
      .map((t) => ({
        ...t,
        completed: Boolean(t?.id && completedIds?.has?.(t.id)),
      }));

    if (statusFilter === 'completed') rows = rows.filter((t) => t.completed);
    if (statusFilter === 'new') rows = rows.filter((t) => !t.completed);

    rows.sort((a, b) => {
      // Watched first, then alphabetical (same as old /topics behavior)
      const ac = a.completed ? 1 : 0;
      const bc = b.completed ? 1 : 0;
      if (ac !== bc) return bc - ac;
      return String(a?.title ?? '').localeCompare(String(b?.title ?? ''));
    });

    return rows;
  }, [topics, completedIds, statusFilter]);

  function resetFilters() {
    setStatusFilter('all');
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

          <div className="catflow-titleRow">
            <h1>{chapterTitle}</h1>
          </div>
          {chapterRow?.description ? <p>{String(chapterRow.description)}</p> : <p>Pick a topic to start.</p>}

          <div className="catflow-metaRow" aria-label="Topic status and filters">
            <div className="catflow-toolbarSub">
              Showing <strong>{visibleTopics.length}</strong> topic(s)
              {contentSource === 'local' ? ' (Local Preview)' : user ? '' : ' (sign in to track watched)'}
            </div>

            <div className="catflow-toolbarBare" role="region" aria-label="Topic filters">
              <div className="catflow-controlsRow">
                <label className="catflow-filterInline">
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
          </div>
        </div>

        {loading && <p className="catflow-empty">Loading…</p>}
        {error && <p className="catflow-error">{error}</p>}

        {!loading && !error && (
          <div className="catflow-list" aria-label="Topics">
            {visibleTopics.map((t) => {
              const id = norm(t?.id);
              const title = String(t?.title ?? id);
              const completed = Boolean(t?.completed);
              const accent = t?.color ? String(t.color) : '';
              const topicGate = getTopicGate({ tier, topicRow: t });
              const canStart = !topicGate?.locked;

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
                  </div>

                  <div className="catflow-actions">
                    <Link className="catflow-button" to={`${chapterBasePath}/topic/${encodeURIComponent(id)}`} state={fromChapterState}>Details</Link>
                    {canStart ? (
                      <Link className="catflow-button primary" to={`${chapterBasePath}/lesson/${encodeURIComponent(id)}`} state={fromChapterState}>Start</Link>
                    ) : topicGate?.reason === 'paused' ? (
                      <Link
                        className="catflow-button primary locked"
                        to="/me"
                        state={fromChapterState}
                        title="Your account is paused. Resume it to start lessons."
                      >
                        Account paused
                      </Link>
                    ) : (
                      <Link
                        className="catflow-button primary locked"
                        to="/upgrade"
                        state={{
                          ...fromChapterState,
                          upgradeIntent: {
                            kind: 'topic',
                            topicId: id,
                            from: chapterBasePath,
                          },
                        }}
                        title="Upgrade to Pro to unlock this lesson"
                      >
                        🔒 Pro only
                      </Link>
                    )}
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
