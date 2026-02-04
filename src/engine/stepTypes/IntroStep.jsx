import { motion } from 'framer-motion';
import './stepTypes.css';

export default function IntroStep({ step }) {
  return (
    <div className="step step-intro">
      <motion.div
        className="step-emoji"
        animate={{ scale: [1, 1.2, 1], rotate: [0, 8, -8, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {step.emoji ?? '🎯'}
      </motion.div>
      <h2 className="step-title">{step.title}</h2>
      {step.text && <p className="step-text">{step.text}</p>}
    </div>
  );
}
