import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const { signInWithPassword, signUpWithPassword, authError, isSupabaseConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const fromPath = useMemo(() => location.state?.from?.pathname ?? '/topics', [location.state]);

  const [mode, setMode] = useState('signin'); // signin | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setInfo(null);

    try {
      if (mode === 'signup') {
        await signUpWithPassword(email, password);
        setInfo('Check your inbox to verify your email (if enabled). Then sign in.');
      } else {
        await signInWithPassword(email, password);
        navigate(fromPath, { replace: true });
      }
    } catch {
      // handled by context
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
            <div className="login-emoji">🧙‍♂️</div>
            <h1>Welcome back</h1>
            <p>Sign in to track your 1MA minutes (minutes completed), streaks, and progress.</p>
          </div>

          {!isSupabaseConfigured && (
            <div className="login-warning">
              <strong>Supabase isn’t configured yet.</strong>
              <div>Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`).</div>
            </div>
          )}

          <div className="login-modes">
            <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')} type="button">
              Sign In
            </button>
            <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')} type="button">
              Sign Up
            </button>
          </div>

          <form className="login-form" onSubmit={onSubmit}>
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@cool.com" required />
            </label>

            <label>
              Password
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" required minLength={6} />
            </label>

            {authError && <div className="login-error">{authError.message}</div>}
            {info && <div className="login-info">{info}</div>}

            <motion.button
              className="login-submit"
              type="submit"
              disabled={busy || !isSupabaseConfigured}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {busy ? 'Working…' : mode === 'signup' ? 'Create Account' : 'Sign In'}
            </motion.button>
          </form>

          <div className="login-footer">
            <Link to="/topics">← Back to topics</Link>
          </div>
        </motion.div>
      </main>
    </motion.div>
  );
}
