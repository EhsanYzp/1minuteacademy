export default function OverviewTab({ stats, tier, formatMinuteExpert }) {
  return (
    <>
      <div className="profile-stats">
        <div className="profile-stat">
          <div className="profile-stat-label">Minute Expert</div>
          <div className="profile-stat-value">{Number(stats?.expert_minutes ?? 0) || 0}</div>
          <div className="profile-stat-sub">{formatMinuteExpert(Number(stats?.expert_minutes ?? 0) || 0)}</div>
          {tier !== 'pro' && (
            <div className="profile-stat-sub" style={{ opacity: 0.85, marginTop: 6 }}>
              Pro feature — upgrade to start earning expert minutes and badges.
            </div>
          )}
        </div>
        <div className="profile-stat">
          <div className="profile-stat-label">🔥 Streak</div>
          <div className="profile-stat-value">{Number(stats?.streak ?? 0)} days</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat-label">📅 Last completion</div>
          <div className="profile-stat-value small">{stats?.last_completed_date ?? '—'}</div>
        </div>
      </div>
    </>
  );
}
