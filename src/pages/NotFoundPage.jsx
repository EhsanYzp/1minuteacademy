import { Link, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import Seo from '../components/Seo';
import { toAbsoluteUrl } from '../services/seo';

export default function NotFoundPage() {
  const location = useLocation();
  const path = `${location.pathname || ''}${location.search || ''}${location.hash || ''}`;

  return (
    <>
      <Seo
        title="Page not found"
        description="This page does not exist."
        canonical={toAbsoluteUrl('/404')}
        noindex
      />
      <Header />

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '36px 20px' }}>
        <h1 style={{ margin: '0 0 8px' }}>404 — Page not found</h1>
        <p style={{ margin: '0 0 20px', color: 'rgba(0,0,0,0.72)' }}>
          The page <strong>{path || '/'}</strong> doesn’t exist.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 14px',
              borderRadius: 12,
              background: 'var(--color-primary, #3b82f6)',
              color: 'white',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            Go to Home
          </Link>
          <Link
            to="/topics"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 14px',
              borderRadius: 12,
              background: 'white',
              border: '1px solid rgba(0,0,0,0.14)',
              color: 'inherit',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            Browse topics
          </Link>
        </div>
      </main>
    </>
  );
}
