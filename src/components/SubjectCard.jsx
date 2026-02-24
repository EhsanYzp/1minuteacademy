import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import StarRating from './StarRating';
import './SubjectCard.css';

function SubjectCard({ subject, gate }) {
  const { id, title, emoji, color, is_free, comingSoon, completed, ratingAvg, ratingCount } = subject;
  const hasRating = Number(ratingCount ?? 0) > 0 && Number.isFinite(Number(ratingAvg));
  const isLocked = Boolean(gate?.locked);
  const lockLabel = String(gate?.label ?? 'Pro only');
  const lockReason = String(gate?.reason ?? 'pro');

  return (
    <motion.div
      className={`subject-card ${comingSoon ? 'coming-soon' : ''} ${isLocked ? 'locked' : ''}`}
      style={{ '--card-color': color }}
      whileHover={!comingSoon && !isLocked ? { 
        scale: 1.03, 
        y: -5,
        boxShadow: `0 20px 40px ${color}40`
      } : {}}
      whileTap={!comingSoon && !isLocked ? { scale: 0.98 } : {}}
      aria-disabled={comingSoon || isLocked}
    >
      {comingSoon || isLocked ? (
        <div className="card-content">
          <div className="card-emoji">
            {emoji}
          </div>
          <h3 className="card-title">{title}</h3>
          <div className="card-footer">
            <span className="difficulty-badge">{is_free ? 'Free' : 'Pro'}</span>
            {comingSoon ? (
              <span className="coming-soon-badge">Coming Soon</span>
            ) : (
              <span className="lock-badge" title={lockLabel}>
                🔒 {lockLabel}
              </span>
            )}
          </div>

          {isLocked && (
            <div className="locked-hint">
              {lockReason === 'pro'
                ? 'Upgrade to unlock this topic.'
                : lockReason === 'paused'
                  ? 'Your account is paused.'
                  : 'Locked.'}
            </div>
          )}
        </div>
      ) : (
        <Link to={`/topic/${id}`} className="card-link">
          <div className="card-content">
            {completed && <div className="completed-ribbon" title="Completed">✅ Completed</div>}
            <div className="card-emoji">
              {emoji}
            </div>
            <h3 className="card-title">{title}</h3>
            <div className="card-footer">
              <span className="difficulty-badge">{is_free ? 'Free' : 'Pro'}</span>
              {hasRating && (
                <span className="rating-badge" title={`${Number(ratingAvg).toFixed(1)} / 5 (${Number(ratingCount)} ratings)`}>
                  <StarRating value={Number(ratingAvg)} readOnly size="sm" />
                  <span className="rating-text">{Number(ratingAvg).toFixed(1)} ({Number(ratingCount)})</span>
                </span>
              )}
            </div>
            <motion.div 
              className="play-hint"
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
            >
              Click to Play! 🎮
            </motion.div>
          </div>
        </Link>
      )}
      
      <div className="card-decoration">
        <div className="decoration-circle circle-1"></div>
        <div className="decoration-circle circle-2"></div>
      </div>
    </motion.div>
  );
}

export default SubjectCard;
