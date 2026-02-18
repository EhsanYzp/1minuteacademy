import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Seo from '../components/Seo';
import { getCourseOutline } from '../services/catalog';
import './CatalogPages.css';

export default function CatalogCoursePage() {
  const { courseId } = useParams();
  const id = String(courseId ?? '').trim();

  const [outline, setOutline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getCourseOutline({ courseId: id });
        if (cancelled) return;
        setOutline(data);
      } catch (e) {
        if (cancelled) return;
        setError(e?.message ?? 'Failed to load course');
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const courseTitle = useMemo(() => String(outline?.course?.title ?? 'Course'), [outline]);
  const courseDesc = useMemo(() => String(outline?.course?.description ?? ''), [outline]);

  return (
    <div className="catalog-page">
      <Seo
        title={`${courseTitle} — Topics`}
        description={courseDesc || 'Browse chapters and topics.'}
        path={`/topics/catalog/course/${encodeURIComponent(id)}`}
        canonicalPath={`/topics/catalog/course/${encodeURIComponent(id)}`}
      />

      <Header />

      <main className="catalog-main">
        <div className="catalog-headerRow">
          <Link className="catalog-back" to="/topics/catalog">
            ← Categories
          </Link>
          <Link className="catalog-back" to="/topics">
            Search
          </Link>
        </div>

        <h1 className="catalog-title">{outline?.course?.emoji ? `${outline.course.emoji} ` : ''}{courseTitle}</h1>
        {courseDesc && <p className="catalog-subtitle">{courseDesc}</p>}

        {loading && <p className="catalog-empty">Loading…</p>}
        {error && <p className="catalog-error">{error}</p>}

        {!loading && !error && (
          <>
            {(outline?.chapters ?? []).map((ch) => {
              const chapterId = String(ch?.id ?? '').trim();
              const chapterTitle = String(ch?.title ?? 'Chapter');
              const chapterDesc = String(ch?.description ?? '');
              const topics = Array.isArray(ch?.topics) ? ch.topics : [];

              return (
                <section key={chapterId} className="catalog-section">
                  <h2 className="catalog-sectionTitle">{chapterTitle}</h2>
                  {chapterDesc && <p className="catalog-subtitle">{chapterDesc}</p>}

                  <div className="catalog-topicList">
                    {topics.map((t) => {
                      const topicId = String(t?.id ?? '').trim();
                      const title = String(t?.title ?? topicId);
                      const desc = String(t?.description ?? '');
                      const emoji = String(t?.emoji ?? '🎯');

                      return (
                        <div key={topicId} className="catalog-topicRow">
                          <div className="catalog-topicMeta">
                            <h3 className="catalog-topicTitle">{emoji} {title}</h3>
                            {desc && <p className="catalog-topicDesc">{desc}</p>}
                          </div>
                          <div className="catalog-topicActions">
                            <Link className="catalog-button" to={`/topic/${encodeURIComponent(topicId)}`}>
                              Details
                            </Link>
                            <Link className="catalog-button primary" to={`/lesson/${encodeURIComponent(topicId)}`}>
                              Start
                            </Link>
                          </div>
                        </div>
                      );
                    })}

                    {topics.length === 0 && <p className="catalog-empty">No topics in this chapter yet.</p>}
                  </div>
                </section>
              );
            })}

            {(outline?.chapters ?? []).length === 0 && (
              <p className="catalog-empty">No chapters yet.</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
