import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { listTopics, listTopicsByIds } from '../services/topics';
import { getContentSource } from '../services/_contentSource';
import { getUserStats, listUserTopicProgress } from '../services/progress';
import { canReview, canSeeTakeaways, canStartTopic, formatTierLabel, getCurrentTier } from '../services/entitlements';
import { getSubscriptionStatus, openCustomerPortal } from '../services/billing';
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

function formatPlanForProfile(user, tier) {
  if (tier === 'pro') {
    const interval = String(user?.user_metadata?.plan_interval ?? '').toLowerCase();
    if (interval === 'year' || interval === 'yearly' || interval === 'annual') return 'Pro (Yearly)';
    if (interval === 'month' || interval === 'monthly') return 'Pro (Monthly)';
    return 'Pro';
  }
  if (tier === 'free') return 'Free (Account)';
  return 'Free (Guest)';
}

function fmtShortDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
  } catch {
    return '—';
  }
}

export default function ProfilePage() {
  const { user, refreshSession, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const contentSource = getContentSource();
  const tier = getCurrentTier(user);
  const planLabel = formatPlanForProfile(user, tier);
  const showTakeaways = canSeeTakeaways(tier);
  const showReview = canReview(tier);

  const hasStripeCustomer = Boolean(user?.user_metadata?.stripe_customer_id);
  const hasStripeSubscription = Boolean(user?.user_metadata?.stripe_subscription_id);
  const showSubscriptionBox = contentSource !== 'local' && Boolean(user) && (hasStripeCustomer || hasStripeSubscription);

  const checkoutState = useMemo(() => {
    try {
      return new URLSearchParams(location.search).get('checkout');
    } catch {
      return null;
    }
  }, [location.search]);

  const [checkoutBanner, setCheckoutBanner] = useState(null); // 'success' | 'error' | null
  const [checkoutBannerText, setCheckoutBannerText] = useState('');

  const [stats, setStats] = useState({ xp: 0, streak: 0, last_completed_date: null });
  const [progressRows, setProgressRows] = useState([]);
  const [topics, setTopics] = useState([]);
  const [topicsWithLessons, setTopicsWithLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progressView, setProgressView] = useState('subjects'); // subjects | recent
  const [progressQuery, setProgressQuery] = useState('');
  const [subStatus, setSubStatus] = useState(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState(null);

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

  useEffect(() => {
    let mounted = true;
    async function loadSub() {
      if (contentSource === 'local') return;
      if (!showSubscriptionBox) return;
      try {
        setSubLoading(true);
        setSubError(null);
        const data = await getSubscriptionStatus();
        if (!mounted) return;
        setSubStatus(data);
      } catch (e) {
        if (!mounted) return;
        setSubError(e);
      } finally {
        if (mounted) setSubLoading(false);
      }
    }
    loadSub();
    return () => {
      mounted = false;
    };
  }, [contentSource, showSubscriptionBox]);

  async function onManageSubscription() {
    try {
      await openCustomerPortal({ returnPath: '/me' });
    } catch (e) {
      setSubError(e);
    }
  }

  useEffect(() => {
    if (checkoutState !== 'success') return;
    if (authLoading) return;
    let canceled = false;

    async function run() {
      if (!user) {
        setCheckoutBanner('error');
        setCheckoutBannerText('Payment received. Please sign in again to activate Pro on your account.');
        return;
      }

      setCheckoutBanner('success');
      const startedAt = Date.now();
      const maxMs = 25_000;

      while (!canceled && Date.now() - startedAt < maxMs) {
        const remaining = Math.max(0, Math.ceil((maxMs - (Date.now() - startedAt)) / 1000));
        setCheckoutBannerText(`Payment received — activating Pro… (${remaining}s)`);
        try {
          const data = await refreshSession();
          const nextUser = data?.session?.user;
          if (getCurrentTier(nextUser) === 'pro') {
            setCheckoutBannerText('Pro is active. Enjoy!');
            // Clear ?checkout=success from the URL.
            navigate('/me', { replace: true });
            return;
          }
        } catch {
          // ignore
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 2000));
      }

      if (!canceled) {
        setCheckoutBanner('error');
        setCheckoutBannerText('Payment received. Pro may still be activating — check Stripe webhook delivery and try refreshing.');
      }
    }

    run();
    return () => {
      canceled = true;
    };
  }, [checkoutState, authLoading, user, refreshSession, navigate]);

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
              <div className="profile-plan-row">
                <span>Plan: <strong>{planLabel}</strong></span>
                {tier !== 'pro' && (
                  <Link className="profile-upgrade-btn" to="/upgrade">
                    Upgrade
                  </Link>
                )}
              </div>

              {showSubscriptionBox && (
                <div className="profile-sub-box">
                  <div className="profile-sub-head">
                    <div className="profile-sub-title">Subscription</div>
                    {hasStripeCustomer && (
                      <button className="profile-sub-btn" type="button" onClick={onManageSubscription}>
                        Manage subscription
                      </button>
                    )}
                  </div>

                  {subLoading ? (
                    <div className="profile-sub-row">Loading subscription details…</div>
                  ) : subError ? (
                    <div className="profile-sub-row profile-sub-error">{subError.message ?? 'Could not load subscription details.'}</div>
                  ) : subStatus ? (
                    (() => {
                      const endsLabel = subStatus.cancel_at_period_end || subStatus.status === 'canceled' ? 'Ends' : 'Renews';
                      const endsDate = subStatus.cancel_at || subStatus.current_period_end;
                      return (
                    <div className="profile-sub-grid">
                      <div className="profile-sub-item"><span>Status</span><strong>{subStatus.status ?? '—'}</strong></div>
                      <div className="profile-sub-item"><span>{endsLabel}</span><strong>{fmtShortDate(endsDate)}</strong></div>
                      <div className="profile-sub-item"><span>Started</span><strong>{fmtShortDate(subStatus.created)}</strong></div>
                      <div className="profile-sub-item"><span>Canceling</span><strong>{subStatus.cancel_at_period_end ? 'Yes' : 'No'}</strong></div>
                    </div>
                      );
                    })()
                  ) : (
                    <div className="profile-sub-row">No subscription details found yet.</div>
                  )}

                  <div className="profile-sub-foot">Cancel, update card, or see invoices in Stripe Portal.</div>
                </div>
              )}
            </div>
          )}

          {checkoutBanner && (
            <div className={`profile-note ${checkoutBanner === 'error' ? 'profile-checkout-error' : 'profile-checkout-success'}`} style={{ marginBottom: 12 }}>
              <strong>{checkoutBanner === 'error' ? 'Checkout' : 'Checkout success'}</strong>
              <div>{checkoutBannerText}</div>
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
              <div className="profile-note-row">
                <div>
                  Your current plan is <strong>{planLabel}</strong>. Upgrade to unlock review mode + saved takeaways.
                </div>
                <Link className="profile-upgrade-btn" to="/upgrade">Upgrade</Link>
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
                                    🔒 Takeaways are Pro-only. <Link className="profile-upgrade-inline" to="/upgrade">Upgrade</Link>
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
                            🔒 Takeaways are Pro-only. <Link className="profile-upgrade-inline" to="/upgrade">Upgrade</Link>
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
