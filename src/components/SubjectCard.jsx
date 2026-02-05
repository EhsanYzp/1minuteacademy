import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import StarRating from './StarRating';
import './SubjectCard.css';

function SubjectCard({ subject, index }) {
  const { id, title, emoji, color, description, difficulty, comingSoon, completed, ratingAvg, ratingCount } = subject;
  const hasRating = Number(ratingCount ?? 0) > 0 && Number.isFinite(Number(ratingAvg));

  return (
    <motion.div
      className={`subject-card ${comingSoon ? 'coming-soon' : ''}`}
      style={{ '--card-color': color }}
      whileHover={!comingSoon ? { 
        scale: 1.03, 
        y: -5,
        boxShadow: `0 20px 40px ${color}40`
      } : {}}
      whileTap={!comingSoon ? { scale: 0.98 } : {}}
    >
      {comingSoon ? (
        <div className="card-content">
          <motion.div 
            className="card-emoji"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
          >
            {emoji}
          </motion.div>
          <h3 className="card-title">{title}</h3>
          <p className="card-description">{description}</p>
          <div className="card-footer">
            <span className="difficulty-badge">{difficulty}</span>
            <span className="coming-soon-badge">Coming Soon</span>
          </div>
        </div>
      ) : (
        <Link to={`/topic/${id}`} className="card-link">
          <div className="card-content">
            {completed && <div className="completed-ribbon" title="Completed">✅ Completed</div>}
            <motion.div 
              className="card-emoji"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
            >
              {emoji}
            </motion.div>
            <h3 className="card-title">{title}</h3>
            <p className="card-description">{description}</p>
            <div className="card-footer">
              <span className="difficulty-badge">{difficulty}</span>
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
