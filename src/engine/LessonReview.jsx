import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import IntroStep from './stepTypes/IntroStep';
import TapRevealStep from './stepTypes/TapRevealStep';
import BuildChainStep from './stepTypes/BuildChainStep';
import SummaryStep from './stepTypes/SummaryStep';
import EitherOrStep from './stepTypes/EitherOrStep';
import TapSprintStep from './stepTypes/TapSprintStep';
import RecipeStep from './stepTypes/RecipeStep';
import './lessonReview.css';

const stepComponents = {
  intro: IntroStep,
  tapReveal: TapRevealStep,
  buildChain: BuildChainStep,
  summary: SummaryStep,
  eitherOr: EitherOrStep,
  tapSprint: TapSprintStep,
  recipe: RecipeStep,
};

function normalizeLesson(lesson) {
  const totalSeconds = Number(lesson?.totalSeconds ?? 60);
  const steps = Array.isArray(lesson?.steps) ? lesson.steps : [];
  return { totalSeconds, steps };
}

export default function LessonReview({ lesson, title, onExit, showTopbar = true, embedded = false }) {
  const { steps } = useMemo(() => normalizeLesson(lesson), [lesson]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [interactions, setInteractions] = useState({});

  const safeIndex = Math.max(0, Math.min(steps.length - 1, activeIndex));
  const activeStep = steps[safeIndex] ?? null;
  const Step = activeStep ? stepComponents[activeStep.type] : null;

  const progress = useMemo(() => {
    if (steps.length <= 1) return 100;
    return Math.round((safeIndex / (steps.length - 1)) * 100);
  }, [safeIndex, steps.length]);

  function markInteracted(stepId) {
    setInteractions((prev) => ({ ...prev, [stepId]: true }));
  }

  const rootClassName = 'lesson-review' + (embedded ? ' embedded' : '');

  if (!lesson || steps.length === 0 || !activeStep || !Step) {
    return (
      <div className={rootClassName}>
        {showTopbar && (
          <div className="review-topbar">
            <button type="button" className="review-back" onClick={onExit}>
              ← Back
            </button>
            <div className="review-title">Review</div>
            <div className="review-spacer" />
          </div>
        )}
        <div className="review-empty">
          <h2>Nothing to review yet</h2>
          <p>This lesson doesn't have steps.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClassName}>
      {showTopbar && (
        <div className="review-topbar">
          <button type="button" className="review-back" onClick={onExit}>
            ← Back
          </button>
          <div className="review-title">
            Review{title ? `: ${title}` : ''}
            <div className="review-sub">No timer. Go at your pace.</div>
          </div>
          <div className="review-spacer" />
        </div>
      )}

      <div className="review-progress">
        <div className="review-progress-bar" aria-label="review progress">
          <motion.div className="review-progress-fill" initial={false} animate={{ width: `${progress}%` }} />
        </div>
        <div className="review-progress-text">
          Step {safeIndex + 1} / {steps.length}
        </div>
      </div>

      <div className="review-steppicker" aria-label="step list">
        {steps.map((s, i) => {
          const isActive = i === safeIndex;
          const isDone = Boolean(interactions[s.id]);
          return (
            <button
              key={s.id}
              type="button"
              className={'review-chip' + (isActive ? ' active' : '') + (isDone ? ' done' : '')}
              title={s.title}
              onClick={() => setActiveIndex(i)}
            >
              <span className="review-chip-num">{i + 1}</span>
              <span className="review-chip-title">{String(s.title ?? `Step ${i + 1}`)}</span>
            </button>
          );
        })}
      </div>

      <div className="review-step">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep.id}
            className="review-step-inner"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2 }}
          >
            <Step
              step={activeStep}
              interacted={Boolean(interactions[activeStep.id])}
              onInteract={() => markInteracted(activeStep.id)}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="review-nav">
        <button
          type="button"
          className="review-nav-btn"
          disabled={safeIndex === 0}
          onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
        >
          ← Prev
        </button>
        <button
          type="button"
          className="review-nav-btn primary"
          disabled={safeIndex >= steps.length - 1}
          onClick={() => setActiveIndex((i) => Math.min(steps.length - 1, i + 1))}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
