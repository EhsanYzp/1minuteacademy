import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaGithub } from 'react-icons/fa6';
import Header from '../components/Header';
import Seo from '../components/Seo';
import { useAuth } from '../context/AuthContext';
import PasswordStrengthMeter from '../components/auth/PasswordStrengthMeter';
import { evaluatePasswordStrength, passwordStrengthErrorMessage } from '../lib/passwordStrength';
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
  const { user, rememberMe, setRememberMe, signInWithPassword, signUpWithPassword, resendVerificationEmail, signInWithOAuth, requestPasswordReset, authError, isSupabaseConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const fromPath = useMemo(() => location.state?.from?.pathname ?? '/learn', [location.state]);
  const reason = useMemo(() => location.state?.reason ?? null, [location.state]);
  const isVerified = Boolean(user?.email_confirmed_at || user?.confirmed_at);

  const [mode, setMode] = useState('signin'); // signin | signup | forgot | verify
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(null);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    // If the user is already authenticated but not verified, guide them to verify
    // instead of asking them to sign in again.
    if (user?.email && !isVerified) {
      setMode('verify');
      setEmail((prev) => prev || user.email);
      setPassword('');
      setInfo('Verify your email to unlock your profile and progress tracking.');
      return;
    }

    if (reason === 'verify_email') {
      setMode('signin');
      setPassword('');
      setInfo('Please verify your email to access that page. Check your inbox, or use “Resend verification email”.');
    }

    if (reason === 'session_expired') {
      setMode('signin');
      setPassword('');
      setInfo('Your session expired. Please sign in again.');
    }
  }, [user?.email, isVerified, reason]);

  useEffect(() => {
    setShowPassword(false);
  }, [mode]);

  async function onOAuth(provider) {
    setBusy(true);
    setInfo(null);
    setLocalError(null);
    try {
      await setRememberMe(rememberMe);
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

  async function onResendVerification() {
    if (!email) return;
    setBusy(true);
    setInfo(null);
    setLocalError(null);
    try {
      await resendVerificationEmail(email, `${window.location.origin}/auth/callback`);
      setInfo("Verification email sent. Please check your inbox.");
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
    setLocalError(null);

    try {
      if (mode === 'signup') {
        await setRememberMe(rememberMe);
        const strength = evaluatePasswordStrength(password, { email });
        if (!strength.ok) {
          setLocalError(new Error(passwordStrengthErrorMessage(strength)));
          return;
        }
        const result = await signUpWithPassword(email, password);
        if (result?.session) {
          navigate(fromPath, { replace: true });
        } else {
          setPassword('');
          setMode('verify');
          setInfo(`We sent a verification link to ${email}. Click it to activate your account.`);
        }
      } else if (mode === 'forgot') {
        const redirectTo = `${window.location.origin}/auth/reset?from=${encodeURIComponent(fromPath)}`;
        await requestPasswordReset(email, redirectTo);
        setInfo("If an account exists for that email, you'll receive a reset link shortly.");
      } else if (mode === 'verify') {
        await onResendVerification();
      } else {
        await setRememberMe(rememberMe);
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
      <Seo title="Sign in" description="Sign in to your account." path="/login" canonicalPath="/login" noindex />
      <Header />

      <main className="login-main">
        <motion.div className="login-card" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <div className="login-title">
            <div className="login-emoji">🧙‍♂️</div>
            <h1>Welcome back</h1>
            <p>Sign in to track your streaks and progress. Upgrade to Pro for Minute Expert + badges.</p>
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
              className={mode === 'signup' || mode === 'verify' ? 'active' : ''}
              onClick={() => {
                setMode('signup');
                setInfo(null);
              }}
              type="button"
            >
              Sign Up
            </button>
          </div>

          {mode === 'signin' && (
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

            {mode !== 'forgot' && mode !== 'verify' && (
              <label>
                Password
                <div className="login-password-field">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    required
                    minLength={mode === 'signup' ? 10 : 6}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    disabled={busy}
                  >
                    <span aria-hidden="true" className="login-password-toggle-icon">
                      {showPassword ? '🙈' : '👁️'}
                    </span>
                    <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
                  </button>
                </div>
              </label>
            )}

            {(mode === 'signin' || mode === 'signup') && (
              <label className="login-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={busy}
                />
                <span>Remember me</span>
              </label>
            )}

            {mode === 'signup' && <PasswordStrengthMeter password={password} email={email} />}

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

            {mode === 'verify' && (
              <div className="login-verify">
                <div className="login-info">
                  Verify your email to finish creating your account.
                </div>
                <button type="button" className="login-secondary" onClick={onResendVerification} disabled={busy || !isSupabaseConfigured}>
                  {busy ? 'Sending…' : 'Resend verification email'}
                </button>
                <button
                  type="button"
                  className="login-secondary"
                  onClick={() => {
                    setMode('signin');
                    setInfo(null);
                  }}
                  disabled={busy}
                >
                  Back to sign in
                </button>
              </div>
            )}

            {localError && <div className="login-error">{localError.message}</div>}
            {authError && <div className="login-error">{authError.message}</div>}
            {info && <div className="login-info">{info}</div>}

            <motion.button
              className="login-submit"
              type="submit"
              disabled={busy || !isSupabaseConfigured}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {busy ? 'Working…' : mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Send reset email' : mode === 'verify' ? 'Resend verification email' : 'Sign In'}
            </motion.button>
          </form>

          <div className="login-footer">
            <Link to="/">← Back</Link>
          </div>
        </motion.div>
      </main>
    </motion.div>
  );
}
