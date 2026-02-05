import { motion } from 'framer-motion';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import { getTopic } from '../services/topics';
import { listUserTopicProgress } from '../services/progress';
import { getContentSource } from '../services/_contentSource';
import { useAuth } from '../context/AuthContext';
import { canReview, canStartTopic, formatTierLabel, getCurrentTier, isBeginnerTopic } from '../services/entitlements';
import StarRating from '../components/StarRating';
import { getMyTopicRating, getTopicRatingSummaries, setMyTopicRating } from '../services/ratings';
import { compileJourneyFromTopic, getTopicStartLearningPoints } from '../engine/journey/compileJourney';
import JourneyBlocks from '../engine/journey/JourneyBlocks';
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
  const journey = compileJourneyFromTopic(topicRow);
  const learningPoints = getTopicStartLearningPoints(journey);
  const fallbackLearningPoints = steps
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
        : fallbackLearningPoints.length > 0
          ? fallbackLearningPoints
        : ['⏱️ Designed to fit in 60 seconds', '🎮 Interactive, game-like steps', '🪙 Finish and add +1 minute (1MA, Pro)'],
    funFact:
      typeof lesson?.version === 'string'
        ? `Lesson version: ${lesson.version}`
        : 'Each lesson here is tuned to fit in one minute!',
  };
}

function normalizeTierForJourney(tier) {
  // Keep the schema's tier list stable even if entitlements evolve.
  if (tier === 'pro' || tier === 'paused') return tier;
  if (!tier || tier === 'guest') return 'guest';
  if (tier === 'free') return 'free';
  return String(tier);
}

function TopicPage() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const contentSource = getContentSource();
  const tier = getCurrentTier(user);
  const [topicRow, setTopicRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [ratingSummary, setRatingSummary] = useState(null);
  const [myRating, setMyRating] = useState(null);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingError, setRatingError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await getTopic(topicId);
        if (mounted) setTopicRow(data);

        try {
          const map = await getTopicRatingSummaries([topicId]);
          if (mounted) setRatingSummary(map.get(topicId) ?? null);
        } catch {
          if (mounted) setRatingSummary(null);
        }

        try {
          const r = await getMyTopicRating(topicId);
          if (mounted) setMyRating(r);
        } catch {
          if (mounted) setMyRating(null);
        }
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

  async function onRate(next) {
    if (!user) {
      setRatingError(new Error('Sign in to rate modules with stars.'));
      return;
    }
    if (ratingBusy) return;
    setRatingBusy(true);
    setRatingError(null);
    try {
      setMyRating(next);
      await setMyTopicRating(topicId, next);
      const map = await getTopicRatingSummaries([topicId]);
      setRatingSummary(map.get(topicId) ?? null);
    } catch (e) {
      setRatingError(e);
    } finally {
      setRatingBusy(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadProgress() {
      try {
        setCompletedCount(0);

        const canReadProgress =
          contentSource === 'local' || (!authLoading && Boolean(user));
        if (!canReadProgress) return;

        const rows = await listUserTopicProgress();
        if (!mounted) return;
        const row = (Array.isArray(rows) ? rows : []).find((r) => r?.topic_id === topicId) ?? null;
        setCompletedCount(Number(row?.completed_count ?? 0));
      } catch {
        // Topic pages should not hard-fail if progress can't be read.
      }
    }

    loadProgress();
    return () => {
      mounted = false;
    };
  }, [topicId, contentSource, user, authLoading]);

  const topic = useMemo(() => {
    const row = topicRow ?? fallbackTopics[topicId];
    return row ? normalizeTopic(row, topicId) : null;
  }, [topicRow, topicId]);

  const isCompleted = Number(completedCount) > 0;
  const beginner = useMemo(() => isBeginnerTopic(topicRow ?? fallbackTopics[topicId]), [topicRow, topicId]);
  const canStart = useMemo(() => canStartTopic({ tier, topicRow: topicRow ?? fallbackTopics[topicId] }), [tier, topicRow, topicId]);
  const canUseReview = canReview(tier);

  const journey = useMemo(() => compileJourneyFromTopic(topicRow ?? fallbackTopics[topicId]), [topicRow, topicId]);
  const journeyCtx = useMemo(() => {
    const normalizedTier = normalizeTierForJourney(tier);
    const startLabel = isCompleted ? 'Restart Lesson' : 'Start Learning!';

    return {
      completed: isCompleted,
      canStart,
      canReview: canUseReview,
      loggedIn: Boolean(user),
      tier: normalizedTier,
      vars: {
        topicTitle: String(topic?.title ?? ''),
        startLabel,
      },
      buttonClassName: 'topic-action-btn',
      containerClassName: 'topic-actions',
      isActionDisabled: (action) => {
        if (!action || typeof action !== 'object') return false;
        if (action.type === 'startLesson') return !canStart;
        if (action.type === 'goToReview') return !(isCompleted && canUseReview);
        return false;
      },
      onAction: (action) => {
        if (!action || typeof action !== 'object') return;
        if (action.type === 'startLesson') {
          navigate(`/lesson/${topicId}`);
        } else if (action.type === 'goToTopics') {
          navigate('/topics');
        } else if (action.type === 'goToUpgrade') {
          navigate('/upgrade');
        } else if (action.type === 'goToProfile') {
          navigate('/me');
        } else if (action.type === 'goToLogin') {
          navigate('/login');
        } else if (action.type === 'goToReview') {
          navigate(`/review/${topicId}`);
        } else if (action.type === 'goToTopic') {
          navigate(`/topic/${topicId}`);
        }
      },
    };
  }, [tier, isCompleted, canStart, canUseReview, user, topic?.title, navigate, topicId]);

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

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
              {ratingSummary && Number(ratingSummary?.ratings_count ?? 0) > 0 ? (
                <>
                  <StarRating value={Number(ratingSummary.avg_rating)} readOnly size="md" />
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 800 }}>
                    {Number(ratingSummary.avg_rating).toFixed(1)} ({Number(ratingSummary.ratings_count)})
                  </span>
                </>
              ) : (
                <span style={{ color: 'var(--text-secondary)', fontWeight: 800 }}>No ratings yet</span>
              )}
            </div>

            <div className="topic-rating-row">
              <span style={{ color: 'var(--text-secondary)', fontWeight: 800 }}>Your rating</span>
              {user && (
                <span style={{ color: 'var(--text-secondary)', opacity: 0.85, fontWeight: 700, fontSize: 13 }}>
                  (you can change this anytime)
                </span>
              )}
              <StarRating
                value={Number(myRating ?? 0)}
                onChange={user ? onRate : undefined}
                readOnly={!user || ratingBusy}
                size="md"
                label="Your rating"
              />
              {!user && (
                <motion.button
                  className="topic-action-btn secondary topic-rate-signin"
                  onClick={() => navigate('/login')}
                  whileTap={{ scale: 0.96 }}
                >
                  Sign in to rate
                </motion.button>
              )}
              {ratingBusy && <span style={{ opacity: 0.7, fontWeight: 750 }}>Saving…</span>}
            </div>

            {ratingError && (
              <div style={{ marginTop: 8, color: '#b91c1c', fontWeight: 750 }}>
                {ratingError?.message ?? String(ratingError)}
              </div>
            )}
            
            <div className="topic-meta">
              <span className="meta-badge duration">
                ⏱️ {topic.duration}
              </span>
              <span className="meta-badge difficulty">
                📊 {topic.difficulty}
              </span>
            </div>

            <div className="topic-learning-points">
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
            <JourneyBlocks
              blocks={journey?.topicStart?.blocks}
              ctx={journeyCtx}
              allowedTypes={['cta', 'ctaRow']}
            />
            
            <p className="start-hint">
              {!canStart
                ? (tier === 'paused'
                  ? 'Your account is paused. Resume it to start lessons.'
                  : `${beginner ? '' : 'This lesson is Pro-only. '}Your plan: ${formatTierLabel(tier)}.`)
                : isCompleted && !canUseReview
                  ? 'Review mode is Pro-only.'
                  : 'Ready? Click above to begin your 60-second adventure! 🎮'}
            </p>
          </motion.div>
        </div>
      </main>
    </motion.div>
  );
}

export default TopicPage;
