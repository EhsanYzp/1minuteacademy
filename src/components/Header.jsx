import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatTierLabel, getCurrentTier, setDevTierOverride } from '../services/entitlements';
import './Header.css';

function getAuthRedirectBaseUrl() {
  const isDev = (import.meta?.env?.DEV ?? false) === true;
  const configured = String(import.meta?.env?.VITE_SITE_URL ?? '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (isDev && typeof window !== 'undefined' && window?.location?.origin) return window.location.origin;
  throw new Error('VITE_SITE_URL is required for auth redirects');
}

function buildAuthRedirectUrl(pathname) {
  const base = getAuthRedirectBaseUrl();
  const path = String(pathname ?? '').startsWith('/') ? String(pathname) : `/${String(pathname ?? '')}`;
  return `${base}${path}`;
}

function getFocusableElements(container) {
  if (!container) return [];
  const nodes = container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  return Array.from(nodes).filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.hasAttribute('disabled')) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    return true;
  });
}

function Header() {
  const { user, isSupabaseConfigured, signOut, resendVerificationEmail } = useAuth();
  const [busy, setBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const tier = getCurrentTier(user);

  const navRef = useRef(null);
  const toggleRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  const isMobileViewport = useMemo(() => {
    try {
      return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    } catch {
      return false;
    }
  }, []);

  const isVerified = Boolean(user?.email_confirmed_at || user?.confirmed_at);
  const showVerifyBanner = isSupabaseConfigured && Boolean(user?.email) && !isVerified;

  async function onResendVerification() {
    if (!user?.email || verifyBusy) return;
    setVerifyBusy(true);
    try {
      await resendVerificationEmail(user.email, buildAuthRedirectUrl('/auth/callback'));
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

  // Focus trap for the mobile nav overlay.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    if (!isMobileViewport) return;

    previouslyFocusedRef.current = document.activeElement;

    // Move focus into the nav so keyboard users don't tab behind it.
    const focusFirst = () => {
      const focusables = getFocusableElements(navRef.current);
      if (focusables.length > 0) focusables[0].focus();
      else navRef.current?.focus?.();
    };

    // Let the menu render before focusing.
    const raf = window.requestAnimationFrame(focusFirst);

    const onKeyDown = (e) => {
      if (!mobileMenuOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setMobileMenuOpen(false);
        return;
      }

      if (e.key !== 'Tab') return;

      const focusables = getFocusableElements(navRef.current);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !navRef.current?.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileMenuOpen, isMobileViewport]);

  // Restore focus to the hamburger toggle when closing.
  useEffect(() => {
    if (mobileMenuOpen) return;
    const prev = previouslyFocusedRef.current;
    previouslyFocusedRef.current = null;
    if (!prev) return;

    // Prefer the toggle button to keep focus predictable.
    if (toggleRef.current) {
      toggleRef.current.focus();
      return;
    }

    if (prev instanceof HTMLElement) prev.focus?.();
  }, [mobileMenuOpen]);

  return (
    <>
      <motion.header
        className="header"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      >
      <Link to="/" className="logo" aria-label="1 minute academy" onClick={closeMobileMenu}>
        <motion.span 
          className="logo-icon"
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        >
          ⏱️
        </motion.span>
        <span className="logo-text logo-text-long" aria-hidden="true">
          <span className="logo-number">1</span>
          {' '}
          <span className="logo-minute">minute</span>
          {' '}
          <span className="logo-academy">academy</span>
        </span>
        <span className="logo-text logo-text-short" aria-hidden="true">
          <span className="logo-number">1</span>
          <span className="logo-short">MA</span>
        </span>
      </Link>

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
        ref={toggleRef}
      >
        {mobileMenuOpen ? '✕' : '☰'}
      </button>
      
      <nav
        id="site-nav"
        className={mobileMenuOpen ? 'nav nav-open' : 'nav'}
        ref={navRef}
        tabIndex={-1}
        aria-label="Site navigation"
      >
        <Link to="/pricing" className="nav-item link" style={{ textDecoration: 'none' }} onClick={closeMobileMenu}>
          Pricing
        </Link>
        <Link to="/faq" className="nav-item link" style={{ textDecoration: 'none' }} onClick={closeMobileMenu}>
          FAQ
        </Link>
        {user ? (
          <>
            <Link to="/me" className="nav-item link" style={{ textDecoration: 'none' }} onClick={closeMobileMenu}>
              Profile
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
