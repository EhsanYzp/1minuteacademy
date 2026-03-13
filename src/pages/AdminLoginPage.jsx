import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo';
import './AdminPanel.css';

const STORAGE_KEY = '1ma.adminToken';

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      // Combine username + password as the ADMIN_SECRET token.
      // The server verifies Bearer token === ADMIN_SECRET env var.
      const token = `${username.trim()}:${password}`;

      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        setError('Invalid credentials');
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Error ${res.status}`);
        return;
      }

      // Credentials valid — store token and navigate
      sessionStorage.setItem(STORAGE_KEY, token);
      window.location.href = '/admin/dashboard';
    } catch (err) {
      setError(err.message || 'Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div className="admin-login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Seo title="Admin" description="Admin panel login" noindex />

      <motion.div
        className="admin-login-card"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="admin-login-header">
          <div className="admin-login-icon">🔐</div>
          <h1>Admin Panel</h1>
          <p>Enter your admin credentials</p>
        </div>

        <form className="admin-login-form" onSubmit={handleSubmit}>
          <div className="admin-login-field">
            <label htmlFor="admin-user">Username</label>
            <input
              id="admin-user"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              required
            />
          </div>

          <div className="admin-login-field">
            <label htmlFor="admin-pass">Password</label>
            <input
              id="admin-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div className="admin-login-error">{error}</div>}

          <motion.button
            className="admin-login-submit"
            type="submit"
            disabled={busy}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {busy ? 'Signing in…' : 'Sign In'}
          </motion.button>
        </form>

        <div className="admin-login-back">
          <Link to="/">← Back to site</Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
