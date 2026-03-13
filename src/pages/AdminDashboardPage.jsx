import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Seo from '../components/Seo';
import './AdminPanel.css';

const STORAGE_KEY = '1ma.adminToken';

function stars(rating) {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function relativeTime(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

/* ══════════════════════════════════════════════════════════
   KPI Card
   ══════════════════════════════════════════════════════════ */
function KpiCard({ icon, value, label, sub }) {
  return (
    <motion.div
      className="admin-kpi-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   Dashboard
   ══════════════════════════════════════════════════════════ */
export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;

  const fetchStats = useCallback(async () => {
    if (!token) {
      navigate('/admin', { replace: true });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        sessionStorage.removeItem(STORAGE_KEY);
        navigate('/admin', { replace: true });
        return;
      }

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Error ${res.status}`);
      }

      setData(await res.json());
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  function handleLogout() {
    sessionStorage.removeItem(STORAGE_KEY);
    navigate('/admin', { replace: true });
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="admin-loading">
          <div className="admin-loading-spinner" />
          <span>Loading dashboard…</span>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="admin-error-state">
          <span>⚠️ {error}</span>
          <button className="admin-retry-btn" onClick={fetchStats}>Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { users, billing, testimonials, ratings, content, engagement } = data;

  return (
    <motion.div className="admin-dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Seo title="Admin Dashboard" noindex />

      {/* ── Top Bar ── */}
      <div className="admin-topbar">
        <div className="admin-topbar-left">
          <span>🛡️</span>
          <h1>1 Minute Academy — Admin</h1>
        </div>
        <div className="admin-topbar-right">
          <span className="admin-generated-at">
            Updated {formatDateTime(data.generated_at)}
          </span>
          <button className="admin-refresh-btn" onClick={fetchStats} disabled={loading}>
            🔄 Refresh
          </button>
          <button className="admin-logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="admin-body">
        {/* ══════════ KPI Grid ══════════ */}
        <div className="admin-kpi-grid">
          <KpiCard
            icon="👥"
            value={users.total.toLocaleString()}
            label="Total Users"
            sub={`+${users.signups_last_24h} today · +${users.signups_last_7d} this week`}
          />
          <KpiCard
            icon="💳"
            value={billing.active_subscribers}
            label="Active Subscribers"
            sub={`${billing.monthly} monthly · ${billing.yearly} yearly`}
          />
          <KpiCard
            icon="⏸️"
            value={billing.paused_subscribers}
            label="Paused"
          />
          <KpiCard
            icon="💬"
            value={testimonials.approved}
            label="Testimonials"
            sub={testimonials.avg_rating > 0 ? `${stars(testimonials.avg_rating)} ${testimonials.avg_rating.toFixed(1)}` : undefined}
          />
          <KpiCard
            icon="⭐"
            value={ratings.total_ratings.toLocaleString()}
            label="Topic Ratings"
            sub={ratings.avg_rating > 0 ? `Avg ${ratings.avg_rating.toFixed(2)} · ${ratings.topics_rated} topics rated` : undefined}
          />
          <KpiCard
            icon="📚"
            value={content.topics.toLocaleString()}
            label="Topics Published"
            sub={`${content.categories} categories · ${content.courses} courses`}
          />
          <KpiCard
            icon="🎓"
            value={engagement.unique_learners.toLocaleString()}
            label="Active Learners"
            sub="Users with progress"
          />
          <KpiCard
            icon="📅"
            value={users.signups_last_30d}
            label="Signups (30d)"
            sub={`${users.signups_last_7d} in last 7 days`}
          />
        </div>

        {/* ══════════ Two-column: Recent Users + Recent Payments ══════════ */}
        <div className="admin-columns">
          {/* ── Recent Signups ── */}
          <div className="admin-section">
            <div className="admin-section-header">
              <span>👤</span>
              <h2>Recent Signups</h2>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Provider</th>
                    <th>Joined</th>
                    <th>Verified</th>
                  </tr>
                </thead>
                <tbody>
                  {users.recent.map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>
                        <span className={`admin-badge admin-badge--${u.provider === 'google' ? 'blue' : u.provider === 'github' ? 'gray' : 'green'}`}>
                          {u.provider}
                        </span>
                      </td>
                      <td>{relativeTime(u.created_at)}</td>
                      <td>{u.email_confirmed_at ? '✅' : '⏳'}</td>
                    </tr>
                  ))}
                  {users.recent.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: '#64748b' }}>No users yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Recent Payments ── */}
          <div className="admin-section">
            <div className="admin-section-header">
              <span>💰</span>
              <h2>Paying Users</h2>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Stripe Customer</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {billing.recent_payments.map((p, i) => (
                    <tr key={p.stripe_customer_id || i}>
                      <td title={p.user_id}>{p.stripe_customer_id || '—'}</td>
                      <td>
                        <span className={`admin-badge admin-badge--${p.plan === 'year' ? 'green' : 'blue'}`}>
                          {p.plan || '—'}
                        </span>
                      </td>
                      <td>
                        {p.paused
                          ? <span className="admin-badge admin-badge--yellow">paused</span>
                          : <span className="admin-badge admin-badge--green">active</span>
                        }
                      </td>
                      <td>{relativeTime(p.updated_at)}</td>
                    </tr>
                  ))}
                  {billing.recent_payments.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: '#64748b' }}>No paying users yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ══════════ Testimonials ══════════ */}
        <div className="admin-section">
          <div className="admin-section-header">
            <span>💬</span>
            <h2>Recent Testimonials</h2>
          </div>
          {testimonials.recent.length === 0 ? (
            <div className="admin-table-wrap" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              No testimonials yet
            </div>
          ) : (
            <div className="admin-testimonials-grid">
              {testimonials.recent.map((t) => (
                <div key={t.id} className="admin-testimonial-card">
                  <div className="admin-testimonial-top">
                    {t.author_avatar_url ? (
                      <img className="admin-testimonial-avatar" src={t.author_avatar_url} alt="" />
                    ) : (
                      <div className="admin-testimonial-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                        👤
                      </div>
                    )}
                    <div>
                      <div className="admin-testimonial-author">{t.author_name || 'Anonymous'}</div>
                      <div className="admin-testimonial-date">{formatDate(t.created_at)}</div>
                    </div>
                  </div>
                  <div className="admin-testimonial-quote">"{t.quote}"</div>
                  <div className="admin-testimonial-footer">
                    <span className="admin-stars">{stars(t.rating)}</span>
                    <span>
                      {t.approved !== false
                        ? <span className="admin-badge admin-badge--green">approved</span>
                        : <span className="admin-badge admin-badge--red">hidden</span>
                      }
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ══════════ Content Stats ══════════ */}
        <div className="admin-section">
          <div className="admin-section-header">
            <span>📖</span>
            <h2>Content Overview</h2>
          </div>
          <div className="admin-kpi-grid">
            <KpiCard icon="🗂️" value={content.categories} label="Categories" />
            <KpiCard icon="📘" value={content.courses} label="Courses" />
            <KpiCard icon="📑" value={content.chapters} label="Chapters" />
            <KpiCard icon="📄" value={content.topics.toLocaleString()} label="Topics" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
