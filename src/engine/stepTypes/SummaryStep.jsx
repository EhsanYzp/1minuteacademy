import { motion } from 'framer-motion';
import './stepTypes.css';

export default function SummaryStep({ step }) {
  const points = Array.isArray(step.points) ? step.points : [];
  const uses = Array.isArray(step.uses) ? step.uses : [];

  return (
    <div className="step step-summary">
      <motion.div className="step-emoji" animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.15, 1] }} transition={{ duration: 1, repeat: Infinity }}>
        🏆
      </motion.div>
      <h2 className="step-title">{step.title ?? 'You Did It!'}</h2>

      <div className="summary-points">
        {points.map((p, idx) => (
          <motion.div key={idx} className="summary-pill" initial={{ x: -15, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.15 * idx }}>
            {p}
          </motion.div>
        ))}
      </div>

      {uses.length > 0 && (
        <div className="summary-uses">
          <div className="uses-label">Used for:</div>
          <div className="uses-icons">
            {uses.map((u, i) => {
              const icon = typeof u === 'string' ? u : (u?.icon ?? '✨');
              const text = typeof u === 'string' ? '' : (u?.text ?? '');

              return (
                <span key={i} className="use-chip" title={text || undefined}>
                  <span className="use-icon">{icon}</span>
                  {text ? <span className="use-text">{text}</span> : null}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {step.congrats && (
        <motion.div className="summary-congrats" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.2, repeat: Infinity }}>
          {step.congrats}
        </motion.div>
      )}
    </div>
  );
}
