import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Seo from '../components/Seo';
import ProgressVisualsToggle from '../components/ProgressVisualsToggle';
import {
  getCategoryCourseCounts,
  getCategoryTopicCounts,
  listAllChapters,
  listCategories,
  listCourses,
} from '../services/catalog';
import { useAuth } from '../context/AuthContext';
import { getUserCompletedTopicsByCategory } from '../services/progress';
import { getCurrentTier, getTopicGate } from '../services/entitlements';
import useShowProgressVisuals from '../lib/useShowProgressVisuals';
import './CategoriesFlow.css';

function tokenizeQuery(q) {
  return String(q ?? '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function matchesAllTokens(haystack, tokens) {
  if (!tokens || tokens.length === 0) return false;
  const hay = String(haystack ?? '').toLowerCase();
  for (const t of tokens) {
    if (!hay.includes(t)) return false;
  }
  return true;
}

/* Highlight exact search tokens inside a text string. */
function HighlightTokens({ text, tokens }) {
  if (!tokens || tokens.length === 0 || !text) return text ?? null;
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = String(text).split(re);
  if (parts.length <= 1) return text;
  const lower = new Set(tokens.map((t) => t.toLowerCase()));
  return parts.map((p, i) =>
    p && lower.has(p.toLowerCase())
      ? <mark key={i} className="catflow-highlight">{p}</mark>
      : p,
  );
}

/**
 * Turn a raw chapter slug like "business--behavioral-economics--ch05-markets-and-irrationality"
 * into a readable label: "Markets and Irrationality".
 */
function humanizeChapterId(raw) {
  const s = String(raw ?? '');
  // Take the last segment after "--"
  const last = s.includes('--') ? s.split('--').pop() : s;
  // Strip leading "chNN-" prefix
  const stripped = last.replace(/^ch\d+-/, '');
  // Replace hyphens with spaces & title-case
  return stripped
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CategoriesPage() {
  const { user, isSupabaseConfigured } = useAuth();
  const tier = getCurrentTier(user);
  const isProUser = tier === 'pro';
  const navigate = useNavigate();
  const showProgressVisuals = useShowProgressVisuals();
  const [categories, setCategories] = useState([]);
  const [courses, setCourses] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [topicsIndex, setTopicsIndex] = useState(null);
  const topicsIndexLoadedRef = useRef(false);
  const [courseCountsByCategoryId, setCourseCountsByCategoryId] = useState(() => new Map());
  const [topicCountsByCategoryId, setTopicCountsByCategoryId] = useState(() => new Map());
  const [completedTopicsByCategoryId, setCompletedTopicsByCategoryId] = useState(() => new Map());
  const [query, setQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [showAll, setShowAll] = useState(() => ({ categories: false, courses: false, chapters: false, topics: false }));
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
      if (!showProgressVisuals) {
        setCompletedTopicsByCategoryId(new Map());
        return;
      }

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
  }, [showProgressVisuals, isSupabaseConfigured, user]);

  const queryTokens = useMemo(() => tokenizeQuery(query), [query]);
  const hasQuery = queryTokens.length > 0;

  useEffect(() => {
    let cancelled = false;

    async function loadSearchData() {
      if (!hasQuery) {
        setSearchLoading(false);
        setSearchError(null);
        setShowAll({ categories: false, courses: false, chapters: false, topics: false });
        return;
      }

      setSearchLoading(true);
      setSearchError(null);

      try {
        const needCourses = !Array.isArray(courses) || courses.length === 0;
        const needChapters = !Array.isArray(chapters) || chapters.length === 0;
        const needTopicsIndex = !topicsIndexLoadedRef.current;

        const [nextCourses, nextChapters, nextTopicsIndex] = await Promise.all([
          needCourses ? listCourses() : Promise.resolve(null),
          needChapters ? listAllChapters() : Promise.resolve(null),
          needTopicsIndex
            ? fetch('/topics.json', { cache: 'force-cache' })
              .then((r) => {
                if (!r.ok) throw new Error('Failed to load topics index');
                return r.json();
              })
              .then((j) => (Array.isArray(j?.topics) ? j.topics : []))
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        if (Array.isArray(nextCourses)) setCourses(nextCourses);
        if (Array.isArray(nextChapters)) setChapters(nextChapters);
        if (Array.isArray(nextTopicsIndex)) {
          topicsIndexLoadedRef.current = true;
          setTopicsIndex(nextTopicsIndex);
        }
      } catch (e) {
        if (!cancelled) setSearchError(e?.message ?? 'Failed to load search data');
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }

    loadSearchData();
    return () => {
      cancelled = true;
    };
  }, [hasQuery, courses, chapters]);

  const categoryTitleById = useMemo(() => {
    const m = new Map();
    for (const c of Array.isArray(categories) ? categories : []) {
      const id = String(c?.id ?? '').trim();
      const title = String(c?.title ?? id).trim();
      if (id) m.set(id, title);
    }
    return m;
  }, [categories]);

  const courseById = useMemo(() => {
    const m = new Map();
    for (const c of Array.isArray(courses) ? courses : []) {
      const id = String(c?.id ?? '').trim();
      if (!id) continue;
      m.set(id, c);
    }
    return m;
  }, [courses]);

  const chapterTitleById = useMemo(() => {
    const m = new Map();
    for (const ch of Array.isArray(chapters) ? chapters : []) {
      const id = String(ch?.id ?? '').trim();
      const title = String(ch?.title ?? id).trim();
      if (id) m.set(id, title);
    }
    return m;
  }, [chapters]);

  const searchResults = useMemo(() => {
    if (!hasQuery) {
      return { categories: [], courses: [], chapters: [], topics: [] };
    }

    const catRows = Array.isArray(categories) ? categories : [];
    const courseRows = Array.isArray(courses) ? courses : [];
    const chapterRows = Array.isArray(chapters) ? chapters : [];
    const topicRows = Array.isArray(topicsIndex) ? topicsIndex : [];

    const categoriesMatched = catRows.filter((cat) => {
      const hay = `${cat?.title ?? ''} ${cat?.description ?? ''}`;
      return matchesAllTokens(hay, queryTokens);
    });

    const coursesMatched = courseRows.filter((c) => {
      const hay = `${c?.title ?? ''} ${c?.description ?? ''}`;
      return matchesAllTokens(hay, queryTokens);
    });

    const chaptersMatched = chapterRows.filter((ch) => {
      const hay = `${ch?.title ?? ''} ${ch?.description ?? ''}`;
      return matchesAllTokens(hay, queryTokens);
    });

    const topicsMatched = topicRows.filter((t) => {
      const hay = `${t?.title ?? ''} ${t?.description ?? ''} ${t?.subject ?? ''} ${t?.subcategory ?? ''}`;
      return matchesAllTokens(hay, queryTokens);
    });

    return {
      categories: categoriesMatched,
      courses: coursesMatched,
      chapters: chaptersMatched,
      topics: topicsMatched,
    };
  }, [hasQuery, categories, courses, chapters, topicsIndex, queryTokens]);

  const SEARCH_LIMIT = 24;
  const limitedResults = useMemo(() => {
    const limit = (items, key) => {
      if (showAll?.[key]) return items;
      return items.slice(0, SEARCH_LIMIT);
    };

    return {
      categories: limit(searchResults.categories, 'categories'),
      courses: limit(searchResults.courses, 'courses'),
      chapters: limit(searchResults.chapters, 'chapters'),
      topics: limit(searchResults.topics, 'topics'),
    };
  }, [searchResults, showAll]);

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
          <p>Search across categories, courses, chapters, and topics.</p>

          <div className="catflow-toolbar" role="region" aria-label="Global search">
            <div className="catflow-toolbarRow">
              <label className="catflow-search" style={{ flex: '1 1 260px' }}>
                <span aria-hidden="true">🔎</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search everything (e.g., sleep, nutrition, confidence…)"
                  aria-label="Search"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                    ✕
                  </button>
                )}
              </label>

              <ProgressVisualsToggle />
            </div>
          </div>
        </div>

        {loading && <p className="catflow-empty">Loading…</p>}
        {error && <p className="catflow-error">{error}</p>}

        {!loading && !error && !hasQuery && (
          <div className="catflow-grid" aria-label="Categories">
            {(Array.isArray(categories) ? categories : []).map((cat) => {
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

                  {showProgressVisuals && user && totalTopics > 0 && completedTopics > 0 && (
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
          </div>
        )}

        {!loading && !error && hasQuery && (
          <div aria-label="Search results">
            {searchError && <p className="catflow-error">{searchError}</p>}
            {searchLoading && <p className="catflow-empty">Searching…</p>}

            {!searchLoading && !searchError && (
              <>
                <h2 className="catflow-sectionTitle">
                  Results for “{String(query ?? '').trim()}”
                </h2>

                <h2 className="catflow-sectionTitle">Categories</h2>

                <div className="catflow-grid" aria-label="Category results">
                  {limitedResults.categories.map((cat) => {
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
                          <h3 className="catflow-cardTitle catflow-cardTitleTop"><HighlightTokens text={title} tokens={queryTokens} /></h3>
                        </div>
                        <div className="catflow-metaChips" aria-label="Category metadata">
                          <span className="catflow-metaChip">
                            <span className="catflow-metaChipLabel">Courses</span>
                            <span className="catflow-metaChipValue">{courseCount}</span>
                          </span>
                          <span className="catflow-metaChip">
                            <span className="catflow-metaChipLabel">Topics</span>
                            <span className="catflow-metaChipValue">{totalTopics}</span>
                          </span>
                        </div>

                        {showProgressVisuals && user && totalTopics > 0 && completedTopics > 0 && (
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
                </div>

                {searchResults.categories.length > SEARCH_LIMIT && (
                  <button
                    type="button"
                    className="catflow-reset"
                    onClick={() => setShowAll((p) => ({ ...p, categories: !p.categories }))}
                  >
                    {showAll.categories ? 'Show fewer categories' : `Show all categories (${searchResults.categories.length})`}
                  </button>
                )}

                <h2 className="catflow-sectionTitle">Courses</h2>
                <div className="catflow-grid" aria-label="Course results">
                  {limitedResults.courses.map((c) => {
                    const id = String(c?.id ?? '').trim();
                    const categoryId = String(c?.category_id ?? '').trim();
                    const title = String(c?.title ?? 'Course');
                    const borderColor = c?.color ? String(c.color) : null;
                    const categoryTitle = categoryTitleById.get(categoryId) ?? categoryId;

                    return (
                      <Link
                        key={id}
                        to={`/categories/${encodeURIComponent(categoryId)}/courses/${encodeURIComponent(id)}`}
                        className="catflow-card"
                        style={borderColor ? { '--card-accent': borderColor } : undefined}
                      >
                        <div className="catflow-cardTop">
                          <h3 className="catflow-cardTitle catflow-cardTitleTop"><HighlightTokens text={title} tokens={queryTokens} /></h3>
                        </div>
                        <div className="catflow-metaChips" aria-label="Course metadata">
                          {categoryTitle ? (
                            <span className="catflow-metaChip catflow-metaChip--category">
                              <span className="catflow-metaChipLabel">Category</span>
                              <span className="catflow-metaChipValue">{categoryTitle}</span>
                            </span>
                          ) : null}
                        </div>
                        {c?.description ? <p className="catflow-cardDesc"><HighlightTokens text={String(c.description)} tokens={queryTokens} /></p> : null}
                      </Link>
                    );
                  })}
                </div>

                {searchResults.courses.length > SEARCH_LIMIT && (
                  <button
                    type="button"
                    className="catflow-reset"
                    onClick={() => setShowAll((p) => ({ ...p, courses: !p.courses }))}
                  >
                    {showAll.courses ? 'Show fewer courses' : `Show all courses (${searchResults.courses.length})`}
                  </button>
                )}

                <h2 className="catflow-sectionTitle">Chapters</h2>
                <div className="catflow-grid" aria-label="Chapter results">
                  {limitedResults.chapters.map((ch) => {
                    const chapterId = String(ch?.id ?? '').trim();
                    const courseId = String(ch?.course_id ?? '').trim();
                    const courseRow = courseById.get(courseId) ?? null;
                    const categoryId = String(courseRow?.category_id ?? '').trim();
                    const title = String(ch?.title ?? 'Chapter');
                    const courseTitle = String(courseRow?.title ?? courseId);
                    const categoryTitle = categoryTitleById.get(categoryId) ?? categoryId;

                    if (!courseId || !categoryId) return null;

                    return (
                      <Link
                        key={chapterId}
                        to={`/categories/${encodeURIComponent(categoryId)}/courses/${encodeURIComponent(courseId)}/chapters/${encodeURIComponent(chapterId)}`}
                        className="catflow-card"
                      >
                        <div className="catflow-cardTop">
                          <h3 className="catflow-cardTitle catflow-cardTitleTop"><HighlightTokens text={title} tokens={queryTokens} /></h3>
                        </div>
                        <div className="catflow-metaChips" aria-label="Chapter metadata">
                          {categoryTitle ? (
                            <span className="catflow-metaChip catflow-metaChip--category">
                              <span className="catflow-metaChipLabel">Category</span>
                              <span className="catflow-metaChipValue">{categoryTitle}</span>
                            </span>
                          ) : null}
                          {courseTitle ? (
                            <span className="catflow-metaChip catflow-metaChip--course">
                              <span className="catflow-metaChipLabel">Course</span>
                              <span className="catflow-metaChipValue">{courseTitle}</span>
                            </span>
                          ) : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {searchResults.chapters.length > SEARCH_LIMIT && (
                  <button
                    type="button"
                    className="catflow-reset"
                    onClick={() => setShowAll((p) => ({ ...p, chapters: !p.chapters }))}
                  >
                    {showAll.chapters ? 'Show fewer chapters' : `Show all chapters (${searchResults.chapters.length})`}
                  </button>
                )}

                <h2 className="catflow-sectionTitle">Topics</h2>
                <div className="catflow-resultList" aria-label="Topic results">
                  {limitedResults.topics.map((t) => {
                    const id = String(t?.id ?? '').trim();
                    const title = String(t?.title ?? id);
                    const path = String(t?.path ?? `/topic/${encodeURIComponent(id)}`);
                    const subject = String(t?.subject ?? '').trim();
                    const subcategory = String(t?.subcategory ?? '').trim();
                    const chapterId = String(t?.chapter_id ?? '').trim();
                    const chapterTitle = chapterId
                      ? (chapterTitleById.get(chapterId) ?? humanizeChapterId(chapterId))
                      : '';
                    const isFree = Boolean(t?.is_free);
                    const tierLabel = isFree ? 'Free' : 'Pro';
                    const gate = getTopicGate({ tier, topicRow: t });
                    const startTo = gate?.locked
                      ? (gate.reason === 'paused' ? '/me' : '/upgrade')
                      : `/lesson/${encodeURIComponent(id)}`;

                    return (
                      <div
                        key={id}
                        className="catflow-result catflow-resultClickable"
                        role="link"
                        tabIndex={0}
                        onClick={() => navigate(path)}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(path); }
                        }}
                      >
                        <div className="catflow-resultMain">
                          <h3 className="catflow-resultTitle">
                            <HighlightTokens text={title} tokens={queryTokens} />
                          </h3>

                          {t?.description ? (
                            <p className="catflow-resultDesc">
                              <HighlightTokens text={String(t.description)} tokens={queryTokens} />
                            </p>
                          ) : null}

                          <div className="catflow-metaChips catflow-metaChips--compact" aria-label="Topic metadata">
                            {subject ? (
                              <span className="catflow-metaChip catflow-metaChip--category">
                                <span className="catflow-metaChipLabel">Category</span>
                                <span className="catflow-metaChipValue">{subject}</span>
                              </span>
                            ) : null}
                            {subcategory ? (
                              <span className="catflow-metaChip catflow-metaChip--course">
                                <span className="catflow-metaChipLabel">Course</span>
                                <span className="catflow-metaChipValue">{subcategory}</span>
                              </span>
                            ) : null}
                            {chapterTitle ? (
                              <span className="catflow-metaChip catflow-metaChip--chapter">
                                <span className="catflow-metaChipLabel">Chapter</span>
                                <span className="catflow-metaChipValue">{chapterTitle}</span>
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="catflow-resultSide" aria-label="Actions">
                          {!isProUser && (
                            <span className={isFree ? 'catflow-pill' : 'catflow-pill catflow-pill-locked'}>
                              {tierLabel}
                            </span>
                          )}
                          <Link
                            to={startTo}
                            className={`catflow-button primary catflow-startBtn${gate?.locked ? ' locked' : ''}`}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={gate?.locked ? 'Unlock to start' : 'Start lesson'}
                          >
                            {gate?.locked ? '🔒' : 'Start ▶'}
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {searchResults.topics.length > SEARCH_LIMIT && (
                  <button
                    type="button"
                    className="catflow-reset"
                    onClick={() => setShowAll((p) => ({ ...p, topics: !p.topics }))}
                  >
                    {showAll.topics ? 'Show fewer topics' : `Show all topics (${searchResults.topics.length})`}
                  </button>
                )}

                {searchResults.categories.length === 0
                  && searchResults.courses.length === 0
                  && searchResults.chapters.length === 0
                  && searchResults.topics.length === 0
                  && (
                    <p className="catflow-empty">No results found.</p>
                  )}
              </>
            )}
          </div>
        )}
      </main>
    </motion.div>
  );
}
