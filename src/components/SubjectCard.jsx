import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import './SubjectCard.css';

function SubjectCard({ subject, index }) {
  const { id, title, emoji, color, description, difficulty, comingSoon } = subject;

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
              <span className="duration-badge">⏱️ 60s</span>
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
