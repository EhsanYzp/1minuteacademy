import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import SubjectCard from '../components/SubjectCard';
import './Home.css';

const subjects = [
  {
    id: 'blockchain',
    title: 'What is Blockchain?',
    emoji: '🔗',
    color: '#4ECDC4',
    description: 'Learn how blockchain technology works in 60 seconds!',
    difficulty: 'Beginner',
  },
  {
    id: 'ai',
    title: 'What is AI?',
    emoji: '🤖',
    color: '#A06CD5',
    description: 'Understand artificial intelligence basics quickly!',
    difficulty: 'Beginner',
    comingSoon: true,
  },
  {
    id: 'quantum',
    title: 'Quantum Computing',
    emoji: '⚛️',
    color: '#FF6B6B',
    description: 'Quantum computers explained simply!',
    difficulty: 'Intermediate',
    comingSoon: true,
  },
  {
    id: 'crypto',
    title: 'Cryptocurrency',
    emoji: '💰',
    color: '#FF9F43',
    description: 'Digital money made easy to understand!',
    difficulty: 'Beginner',
    comingSoon: true,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
    },
  },
};

function Home() {
  return (
    <motion.div
      className="home"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Header />
      
      <main className="home-main">
        <motion.div 
          className="hero"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, type: 'spring' }}
        >
          <motion.div 
            className="hero-badge"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            ⏱️ Just 60 Seconds!
          </motion.div>
          <h1 className="hero-title">
            Learn Anything in <span className="highlight">One Minute</span>
          </h1>
          <p className="hero-subtitle">
            Pick a topic, hit start, and become smarter in 60 seconds! 
            <br />
            Learning has never been this fun! 🎮
          </p>
        </motion.div>

        <motion.section 
          className="subjects-section"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.h2 className="section-title" variants={itemVariants}>
            🎯 Choose Your Adventure
          </motion.h2>
          
          <div className="subjects-grid">
            {subjects.map((subject, index) => (
              <motion.div key={subject.id} variants={itemVariants}>
                <SubjectCard subject={subject} index={index} />
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section 
          className="how-it-works"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="section-title">🎮 How It Works</h2>
          <div className="steps-container">
            <div className="step">
              <div className="step-icon">1️⃣</div>
              <h3>Pick a Topic</h3>
              <p>Choose what you want to learn</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-icon">2️⃣</div>
              <h3>Hit Start</h3>
              <p>Begin your 60-second journey</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-icon">3️⃣</div>
              <h3>Learn & Play</h3>
              <p>Interactive fun learning!</p>
            </div>
          </div>
        </motion.section>
      </main>

      <footer className="home-footer">
        <p>Made with 💖 for curious minds</p>
      </footer>
    </motion.div>
  );
}

export default Home;
