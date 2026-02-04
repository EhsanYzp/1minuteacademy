import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import './stepTypes.css';

function normalizeOptions(step) {
  if (Array.isArray(step?.options) && step.options.length >= 2) return step.options.slice(0, 2);

  const left = step?.left;
  const right = step?.right;
  if (left && right) return [left, right];

  return [
    { id: 'a', text: 'Option A' },
    { id: 'b', text: 'Option B' },
  ];
}

function getCorrectId(step, options) {
  if (typeof step?.correctOptionId === 'string' && step.correctOptionId.length > 0) return step.correctOptionId;
  const correctIndex = Number(step?.correctIndex);
  if (Number.isFinite(correctIndex) && correctIndex >= 0 && correctIndex < options.length) return options[correctIndex]?.id;
  const flagged = options.find((o) => o?.correct);
  return flagged?.id ?? null;
}

export default function EitherOrStep({ step, onInteract, interacted }) {
  const options = useMemo(() => normalizeOptions(step).map((o, i) => ({ id: o?.id ?? String(i), ...o })), [step]);
  const correctId = useMemo(() => getCorrectId(step, options), [step, options]);

  const [pickedId, setPickedId] = useState(null);
  const [done, setDone] = useState(Boolean(interacted));

  const prompt = step.prompt ?? step.question ?? 'This or that?';
  const variant = step.variant ?? 'thisOrThat';

  function pick(id) {
    if (done) return;
    setPickedId(id);
    setDone(true);
    onInteract?.();
  }

  const showFeedback = done && pickedId != null;
  const isCorrect = showFeedback && correctId != null ? pickedId === correctId : null;

  const successText = step.successText ?? '✅ Nice!';
  const revealText = step.revealText ?? (isCorrect === false ? '✅ The correct answer is highlighted.' : null);

  return (
    <div className={"step step-eitheror" + (variant === 'mythFact' ? ' mythfact' : '')}>
      <h2 className="step-title">{step.title}</h2>
      <p className="step-text">{prompt}</p>

      <div className="eitheror-row">
        {options.map((opt) => {
          const isPicked = pickedId === opt.id;
          const isCorrectOpt = correctId != null && opt.id === correctId;

          return (
            <motion.button
              key={opt.id}
              type="button"
              className={
                'eitheror-btn' +
                (isPicked ? ' picked' : '') +
                (showFeedback && isCorrectOpt ? ' correct' : '')
              }
              onClick={() => pick(opt.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={done}
            >
              <div className="eitheror-emoji">{opt.icon ?? (variant === 'mythFact' ? (opt.id === options[0].id ? '🧨' : '✅') : '✨')}</div>
              <div className="eitheror-text">{opt.text ?? ''}</div>
            </motion.button>
          );
        })}
      </div>

      {showFeedback && (
        <div className="eitheror-feedback">
          {isCorrect === true ? (
            <div className="step-success">{successText}</div>
          ) : (
            <div className="eitheror-reveal">{revealText}</div>
          )}
          {step.explain && <div className="eitheror-explain">{step.explain}</div>}
        </div>
      )}
    </div>
  );
}
