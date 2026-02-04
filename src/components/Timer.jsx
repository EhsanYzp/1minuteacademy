import { motion } from 'framer-motion';
import './Timer.css';

function Timer({ timeRemaining }) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const isLow = timeRemaining <= 10;
  const isCritical = timeRemaining <= 5;

  return (
    <motion.div 
      className={`timer ${isLow ? 'low' : ''} ${isCritical ? 'critical' : ''}`}
      animate={isCritical ? { scale: [1, 1.1, 1] } : {}}
      transition={{ duration: 0.5, repeat: isCritical ? Infinity : 0 }}
    >
      <div className="timer-circle">
        <svg viewBox="0 0 100 100">
          <circle
            className="timer-bg"
            cx="50"
            cy="50"
            r="45"
          />
          <motion.circle
            className="timer-progress"
            cx="50"
            cy="50"
            r="45"
            strokeDasharray={283}
            initial={{ strokeDashoffset: 0 }}
            animate={{ strokeDashoffset: 283 - (283 * timeRemaining) / 60 }}
            transition={{ duration: 0.5 }}
          />
        </svg>
        <div className="timer-display">
          <span className="timer-value">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
          <span className="timer-label">remaining</span>
        </div>
      </div>
    </motion.div>
  );
}

export default Timer;
