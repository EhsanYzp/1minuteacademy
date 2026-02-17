import { Link } from 'react-router-dom';
import { EXPERT_BADGES, getNextBadge, getUnlockedBadges } from '../../../services/badges';

export default function BadgesTab({ stats, tier, contentSource, getBadgeRarity }) {
  return (
    <>
      <div className="profile-section-header profile-section-header-spaced">
        <h2>Badges</h2>
        <div className="profile-section-sub">Milestones based on your Minute Expert minutes.</div>
      </div>

      {tier !== 'pro' && tier !== 'paused' && contentSource !== 'local' ? (
        <div className="profile-note" style={{ marginBottom: 12 }}>
          <strong>Pro feature</strong>
          <div>Upgrade to Pro to start earning expert minutes and unlocking badges.</div>
          <div style={{ marginTop: 10 }}>
            <Link className="profile-upgrade-btn" to="/upgrade">
              Upgrade
            </Link>
          </div>
        </div>
      ) : null}

      <div className="profile-badges" aria-label="Badges">
        <div className="profile-badges-title">All badges</div>
        <div className="profile-badges-row">
          {EXPERT_BADGES.map((b) => {
            const minutes = Number(stats?.expert_minutes ?? 0) || 0;
            const required = Number(b.minutes ?? 0) || 0;
            const unlocked = minutes >= required;
            const rarity = getBadgeRarity(required);
            const pct = required > 0 ? Math.max(0, Math.min(100, Math.round((minutes / required) * 100))) : 0;
            const label = unlocked ? `${b.name} (Unlocked)` : `${b.name} (Locked)`;
            return (
              <div
                key={b.minutes}
                className={`profile-badge ${unlocked ? 'profile-badge--unlocked' : 'profile-badge--locked'} profile-badge--${rarity}`}
                title={label}
                aria-label={label}
              >
                <div className="profile-badge-top">
                  <div className="profile-badge-emoji" aria-hidden="true">
                    {b.emoji}
                  </div>
                  <div className="profile-badge-meta">
                    <div className="profile-badge-name">{b.name}</div>
                    <div className="profile-badge-req">
                      Unlock at <strong>{required}</strong> min
                    </div>
                  </div>
                  <div className={`profile-badge-pill ${unlocked ? 'ok' : 'locked'}`}>{unlocked ? 'Unlocked' : 'Locked'}</div>
                </div>

                <div className="profile-badge-progress" aria-hidden="true">
                  <div className="profile-badge-progressTrack">
                    <div className="profile-badge-progressFill" style={{ width: `${unlocked ? 100 : pct}%` }} />
                  </div>
                  <div className="profile-badge-progressText">{unlocked ? '100%' : `${pct}%`}</div>
                </div>
              </div>
            );
          })}
        </div>

        {getUnlockedBadges(Number(stats?.expert_minutes ?? 0) || 0).length === 0 ? (
          <div className="profile-badges-empty" style={{ marginTop: 10 }}>
            {tier === 'pro' ? 'Complete your first module to unlock your first badge.' : 'Badges are Pro-only. Upgrade to start unlocking.'}
          </div>
        ) : null}

        {(() => {
          const next = getNextBadge(Number(stats?.expert_minutes ?? 0) || 0);
          if (!next) return null;
          const have = Number(stats?.expert_minutes ?? 0) || 0;
          const remaining = Math.max(0, next.minutes - have);
          return (
            <div className="profile-badges-next">
              Next badge: <strong>{next.name}</strong> in <strong>{remaining}</strong> minute(s).
            </div>
          );
        })()}
      </div>
    </>
  );
}
