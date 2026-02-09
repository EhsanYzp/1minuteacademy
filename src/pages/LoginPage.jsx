import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaGithub } from 'react-icons/fa6';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

function GoogleGIcon(props) {
  return (
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.12 0 5.93 1.08 8.15 2.9l6.05-6.05C34.7 3.28 29.68 1 24 1 14.62 1 6.53 6.38 2.64 14.2l7.3 5.66C11.72 14.26 17.4 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.66-.15-3.25-.43-4.8H24v9.1h12.65c-.55 2.94-2.2 5.43-4.68 7.1l7.17 5.56c4.2-3.88 6.36-9.6 6.36-16.96z"
      />
      <path
        fill="#FBBC05"
        d="M9.94 28.55a14.5 14.5 0 0 1-.76-4.55c0-1.6.28-3.14.76-4.55l-7.3-5.66A23.09 23.09 0 0 0 1 24c0 3.73.9 7.26 2.64 10.21l7.3-5.66z"
      />
      <path
        fill="#34A853"
        d="M24 47c5.68 0 10.45-1.88 13.93-5.09l-7.17-5.56c-2 1.35-4.56 2.15-6.76 2.15-6.6 0-12.28-4.76-14.06-10.85l-7.3 5.66C6.53 41.62 14.62 47 24 47z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const { signInWithPassword, signUpWithPassword, signInWithOAuth, requestPasswordReset, authError, isSupabaseConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const fromPath = useMemo(() => location.state?.from?.pathname ?? '/topics', [location.state]);

  const [mode, setMode] = useState('signin'); // signin | signup | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(null);

  async function onOAuth(provider) {
    setBusy(true);
    setInfo(null);
    try {
      const redirectTo = `${window.location.origin}/auth/callback?from=${encodeURIComponent(fromPath)}`;
      const options = provider === 'github' ? { scopes: 'read:user user:email' } : undefined;
      await signInWithOAuth(provider, redirectTo, options);
      // Supabase will redirect to the provider; callback returns to /auth/callback.
    } catch {
      // handled by context
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setInfo(null);

    try {
      if (mode === 'signup') {
        await signUpWithPassword(email, password);
        setInfo('Check your inbox to verify your email (if enabled). Then sign in.');
      } else if (mode === 'forgot') {
        const redirectTo = `${window.location.origin}/auth/reset?from=${encodeURIComponent(fromPath)}`;
        await requestPasswordReset(email, redirectTo);
        setInfo("If an account exists for that email, you'll receive a reset link shortly.");
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
            <button
              className={mode === 'signin' || mode === 'forgot' ? 'active' : ''}
              onClick={() => {
                setMode('signin');
                setInfo(null);
              }}
              type="button"
            >
              Sign In
            </button>
            <button
              className={mode === 'signup' ? 'active' : ''}
              onClick={() => {
                setMode('signup');
                setInfo(null);
              }}
              type="button"
            >
              Sign Up
            </button>
          </div>

          {mode !== 'forgot' && (
            <div className="login-social" aria-label="Social sign-in">
              <div className="login-social-label">Or continue with</div>
              <div className="login-social-buttons">
                <button type="button" className="login-social-btn login-social-btn--google" onClick={() => onOAuth('google')} disabled={busy || !isSupabaseConfigured}>
                  <span className="login-social-icon" aria-hidden="true">
                    <GoogleGIcon />
                  </span>
                  <span className="login-social-text">Google</span>
                </button>
                <button type="button" className="login-social-btn login-social-btn--github" onClick={() => onOAuth('github')} disabled={busy || !isSupabaseConfigured}>
                  <span className="login-social-icon" aria-hidden="true">
                    <FaGithub />
                  </span>
                  <span className="login-social-text">GitHub</span>
                </button>
              </div>
            </div>
          )}

          <form className="login-form" onSubmit={onSubmit}>
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@cool.com" required />
            </label>

            {mode !== 'forgot' && (
              <label>
                Password
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" required minLength={6} />
              </label>
            )}

            {mode === 'signin' && (
              <button
                type="button"
                className="login-forgot"
                onClick={() => {
                  setMode('forgot');
                  setPassword('');
                  setInfo(null);
                }}
              >
                Forgot password?
              </button>
            )}

            {mode === 'forgot' && (
              <div className="login-info">
                Enter your email and we’ll send a reset link.
              </div>
            )}

            {authError && <div className="login-error">{authError.message}</div>}
            {info && <div className="login-info">{info}</div>}

            <motion.button
              className="login-submit"
              type="submit"
              disabled={busy || !isSupabaseConfigured}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {busy ? 'Working…' : mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Send reset email' : 'Sign In'}
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
