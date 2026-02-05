import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Timer from '../../components/Timer';
import './story.css';

const BEAT_DURATION = 10000; // 10 seconds per beat
const QUIZ_AUTO_REVEAL_AT = 4; // Auto-reveal answer when 4 seconds remaining

export default function StoryRenderer({ story, timeRemaining, onComplete }) {
  const beats = ['hook', 'buildup', 'discovery', 'twist', 'punchline'];
  const [currentBeat, setCurrentBeat] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [autoRevealed, setAutoRevealed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [waitingForTimer, setWaitingForTimer] = useState(false);

  const isStoryComplete = currentBeat >= beats.length;
  const beatKey = beats[currentBeat];
  const beatData = story?.story?.[beatKey];

  // Auto-advance through story beats
  useEffect(() => {
    if (showQuiz || isStoryComplete) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const beatProgress = Math.min(elapsed / BEAT_DURATION, 1);
      setProgress(((currentBeat + beatProgress) / beats.length) * 100);

      if (elapsed >= BEAT_DURATION) {
        if (currentBeat < beats.length - 1) {
          setCurrentBeat(prev => prev + 1);
        } else {
          setShowQuiz(true);
          setProgress(100);
        }
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [currentBeat, showQuiz, isStoryComplete, beats.length]);

  const handleAnswer = (index) => {
    if (answered) return;
    setSelectedAnswer(index);
    setAnswered(true);
    setWaitingForTimer(true);
  };

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

  return (
    <div className="story-renderer">
      {/* Timer */}
      <div className="story-timer">
        <Timer timeRemaining={timeRemaining} />
      </div>

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
          </motion.div>
        ) : (
          <motion.div
            key="quiz"
            className="story-quiz"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="quiz-question">{story.quiz.question}</h2>

            <div className="quiz-options">
              {story.quiz.options.map((option, i) => (
                <motion.button
                  key={i}
                  className={`quiz-option ${getOptionClass(i)}`}
                  onClick={() => handleAnswer(i)}
                  whileTap={{ scale: 0.98 }}
                  disabled={answered}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
