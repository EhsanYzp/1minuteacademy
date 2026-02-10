import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Seo from '../components/Seo';
import './Home.css';

function Home() {
  const howSteps = [
    {
      n: '01',
      icon: '🧭',
      title: 'Pick a topic',
      body: 'Browse subjects or search for exactly what you want to learn.',
      meta: 'Start free',
    },
    {
      n: '02',
      icon: '⏱️',
      title: '60-second sprint',
      body: 'Hit Start. The timer is strict — no pause — so you stay focused.',
      meta: 'No doomscrolling',
    },
    {
      n: '03',
      icon: '🎯',
      title: 'Story + quiz',
      body: 'Experience a 4-beat narrative then test yourself with a quick quiz.',
      meta: 'Engaging',
    },
    {
      n: '04',
      icon: '🔁',
      title: 'Review & keep it',
      body: 'After the sprint you can review calmly. Pro unlocks advanced topics + review mode.',
      meta: 'Optional review',
    },
  ];

  const howContainer = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: { staggerChildren: 0.08, delayChildren: 0.05 },
    },
  };

  const howItem = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      className="home"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Seo
        title="Learn anything in one minute"
        description="Learn anything in 60 seconds: story + quiz lessons that build real momentum."
        path="/"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: '1 Minute Academy',
            url: typeof window !== 'undefined' ? window.location.origin : undefined,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: '1 Minute Academy',
            url: typeof window !== 'undefined' ? window.location.origin : undefined,
          },
        ]}
      />
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
            Learn <span className="accent">Anything</span> in <span className="one-minute accent">One Minute</span>
          </h1>
          <p className="hero-subtitle">
            <span className="hero-hook">One minute. One story. Real progress.</span>
            <span className="hero-hook-sub">No doomscrolling — just focused momentum.</span>
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
          <div className="how-header">
            <h2 className="section-title">How it works</h2>
            <p className="section-subtitle">
              Designed for momentum: one focused minute, then optional review.
            </p>
          </div>

          <motion.div
            className="how-grid"
            variants={howContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-20% 0px' }}
          >
            {howSteps.map((s) => (
              <motion.div key={s.n} className="how-card" variants={howItem}>
                <div className="how-top">
                  <div className="how-num" aria-hidden="true">{s.n}</div>
                  <div className="how-icon" aria-hidden="true">{s.icon}</div>
                </div>
                <h3 className="how-title">{s.title}</h3>
                <p className="how-body">{s.body}</p>
                <div className="how-meta" aria-label="Key benefit">{s.meta}</div>
              </motion.div>
            ))}
          </motion.div>

          <div className="how-notes" aria-label="Key principles">
            <div className="how-chip">No pause timer</div>
            <div className="how-chip">Short + interactive</div>
            <div className="how-chip">Review after (calm)</div>
            <div className="how-chip">Progress when signed in</div>
          </div>

          <div className="how-cta">
            <Link className="cta primary" to="/topics">
              Browse topics
            </Link>
          </div>
        </motion.section>
      </main>
    </motion.div>
  );
}

export default Home;
