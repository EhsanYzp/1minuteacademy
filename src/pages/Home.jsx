import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Seo from '../components/Seo';
import { useAuth } from '../context/AuthContext';
import { getCurrentTier } from '../services/entitlements';
import { pickRandomEligibleTopic, pushRecentRandomId } from '../lib/surpriseTopic';
import contentStats from '../generated/contentStats.json';
import './Home.css';

function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tier = getCurrentTier(user);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const stats = contentStats && typeof contentStats === 'object' ? contentStats : { categories: 0, topics: 0, minutes: 0 };
  const categoriesCount = Number(stats.categories ?? 0) || 0;
  const subcategoriesCount = Number(stats.subcategories ?? 0) || 0;
  const topicsCount = Number(stats.topics ?? 0) || 0;

  const fmt = new Intl.NumberFormat(undefined);

  async function onSurprise() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const topic = await pickRandomEligibleTopic({ tier, includeCompleted: false, avoidRecent: true });
      if (!topic?.id) {
        setError("Couldn't find an eligible topic right now.");
        return;
      }
      pushRecentRandomId(topic.id);
      navigate(`/topic/${topic.id}`);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      className="home"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Seo
        title="Learn anything in one minute"
        description="Strict 60-second lessons: pick a topic or get surprised."
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
            <span className="hero-badgeIcon" aria-hidden="true">⏱️</span>
            <span className="hero-badgeText">
              Strictly <span className="hero-badgeStrong">60 seconds</span> <span className="hero-badgeMuted">(no pause)</span>
            </span>
          </motion.div>
          <h1 className="hero-title">
            Learn <span className="accent">Anything</span> in <span className="one-minute accent">One Minute</span>
          </h1>

          <div className="home-direct" aria-label="Start learning">
            <div className="home-directLead">
              Your next minute is ready. Choose your weapon ↓
            </div>

            <div className="home-choices">
              <Link className="home-choice" to="/topics">
                <div className="home-choiceTitle">I’ll pick</div>
                <div className="home-choiceSub">Browse topics and choose what you’re curious about.</div>
                <div className="home-choiceHint" aria-hidden="true">
                  Browse →
                </div>
              </Link>

              <button type="button" className="home-choice home-choice--primary" onClick={onSurprise} disabled={busy}>
                <div className="home-choiceTitle">Surprise me</div>
                <div className="home-choiceSub">Spin a random topic you can access right now.</div>
                <div className="home-choiceHint" aria-hidden="true">
                  {busy ? 'Spinning…' : 'Spin →'}
                </div>
              </button>
            </div>

            {error && <div className="home-error" role="status">{error}</div>}

            <section className="home-stats" aria-label="Learning stats">
              <div className="home-statsInline">
                <span className="home-statInline">
                  <span className="home-statInlineNum">{fmt.format(categoriesCount)}</span>
                  <span className="home-statInlineLabel">categories</span>
                </span>

                <span className="home-statDot" aria-hidden="true">·</span>

                <span className="home-statInline">
                  <span className="home-statInlineNum">{fmt.format(subcategoriesCount)}</span>
                  <span className="home-statInlineLabel">subcategories</span>
                </span>

                <span className="home-statDot" aria-hidden="true">·</span>

                <span className="home-statInline">
                  <span className="home-statInlineNum">{fmt.format(topicsCount)}</span>
                  <span className="home-statInlineLabel">1-minute lessons</span>
                </span>
              </div>
            </section>
          </div>
        </motion.div>
      </main>
    </motion.div>
  );
}

export default Home;
