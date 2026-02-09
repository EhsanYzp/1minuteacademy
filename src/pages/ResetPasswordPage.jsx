import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { supabase } from '../lib/supabaseClient';
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

export default function ResetPasswordPage() {
  const { user, loading, reloadUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const fromPath = useMemo(() => {
    const qs = new URLSearchParams(location.search);
    return safeFromPath(qs.get('from')) ?? '/topics';
  }, [location.search]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const canSubmit = Boolean(user) && !loading && !busy;

  useEffect(() => {
    // Ensure any PASSWORD_RECOVERY session in the URL is captured in context.
    reloadUser().catch(() => {});
  }, [reloadUser]);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password.length < 6) {
      setError(new Error('Password must be at least 6 characters.'));
      return;
    }
    if (password !== confirm) {
      setError(new Error('Passwords do not match.'));
      return;
    }

    setBusy(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;
      setInfo('Password updated. Redirecting…');
      navigate(fromPath, { replace: true });
    } catch (e2) {
      setError(e2);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div className="login-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Header />

      <main className="login-main">
        <motion.div className="login-card" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <div className="login-title">
            <div className="login-emoji">🔁</div>
            <h1>Reset your password</h1>
            <p>Set a new password for your account.</p>
          </div>

          {!loading && !user && (
            <div className="login-warning">
              <strong>Reset link is missing or expired.</strong>
              <div>Please request a new password reset email and try again.</div>
            </div>
          )}

          <form className="login-form" onSubmit={onSubmit}>
            <label>
              New password
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" required minLength={6} />
            </label>

            <label>
              Confirm password
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" placeholder="••••••••" required minLength={6} />
            </label>

            {error && <div className="login-error">{String(error?.message ?? error)}</div>}
            {info && <div className="login-info">{info}</div>}

            <motion.button className="login-submit" type="submit" disabled={!canSubmit} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              {busy ? 'Updating…' : loading ? 'Loading…' : 'Update password'}
            </motion.button>
          </form>

          <div className="login-footer">
            <Link to="/login">Back to login</Link>
          </div>
        </motion.div>
      </main>
    </motion.div>
  );
}
