import { Link } from 'react-router-dom';
import { getTopicGate } from '../../../services/entitlements';

export default function ProgressTab({
  contentSource,
  fmtDate,
  loading,
  planLabel,
  progress,
  progressBySubject,
  progressFiltered,
  progressQuery,
  progressView,
  setProgressQuery,
  setProgressView,
  showReview,
  tier,
}) {
  return (
    <>
      <div className="profile-section-header">
        <h2>Your learning</h2>
        <div className="profile-section-sub">Your progress in one place.</div>
      </div>

      {contentSource !== 'local' && !showReview && (
        <div className="profile-note" style={{ marginBottom: 12 }}>
          <strong>Free plan</strong>
          <div className="profile-note-row">
            <div>
              Your current plan is <strong>{planLabel}</strong>. Upgrade to unlock review mode.
            </div>
            <Link className="profile-upgrade-btn" to="/upgrade">
              Upgrade
            </Link>
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
        <div className="profile-empty">No activity yet. Finish a topic to see your progress.</div>
      ) : progressView === 'subjects' ? (
        <div className="subject-progress">
          {progressBySubject.map((group) => {
            const pct = group.total > 0 ? Math.round((group.completedTopics / group.total) * 100) : 0;
            return (
              <details key={group.subject} className="subject-group">
                <summary className="subject-summary">
                  <div className="subject-left">
                    <div className="subject-name">{group.subject}</div>
                    <div className="subject-sub">
                      ✅ {group.completedTopics}/{group.total} topics
                    </div>
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
                    const completed = Number(p.completed ?? 0) > 0;
                    const topicGate = getTopicGate({ tier, topicRow: p });
                    const canStart = !topicGate?.locked;
                    const restartTo = canStart ? `/lesson/${p.topicId}` : topicGate?.reason === 'paused' ? '/me' : '/upgrade';
                    const restartLabel = canStart ? '🔄 Restart' : topicGate?.reason === 'paused' ? '⏸️ Account paused' : '🔒 Pro only';

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
                              <Link className={canStart ? 'action-pill secondary' : 'action-pill'} to={restartTo}>
                                {restartLabel}
                              </Link>
                            </div>
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
            const completed = Number(p.completed ?? 0) > 0;
            const topicGate = getTopicGate({ tier, topicRow: p });
            const canStart = !topicGate?.locked;
            const restartTo = canStart ? `/lesson/${p.topicId}` : topicGate?.reason === 'paused' ? '/me' : '/upgrade';
            const restartLabel = canStart ? '🔄 Restart' : topicGate?.reason === 'paused' ? '⏸️ Account paused' : '🔒 Pro only';

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
                      <Link className={canStart ? 'action-pill secondary' : 'action-pill'} to={restartTo}>
                        {restartLabel}
                      </Link>
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </>
  );
}
