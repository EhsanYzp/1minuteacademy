import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import Timer from '../components/Timer';
import LessonRenderer from '../engine/LessonRenderer';
import LessonReview from '../engine/LessonReview';
import { getTopic } from '../services/topics';
import { completeTopic } from '../services/progress';
import { getContentSource } from '../services/_contentSource';
import { useAuth } from '../context/AuthContext';
import { canReview, canSeeTakeaways, canStartTopic, canTrackProgress, formatTierLabel, getCurrentTier } from '../services/entitlements';
import StarRating from '../components/StarRating';
import { getMyTopicRating, setMyTopicRating } from '../services/ratings';
import './LessonPage.css';

function getLessonDefaults() {
  return { totalSeconds: 60, xp: 50, steps: [] };
}

function getSummaryPointsFromLesson(lesson) {
  const steps = Array.isArray(lesson?.steps) ? lesson.steps : [];
  const summary = steps.find((s) => s?.type === 'summary') ?? null;
  const points = Array.isArray(summary?.points) ? summary.points : [];
  return points.filter((p) => typeof p === 'string' && p.trim().length > 0);
}

function LessonPage() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const contentSource = getContentSource();
  const { user } = useAuth();
  const tier = getCurrentTier(user);
  const canUseReview = canReview(tier);
  const canSaveProgress = canTrackProgress(tier);
  const canAttemptSaveProgress = canSaveProgress && Boolean(user);
  const canShowTakeaways = canSeeTakeaways(tier);
  const [isStarted, setIsStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [topicRow, setTopicRow] = useState(null);
  const [topicLoading, setTopicLoading] = useState(true);
  const [topicError, setTopicError] = useState(null);
  const [completionResult, setCompletionResult] = useState(null);
  const [completionError, setCompletionError] = useState(null);
  const [submittingCompletion, setSubmittingCompletion] = useState(false);
  const [myRating, setMyRating] = useState(null);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingError, setRatingError] = useState(null);
  const submittedCompletionRef = useRef(false);

  const lesson = useMemo(() => topicRow?.lesson ?? getLessonDefaults(), [topicRow]);
  const totalSeconds = useMemo(() => Number(lesson?.totalSeconds ?? 60), [lesson]);
  const xpAward = useMemo(() => Number(lesson?.xp ?? 50), [lesson]);
  const summaryPoints = useMemo(() => getSummaryPointsFromLesson(lesson), [lesson]);

  const canStart = useMemo(() => canStartTopic({ tier, topicRow }), [tier, topicRow]);

  const handleComplete = useCallback(() => {
    setIsCompleted(true);
  }, []);

  const handleTimeUp = useCallback(() => {
    setIsCompleted(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setTopicLoading(true);
        setTopicError(null);
        const row = await getTopic(topicId);
        if (mounted) setTopicRow(row);
      } catch (e) {
        if (mounted) setTopicError(e);
      } finally {
        if (mounted) setTopicLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [topicId]);

  useEffect(() => {
    if (!isStarted) {
      setTimeRemaining(totalSeconds);
      setIsCompleted(false);
      setIsReviewing(false);
      setCompletionResult(null);
      setCompletionError(null);
      submittedCompletionRef.current = false;
      setSubmittingCompletion(false);
      setMyRating(null);
      setRatingBusy(false);
      setRatingError(null);
    }
  }, [totalSeconds, isStarted]);

  useEffect(() => {
    let mounted = true;
    async function loadMyRating() {
      if (!isCompleted) return;
      if (!topicId) return;
      try {
        setRatingError(null);
        const r = await getMyTopicRating(topicId);
        if (mounted) setMyRating(r);
      } catch (e) {
        if (mounted) setRatingError(e);
      }
    }
    loadMyRating();
    return () => {
      mounted = false;
    };
  }, [isCompleted, topicId]);

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
    } catch (e) {
      setRatingError(e);
      try {
        const r = await getMyTopicRating(topicId);
        setMyRating(r);
      } catch {
        // ignore
      }
    } finally {
      setRatingBusy(false);
    }
  }

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

  useEffect(() => {
    if (!isStarted || !isCompleted) return;
    if (!topicRow) return;

    // Never attempt Supabase writes without an authenticated user.
    // This also prevents confusing errors when using dev tier overrides.
    if (!canAttemptSaveProgress) return;

    if (submittedCompletionRef.current) return;
    submittedCompletionRef.current = true;

    let mounted = true;
    async function submit() {
      try {
        setSubmittingCompletion(true);
        setCompletionError(null);
        const result = await completeTopic({ topicId, xp: xpAward, seconds: totalSeconds });
        if (mounted) setCompletionResult(result);
      } catch (e) {
        if (mounted) setCompletionError(e);
      } finally {
        if (mounted) setSubmittingCompletion(false);
      }
    }

    submit();
    return () => {
      mounted = false;
    };
  }, [isStarted, isCompleted, topicRow, topicId, xpAward, totalSeconds, canAttemptSaveProgress]);

  // Calculate progress based on time elapsed
  const progress = totalSeconds > 0 ? ((totalSeconds - timeRemaining) / totalSeconds) * 100 : 0;

  if (topicError) {
    return (
      <div className="lesson-page">
        <div className="lesson-error">
          <h2>⚠️ Couldn’t load lesson</h2>
          <p style={{ opacity: 0.8 }}>Make sure Supabase is configured and the topic exists.</p>
          <button onClick={() => navigate('/')}>Go Home</button>
        </div>
      </div>
    );
  }

  if (topicLoading) {
    return (
      <div className="lesson-page">
        <div className="lesson-error">
          <h2>Loading…</h2>
        </div>
      </div>
    );
  }

  if (!canStart) {
    if (tier === 'paused') {
      return (
        <div className="lesson-page">
          <div className="lesson-error">
            <h2>⏸️ Account paused</h2>
            <p style={{ opacity: 0.85, maxWidth: 520 }}>
              Your account is paused. Resume it to start lessons.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={() => navigate('/me')}>Go to Profile</button>
              <button onClick={() => navigate(`/topic/${topicId}`)}>Back to topic</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="lesson-page">
        <div className="lesson-error">
          <h2>🔒 Pro-only lesson</h2>
          <p style={{ opacity: 0.85, maxWidth: 520 }}>
            Your plan: <strong>{formatTierLabel(tier)}</strong>. Upgrade to Pro to start this module.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => navigate('/upgrade')}>Upgrade</button>
            <button onClick={() => navigate(`/topic/${topicId}`)}>Back to topic</button>
          </div>
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
              <div className="tip">📚 Review after (no timer)</div>
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
      ) : isReviewing ? (
        <LessonReview
          lesson={lesson}
          title={topicRow?.title ?? ''}
          onExit={() => setIsReviewing(false)}
        />
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
            <p>You just learned about {topicRow?.title ?? 'this topic'} in {totalSeconds} seconds!</p>
            
            <div className="completion-stats">
              <div className="stat">
                <span className="stat-value">+{xpAward}</span>
                <span className="stat-label">XP Earned</span>
              </div>
              <div className="stat">
                <span className="stat-value">🔥 {completionResult?.streak ?? '—'}</span>
                <span className="stat-label">Streak</span>
              </div>
            </div>

            <div className="completion-panel completion-progress">
              {!canSaveProgress || !user ? (
                <p style={{ margin: 0 }}>✅ Completed. Sign in to track progress.</p>
              ) : submittingCompletion ? (
                <p style={{ margin: 0 }}>Saving your progress…</p>
              ) : completionError ? (
                <>
                  <p style={{ margin: 0 }}>Couldn’t save progress.</p>
                  <p style={{ margin: '6px 0 0', opacity: 0.8, fontSize: 14 }}>
                    {completionError?.message ?? String(completionError)}
                  </p>
                </>
              ) : completionResult ? (
                <p style={{ margin: 0 }}>
                  ✅ Progress saved {contentSource === 'local' ? 'locally' : 'to Supabase'}.
                </p>
              ) : (
                <p style={{ margin: 0, opacity: 0.8 }}>✅ Completed.</p>
              )}
            </div>

            {summaryPoints.length > 0 && (
              <div className="completion-panel">
                <p className="completion-panel-title">Key takeaways</p>
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, opacity: 0.9 }}>
                  {summaryPoints.slice(0, 5).map((pt, idx) => (
                    <li key={idx} style={{ margin: '6px 0' }}>
                      {pt}
                    </li>
                  ))}
                </ul>

                {!canShowTakeaways && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => navigate('/upgrade')}>Unlock saved takeaways</button>
                    {!user && <button onClick={() => navigate('/login')}>Create free account</button>}
                  </div>
                )}
              </div>
            )}

            <div className="completion-panel completion-rating">
              <div className="completion-rating-header">
                <div>
                  <p className="completion-panel-title">Rate this module</p>
                  <p className="completion-panel-subtitle">
                    {user ? 'Tap a star to rate (you can change it later).' : 'Rating is disabled until you sign in.'}
                  </p>
                </div>
                {!user && (
                  <button className="completion-signin" onClick={() => navigate('/login')}>
                    Sign in to rate
                  </button>
                )}
              </div>

              <div className="completion-rating-body">
                <StarRating
                  value={Number(myRating ?? 0)}
                  onChange={user ? onRate : undefined}
                  readOnly={!user || ratingBusy}
                  size="lg"
                  label="Rate this module"
                />

                <div className="completion-rating-meta" aria-live="polite">
                  {ratingBusy
                    ? 'Saving…'
                    : myRating
                      ? `Your rating: ${myRating}/5`
                      : user
                        ? 'Choose a rating'
                        : 'Sign in to enable rating'}
                </div>
              </div>

              {user && ratingError && (
                <div className="completion-panel-error">
                  {ratingError?.message ?? String(ratingError)}
                </div>
              )}
            </div>

            <div className="completion-actions">
              <motion.button
                className="action-button primary"
                onClick={() => {
                  setIsStarted(false);
                  setIsCompleted(false);
                  setIsReviewing(false);
                  setTimeRemaining(totalSeconds);
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                🔄 Try Again
              </motion.button>

              {canUseReview ? (
                <motion.button
                  className="action-button secondary"
                  onClick={() => setIsReviewing(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  📚 Review what you learned
                </motion.button>
              ) : (
                <motion.button
                  className="action-button secondary"
                  onClick={() => navigate('/upgrade')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  🔒 Unlock review mode
                </motion.button>
              )}

              <motion.button
                className="action-button secondary"
                onClick={() => navigate('/')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                🏠 More Topics
              </motion.button>

              <motion.button
                className="action-button secondary"
                onClick={() => navigate('/me')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                🧑‍🚀 Your learning summary
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
            <LessonRenderer lesson={lesson} timeRemaining={timeRemaining} onComplete={handleComplete} />
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default LessonPage;
