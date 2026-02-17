import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Seo from '../components/Seo';
import RouteLoading from '../components/RouteLoading';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

function safeFromPath(raw) {
  if (!raw || typeof raw !== 'string') return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  return raw
    .split('#')[0]
    .replace(/\s/g, '')
    .slice(0, 1024);
}

export default function AuthCallbackPage() {
  const { user, loading, reloadUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [error, setError] = useState(null);

  const fromPath = useMemo(() => {
    const qs = new URLSearchParams(location.search);
    return safeFromPath(qs.get('from')) ?? '/learn';
  }, [location.search]);

  useEffect(() => {
    let cancelled = false;

    async function finalize() {
      try {
        // Supabase with detectSessionInUrl=true will parse the URL on load.
        // Calling reloadUser ensures AuthContext updates even if the listener lags.
        await reloadUser();
      } catch (e) {
        if (!cancelled) setError(e);
      }
    }

    finalize();

    return () => {
      cancelled = true;
    };
  }, [reloadUser]);

  useEffect(() => {
    if (loading) return;
    if (user) navigate(fromPath, { replace: true });
  }, [user, loading, navigate, fromPath]);

  return (
    <motion.div className="login-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Seo title="Auth callback" description="Completing authentication." path="/auth/callback" canonicalPath="/auth/callback" noindex />
      <Header />

      <main className="login-main">
        <motion.div className="login-card" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <div className="login-title">
            <div className="login-emoji">🔐</div>
            <h1>Signing you in…</h1>
            <p>Finishing authentication. You’ll be redirected automatically.</p>
          </div>

          {(loading || (!user && !error)) && <RouteLoading />}

          {error && <div className="login-error">{String(error?.message ?? error)}</div>}

          {!loading && !user && !error && (
            <div className="login-info">
              No active session found yet. If you came from an OAuth provider, try again.
            </div>
          )}

          <div className="login-footer">
            <Link to="/login">Go to login</Link>
          </div>
        </motion.div>
      </main>
    </motion.div>
  );
}
