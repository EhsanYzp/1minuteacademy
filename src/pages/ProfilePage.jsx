import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { listTopics, listTopicsByIds } from '../services/topics';
import { getContentSource } from '../services/_contentSource';
import { getUserStats, listUserTopicProgress } from '../services/progress';
import { canReview, canSeeTakeaways, canStartTopic, formatTierLabel, getCurrentTier } from '../services/entitlements';
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

function getSummaryPointsFromLesson(lesson) {
  const steps = Array.isArray(lesson?.steps) ? lesson.steps : [];
  const summary = steps.find((s) => s?.type === 'summary') ?? null;
  const points = Array.isArray(summary?.points) ? summary.points : [];
  return points.filter((p) => typeof p === 'string' && p.trim().length > 0);
}

function getLessonTotalSeconds(lesson) {
  const n = Number(lesson?.totalSeconds ?? 60);
  return Number.isFinite(n) && n > 0 ? n : 60;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const contentSource = getContentSource();
  const tier = getCurrentTier(user);
  const showTakeaways = canSeeTakeaways(tier);
  const showReview = canReview(tier);

  const [stats, setStats] = useState({ xp: 0, streak: 0, last_completed_date: null });
  const [progressRows, setProgressRows] = useState([]);
  const [topics, setTopics] = useState([]);
  const [topicsWithLessons, setTopicsWithLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progressView, setProgressView] = useState('subjects'); // subjects | recent
  const [progressQuery, setProgressQuery] = useState('');

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

        // For the learning recap we want the lesson JSON (summary points).
        // In Supabase mode, listTopics doesn't include lesson, so we fetch on-demand by ids.
        const completedIds = (Array.isArray(p) ? p : [])
          .filter((r) => Number(r.completed_count ?? 0) > 0)
          .map((r) => r.topic_id);

        const withLessons = showTakeaways
          ? await listTopicsByIds(completedIds, { includeLesson: true })
          : [];
        if (!mounted) return;
        setTopicsWithLessons(Array.isArray(withLessons) ? withLessons : []);
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
  }, [contentSource, showTakeaways]);

  const topicById = useMemo(() => {
    const map = new Map();
    for (const t of topics) map.set(t.id, t);
    return map;
  }, [topics]);

  const lessonByTopicId = useMemo(() => {
    const map = new Map();
    for (const t of topicsWithLessons) map.set(t.id, t?.lesson ?? null);
    return map;
  }, [topicsWithLessons]);

  const takeawaysCountByTopicId = useMemo(() => {
    const map = new Map();
    for (const [topicId, lesson] of lessonByTopicId.entries()) {
      map.set(topicId, getSummaryPointsFromLesson(lesson).length);
    }
    return map;
  }, [lessonByTopicId]);

  const takeawaysByTopicId = useMemo(() => {
    const map = new Map();
    for (const [topicId, lesson] of lessonByTopicId.entries()) {
      map.set(topicId, getSummaryPointsFromLesson(lesson));
    }
    return map;
  }, [lessonByTopicId]);

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

  const progressFiltered = useMemo(() => {
    const q = progressQuery.trim().toLowerCase();
    if (!q) return progress;
    return progress.filter((p) => {
      const hay = `${p.title ?? ''} ${p.subject ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [progress, progressQuery]);

  const subjectTotals = useMemo(() => {
    const totals = new Map();
    for (const t of topics) {
      const subject = t?.subject ?? 'General';
      totals.set(subject, (totals.get(subject) ?? 0) + 1);
    }
    return totals;
  }, [topics]);

  const progressBySubject = useMemo(() => {
    const buckets = new Map();
    for (const p of progressFiltered) {
      const subject = p.subject ?? 'General';
      const arr = buckets.get(subject) ?? [];
      arr.push(p);
      buckets.set(subject, arr);
    }

    // Sort each bucket: most recently completed first.
    for (const [subject, arr] of buckets) {
      arr.sort((a, b) => String(b.lastCompletedAt ?? '').localeCompare(String(a.lastCompletedAt ?? '')));
      buckets.set(subject, arr);
    }

    const subjects = Array.from(buckets.keys()).sort((a, b) => String(a).localeCompare(String(b)));
    return subjects.map((subject) => {
      const rows = buckets.get(subject) ?? [];
      const completedTopics = rows.filter((r) => Number(r.completed ?? 0) > 0).length;
      const total = subjectTotals.get(subject) ?? rows.length;
      return { subject, rows, completedTopics, total };
    });
  }, [progressFiltered, subjectTotals]);

  return (
    <motion.div className="profile-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Header />

      <main className="profile-main">
        <div className="profile-top">
          <Link className="profile-back" to="/topics">
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
            <h2>Your learning</h2>
            <div className="profile-section-sub">Progress + takeaways in one place.</div>
          </div>

          {!showTakeaways && (
            <div className="profile-note" style={{ marginBottom: 12 }}>
              <strong>Free plan</strong>
              <div>
                Your current plan is <strong>{formatTierLabel(tier)}</strong>. Upgrade to unlock review mode + saved takeaways.
                {' '}
                <Link to="/upgrade">Upgrade</Link>
              </div>
            </div>
          )}

          <div className="profile-progress-toolbar">
            <div className="profile-toggle">
              <button
                type="button"
                className={progressView === 'subjects' ? 'pt active' : 'pt'}
                onClick={() => setProgressView('subjects')}
              >
                By subject
              </button>
              <button
                type="button"
                className={progressView === 'recent' ? 'pt active' : 'pt'}
                onClick={() => setProgressView('recent')}
              >
                Recent
              </button>
            </div>

            <label className="profile-search">
              <span className="profile-search-icon">🔎</span>
              <input
                value={progressQuery}
                onChange={(e) => setProgressQuery(e.target.value)}
                placeholder="Search your progress…"
                aria-label="Search progress"
              />
              {progressQuery && (
                <button type="button" className="profile-clear" onClick={() => setProgressQuery('')} aria-label="Clear search">
                  ✕
                </button>
              )}
            </label>
          </div>

          {loading ? (
            <div className="profile-loading">Loading…</div>
          ) : progress.length === 0 ? (
            <div className="profile-empty">No activity yet. Finish a topic to unlock review + takeaways.</div>
          ) : progressView === 'subjects' ? (
            <div className="subject-progress">
              {progressBySubject.map((group) => {
                const pct = group.total > 0 ? Math.round((group.completedTopics / group.total) * 100) : 0;
                return (
                  <details key={group.subject} className="subject-group" open>
                    <summary className="subject-summary">
                      <div className="subject-left">
                        <div className="subject-name">{group.subject}</div>
                        <div className="subject-sub">✅ {group.completedTopics}/{group.total} topics</div>
                      </div>
                      <div className="subject-right">
                        <div className="subject-bar" aria-label="subject completion">
                          <div className="subject-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="subject-pct">{pct}%</div>
                      </div>
                    </summary>

                    <div className="progress-list" style={{ marginTop: 10 }}>
                      {group.rows.map((p) => {
                        const lesson = lessonByTopicId.get(p.topicId) ?? null;
                        const totalSecs = getLessonTotalSeconds(lesson);
                        const bestSecs = Number(p.bestSeconds);
                        const showBest = Number.isFinite(bestSecs) && Math.round(bestSecs) !== Math.round(totalSecs);
                        const takeaways = showTakeaways ? (takeawaysCountByTopicId.get(p.topicId) ?? 0) : 0;
                        const points = showTakeaways ? (takeawaysByTopicId.get(p.topicId) ?? []) : [];
                        const completed = Number(p.completed ?? 0) > 0;

                        return (
                          <details key={p.topicId} className="progress-details">
                            <summary className="progress-row" style={{ '--row-color': p.color }}>
                              <div className="progress-left">
                                <div className="progress-emoji">{p.emoji}</div>
                                <div className="progress-meta">
                                  <Link className="progress-title-link" to={`/topic/${p.topicId}`}>
                                    <div className="progress-title">{p.title}</div>
                                  </Link>
                                  <div className="progress-sub">{p.subject}</div>
                                </div>
                              </div>

                              <div className="progress-right">
                                <div className="pill">✅ {p.completed}</div>
                                {showTakeaways ? (
                                  takeaways > 0 ? <div className="pill">🧠 {takeaways} takeaways</div> : null
                                ) : (
                                  <div className="pill">🔒 takeaways</div>
                                )}
                                {showBest && <div className="pill">⏱️ best {fmtSeconds(bestSecs)}</div>}
                                <div className="pill faint">🕒 {fmtDate(p.lastCompletedAt)}</div>
                              </div>
                            </summary>

                            <div className="progress-expand">
                              {completed && (
                                <div className="progress-actions">
                                  {showReview ? (
                                    <Link className="action-pill" to={`/review/${p.topicId}`}>
                                      📚 Review
                                    </Link>
                                  ) : (
                                    <Link className="action-pill" to="/upgrade">
                                      🔒 Unlock review
                                    </Link>
                                  )}
                                  <Link className="action-pill secondary" to={`/lesson/${p.topicId}`}>
                                    🔄 Restart
                                  </Link>
                                </div>
                              )}

                              {completed ? (
                                showTakeaways ? (
                                  points.length > 0 ? (
                                  <ul className="progress-takeaways">
                                    {points.slice(0, 6).map((pt, idx) => (
                                      <li key={idx}>{pt}</li>
                                    ))}
                                  </ul>
                                  ) : (
                                    <div className="progress-takeaways-empty">No summary points for this topic yet.</div>
                                  )
                                ) : (
                                  <div className="progress-takeaways-empty">
                                    🔒 Takeaways are Pro-only. <Link to="/upgrade">Upgrade</Link>
                                  </div>
                                )
                              ) : (
                                <div className="progress-takeaways-empty">Finish this topic to unlock review + takeaways.</div>
                              )}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <div className="progress-list">
              {progressFiltered.map((p) => {
                const lesson = lessonByTopicId.get(p.topicId) ?? null;
                const totalSecs = getLessonTotalSeconds(lesson);
                const bestSecs = Number(p.bestSeconds);
                const showBest = Number.isFinite(bestSecs) && Math.round(bestSecs) !== Math.round(totalSecs);
                const takeaways = showTakeaways ? (takeawaysCountByTopicId.get(p.topicId) ?? 0) : 0;
                const points = showTakeaways ? (takeawaysByTopicId.get(p.topicId) ?? []) : [];
                const completed = Number(p.completed ?? 0) > 0;

                return (
                  <details key={p.topicId} className="progress-details">
                    <summary className="progress-row" style={{ '--row-color': p.color }}>
                      <div className="progress-left">
                        <div className="progress-emoji">{p.emoji}</div>
                        <div className="progress-meta">
                          <Link className="progress-title-link" to={`/topic/${p.topicId}`}>
                            <div className="progress-title">{p.title}</div>
                          </Link>
                          <div className="progress-sub">{p.subject}</div>
                        </div>
                      </div>

                      <div className="progress-right">
                        <div className="pill">✅ {p.completed}</div>
                        {showTakeaways ? (
                          takeaways > 0 ? <div className="pill">🧠 {takeaways} takeaways</div> : null
                        ) : (
                          <div className="pill">🔒 takeaways</div>
                        )}
                        {showBest && <div className="pill">⏱️ best {fmtSeconds(bestSecs)}</div>}
                        <div className="pill faint">🕒 {fmtDate(p.lastCompletedAt)}</div>
                      </div>
                    </summary>

                    <div className="progress-expand">
                      {completed && (
                        <div className="progress-actions">
                          {showReview ? (
                            <Link className="action-pill" to={`/review/${p.topicId}`}>
                              📚 Review
                            </Link>
                          ) : (
                            <Link className="action-pill" to="/upgrade">
                              🔒 Unlock review
                            </Link>
                          )}
                          <Link className="action-pill secondary" to={`/lesson/${p.topicId}`}>
                            🔄 Restart
                          </Link>
                        </div>
                      )}

                      {completed ? (
                        showTakeaways ? (
                          points.length > 0 ? (
                          <ul className="progress-takeaways">
                            {points.slice(0, 6).map((pt, idx) => (
                              <li key={idx}>{pt}</li>
                            ))}
                          </ul>
                          ) : (
                            <div className="progress-takeaways-empty">No summary points for this topic yet.</div>
                          )
                        ) : (
                          <div className="progress-takeaways-empty">
                            🔒 Takeaways are Pro-only. <Link to="/upgrade">Upgrade</Link>
                          </div>
                        )
                      ) : (
                        <div className="progress-takeaways-empty">Finish this topic to unlock review + takeaways.</div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </motion.section>
      </main>
    </motion.div>
  );
}
