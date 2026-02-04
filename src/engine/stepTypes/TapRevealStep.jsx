import { useState } from 'react';
import { motion } from 'framer-motion';
import './stepTypes.css';

export default function TapRevealStep({ step, onInteract, interacted }) {
  const [open, setOpen] = useState(Boolean(interacted));

  function onTap() {
    if (open) return;
    setOpen(true);
    onInteract?.();
  }

  const items = Array.isArray(step.items) ? step.items : [];
  const successText = step.successText ?? '✅ Nice!';

  return (
    <div className="step step-reveal">
      <h2 className="step-title">{step.title}</h2>
      <p className="step-text">{step.prompt ?? 'Tap to reveal!'}</p>

      <motion.div
        className={'reveal-box' + (open ? ' open' : '')}
        onClick={onTap}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        role="button"
        tabIndex={0}
      >
        {!open ? (
          <motion.div className="reveal-closed" animate={{ y: [0, -6, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
            <div className="reveal-click">👆</div>
            <div>{step.prompt ?? 'Tap to open!'}</div>
          </motion.div>
        ) : (
          <motion.div className="reveal-items" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            {items.map((it, idx) => (
              <div className="reveal-item" key={idx}>
                <span className="reveal-icon">{it.icon ?? '✨'}</span>
                <span className="reveal-text">{it.text ?? ''}</span>
              </div>
            ))}
          </motion.div>
        )}
      </motion.div>

      {open && <div className="step-success">{successText}</div>}
    </div>
  );
}
