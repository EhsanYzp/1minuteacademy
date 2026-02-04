import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import './stepTypes.css';

export default function TapSprintStep({ step, onInteract, interacted }) {
  const target = Math.max(1, Number(step.targetTaps ?? step.target ?? 8));
  const variant = step.variant ?? 'meter';

  const [taps, setTaps] = useState(Boolean(interacted) ? target : 0);

  const progress = useMemo(() => Math.max(0, Math.min(1, taps / target)), [taps, target]);
  const done = taps >= target;

  const title = step.title;
  const prompt = step.prompt ?? 'Tap fast!';
  const buttonLabel = step.buttonLabel ?? step.cta ?? 'TAP';
  const successText = step.successText ?? '✅ Charged!';

  function tap() {
    if (done) return;
    setTaps((prev) => {
      const next = prev + 1;
      if (next >= target) onInteract?.();
      return next;
    });
  }

  return (
    <div className={"step step-sprint" + (variant === 'battery' ? ' battery' : '')}>
      <h2 className="step-title">{title}</h2>
      <p className="step-text">{prompt}</p>

      <div className="sprint-meter" aria-label="progress">
        <div className="sprint-meter-track">
          <motion.div
            className="sprint-meter-fill"
            initial={false}
            animate={{ scaleX: progress }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          />
        </div>
        <div className="sprint-meter-label">{done ? '100%' : `${Math.round(progress * 100)}%`}</div>
      </div>

      <motion.button
        type="button"
        className={'sprint-button' + (done ? ' done' : '')}
        onClick={tap}
        whileTap={{ scale: 0.96 }}
        whileHover={{ scale: 1.03 }}
        disabled={done}
      >
        <motion.div
          className="sprint-button-inner"
          animate={!done ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={{ duration: 0.6, repeat: !done ? Infinity : 0 }}
        >
          {buttonLabel}
        </motion.div>
        {!done && <div className="sprint-sub">{target - taps} taps left</div>}
      </motion.button>

      {done && <div className="step-success">{successText}</div>}
    </div>
  );
}
