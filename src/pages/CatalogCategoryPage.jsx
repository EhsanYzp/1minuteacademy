import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Seo from '../components/Seo';
import { listCategories, listCourses } from '../services/catalog';
import './CatalogPages.css';

export default function CatalogCategoryPage() {
  const { categoryId } = useParams();
  const id = String(categoryId ?? '').trim();

  const [category, setCategory] = useState(null);
  const [courses, setCourses] = useState([]);
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
        setCourses(Array.isArray(rows) ? rows : []);
        const found = (Array.isArray(cats) ? cats : []).find((c) => String(c?.id ?? '') === id) ?? null;
        setCategory(found);
      } catch (e) {
        if (cancelled) return;
        setError(e?.message ?? 'Failed to load category');
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

  const title = useMemo(() => String(category?.title ?? 'Category'), [category]);
  const description = useMemo(() => String(category?.description ?? ''), [category]);

  return (
    <div className="catalog-page">
      <Seo
        title={`${title} — Topics`}
        description={description || 'Browse courses in this category.'}
        path={`/topics/catalog/category/${encodeURIComponent(id)}`}
        canonicalPath={`/topics/catalog/category/${encodeURIComponent(id)}`}
      />

      <Header />

      <main className="catalog-main">
        <div className="catalog-headerRow">
          <Link className="catalog-back" to="/topics/catalog">
            ← Back
          </Link>
          <Link className="catalog-back" to="/topics">
            Search
          </Link>
        </div>

        <h1 className="catalog-title">{category?.emoji ? `${category.emoji} ` : ''}{title}</h1>
        {description && <p className="catalog-subtitle">{description}</p>}

        {loading && <p className="catalog-empty">Loading…</p>}
        {error && <p className="catalog-error">{error}</p>}

        {!loading && !error && (
          <div className="catalog-grid">
            {courses.map((c) => {
              const courseId = String(c?.id ?? '').trim();
              const courseTitle = String(c?.title ?? 'Untitled course');
              const emoji = String(c?.emoji ?? '📘');
              const desc = String(c?.description ?? '');
              const borderColor = c?.color ? String(c.color) : null;

              return (
                <Link
                  key={courseId}
                  to={`/topics/catalog/course/${encodeURIComponent(courseId)}`}
                  className="catalog-card"
                  style={borderColor ? { borderColor } : undefined}
                >
                  <div className="catalog-cardTop">
                    <div className="catalog-emoji">{emoji}</div>
                    <div className="catalog-badge">Course</div>
                  </div>
                  <h2 className="catalog-cardTitle">{courseTitle}</h2>
                  <p className="catalog-cardDesc">{desc}</p>
                </Link>
              );
            })}

            {courses.length === 0 && <p className="catalog-empty">No courses yet.</p>}
          </div>
        )}
      </main>
    </div>
  );
}
