import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { listTopics } from '../services/topics';
import { getContentSource } from '../services/_contentSource';
import { getUserStats, listUserTopicProgress } from '../services/progress';
import './ProfilePage.css';

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  } catch {
    return '—';
  }
}

function fmtSeconds(s) {
  const n = Number(s);
  if (!Number.isFinite(n)) return '—';
  return `${Math.max(0, Math.round(n))}s`;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const contentSource = getContentSource();

  const [stats, setStats] = useState({ xp: 0, streak: 0, last_completed_date: null });
  const [progressRows, setProgressRows] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [s, p, t] = await Promise.all([getUserStats(), listUserTopicProgress(), listTopics()]);
        if (!mounted) return;

        setStats(s);
        setProgressRows(Array.isArray(p) ? p : []);
        setTopics(Array.isArray(t) ? t : []);
      } catch (e) {
        if (!mounted) return;
        setError(e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [contentSource]);

  const topicById = useMemo(() => {
    const map = new Map();
    for (const t of topics) map.set(t.id, t);
    return map;
  }, [topics]);

  const progress = useMemo(() => {
    const rows = Array.isArray(progressRows) ? progressRows : [];
    return rows
      .map((r) => {
        const topicId = r.topic_id;
        const fromJoin = r.topics && typeof r.topics === 'object' ? r.topics : null;
        const fromList = topicById.get(topicId) ?? null;
        const topic = fromJoin ?? fromList;
        return {
          topicId,
          title: topic?.title ?? topicId,
          emoji: topic?.emoji ?? '🎯',
          color: topic?.color ?? '#4ECDC4',
          subject: topic?.subject ?? 'General',
          completed: Number(r.completed_count ?? 0),
          bestSeconds: r.best_seconds,
          lastCompletedAt: r.last_completed_at,
        };
      })
      .sort((a, b) => String(b.lastCompletedAt ?? '').localeCompare(String(a.lastCompletedAt ?? '')));
  }, [progressRows, topicById]);

  return (
    <motion.div className="profile-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Header />

      <main className="profile-main">
        <div className="profile-top">
          <Link className="profile-back" to="/">
            ← Back to topics
          </Link>
        </div>

        <motion.section className="profile-card" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <div className="profile-title">
            <div className="profile-emoji">🧑‍🚀</div>
            <div>
              <h1>Your profile</h1>
              <p>Track your XP, streak, and completed topics.</p>
            </div>
          </div>

          {contentSource === 'local' ? (
            <div className="profile-note">
              <strong>Local Preview mode</strong>
              <div>Progress is stored in your browser (localStorage).</div>
            </div>
          ) : (
            <div className="profile-note">
              <strong>Signed in</strong>
              <div className="profile-email">{user?.email ?? '—'}</div>
            </div>
          )}

          <div className="profile-section-sub" style={{ marginBottom: 12 }}>
            Content source: <strong>{contentSource}</strong>
          </div>

          {error && <div className="profile-error">{error.message ?? 'Failed to load profile.'}</div>}

          <div className="profile-stats">
            <div className="stat">
              <div className="stat-label">⭐ XP</div>
              <div className="stat-value">{Number(stats?.xp ?? 0)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">🔥 Streak</div>
              <div className="stat-value">{Number(stats?.streak ?? 0)} days</div>
            </div>
            <div className="stat">
              <div className="stat-label">📅 Last completion</div>
              <div className="stat-value small">{stats?.last_completed_date ?? '—'}</div>
            </div>
          </div>

          <div className="profile-section-header">
            <h2>Progress</h2>
            <div className="profile-section-sub">Your best time and completion count per topic.</div>
          </div>

          {loading ? (
            <div className="profile-loading">Loading…</div>
          ) : progress.length === 0 ? (
            <div className="profile-empty">
              No completed topics yet. Pick one on the home page and finish the 60 seconds.
            </div>
          ) : (
            <div className="progress-list">
              {progress.map((p) => (
                <Link
                  key={p.topicId}
                  to={`/topic/${p.topicId}`}
                  className="progress-row"
                  style={{ '--row-color': p.color }}
                >
                  <div className="progress-left">
                    <div className="progress-emoji">{p.emoji}</div>
                    <div className="progress-meta">
                      <div className="progress-title">{p.title}</div>
                      <div className="progress-sub">{p.subject}</div>
                    </div>
                  </div>

                  <div className="progress-right">
                    <div className="pill">✅ {p.completed}</div>
                    <div className="pill">⏱️ best {fmtSeconds(p.bestSeconds)}</div>
                    <div className="pill faint">🕒 {fmtDate(p.lastCompletedAt)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </motion.section>
      </main>
    </motion.div>
  );
}
