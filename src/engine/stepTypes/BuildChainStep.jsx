import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import './stepTypes.css';

export default function BuildChainStep({ step, onInteract, interacted }) {
  const target = Number(step.target ?? 2);
  const [built, setBuilt] = useState(interacted ? target : 0);

  const remaining = useMemo(() => Math.max(0, target - built), [target, built]);

  function addBlock() {
    if (built >= target) return;
    const next = built + 1;
    setBuilt(next);
    if (next >= target) onInteract?.();
  }

  return (
    <div className="step step-chain">
      <h2 className="step-title">{step.title}</h2>
      {step.hint && <p className="step-text">{step.hint}</p>}

      <div className="chain-row">
        <div className="chain-block genesis">
          <div className="chain-name">{step.genesisLabel ?? 'Genesis'}</div>
          <div className="chain-hash">#00000</div>
        </div>

        {Array.from({ length: built }).map((_, i) => (
          <div className="chain-link" key={i}>
            <div className="chain-connector">
              <motion.div className="connector-line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} />
              <span className="link-emoji">🔗</span>
            </div>
            <div className="chain-block">
              <div className="chain-name">{step.blockLabel ?? 'Block'} {i + 1}</div>
              <div className="chain-hash">#{String(i + 1).padStart(5, '0')}</div>
            </div>
          </div>
        ))}
      </div>

      {built < target ? (
        <motion.button
          className="step-button"
          onClick={addBlock}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.98 }}
        >
          ➕ Add Block ({remaining} left)
        </motion.button>
      ) : (
        <div className="step-success">✅ Chain built! Tampering breaks the links.</div>
      )}
    </div>
  );
}
