import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './BlockchainLesson.css';

// Lesson content organized by time segments - SIMPLIFIED for better pacing
const lessonSteps = [
  {
    id: 'intro',
    timeRange: [60, 52],
    title: 'Welcome to Blockchain!',
    type: 'intro'
  },
  {
    id: 'what-is-block',
    timeRange: [52, 38],
    title: 'What is a Block?',
    type: 'block-demo'
  },
  {
    id: 'chain-them',
    timeRange: [38, 20],
    title: 'Chaining Blocks Together',
    type: 'chain-demo'
  },
  {
    id: 'summary',
    timeRange: [20, 0],
    title: 'You Did It!',
    type: 'summary'
  }
];

function BlockchainLesson({ timeRemaining, onComplete }) {
  const [activeStep, setActiveStep] = useState(0);
  const [interactionDone, setInteractionDone] = useState({});

  useEffect(() => {
    const currentStep = lessonSteps.findIndex(
      step => timeRemaining <= step.timeRange[0] && timeRemaining > step.timeRange[1]
    );
    if (currentStep !== -1 && currentStep !== activeStep) {
      setActiveStep(currentStep);
    }
    
    if (timeRemaining <= 0) {
      onComplete();
    }
  }, [timeRemaining, activeStep, onComplete]);

  const currentLesson = lessonSteps[activeStep];

  const handleInteraction = (stepId) => {
    setInteractionDone(prev => ({ ...prev, [stepId]: true }));
  };

  return (
    <div className="blockchain-lesson">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentLesson.id}
          className="lesson-step"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.4 }}
        >
          {currentLesson.type === 'intro' && (
            <IntroSection />
          )}
          
          {currentLesson.type === 'block-demo' && (
            <BlockDemo 
              onInteract={() => handleInteraction('block')}
              isDone={interactionDone['block']}
            />
          )}
          
          {currentLesson.type === 'chain-demo' && (
            <ChainDemo 
              onInteract={() => handleInteraction('chain')}
              isDone={interactionDone['chain']}
            />
          )}
          
          {currentLesson.type === 'summary' && (
            <SummarySection />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Step Indicators */}
      <div className="step-indicators">
        {lessonSteps.map((step, index) => (
          <motion.div
            key={step.id}
            className={`step-dot ${index === activeStep ? 'active' : ''} ${index < activeStep ? 'completed' : ''}`}
            whileHover={{ scale: 1.2 }}
          />
        ))}
      </div>
    </div>
  );
}

// Intro Section - Quick hook
function IntroSection() {
  return (
    <motion.div className="intro-section">
      <motion.div 
        className="big-emoji"
        animate={{ 
          scale: [1, 1.2, 1],
          rotate: [0, 10, -10, 0]
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        🔗
      </motion.div>
      <h2>Blockchain = Digital Notebook</h2>
      <p className="intro-text">
        Everyone can <span className="highlight">read it</span>, but 
        <span className="highlight">nobody can cheat!</span>
      </p>
    </motion.div>
  );
}

// Block Demo
function BlockDemo({ onInteract, isDone }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = () => {
    setIsOpen(true);
    onInteract();
  };

  return (
    <div className="block-demo-section">
      <h2>🧱 What is a Block?</h2>
      <p>A block is like a <strong>container</strong> that holds information!</p>
      
      <motion.div 
        className={`interactive-block ${isOpen ? 'open' : ''}`}
        onClick={handleClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {!isOpen ? (
          <motion.div 
            className="block-closed"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <span className="click-icon">👆</span>
            <span>Click to open!</span>
          </motion.div>
        ) : (
          <motion.div 
            className="block-content"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="block-item">
              <span className="item-icon">📝</span>
              <span className="item-text">Data</span>
            </div>
            <div className="block-item">
              <span className="item-icon">🔢</span>
              <span className="item-text">Unique ID</span>
            </div>
            <div className="block-item">
              <span className="item-icon">🔙</span>
              <span className="item-text">Link to Previous</span>
            </div>
          </motion.div>
        )}
      </motion.div>

      {isDone && (
        <motion.p 
          className="success-text"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          ✅ Great! Each block contains important data!
        </motion.p>
      )}
    </div>
  );
}

// Chain Demo
function ChainDemo({ onInteract, isDone }) {
  const [chainBuilt, setChainBuilt] = useState(0);

  const addBlock = () => {
    if (chainBuilt < 2) {
      setChainBuilt(prev => prev + 1);
      if (chainBuilt === 1) {
        onInteract();
      }
    }
  };

  return (
    <div className="chain-demo-section">
      <h2>⛓️ Chaining Blocks</h2>
      <p>Blocks are <strong>linked together</strong> like a chain!</p>
      
      <div className="chain-container">
        <motion.div 
          className="genesis-block"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="block-visual">
            <span>Genesis</span>
            <span className="block-hash">#00000</span>
          </div>
        </motion.div>

        {[...Array(chainBuilt)].map((_, i) => (
          <motion.div 
            key={i}
            className="chain-link-group"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="chain-connector">
              <motion.div 
                className="connector-line"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
              />
              <span className="link-icon">🔗</span>
            </div>
            <div className="block-visual">
              <span>Block {i + 1}</span>
              <span className="block-hash">#{String(i + 1).padStart(5, '0')}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {chainBuilt < 2 && (
        <motion.button
          className="add-block-btn"
          onClick={addBlock}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          animate={{ 
            boxShadow: ['0 0 0 0 rgba(78, 205, 196, 0.4)', '0 0 0 15px rgba(78, 205, 196, 0)']
          }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          ➕ Add Block ({2 - chainBuilt} left)
        </motion.button>
      )}

      {isDone && (
        <motion.p 
          className="success-text"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          ✅ Perfect! Each block points to the previous one!
        </motion.p>
      )}
    </div>
  );
}

// Security Demo
function SecurityDemo({ onInteract, isDone }) {
  const [attempted, setAttempted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const attemptHack = () => {
    setAttempted(true);
    setTimeout(() => {
      setShowExplanation(true);
      onInteract();
    }, 1000);
  };

  return (
    <div className="security-demo-section">
      <h2>🔒 Why So Secure?</h2>
      <p>Try to hack the blockchain!</p>
      
      <div className="security-visual">
        <div className="blockchain-line">
          {[1, 2, 3].map(num => (
            <motion.div 
              key={num}
              className={`secure-block ${attempted ? 'shake' : ''}`}
              animate={attempted ? { x: [-5, 5, -5, 5, 0] } : {}}
              transition={{ duration: 0.5 }}
            >
              <span className="lock-icon">{attempted ? '🔐' : '🔓'}</span>
              <span>Block {num}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {!attempted ? (
        <motion.button
          className="hack-btn"
          onClick={attemptHack}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          🦹 Try to Change Data
        </motion.button>
      ) : (
        <motion.div 
          className="hack-result"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <span className="result-icon">🚫</span>
          <span>BLOCKED!</span>
        </motion.div>
      )}

      {showExplanation && (
        <motion.div 
          className="explanation-box"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p>
            <strong>Why it failed:</strong> Changing one block would break 
            the chain! Everyone's copy would notice the difference immediately.
          </p>
          <div className="security-points">
            <span>📋 Thousands of copies exist</span>
            <span>🔍 Everyone verifies changes</span>
            <span>🔗 Blocks are mathematically linked</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Uses Section
function UsesSection() {
  const uses = [
    { icon: '💰', title: 'Cryptocurrency', desc: 'Bitcoin, Ethereum' },
    { icon: '📋', title: 'Smart Contracts', desc: 'Automatic agreements' },
    { icon: '🏥', title: 'Medical Records', desc: 'Secure health data' },
    { icon: '🗳️', title: 'Voting', desc: 'Tamper-proof elections' },
  ];

  return (
    <div className="uses-section">
      <h2>🌍 Real World Uses</h2>
      <p>Blockchain is everywhere!</p>
      
      <div className="uses-grid">
        {uses.map((use, index) => (
          <motion.div
            key={use.title}
            className="use-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.15 }}
            whileHover={{ scale: 1.05, y: -5 }}
          >
            <span className="use-icon">{use.icon}</span>
            <h3>{use.title}</h3>
            <p>{use.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Summary Section
function SummarySection() {
  return (
    <motion.div 
      className="summary-section"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <motion.div 
        className="trophy"
        animate={{ 
          rotate: [0, 10, -10, 0],
          scale: [1, 1.2, 1]
        }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        🏆
      </motion.div>
      <h2>You Did It!</h2>
      <div className="summary-points">
        <motion.div 
          className="summary-point"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          🧱 Blocks = containers of data
        </motion.div>
        <motion.div 
          className="summary-point"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          ⛓️ Each block links to the previous
        </motion.div>
        <motion.div 
          className="summary-point"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          🔒 Can't change without breaking the chain!
        </motion.div>
      </div>
      
      <motion.div 
        className="uses-quick"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        <span>Used for:</span>
        <div className="uses-icons">
          <span title="Cryptocurrency">💰</span>
          <span title="Voting">🗳️</span>
          <span title="Contracts">📋</span>
          <span title="Records">🏥</span>
        </div>
      </motion.div>
      
      <motion.p 
        className="congrats-text"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        🎉 Blockchain Expert! 🎉
      </motion.p>
    </motion.div>
  );
}

export default BlockchainLesson;
