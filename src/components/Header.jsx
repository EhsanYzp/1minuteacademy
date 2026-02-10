import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getContentSource } from '../services/_contentSource';
import { formatTierLabel, getCurrentTier, setDevTierOverride } from '../services/entitlements';
import './Header.css';

function Header() {
  const { user, isSupabaseConfigured, signOut, resendVerificationEmail } = useAuth();
  const contentSource = getContentSource();
  const [busy, setBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const tier = getCurrentTier(user);

  const isVerified = Boolean(user?.email_confirmed_at || user?.confirmed_at);
  const showVerifyBanner = contentSource !== 'local' && isSupabaseConfigured && Boolean(user?.email) && !isVerified;

  async function onResendVerification() {
    if (!user?.email || verifyBusy) return;
    setVerifyBusy(true);
    try {
      await resendVerificationEmail(user.email, `${window.location.origin}/auth/callback`);
      setVerifySent(true);
    } catch {
      // ignore (AuthContext surfaces errors elsewhere)
    } finally {
      setVerifyBusy(false);
    }
  }

  async function onSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
      setMobileMenuOpen(false);
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <>
      <motion.header
        className="header"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      >
      <Link to="/" className="logo" aria-label="1 Minute Academy" onClick={closeMobileMenu}>
        <motion.span 
          className="logo-icon"
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        >
          ⏱️
        </motion.span>
        <span className="logo-text logo-text-long" aria-hidden="true">
          <span className="logo-number">1</span>
          <span className="logo-minute">Minute</span>
          <span className="logo-academy">Academy</span>
        </span>
        <span className="logo-text logo-text-short" aria-hidden="true">
          <span className="logo-number">1</span>
          <span className="logo-short">MA</span>
        </span>
      </Link>

      {contentSource === 'local' && (
        <div className="env-badge" title="Topics come from content/topics/** (no Supabase)">
          LOCAL PREVIEW
        </div>
      )}

      {import.meta.env.DEV && (
        <label
          className="dev-tier"
          title="Dev-only: switch tiers without Stripe. Stored in localStorage."
        >
          <span className="dev-tier-label">Tier</span>
          <select
            className="dev-tier-select"
            value={tier}
            onChange={(e) => {
              setDevTierOverride(e.target.value);
              window.location.reload();
            }}
            aria-label="Developer tier override"
          >
            <option value="guest">{formatTierLabel('guest')}</option>
            <option value="free">{formatTierLabel('free')}</option>
            <option value="pro">{formatTierLabel('pro')}</option>
          </select>
        </label>
      )}

      <button
        type="button"
        className="nav-toggle"
        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileMenuOpen}
        aria-controls="site-nav"
        onClick={() => setMobileMenuOpen((v) => !v)}
      >
        {mobileMenuOpen ? '✕' : '☰'}
      </button>
      
      <nav id="site-nav" className={mobileMenuOpen ? 'nav nav-open' : 'nav'}>
        <Link to="/topics" className="nav-item link browse" style={{ textDecoration: 'none' }} onClick={closeMobileMenu}>
          🧭 Browse
        </Link>
        <Link to="/pricing" className="nav-item link" style={{ textDecoration: 'none' }} onClick={closeMobileMenu}>
          💳 Pricing
        </Link>
        <Link to="/faq" className="nav-item link" style={{ textDecoration: 'none' }} onClick={closeMobileMenu}>
          ❓ FAQ
        </Link>
        {user ? (
          <>
            <Link to="/me" className="nav-item link" style={{ textDecoration: 'none' }} onClick={closeMobileMenu}>
              👤 Profile
            </Link>
            <button className="nav-item button" type="button" onClick={onSignOut} disabled={busy}>
              {busy ? 'Signing out…' : 'Sign out'}
            </button>
          </>
        ) : (
          <Link to="/login" className="nav-item points" style={{ textDecoration: 'none' }} onClick={closeMobileMenu}>
            Sign in
          </Link>
        )}
      </nav>
      </motion.header>

      {showVerifyBanner && (
        <div className="verify-banner" role="status" aria-live="polite">
          <div className="verify-banner-text">
            <strong>Verify your email</strong>
            <span>
              {' '}
              to unlock your profile and progress tracking.
              {verifySent ? ' Verification email sent.' : ''}
            </span>
          </div>
          <button className="verify-banner-btn" type="button" onClick={onResendVerification} disabled={verifyBusy}>
            {verifyBusy ? 'Sending…' : 'Resend email'}
          </button>
        </div>
      )}
    </>
  );
}

export default Header;
