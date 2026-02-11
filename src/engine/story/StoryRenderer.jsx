import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './story.css';

const BEAT_DURATION = 8000; // 8 seconds per beat
const QUIZ_AUTO_REVEAL_AT = 4; // Auto-reveal answer when 4 seconds remaining

const BEATS = ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline'];

function coercePresentationStyle(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'cards' || s === 'split' || s === 'minimal' || s === 'bold' || s === 'dark' || s === 'paper' || s === 'terminal' || s === 'glass') return s;
  return 'focus';
}

export default function StoryRenderer({
  story,
  topicTitle,
  timeRemaining,
  onComplete,
  onClose,
  hideTopbar = false,
  presentationStyle = 'focus',
  totalSeconds = 60,
}) {
  const quizQuestionId = useId();
  const [currentBeat, setCurrentBeat] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [autoRevealed, setAutoRevealed] = useState(false);
  const [waitingForTimer, setWaitingForTimer] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const quizOptionsRef = useRef(null);

  const isStoryComplete = currentBeat >= BEATS.length;
  const beatKey = BEATS[currentBeat];
  const beatData = story?.story?.[beatKey];

  // Reset story state when the lesson restarts.
  useEffect(() => {
    if (timeRemaining !== totalSeconds) return;
    if (currentBeat === 0 && !showQuiz && !answered && selectedAnswer == null) return;

    setCurrentBeat(0);
    setShowQuiz(false);
    setSelectedAnswer(null);
    setAnswered(false);
    setAutoRevealed(false);
    setWaitingForTimer(false);
  }, [timeRemaining, totalSeconds, currentBeat, showQuiz, answered, selectedAnswer]);

  // Derive story beat / quiz visibility from the 1Hz lesson timer.
  // This keeps beats aligned to wall-clock time without a high-frequency interval.
  useEffect(() => {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return;

    const beatDurationSeconds = BEAT_DURATION / 1000;
    const totalBeatsSeconds = BEATS.length * beatDurationSeconds;
    const elapsedSeconds = Math.max(0, totalSeconds - Math.max(0, timeRemaining));

    if (elapsedSeconds >= totalBeatsSeconds) {
      if (!showQuiz) setShowQuiz(true);
      if (currentBeat !== BEATS.length) setCurrentBeat(BEATS.length);
      return;
    }

    if (showQuiz) return;

    const nextBeat = Math.min(BEATS.length - 1, Math.floor(elapsedSeconds / beatDurationSeconds));
    if (nextBeat !== currentBeat) setCurrentBeat(nextBeat);
  }, [timeRemaining, totalSeconds, currentBeat, showQuiz]);

  const handleAnswer = (index) => {
    if (answered) return;
    setActiveOptionIndex(index);
    setSelectedAnswer(index);
    setAnswered(true);
    setWaitingForTimer(true);
  };

  useEffect(() => {
    if (!showQuiz) return;
    setActiveOptionIndex(0);
  }, [showQuiz]);

  useEffect(() => {
    if (!showQuiz) return;
    if (!autoRevealed) return;
    if (selectedAnswer != null) return;
    const correctIndex = story?.quiz?.correct;
    if (Number.isInteger(correctIndex)) setActiveOptionIndex(correctIndex);
  }, [showQuiz, autoRevealed, selectedAnswer, story?.quiz?.correct]);

  // Wait for timer to hit 0 after answering
  useEffect(() => {
    if (waitingForTimer && timeRemaining <= 0) {
      onComplete?.();
    }
  }, [waitingForTimer, timeRemaining, onComplete]);

  // Auto-reveal quiz answer in the last 4 seconds if not answered
  useEffect(() => {
    if (showQuiz && !answered && timeRemaining <= QUIZ_AUTO_REVEAL_AT && timeRemaining > 0) {
      setAutoRevealed(true);
      setAnswered(true);
      setWaitingForTimer(true);
    }
  }, [showQuiz, answered, timeRemaining]);

  const getOptionClass = (index) => {
    if (!answered) return '';
    if (index === story.quiz.correct) return 'correct';
    if (index === selectedAnswer && index !== story.quiz.correct) return 'incorrect';
    return 'dimmed';
  };

  const describedById = useMemo(() => {
    if (!answered) return undefined;
    return `${quizQuestionId}-feedback`;
  }, [answered, quizQuestionId]);

  const ariaCheckedIndex = useMemo(() => {
    if (selectedAnswer != null) return selectedAnswer;
    if (autoRevealed) return story?.quiz?.correct ?? null;
    return null;
  }, [selectedAnswer, autoRevealed, story?.quiz?.correct]);

  const focusOptionAt = (index) => {
    const root = quizOptionsRef.current;
    if (!root) return;
    const radios = root.querySelectorAll('[role="radio"]');
    const target = radios?.[index];
    if (target && typeof target.focus === 'function') target.focus();
  };

  const handleQuizOptionsKeyDown = (e) => {
    if (answered) return;
    const key = e.key;
    if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;

    const optionsCount = story?.quiz?.options?.length ?? 0;
    if (optionsCount <= 0) return;
    e.preventDefault();

    let nextIndex = activeOptionIndex;
    if (key === 'Home') nextIndex = 0;
    else if (key === 'End') nextIndex = optionsCount - 1;
    else if (key === 'ArrowUp' || key === 'ArrowLeft') nextIndex = (activeOptionIndex - 1 + optionsCount) % optionsCount;
    else if (key === 'ArrowDown' || key === 'ArrowRight') nextIndex = (activeOptionIndex + 1) % optionsCount;

    setActiveOptionIndex(nextIndex);
    focusOptionAt(nextIndex);
  };

  const style = coercePresentationStyle(presentationStyle);

  return (
    <div className={`story-renderer style-${style}`}>
      {/* Topbar - can be hidden when rendered via journey blocks */}
      {!hideTopbar && (
        <div className="story-topbar">
          <button className="story-close-btn" onClick={onClose} aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div className="story-topic-title">
            <span className="story-topic-emoji">{story?.emoji || '📚'}</span>
            <span className="story-topic-name">{topicTitle || 'Learning...'}</span>
          </div>
          <div className="story-timer-large">
            <span className="story-timer-value">{Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</span>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!showQuiz ? (
          <motion.div
            key={beatKey}
            className={`story-beat ${beatKey}`}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.5 }}
          >
            <div className="story-beat-inner">
              {/* Visual */}
              <motion.div
                className="story-visual"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                {beatData?.visual}
              </motion.div>

              {/* Animated text */}
              <motion.p
                className="story-text"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.6 }}
              >
                {beatData?.text}
              </motion.p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="quiz"
            className="story-quiz"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="story-quiz-inner">
              <h2 id={quizQuestionId} className="quiz-question">{story.quiz.question}</h2>

              <div
                ref={quizOptionsRef}
                className="quiz-options"
                role="radiogroup"
                aria-labelledby={quizQuestionId}
                aria-describedby={describedById}
                aria-disabled={answered}
                onKeyDown={handleQuizOptionsKeyDown}
              >
                {story.quiz.options.map((option, i) => (
                  <motion.button
                    key={i}
                    className={`quiz-option ${getOptionClass(i)}`}
                    onClick={() => handleAnswer(i)}
                    onFocus={() => setActiveOptionIndex(i)}
                    onKeyDown={(e) => {
                      if (answered) return;
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        handleAnswer(i);
                      }
                    }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    role="radio"
                    aria-checked={ariaCheckedIndex === i}
                    aria-disabled={answered}
                    tabIndex={activeOptionIndex === i ? 0 : -1}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * i }}
                  >
                    {option}
                  </motion.button>
                ))}
              </div>

              {answered && (
                <motion.p
                  id={describedById}
                  className={`quiz-feedback ${autoRevealed ? 'auto-revealed' : selectedAnswer === story.quiz.correct ? 'correct' : 'incorrect'}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {autoRevealed
                    ? '⏱️ Time\'s up! Here\'s the answer'
                    : selectedAnswer === story.quiz.correct
                      ? '✓ Correct!'
                      : '✗ Not quite'}
                </motion.p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
