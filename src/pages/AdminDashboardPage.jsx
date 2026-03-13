import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Seo from '../components/Seo';
import './AdminPanel.css';

const STORAGE_KEY = '1ma.adminToken';

/* ═══════════════════════════════════════════════════════
   Tabs
   ═══════════════════════════════════════════════════════ */
const TABS = [
  { id: 'overview',      label: 'Overview',      icon: '📊' },
  { id: 'users',         label: 'Users',         icon: '👥' },
  { id: 'revenue',       label: 'Revenue',       icon: '💰' },
  { id: 'content',       label: 'Content',       icon: '📚' },
  { id: 'learning',      label: 'Learning',      icon: '🎓' },
  { id: 'testimonials',  label: 'Testimonials',  icon: '💬' },
  { id: 'operations',    label: 'Operations',    icon: '⚙️' },
];

/* ═══════════════════════════════════════════════════════
   Utilities
   ═══════════════════════════════════════════════════════ */
function stars(rating) {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full));
}
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
function pct(n, d) {
  if (!d) return '0%';
  return `${Math.round((n / d) * 100)}%`;
}

/* ═══════════════════════════════════════════════════════
   Shared Components
   ═══════════════════════════════════════════════════════ */
function KpiCard({ icon, value, label, sub, color }) {
  return (
    <motion.div
      className={`admin-kpi-card${color ? ` admin-kpi--${color}` : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </motion.div>
  );
}

function DistChart({ data, color = 'blue' }) {
  const max = Math.max(...Object.values(data), 1);
  return (
    <div className="admin-dist">
      {Object.entries(data).map(([label, count]) => (
        <div key={label} className="admin-dist-row">
          <span className="admin-dist-label">{label}</span>
          <div className="admin-dist-track">
            <motion.div
              className={`admin-dist-fill admin-dist-fill--${color}`}
              initial={{ width: 0 }}
              animate={{ width: `${(count / max) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="admin-dist-value">{count}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon = '📭', message = 'No data yet' }) {
  return (
    <div className="admin-empty">
      <span className="admin-empty-icon">{icon}</span>
      <span>{message}</span>
    </div>
  );
}

function Badge({ variant = 'gray', children }) {
  return <span className={`admin-badge admin-badge--${variant}`}>{children}</span>;
}

/* ═══════════════════════════════════════════════════════
   OVERVIEW TAB
   ═══════════════════════════════════════════════════════ */
function OverviewTab({ data }) {
  const { users, billing, testimonials, ratings, content, learning } = data;

  // Activity feed: interleave recent signups + recent completions
  const feed = [
    ...users.recent.slice(0, 8).map(u => ({
      type: 'signup',
      time: u.created_at,
      text: u.email,
      icon: '👤',
    })),
    ...learning.recent_completions.slice(0, 8).map(c => ({
      type: 'completion',
      time: c.completed_at,
      text: `${c.topic_emoji} ${c.topic_title}`,
      icon: '✅',
    })),
  ]
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 12);

  const conversionRate = users.total > 0
    ? ((billing.active / users.total) * 100).toFixed(1)
    : '0';

  return (
    <div className="admin-tab-content">
      <div className="admin-kpi-grid">
        <KpiCard icon="👥" value={users.total.toLocaleString()} label="Total Users"
          sub={`+${users.signups_24h} today · +${users.signups_7d} this week`} />
        <KpiCard icon="💳" value={billing.active} label="Active Subscribers"
          sub={`${billing.monthly} mo · ${billing.yearly} yr`} color="green" />
        <KpiCard icon="📈" value={`${conversionRate}%`} label="Conversion Rate"
          sub={`${billing.active} of ${users.total} users`} color="blue" />
        <KpiCard icon="🔥" value={learning.active_today} label="Active Today"
          sub={`${learning.unique_learners} total learners`} color="orange" />
        <KpiCard icon="💬" value={testimonials.approved} label="Testimonials"
          sub={testimonials.avg_rating > 0 ? `${stars(testimonials.avg_rating)} ${testimonials.avg_rating.toFixed(1)}` : undefined} />
        <KpiCard icon="⭐" value={ratings.total_ratings.toLocaleString()} label="Topic Ratings"
          sub={ratings.avg_rating > 0 ? `Avg ${ratings.avg_rating.toFixed(2)} · ${ratings.topics_rated} rated` : undefined} />
        <KpiCard icon="📚" value={content.topics.toLocaleString()} label="Topics Published"
          sub={`${content.categories} categories · ${content.courses} courses`} />
        <KpiCard icon="🎯" value={learning.total_completions.toLocaleString()} label="Total Completions"
          sub={`${learning.avg_completions_per_user} avg per user`} />
      </div>

      <div className="admin-columns">
        {/* Activity Feed */}
        <div className="admin-section">
          <div className="admin-section-header">
            <span>⚡</span><h2>Live Activity</h2>
          </div>
          {feed.length === 0 ? <EmptyState message="No activity yet" /> : (
            <div className="admin-feed">
              {feed.map((item, i) => (
                <div key={i} className="admin-feed-item">
                  <span className="admin-feed-icon">{item.icon}</span>
                  <span className="admin-feed-text">{item.text}</span>
                  <span className="admin-feed-time">{relativeTime(item.time)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Insights */}
        <div className="admin-section">
          <div className="admin-section-header">
            <span>💡</span><h2>Quick Insights</h2>
          </div>
          <div className="admin-insights">
            <div className="admin-insight-row">
              <span className="admin-insight-label">Email verified rate</span>
              <span className="admin-insight-value">{pct(users.verified, users.total)}</span>
            </div>
            <div className="admin-insight-row">
              <span className="admin-insight-label">Signups last hour</span>
              <span className="admin-insight-value">{users.signups_1h}</span>
            </div>
            <div className="admin-insight-row">
              <span className="admin-insight-label">Signups (30d)</span>
              <span className="admin-insight-value">{users.signups_30d}</span>
            </div>
            <div className="admin-insight-row">
              <span className="admin-insight-label">Avg streak</span>
              <span className="admin-insight-value">{learning.avg_streak} days</span>
            </div>
            <div className="admin-insight-row">
              <span className="admin-insight-label">Max streak</span>
              <span className="admin-insight-value">🔥 {learning.max_streak} days</span>
            </div>
            <div className="admin-insight-row">
              <span className="admin-insight-label">Total 1MA earned</span>
              <span className="admin-insight-value">🪙 {learning.one_ma_total.toLocaleString()}</span>
            </div>
            <div className="admin-insight-row">
              <span className="admin-insight-label">Past-due subs</span>
              <span className={`admin-insight-value${billing.past_due > 0 ? ' admin-insight--warn' : ''}`}>{billing.past_due}</span>
            </div>
            <div className="admin-insight-row">
              <span className="admin-insight-label">Hidden testimonials</span>
              <span className="admin-insight-value">{testimonials.hidden}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   USERS TAB
   ═══════════════════════════════════════════════════════ */
function UsersTab({ data, token }) {
  const { users } = data;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef(null);

  function handleSearch(val) {
    setQuery(val);
    clearTimeout(timerRef.current);
    if (val.trim().length < 2) { setResults(null); return; }
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/users?q=${encodeURIComponent(val.trim())}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const d = await res.json();
          setResults(d.users);
        }
      } catch { /* ignore */ }
      setSearching(false);
    }, 400);
  }

  const providerEntries = Object.entries(users.providers).sort((a, b) => b[1] - a[1]);

  return (
    <div className="admin-tab-content">
      {/* Search */}
      <div className="admin-search-wrap">
        <div className="admin-search-box">
          <span className="admin-search-icon">🔍</span>
          <input
            className="admin-search-input"
            type="text"
            placeholder="Search users by email or name…"
            value={query}
            onChange={e => handleSearch(e.target.value)}
          />
          {searching && <span className="admin-search-spinner" />}
        </div>
      </div>

      {/* Search Results */}
      {results && (
        <div className="admin-section">
          <div className="admin-section-header">
            <span>🔎</span><h2>Search Results ({results.length})</h2>
          </div>
          {results.length === 0 ? <EmptyState icon="🤷" message="No users found" /> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Plan</th>
                    <th>Provider</th>
                    <th>Joined</th>
                    <th>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(u => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{u.display_name || '—'}</td>
                      <td><Badge variant={u.plan === 'pro' ? 'green' : 'gray'}>{u.plan}</Badge></td>
                      <td><Badge variant={u.provider === 'google' ? 'blue' : u.provider === 'github' ? 'purple' : 'gray'}>{u.provider}</Badge></td>
                      <td>{relativeTime(u.created_at)}</td>
                      <td>{relativeTime(u.last_sign_in_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="admin-kpi-grid admin-kpi-grid--small">
        <KpiCard icon="👥" value={users.total.toLocaleString()} label="Total Users" />
        <KpiCard icon="✅" value={users.verified} label="Verified" sub={pct(users.verified, users.total)} />
        <KpiCard icon="📅" value={users.signups_30d} label="Signups (30d)" sub={`+${users.signups_7d} this week`} />
        <KpiCard icon="🕐" value={users.signups_1h} label="Last Hour" />
      </div>

      {/* Provider Breakdown */}
      <div className="admin-section">
        <div className="admin-section-header">
          <span>🔑</span><h2>Auth Providers</h2>
        </div>
        <DistChart data={Object.fromEntries(providerEntries)} color="blue" />
      </div>

      {/* Recent Signups Table */}
      <div className="admin-section">
        <div className="admin-section-header">
          <span>🆕</span><h2>Recent Signups</h2>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Plan</th>
                <th>Provider</th>
                <th>Joined</th>
                <th>Verified</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {users.recent.map(u => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td><Badge variant={u.plan === 'pro' ? 'green' : 'gray'}>{u.plan}</Badge></td>
                  <td><Badge variant={u.provider === 'google' ? 'blue' : u.provider === 'github' ? 'purple' : 'gray'}>{u.provider}</Badge></td>
                  <td>{relativeTime(u.created_at)}</td>
                  <td>{u.email_confirmed_at ? '✅' : '⏳'}</td>
                  <td>{relativeTime(u.last_sign_in_at)}</td>
                </tr>
              ))}
              {users.recent.length === 0 && (
                <tr><td colSpan={6} className="admin-table-empty">No users yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   REVENUE TAB
   ═══════════════════════════════════════════════════════ */
function RevenueTab({ data }) {
  const { billing } = data;

  return (
    <div className="admin-tab-content">
      <div className="admin-kpi-grid">
        <KpiCard icon="💳" value={billing.active} label="Active Subscribers" color="green"
          sub={`${billing.monthly} monthly · ${billing.yearly} yearly`} />
        <KpiCard icon="🚫" value={billing.canceled} label="Canceled" color="red" />
        <KpiCard icon="⚠️" value={billing.past_due} label="Past Due"
          color={billing.past_due > 0 ? 'red' : 'gray'} />
        <KpiCard icon="📊" value={billing.total_customers} label="Total Customers"
          sub="All-time Stripe customers" />
        <KpiCard icon="📅" value={billing.monthly} label="Monthly Plans" color="blue" />
        <KpiCard icon="📆" value={billing.yearly} label="Yearly Plans" color="purple" />
      </div>

      {/* Subscription split chart */}
      {billing.active > 0 && (
        <div className="admin-section">
          <div className="admin-section-header">
            <span>📈</span><h2>Subscription Breakdown</h2>
          </div>
          <DistChart
            data={{
              'Active': billing.active,
              'Canceled': billing.canceled,
              'Past Due': billing.past_due,
            }}
            color="green"
          />
        </div>
      )}

      {/* Stripe link */}
      <div className="admin-stripe-note">
        💡 For detailed revenue (MRR, ARR, failed payments), visit your{' '}
        <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
          Stripe Dashboard ↗
        </a>
      </div>

      {/* Customer Table */}
      <div className="admin-section">
        <div className="admin-section-header">
          <span>💰</span><h2>All Customers</h2>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Customer ID</th>
                <th>Interval</th>
                <th>Status</th>
                <th>Period End</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {billing.customers.map((c, i) => (
                <tr key={c.customer_id || i}>
                  <td className="admin-mono">{c.customer_id || '—'}</td>
                  <td><Badge variant={c.interval === 'year' ? 'purple' : 'blue'}>{c.interval || '—'}</Badge></td>
                  <td>
                    <Badge variant={
                      c.status === 'active' ? 'green' :
                      c.status === 'canceled' ? 'red' :
                      c.status === 'past_due' ? 'yellow' : 'gray'
                    }>
                      {c.status || '—'}
                    </Badge>
                  </td>
                  <td>{formatDate(c.current_period_end)}</td>
                  <td>{relativeTime(c.updated_at)}</td>
                </tr>
              ))}
              {billing.customers.length === 0 && (
                <tr><td colSpan={5} className="admin-table-empty">No customers yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CONTENT TAB
   ═══════════════════════════════════════════════════════ */
function ContentTab({ data }) {
  const { content, ratings } = data;

  return (
    <div className="admin-tab-content">
      <div className="admin-kpi-grid admin-kpi-grid--small">
        <KpiCard icon="🗂️" value={content.categories} label="Categories" />
        <KpiCard icon="📘" value={content.courses} label="Courses" />
        <KpiCard icon="📑" value={content.chapters} label="Chapters" />
        <KpiCard icon="📄" value={content.topics.toLocaleString()} label="Topics" />
      </div>

      {/* Categories Breakdown */}
      {content.categories_list.length > 0 && (
        <div className="admin-section">
          <div className="admin-section-header">
            <span>🗂️</span><h2>Categories</h2>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Category</th><th>Courses</th></tr>
              </thead>
              <tbody>
                {content.categories_list.map(c => (
                  <tr key={c.id}>
                    <td>{c.emoji} {c.name}</td>
                    <td>{c.courses_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="admin-columns">
        {/* Top Rated */}
        <div className="admin-section">
          <div className="admin-section-header">
            <span>🌟</span><h2>Top Rated Topics</h2>
          </div>
          {ratings.top_rated.length === 0 ? <EmptyState message="Not enough ratings yet" /> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Topic</th><th>Avg</th><th>Votes</th></tr>
                </thead>
                <tbody>
                  {ratings.top_rated.map(r => (
                    <tr key={r.topic_id}>
                      <td>{r.emoji || '📄'} {r.title || r.topic_id}</td>
                      <td><span className="admin-stars">{stars(r.avg_rating)}</span> {r.avg_rating.toFixed(1)}</td>
                      <td>{r.ratings_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Lowest Rated */}
        <div className="admin-section">
          <div className="admin-section-header">
            <span>📉</span><h2>Lowest Rated Topics</h2>
          </div>
          {ratings.lowest_rated.length === 0 ? <EmptyState message="Not enough ratings yet" /> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Topic</th><th>Avg</th><th>Votes</th></tr>
                </thead>
                <tbody>
                  {ratings.lowest_rated.map(r => (
                    <tr key={r.topic_id}>
                      <td>{r.emoji || '📄'} {r.title || r.topic_id}</td>
                      <td><span className="admin-stars">{stars(r.avg_rating)}</span> {r.avg_rating.toFixed(1)}</td>
                      <td>{r.ratings_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Unrated Popular */}
      {ratings.unrated_popular.length > 0 && (
        <div className="admin-section">
          <div className="admin-section-header">
            <span>🕵️</span><h2>Unrated Popular Topics</h2>
            <span className="admin-section-hint">High completions but no ratings — consider prompting users</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Topic</th><th>Completions</th><th>Unique Users</th></tr>
              </thead>
              <tbody>
                {ratings.unrated_popular.map(r => (
                  <tr key={r.topic_id}>
                    <td>{r.emoji || '📄'} {r.title || r.topic_id}</td>
                    <td>{r.total_completions}</td>
                    <td>{r.unique_users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   LEARNING TAB
   ═══════════════════════════════════════════════════════ */
function LearningTab({ data }) {
  const { learning } = data;

  return (
    <div className="admin-tab-content">
      <div className="admin-kpi-grid">
        <KpiCard icon="🎓" value={learning.unique_learners.toLocaleString()} label="Unique Learners" color="blue" />
        <KpiCard icon="✅" value={learning.total_completions.toLocaleString()} label="Total Completions" color="green" />
        <KpiCard icon="📊" value={learning.avg_completions_per_user} label="Avg per User" />
        <KpiCard icon="🔥" value={learning.active_today} label="Active Today" color="orange" />
        <KpiCard icon="🏆" value={`${learning.max_streak}d`} label="Best Streak" color="purple" />
        <KpiCard icon="📈" value={`${learning.avg_streak}d`} label="Avg Streak" />
        <KpiCard icon="🪙" value={learning.one_ma_total.toLocaleString()} label="Total 1MA Earned" />
      </div>

      <div className="admin-columns">
        {/* Streak Distribution */}
        <div className="admin-section">
          <div className="admin-section-header">
            <span>🔥</span><h2>Streak Distribution</h2>
          </div>
          <DistChart data={learning.streak_distribution} color="orange" />
        </div>

        {/* Top Streakers */}
        <div className="admin-section">
          <div className="admin-section-header">
            <span>🏅</span><h2>Top Streakers</h2>
          </div>
          {learning.top_streakers.length === 0 ? <EmptyState message="No streak data yet" /> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>#</th><th>User</th><th>Streak</th><th>1MA</th></tr>
                </thead>
                <tbody>
                  {learning.top_streakers.map((s, i) => (
                    <tr key={s.user_id}>
                      <td>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                      <td className="admin-mono admin-truncate">{s.user_id}</td>
                      <td>🔥 {s.streak}d</td>
                      <td>🪙 {s.one_ma_balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Top Topics by Completions */}
      <div className="admin-section">
        <div className="admin-section-header">
          <span>🏆</span><h2>Most Completed Topics</h2>
        </div>
        {learning.top_topics.length === 0 ? <EmptyState message="No completion data yet" /> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Topic</th><th>Completions</th><th>Users</th><th>Avg Time</th></tr>
              </thead>
              <tbody>
                {learning.top_topics.map(t => (
                  <tr key={t.topic_id}>
                    <td>{t.emoji || '📄'} {t.title || t.topic_id}</td>
                    <td>{t.total_completions.toLocaleString()}</td>
                    <td>{t.unique_users}</td>
                    <td>{t.avg_seconds != null ? `${t.avg_seconds}s` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Completions */}
      <div className="admin-section">
        <div className="admin-section-header">
          <span>🕐</span><h2>Recent Completions</h2>
        </div>
        {learning.recent_completions.length === 0 ? <EmptyState message="No completions yet" /> : (
          <div className="admin-feed">
            {learning.recent_completions.map((c, i) => (
              <div key={i} className="admin-feed-item">
                <span className="admin-feed-icon">{c.topic_emoji}</span>
                <span className="admin-feed-text">
                  <span className="admin-mono admin-truncate-sm">{c.user_id.slice(0, 8)}…</span>
                  {' completed '}
                  <strong>{c.topic_title}</strong>
                  {c.best_seconds != null && <span className="admin-feed-meta"> ({c.best_seconds}s)</span>}
                </span>
                <span className="admin-feed-time">{relativeTime(c.completed_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TESTIMONIALS TAB
   ═══════════════════════════════════════════════════════ */
function TestimonialsTab({ data, token, onRefresh }) {
  const { testimonials } = data;
  const [localList, setLocalList] = useState(testimonials.list);
  const [toggling, setToggling] = useState(null);

  // Sync when parent data refreshes
  useEffect(() => { setLocalList(testimonials.list); }, [testimonials.list]);

  async function toggleApproval(id, currentApproved) {
    setToggling(id);
    const newApproved = !currentApproved;

    // Optimistic update
    setLocalList(prev => prev.map(t => t.id === id ? { ...t, approved: newApproved } : t));

    try {
      const res = await fetch('/api/admin/moderate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id, approved: newApproved }),
      });
      if (!res.ok) {
        // Revert on failure
        setLocalList(prev => prev.map(t => t.id === id ? { ...t, approved: currentApproved } : t));
      }
    } catch {
      setLocalList(prev => prev.map(t => t.id === id ? { ...t, approved: currentApproved } : t));
    }
    setToggling(null);
  }

  const approvedCount = localList.filter(t => t.approved !== false).length;
  const hiddenCount = localList.length - approvedCount;

  return (
    <div className="admin-tab-content">
      <div className="admin-kpi-grid admin-kpi-grid--small">
        <KpiCard icon="💬" value={localList.length} label="Total" />
        <KpiCard icon="✅" value={approvedCount} label="Approved" color="green" />
        <KpiCard icon="🙈" value={hiddenCount} label="Hidden" color={hiddenCount > 0 ? 'yellow' : 'gray'} />
        <KpiCard icon="⭐" value={testimonials.avg_rating > 0 ? testimonials.avg_rating.toFixed(1) : '—'} label="Avg Rating" />
      </div>

      {localList.length === 0 ? (
        <EmptyState icon="💬" message="No testimonials yet" />
      ) : (
        <div className="admin-testimonials-grid">
          {localList.map(t => (
            <motion.div
              key={t.id}
              className={`admin-testimonial-card${t.approved === false ? ' admin-testimonial--hidden' : ''}`}
              layout
            >
              <div className="admin-testimonial-top">
                {t.author_avatar_url ? (
                  <img className="admin-testimonial-avatar" src={t.author_avatar_url} alt="" />
                ) : (
                  <div className="admin-testimonial-avatar admin-testimonial-avatar--placeholder">👤</div>
                )}
                <div>
                  <div className="admin-testimonial-author">{t.author_name || 'Anonymous'}</div>
                  {t.author_title && <div className="admin-testimonial-title">{t.author_title}</div>}
                  <div className="admin-testimonial-date">{formatDate(t.created_at)}</div>
                </div>
              </div>

              <div className="admin-testimonial-quote">"{t.quote}"</div>

              <div className="admin-testimonial-footer">
                <div className="admin-testimonial-left">
                  {t.rating && <span className="admin-stars">{stars(t.rating)}</span>}
                  {t.platform && (
                    <Badge variant="blue">{t.platform}</Badge>
                  )}
                </div>
                <button
                  className={`admin-moderate-btn ${t.approved !== false ? 'admin-moderate-btn--approved' : 'admin-moderate-btn--hidden'}`}
                  onClick={() => toggleApproval(t.id, t.approved !== false)}
                  disabled={toggling === t.id}
                >
                  {toggling === t.id ? '…' : t.approved !== false ? '✅ Approved' : '🙈 Hidden'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   OPERATIONS TAB
   ═══════════════════════════════════════════════════════ */
function OperationsTab({ data }) {
  const { operations } = data;
  const { webhooks, rate_limits } = operations;

  return (
    <div className="admin-tab-content">
      {/* Webhook KPIs */}
      <div className="admin-section">
        <div className="admin-section-header">
          <span>🔗</span><h2>Stripe Webhooks</h2>
        </div>
        <div className="admin-kpi-grid admin-kpi-grid--small">
          <KpiCard icon="📩" value={webhooks.total} label="Total Events" />
          <KpiCard icon="✅" value={webhooks.succeeded} label="Succeeded" color="green" />
          <KpiCard icon="⏳" value={webhooks.processing} label="Processing" color="yellow" />
          <KpiCard icon="❌" value={webhooks.failed} label="Failed" color={webhooks.failed > 0 ? 'red' : 'gray'} />
        </div>

        {webhooks.recent.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Event ID</th><th>Type</th><th>Status</th><th>Time</th><th>Error</th></tr>
              </thead>
              <tbody>
                {webhooks.recent.map(w => (
                  <tr key={w.event_id}>
                    <td className="admin-mono admin-truncate">{w.event_id}</td>
                    <td><Badge variant="blue">{w.type || '—'}</Badge></td>
                    <td>
                      <Badge variant={
                        w.status === 'succeeded' ? 'green' :
                        w.status === 'failed' ? 'red' : 'yellow'
                      }>
                        {w.status}
                      </Badge>
                    </td>
                    <td>{relativeTime(w.first_seen_at)}</td>
                    <td className="admin-error-text">{w.last_error || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="🔗" message="No webhook events recorded" />
        )}
      </div>

      {/* Rate Limits */}
      <div className="admin-section">
        <div className="admin-section-header">
          <span>🛡️</span><h2>Rate Limit Activity</h2>
        </div>
        {rate_limits.recent.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Key</th><th>Window</th><th>Hits</th></tr>
              </thead>
              <tbody>
                {rate_limits.recent.map((r, i) => (
                  <tr key={i}>
                    <td className="admin-mono admin-truncate">{r.key}</td>
                    <td>{formatDateTime(r.window_start)}</td>
                    <td>
                      <Badge variant={r.count > 10 ? 'red' : r.count > 5 ? 'yellow' : 'gray'}>
                        {r.count}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="🛡️" message="No rate limit hits recorded" />
        )}
      </div>

      {/* System Notes */}
      <div className="admin-section">
        <div className="admin-section-header">
          <span>📋</span><h2>System Notes</h2>
        </div>
        <div className="admin-insights">
          <div className="admin-insight-row">
            <span className="admin-insight-label">Database</span>
            <span className="admin-insight-value"><Badge variant="green">Supabase</Badge></span>
          </div>
          <div className="admin-insight-row">
            <span className="admin-insight-label">Hosting</span>
            <span className="admin-insight-value"><Badge variant="blue">Vercel</Badge></span>
          </div>
          <div className="admin-insight-row">
            <span className="admin-insight-label">Payments</span>
            <span className="admin-insight-value"><Badge variant="purple">Stripe</Badge></span>
          </div>
          <div className="admin-insight-row">
            <span className="admin-insight-label">Webhook TTL</span>
            <span className="admin-insight-value">30 days</span>
          </div>
          <div className="admin-insight-row">
            <span className="admin-insight-label">Rate limit TTL</span>
            <span className="admin-insight-value">1 day</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════════════════ */
export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;

  async function expectJson(res) {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      const sample = await res.text().catch(() => '');
      const preview = sample.slice(0, 120).replace(/\s+/g, ' ').trim();
      throw new Error(
        `Admin API is not returning JSON. If you're running "npm run dev", you also need ` +
        `"vercel dev" so /api routes execute. Preview: ${preview || '—'}`
      );
    }
    return res.json();
  }

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
        const d = await expectJson(res).catch(() => ({}));
        throw new Error(d.error || `Error ${res.status}`);
      }

      setData(await expectJson(res));
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchStats, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchStats]);

  function handleLogout() {
    sessionStorage.removeItem(STORAGE_KEY);
    navigate('/admin', { replace: true });
  }

  /* ── Loading ── */
  if (loading && !data) {
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
  if (error && !data) {
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

  function renderTab() {
    switch (activeTab) {
      case 'overview':     return <OverviewTab data={data} />;
      case 'users':        return <UsersTab data={data} token={token} />;
      case 'revenue':      return <RevenueTab data={data} />;
      case 'content':      return <ContentTab data={data} />;
      case 'learning':     return <LearningTab data={data} />;
      case 'testimonials': return <TestimonialsTab data={data} token={token} onRefresh={fetchStats} />;
      case 'operations':   return <OperationsTab data={data} />;
      default:             return <OverviewTab data={data} />;
    }
  }

  return (
    <motion.div className="admin-dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Seo title="Admin Dashboard" noindex />

      {/* ── Top Bar ── */}
      <div className="admin-topbar">
        <div className="admin-topbar-left">
          <span className="admin-topbar-icon">🛡️</span>
          <h1>1 Minute Academy</h1>
          <Badge variant="blue">Admin</Badge>
        </div>
        <div className="admin-topbar-right">
          <span className="admin-generated-at">
            {loading ? 'Refreshing…' : `Updated ${formatDateTime(data.generated_at)}`}
          </span>
          <button
            className={`admin-auto-btn${autoRefresh ? ' admin-auto-btn--active' : ''}`}
            onClick={() => setAutoRefresh(v => !v)}
            title="Auto-refresh every 30s"
          >
            ⚡ Auto
          </button>
          <button className="admin-refresh-btn" onClick={fetchStats} disabled={loading}>
            🔄
          </button>
          <button className="admin-logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <nav className="admin-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`admin-tab-btn${activeTab === tab.id ? ' admin-tab-btn--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="admin-tab-icon">{tab.icon}</span>
            <span className="admin-tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* ── Tab Content ── */}
      <div className="admin-body">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
