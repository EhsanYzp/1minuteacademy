import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import Timer from '../components/Timer';
import { StoryRenderer, StoryReview } from '../engine/story';
import { getTopic } from '../services/topics';
import { completeTopic } from '../services/progress';
import { getContentSource } from '../services/_contentSource';
import { useAuth } from '../context/AuthContext';
import { canReview, canStartTopic, canTrackProgress, formatTierLabel, getCurrentTier } from '../services/entitlements';
import StarRating from '../components/StarRating';
import { getMyTopicRating, setMyTopicRating } from '../services/ratings';
import OneMAIcon from '../components/OneMAIcon';
import { compileJourneyFromTopic } from '../engine/journey/compileJourney';
import JourneyBlocks from '../engine/journey/JourneyBlocks';
import './LessonPage.css';

function normalizeTierForJourney(tier) {
  if (tier === 'pro' || tier === 'paused') return tier;
  if (!tier || tier === 'guest') return 'guest';
  if (tier === 'free') return 'free';
  return String(tier);
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
  const [isStarted, setIsStarted] = useState(true);
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

  const canStart = useMemo(() => canStartTopic({ tier, topicRow }), [tier, topicRow]);

  // Fixed 60 seconds for story-based lessons
  const totalSeconds = 60;

  const journey = useMemo(() => compileJourneyFromTopic(topicRow), [topicRow]);
  const journeyCtx = useMemo(() => {
    const normalizedTier = normalizeTierForJourney(tier);
    return {
      completed: isCompleted,
      canStart,
      canReview: canUseReview,
      loggedIn: Boolean(user),
      tier: normalizedTier,
      vars: {
        topicTitle: String(topicRow?.title ?? ''),
        totalSeconds: String(totalSeconds),
      },
      containerClassName: 'completion-content',
      buttonClassName: 'action-button',
      isActionDisabled: (action) => {
        if (!action || typeof action !== 'object') return false;
        if (action.type === 'openReview') return !canUseReview;
        return false;
      },
      onAction: (action) => {
        if (!action || typeof action !== 'object') return;
        if (action.type === 'tryAgain') {
          setIsStarted(false);
          setIsCompleted(false);
          setIsReviewing(false);
          setTimeRemaining(totalSeconds);
          return;
        }
        if (action.type === 'openReview') {
          setIsReviewing(true);
          return;
        }
        if (action.type === 'goToUpgrade') {
          navigate('/upgrade');
          return;
        }
        if (action.type === 'goToTopics') {
          navigate('/topics');
          return;
        }
        if (action.type === 'goToProfile') {
          navigate('/me');
          return;
        }
        if (action.type === 'goToLogin') {
          navigate('/login');
          return;
        }
        if (action.type === 'goToReview') {
          navigate(`/review/${topicId}`);
          return;
        }
        if (action.type === 'goToTopic') {
          navigate(`/topic/${topicId}`);
        }
      },
      renderCompletionStats: () => (
        <div className="completion-stats">
          <div className="stat">
            <span className="stat-value">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <OneMAIcon size={18} />
                  <span>+{Number(completionResult?.awarded_one_ma ?? 0) || 0}</span>
                </span>
              </span>
            </span>
            <span className="stat-label">1MA Minutes</span>
          </div>
          <div className="stat">
            <span className="stat-value">🔥 {completionResult?.streak ?? '—'}</span>
            <span className="stat-label">Streak</span>
          </div>
        </div>
      ),
      renderProPerkPanel: () => (
        tier !== 'pro' ? (
          <div className="completion-panel" style={{ marginTop: 12 }}>
            <p style={{ margin: 0 }}>
              <strong>Pro perk:</strong> each completed module adds <strong>+1</strong> to your <strong>1MA minutes</strong>.
            </p>
            <p style={{ margin: '8px 0 0', opacity: 0.85 }}>
              Your 1MA minutes equal the number of minutes you’ve completed on the platform.
            </p>
            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/upgrade')}>Unlock 1MA minutes (Pro)</button>
            </div>
          </div>
        ) : null
      ),
      renderOneMaAwardPanel: () => (
        tier === 'pro' && completionResult && Number(completionResult?.awarded_one_ma ?? 0) > 0 ? (
          <motion.div
            className="completion-panel"
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25 }}
            style={{ marginTop: 12 }}
          >
            <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <OneMAIcon size={18} />
              <strong>+1</strong> added to your 1MA minutes.
            </p>
            <p style={{ margin: '8px 0 0', opacity: 0.85 }}>
              Total 1MA minutes: <strong>{Number(completionResult?.one_ma_balance ?? 0)}</strong>
            </p>
          </motion.div>
        ) : null
      ),
      renderCompletionProgress: () => (
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
              ✅ Progress saved.
            </p>
          ) : (
            <p style={{ margin: 0, opacity: 0.8 }}>✅ Completed.</p>
          )}
        </div>
      ),
      panelTitleClassName: 'completion-panel-title',
      ratingClassName: 'completion-panel completion-rating',
      renderRating: ({ title } = {}) => (
        <>
          <div className="completion-rating-header">
            <div>
              <p className="completion-panel-title">{String(title ?? 'Rate this module')}</p>
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
        </>
      ),
    };
  }, [
    tier,
    isCompleted,
    canStart,
    canUseReview,
    user,
    topicRow?.title,
    totalSeconds,
    completionResult,
    canSaveProgress,
    submittingCompletion,
    completionError,
    contentSource,
    myRating,
    ratingBusy,
    ratingError,
    onRate,
    navigate,
    topicId,
  ]);

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
        const result = await completeTopic({ topicId, seconds: totalSeconds });
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
  }, [isStarted, isCompleted, topicRow, topicId, totalSeconds, canAttemptSaveProgress]);

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
      {isReviewing ? (
        <StoryReview
          story={topicRow}
          title={topicRow?.title ?? ''}
          onExit={() => setIsReviewing(false)}
        />
      ) : isCompleted ? (
        <motion.div 
          className="completion-screen"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <motion.div className="completion-content" initial={{ y: 50 }} animate={{ y: 0 }}>
            <motion.div
              className="completion-emoji"
              animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: 3 }}
            >
              🎉
            </motion.div>

            <JourneyBlocks
              blocks={journey?.completion?.blocks}
              ctx={journeyCtx}
              allowedTypes={[
                'hero',
                'completionStats',
                'proPerkPanel',
                'oneMaAwardPanel',
                'completionProgress',

                'ratingPrompt',
                'cta',
                'ctaRow',
              ]}
            />
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
            <StoryRenderer story={topicRow} timeRemaining={timeRemaining} onComplete={handleComplete} />
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default LessonPage;
