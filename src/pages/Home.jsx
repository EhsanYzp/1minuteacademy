import { motion } from 'framer-motion';
import Header from '../components/Header';
import SubjectCard from '../components/SubjectCard';
import { useEffect, useMemo, useState } from 'react';
import { listTopics } from '../services/topics';
import './Home.css';

const fallbackSubjects = [
  {
    id: 'blockchain',
    title: 'What is Blockchain?',
    emoji: '🔗',
    color: '#4ECDC4',
    description: 'Connect Supabase to load topics from the database.',
    difficulty: 'Beginner',
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
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const data = await listTopics();
        if (mounted) setTopics(data);
      } catch (e) {
        if (mounted) setError(e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const subjects = useMemo(() => {
    if (topics.length > 0) return topics;
    return fallbackSubjects;
  }, [topics]);

  // When topics load asynchronously, new cards can mount after the parent
  // variant animation already completed. Keying the section forces a re-run
  // so newly added cards (like "quantum") don’t remain invisible.
  const subjectsKey = useMemo(() => subjects.map((s) => s.id).join('|'), [subjects]);

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
          key={subjectsKey}
          className="subjects-section"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.h2 className="section-title" variants={itemVariants}>
            🎯 Choose Your Adventure
          </motion.h2>

          {error && (
            <motion.div className="home-error" variants={itemVariants}>
              <strong>Couldn’t load topics from Supabase.</strong>
              <div className="home-error-sub">Set env vars from `.env.example` and run Supabase SQL in `supabase/001_init.sql`.</div>
            </motion.div>
          )}
          {loading && (
            <motion.div className="home-loading" variants={itemVariants}>
              Loading topics…
            </motion.div>
          )}
          
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
