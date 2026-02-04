import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import './Home.css';

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
            ⏱️ Strictly 60 seconds (no pause)
          </motion.div>
          <h1 className="hero-title">
            Learn Anything in <span className="highlight">One Minute</span>
          </h1>
          <p className="hero-subtitle">
            Fast, interactive lessons that fit into your day.
            <br />No doomscrolling — just one minute of progress.
          </p>

          <motion.div className="hero-cta" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Link className="cta primary" to="/topics">
              🚀 Start
            </Link>
            <a className="cta secondary" href="#how-it-works">
              How it works
            </a>
          </motion.div>
        </motion.div>

        <motion.section 
          id="how-it-works"
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
              <p>Browse categories or search</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-icon">2️⃣</div>
              <h3>Hit Start</h3>
              <p>Start the 60-second timer</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-icon">3️⃣</div>
              <h3>Learn & Play</h3>
              <p>Interactive steps, then earn XP</p>
            </div>
          </div>

          <div className="how-cta">
            <Link className="cta primary" to="/topics">
              Browse topics
            </Link>
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
