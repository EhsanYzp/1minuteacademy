import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import Timer from '../components/Timer';
import BlockchainLesson from '../modules/BlockchainLesson';
import './LessonPage.css';

const lessonComponents = {
  blockchain: BlockchainLesson,
};

function LessonPage() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const [isStarted, setIsStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(60);

  const LessonComponent = lessonComponents[topicId];

  const handleComplete = useCallback(() => {
    setIsCompleted(true);
  }, []);

  const handleTimeUp = useCallback(() => {
    setIsCompleted(true);
  }, []);

  useEffect(() => {
    if (isStarted && !isCompleted && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isStarted, isCompleted, timeRemaining, handleTimeUp]);

  // Calculate progress based on time elapsed
  const progress = ((60 - timeRemaining) / 60) * 100;

  if (!LessonComponent) {
    return (
      <div className="lesson-page">
        <div className="lesson-error">
          <h2>🚧 Lesson not found!</h2>
          <button onClick={() => navigate('/')}>Go Home</button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="lesson-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {!isStarted ? (
        <motion.div 
          className="countdown-screen"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
        >
          <motion.div
            className="countdown-content"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h1>Ready to Learn? 🎓</h1>
            <p>You have 60 seconds to master this topic!</p>
            
            <motion.div 
              className="countdown-tips"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <div className="tip">👀 Watch closely</div>
              <div className="tip">🖱️ Interact with elements</div>
              <div className="tip">🧠 Have fun learning!</div>
            </motion.div>

            <motion.button
              className="begin-button"
              onClick={() => setIsStarted(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={{
                boxShadow: [
                  '0 0 0 0 rgba(78, 205, 196, 0.4)',
                  '0 0 0 20px rgba(78, 205, 196, 0)',
                ]
              }}
              transition={{
                boxShadow: { duration: 1.5, repeat: Infinity }
              }}
            >
              🚀 Begin Now!
            </motion.button>
          </motion.div>
        </motion.div>
      ) : isCompleted ? (
        <motion.div 
          className="completion-screen"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <motion.div
            className="completion-content"
            initial={{ y: 50 }}
            animate={{ y: 0 }}
          >
            <motion.div 
              className="completion-emoji"
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0]
              }}
              transition={{ duration: 0.5, repeat: 3 }}
            >
              🎉
            </motion.div>
            <h1>Congratulations!</h1>
            <p>You just learned about Blockchain in 60 seconds!</p>
            
            <div className="completion-stats">
              <div className="stat">
                <span className="stat-value">+50</span>
                <span className="stat-label">XP Earned</span>
              </div>
              <div className="stat">
                <span className="stat-value">🔥</span>
                <span className="stat-label">Streak!</span>
              </div>
            </div>

            <div className="completion-actions">
              <motion.button
                className="action-button primary"
                onClick={() => {
                  setIsStarted(false);
                  setIsCompleted(false);
                  setTimeRemaining(60);
                  setCurrentStep(0);
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                🔄 Try Again
              </motion.button>
              <motion.button
                className="action-button secondary"
                onClick={() => navigate('/')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                🏠 More Topics
              </motion.button>
            </div>
          </motion.div>
          
          {/* Confetti Effect */}
          <div className="confetti-container">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  backgroundColor: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A06CD5', '#FF9F43'][i % 5]
                }}
                initial={{ y: -20, opacity: 1 }}
                animate={{ 
                  y: '100vh',
                  rotate: Math.random() * 720,
                  opacity: 0
                }}
                transition={{
                  duration: 2 + Math.random() * 2,
                  delay: Math.random() * 0.5,
                  ease: 'easeOut'
                }}
              />
            ))}
          </div>
        </motion.div>
      ) : (
        <div className="lesson-container">
          <div className="lesson-header">
            <Timer timeRemaining={timeRemaining} />
            <div className="progress-container">
              <div className="progress-bar">
                <motion.div 
                  className="progress-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
              <span className="progress-text">{Math.round(progress)}% Complete</span>
            </div>
            <button 
              className="exit-button"
              onClick={() => navigate(`/topic/${topicId}`)}
            >
              ✕
            </button>
          </div>

          <div className="lesson-content">
            <LessonComponent 
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}
              timeRemaining={timeRemaining}
              onComplete={handleComplete}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default LessonPage;
