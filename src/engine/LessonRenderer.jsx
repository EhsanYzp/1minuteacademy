import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import IntroStep from './stepTypes/IntroStep';
import TapRevealStep from './stepTypes/TapRevealStep';
import BuildChainStep from './stepTypes/BuildChainStep';
import SummaryStep from './stepTypes/SummaryStep';
import EitherOrStep from './stepTypes/EitherOrStep';
import TapSprintStep from './stepTypes/TapSprintStep';
import RecipeStep from './stepTypes/RecipeStep';
import './lessonRenderer.css';

const stepComponents = {
  intro: IntroStep,
  tapReveal: TapRevealStep,
  buildChain: BuildChainStep,
  summary: SummaryStep,
  eitherOr: EitherOrStep,
  tapSprint: TapSprintStep,
  recipe: RecipeStep,
};

function getActiveStepIndex(steps, totalSeconds, timeRemaining) {
  const elapsed = Math.max(0, Math.min(totalSeconds, totalSeconds - timeRemaining));
  let cursor = 0;
  for (let i = 0; i < steps.length; i += 1) {
    const duration = Number(steps[i].seconds ?? 0);
    const next = cursor + duration;
    if (elapsed >= cursor && elapsed < next) return i;
    cursor = next;
  }
  return Math.max(0, steps.length - 1);
}

export default function LessonRenderer({ lesson, timeRemaining }) {
  const steps = lesson?.steps ?? [];
  const totalSeconds = Number(lesson?.totalSeconds ?? 60);

  const activeIndex = useMemo(
    () => getActiveStepIndex(steps, totalSeconds, timeRemaining),
    [steps, totalSeconds, timeRemaining]
  );

  const activeStep = steps[activeIndex];
  const Step = activeStep ? stepComponents[activeStep.type] : null;

  const [interactions, setInteractions] = useState({});

  function markInteracted(stepId) {
    setInteractions((prev) => ({ ...prev, [stepId]: true }));
  }

  if (!lesson || steps.length === 0 || !activeStep || !Step) {
    return (
      <div className="lesson-renderer-empty">
        <h2>🚧 Lesson not available</h2>
        <p>This topic doesn't have a valid lesson yet.</p>
      </div>
    );
  }

  return (
    <div className="lesson-renderer">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep.id}
          className="lesson-renderer-step"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.25 }}
        >
          <Step
            step={activeStep}
            interacted={Boolean(interactions[activeStep.id])}
            onInteract={() => markInteracted(activeStep.id)}
          />
        </motion.div>
      </AnimatePresence>

      <div className="lesson-renderer-dots">
        {steps.map((s, i) => (
          <div
            key={s.id}
            className={
              'lesson-dot' +
              (i === activeIndex ? ' active' : '') +
              (i < activeIndex ? ' done' : '')
            }
            title={s.title}
          />
        ))}
      </div>
    </div>
  );
}
