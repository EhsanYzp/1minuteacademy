import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Seo from '../components/Seo';
import { listCategories, listCourses } from '../services/catalog';
import './CatalogPages.css';

export default function CatalogCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [courses, setCourses] = useState([]);
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
        setError(e?.message ?? 'Failed to load catalog');
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

  const courseCountsByCategory = useMemo(() => {
    const m = new Map();
    for (const c of courses) {
      const categoryId = String(c?.category_id ?? c?.categoryId ?? '').trim();
      if (!categoryId) continue;
      m.set(categoryId, (m.get(categoryId) ?? 0) + 1);
    }
    return m;
  }, [courses]);

  return (
    <div className="catalog-page">
      <Seo
        title="Topics"
        description="Explore categories and courses."
        path="/topics"
        canonicalPath="/topics"
      />

      <Header />

      <main className="catalog-main">
        <div className="catalog-headerRow">
          <div>
            <h1 className="catalog-title">Explore</h1>
            <p className="catalog-subtitle">Choose a category, then a course, then a chapter.</p>
          </div>
          <Link className="catalog-back" to="search">
            Search topics
          </Link>
        </div>

        {loading && <p className="catalog-empty">Loading…</p>}
        {error && <p className="catalog-error">{error}</p>}

        {!loading && !error && (
          <div className="catalog-grid">
            {categories.map((cat) => {
              const id = String(cat?.id ?? '').trim();
              const title = String(cat?.title ?? 'Untitled');
              const emoji = String(cat?.emoji ?? '📚');
              const description = String(cat?.description ?? '');
              const badge = `${courseCountsByCategory.get(id) ?? 0} courses`;
              const borderColor = cat?.color ? String(cat.color) : null;

              return (
                <Link
                  key={id}
                  to={`category/${encodeURIComponent(id)}`}
                  className="catalog-card"
                  style={borderColor ? { borderColor } : undefined}
                >
                  <div className="catalog-cardTop">
                    <div className="catalog-emoji">{emoji}</div>
                    <div className="catalog-badge">{badge}</div>
                  </div>
                  <h2 className="catalog-cardTitle">{title}</h2>
                  <p className="catalog-cardDesc">{description}</p>
                </Link>
              );
            })}

            {categories.length === 0 && <p className="catalog-empty">No categories yet.</p>}
          </div>
        )}
      </main>
    </div>
  );
}
