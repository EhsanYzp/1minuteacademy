import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getContentSource } from '../services/_contentSource';
import { formatTierLabel, getCurrentTier, setDevTierOverride } from '../services/entitlements';
import './Header.css';

function Header() {
  const { user, isSupabaseConfigured, signOut } = useAuth();
  const contentSource = getContentSource();
  const [busy, setBusy] = useState(false);
  const tier = getCurrentTier(user);

  async function onSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.header 
      className="header"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
    >
      <Link to="/" className="logo">
        <motion.span 
          className="logo-icon"
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        >
          ⏱️
        </motion.span>
        <span className="logo-text">
          <span className="logo-number">1</span>
          <span className="logo-minute">Minute</span>
          <span className="logo-academy">Academy</span>
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
      
      <nav className="nav">
        <Link to="/topics" className="nav-item link browse" style={{ textDecoration: 'none' }}>
          🧭 Browse
        </Link>
        {user ? (
          <>
            <Link to="/me" className="nav-item link" style={{ textDecoration: 'none' }}>
              👤 Profile
            </Link>
            <button className="nav-item button" type="button" onClick={onSignOut} disabled={busy}>
              {busy ? 'Signing out…' : 'Sign out'}
            </button>
          </>
        ) : (
          <Link to="/login" className="nav-item points" style={{ textDecoration: 'none' }}>
            Sign in
          </Link>
        )}
      </nav>
    </motion.header>
  );
}

export default Header;
