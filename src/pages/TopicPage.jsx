import { motion } from 'framer-motion';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import { getTopic } from '../services/topics';
import './TopicPage.css';

const fallbackTopics = {
  blockchain: {
    id: 'blockchain',
    title: 'What is Blockchain?',
    emoji: '🔗',
    color: '#4ECDC4',
    description: 'Connect Supabase to load topics from the database.',
    lesson: { totalSeconds: 60, steps: [] },
    difficulty: 'Beginner',
  },
};

function normalizeTopic(topicRow, topicId) {
  const lesson = topicRow?.lesson ?? {};
  const steps = Array.isArray(lesson?.steps) ? lesson.steps : [];
  const learningPoints = steps
    .slice(0, 4)
    .map((s) => (typeof s.title === 'string' ? s.title : null))
    .filter(Boolean);

  return {
    id: topicRow?.id ?? topicId,
    title: topicRow?.title ?? 'Topic',
    emoji: topicRow?.emoji ?? '🎯',
    color: topicRow?.color ?? '#4ECDC4',
    description: topicRow?.description ?? 'No description yet.',
    duration: `${Number(lesson?.totalSeconds ?? 60)} seconds`,
    difficulty: topicRow?.difficulty ?? 'Beginner',
    learningPoints:
      learningPoints.length > 0
        ? learningPoints
        : ['⏱️ Designed to fit in 60 seconds', '🎮 Interactive, game-like steps', '🏁 Finish and earn XP'],
    funFact:
      typeof lesson?.version === 'string'
        ? `Lesson version: ${lesson.version}`
        : 'Each lesson here is tuned to fit in one minute!',
  };
}

function TopicPage() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const [topicRow, setTopicRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await getTopic(topicId);
        if (mounted) setTopicRow(data);
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
  }, [topicId]);

  const topic = useMemo(() => {
    const row = topicRow ?? fallbackTopics[topicId];
    return row ? normalizeTopic(row, topicId) : null;
  }, [topicRow, topicId]);

  if (!topic && loading) {
    return (
      <div className="topic-page">
        <Header />
        <div className="topic-not-found">
          <h2>Loading…</h2>
        </div>
      </div>
    );
  }

  if (!topic && !loading) {
    return (
      <div className="topic-page">
        <Header />
        <div className="topic-not-found">
          <h2>🔍 Topic not found!</h2>
          <Link to="/topics">Go back to topics</Link>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="topic-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Header />
      
      <main className="topic-main">
        <motion.div 
          className="topic-header"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Link to="/topics" className="back-button">
            ← Back to Topics
          </Link>
        </motion.div>

        <div className="topic-content">
          <motion.div 
            className="topic-card"
            style={{ '--topic-color': topic.color }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            {error && (
              <div className="topic-not-found" style={{ marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>⚠️ Couldn’t load from Supabase</h2>
                <div style={{ opacity: 0.8 }}>Showing fallback content.</div>
              </div>
            )}
            {loading && (
              <div className="topic-not-found" style={{ marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>Loading…</h2>
              </div>
            )}

            <motion.div 
              className="topic-emoji"
              animate={{ 
                y: [0, -10, 0],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ 
                duration: 3, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              {topic.emoji}
            </motion.div>
            
            <h1 className="topic-title">{topic.title}</h1>
            <p className="topic-description">{topic.description}</p>
            
            <div className="topic-meta">
              <span className="meta-badge duration">
                ⏱️ {topic.duration}
              </span>
              <span className="meta-badge difficulty">
                📊 {topic.difficulty}
              </span>
            </div>

            <div className="learning-points">
              <h3>What You'll Learn:</h3>
              <ul>
                {topic.learningPoints.map((point, index) => (
                  <motion.li 
                    key={index}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                  >
                    {point}
                  </motion.li>
                ))}
              </ul>
            </div>

            <motion.div 
              className="fun-fact"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <span className="fun-fact-label">💡 Fun Fact:</span>
              <p>{topic.funFact}</p>
            </motion.div>
          </motion.div>

          <motion.div 
            className="start-section"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <motion.button
              className="start-button"
              onClick={() => navigate(`/lesson/${topicId}`)}
              whileHover={{ 
                scale: 1.05,
                boxShadow: '0 10px 40px rgba(255, 107, 107, 0.4)'
              }}
              whileTap={{ scale: 0.95 }}
              animate={{
                boxShadow: [
                  '0 5px 20px rgba(255, 107, 107, 0.3)',
                  '0 5px 30px rgba(255, 107, 107, 0.5)',
                  '0 5px 20px rgba(255, 107, 107, 0.3)'
                ]
              }}
              transition={{
                boxShadow: { duration: 2, repeat: Infinity }
              }}
            >
              <span className="button-icon">🚀</span>
              <span className="button-text">Start Learning!</span>
              <span className="button-timer">60s</span>
            </motion.button>
            
            <p className="start-hint">
              Ready? Click above to begin your 60-second adventure! 🎮
            </p>
          </motion.div>
        </div>
      </main>
    </motion.div>
  );
}

export default TopicPage;
