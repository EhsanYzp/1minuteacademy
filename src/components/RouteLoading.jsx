import './RouteLoading.css';

export default function RouteLoading() {
  return (
    <div className="route-loading" role="status" aria-live="polite" aria-label="Loading">
      <div className="route-loading__spinner" aria-hidden="true" />
      <div className="route-loading__text">Loading…</div>
    </div>
  );
}
