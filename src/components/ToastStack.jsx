import { AnimatePresence, motion } from 'framer-motion';
import './ToastStack.css';

export default function ToastStack({ toasts, onDismiss }) {
  const items = Array.isArray(toasts) ? toasts : [];

  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <motion.div
            key={t.id}
            className={`toast ${t.variant ? `toast--${t.variant}` : ''}`}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <div className="toast-body">
              {t.emoji ? (
                <div className="toast-emoji" aria-hidden="true">{t.emoji}</div>
              ) : null}
              <div className="toast-text">
                <div className="toast-title">{t.title}</div>
                {t.message ? <div className="toast-message">{t.message}</div> : null}
              </div>
            </div>

            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss"
              onClick={() => onDismiss?.(t.id)}
            >
              ×
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
