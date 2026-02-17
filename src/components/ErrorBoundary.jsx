import React from 'react';

function isChunkLoadError(error) {
  const message = String(error?.message || error || '');
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /ChunkLoadError/i.test(message)
  );
}

function ErrorFallback({ error }) {
  const isDev = (import.meta?.env?.DEV ?? false) === true;
  const chunkLoadFailed = isChunkLoadError(error);

  return (
    <div style={{
      minHeight: '60vh',
      display: 'grid',
      placeItems: 'center',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '720px',
        background: 'rgba(255,255,255,0.9)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
      }}>
        <h1 style={{ margin: '0 0 8px', fontSize: '20px' }}>
          {chunkLoadFailed ? 'Update needed' : 'Something went wrong'}
        </h1>
        <p style={{ margin: '0 0 16px', color: 'rgba(0,0,0,0.72)' }}>
          {chunkLoadFailed
            ? 'A new version was likely deployed while your tab was open. Reload to update and continue.'
            : 'Try reloading the page. If this keeps happening, please contact support.'}
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 14px',
              borderRadius: '12px',
              background: 'var(--color-primary, #3b82f6)',
              color: 'white',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Go to Home
          </a>

          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 14px',
              borderRadius: '12px',
              background: 'white',
              border: '1px solid rgba(0,0,0,0.14)',
              fontWeight: 600,
            }}
          >
            {chunkLoadFailed ? 'Reload to update' : 'Reload'}
          </button>
        </div>

        {isDev && error ? (
          <pre style={{
            marginTop: '16px',
            padding: '12px',
            borderRadius: '12px',
            background: 'rgba(0,0,0,0.06)',
            overflowX: 'auto',
            fontSize: '12px',
            lineHeight: 1.4,
          }}>
            {String(error?.stack || error?.message || error)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Keep details out of the UI; log for debugging/monitoring.
    console.error('ui:error-boundary', error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      const fallback = this.props.fallback;
      if (typeof fallback === 'function') return fallback({ error: this.state.error });
      if (fallback) return fallback;
      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}
