import { Link } from 'react-router-dom';
import './Breadcrumbs.css';

export default function Breadcrumbs({ items }) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (safeItems.length === 0) return null;

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol className="breadcrumbs-list">
        {safeItems.map((it, idx) => {
          const label = String(it?.label ?? '').trim() || '…';
          const to = typeof it?.to === 'string' && it.to.trim() ? it.to.trim() : null;
          const isLast = idx === safeItems.length - 1;

          return (
            <li key={`${idx}-${label}`} className="breadcrumbs-item">
              {!isLast && to ? (
                <Link className="breadcrumbs-link" to={to}>
                  {label}
                </Link>
              ) : (
                <span className="breadcrumbs-current" aria-current="page">
                  {label}
                </span>
              )}
              {!isLast && <span className="breadcrumbs-sep" aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
