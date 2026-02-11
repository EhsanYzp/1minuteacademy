import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import './Timer.css';

function Timer({ timeRemaining }) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const isLow = timeRemaining <= 10;
  const isCritical = timeRemaining <= 5;

  const [announcement, setAnnouncement] = useState('');
  const lastAnnouncedRef = useRef(null);

  useEffect(() => {
    const remainingSeconds = Number.isFinite(timeRemaining) ? Math.max(0, Math.floor(timeRemaining)) : 0;
    const shouldAnnounce = remainingSeconds === 30 || remainingSeconds === 10 || remainingSeconds === 5 || remainingSeconds === 0;
    if (!shouldAnnounce) return;
    if (lastAnnouncedRef.current === remainingSeconds) return;
    lastAnnouncedRef.current = remainingSeconds;

    if (remainingSeconds === 0) {
      setAnnouncement("Time's up");
      return;
    }

    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;

    const parts = [];
    if (mins > 0) parts.push(`${mins} minute${mins === 1 ? '' : 's'}`);
    if (secs > 0) parts.push(`${secs} second${secs === 1 ? '' : 's'}`);
    const pretty = parts.length > 0 ? parts.join(' ') : `${remainingSeconds} seconds`;

    setAnnouncement(`${pretty} remaining`);
  }, [timeRemaining]);

  const ariaTimeRemaining = `${minutes} minute${minutes === 1 ? '' : 's'} ${seconds} second${seconds === 1 ? '' : 's'} remaining`;

  return (
    <motion.div 
      className={`timer ${isLow ? 'low' : ''} ${isCritical ? 'critical' : ''}`}
      animate={isCritical ? { scale: [1, 1.1, 1] } : {}}
      transition={{ duration: 0.5, repeat: isCritical ? Infinity : 0 }}
    >
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {announcement}
      </div>
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
        <div className="timer-display" role="timer" aria-label={ariaTimeRemaining} aria-live="off">
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
