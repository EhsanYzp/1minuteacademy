import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import Seo from '../components/Seo';
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
import {
  buildPresentationStyleOptions,
  canChoosePresentationStyle,
  normalizePresentationStyle,
  resolveStoryPresentationStyle,
  saveStoryPresentationStyle,
} from '../services/presentationStyle';
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
  const timerDeadlineMsRef = useRef(null);
  const timerCompletedRef = useRef(false);

  const canStart = useMemo(() => canStartTopic({ tier, topicRow }), [tier, topicRow]);

  // Fixed 60 seconds for story-based lessons
  const totalSeconds = 60;

  const handleComplete = useCallback(() => {
    setIsCompleted(true);
  }, []);

  const journey = useMemo(() => compileJourneyFromTopic(topicRow), [topicRow]);
  const canChoosePresentation = useMemo(() => canChoosePresentationStyle(tier), [tier]);
  const presentationStyleOptions = useMemo(
    () => buildPresentationStyleOptions({ tier, journey }),
    [tier, journey]
  );
  const presentationStyleOptionById = useMemo(() => {
    const m = new Map();
    for (const opt of presentationStyleOptions) m.set(String(opt.id), opt);
    return m;
  }, [presentationStyleOptions]);
  const resolvedStoryPresentationStyle = useMemo(
    () => resolveStoryPresentationStyle({ user, tier, journey }),
    [user, tier, journey]
  );
  const [storyPresentationStyle, setStoryPresentationStyle] = useState(resolvedStoryPresentationStyle);
  const [storyStyleBusy, setStoryStyleBusy] = useState(false);

  useEffect(() => {
    setStoryPresentationStyle(resolvedStoryPresentationStyle);
  }, [resolvedStoryPresentationStyle]);

  async function onChangeStoryPresentationStyle(nextRaw) {
    const next = normalizePresentationStyle(nextRaw) ?? resolvedStoryPresentationStyle;
    if (!canChoosePresentation) return;
    if (presentationStyleOptionById.get(String(next))?.disabled) return;

    setStoryPresentationStyle(next);
    setStoryStyleBusy(true);
    try {
      await saveStoryPresentationStyle({ user, style: next, tier });
    } finally {
      setStoryStyleBusy(false);
    }
  }
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
      containerClassName: 'journey-blocks',
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
      // Lesson page block renderers
      renderLessonTopbar: () => (
        <div className="story-topbar">
          <button className="story-close-btn" onClick={() => navigate(`/topic/${topicId}`)} aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div className="story-topic-title">
            <span className="story-topic-emoji">{topicRow?.emoji || '📚'}</span>
            <span className="story-topic-name">{topicRow?.title || 'Learning...'}</span>
          </div>
          <div className="story-topbar-right">
            {canChoosePresentation ? (
              <label className="story-style">
                <span className="story-style-label">Style</span>
                <select
                  className="story-style-select"
                  value={storyPresentationStyle}
                  onChange={(e) => onChangeStoryPresentationStyle(e.target.value)}
                  disabled={storyStyleBusy}
                  aria-label="Lesson presentation style"
                >
                  {presentationStyleOptions.map((s) => (
                    <option key={s.id} value={s.id} disabled={Boolean(s.disabled)}>{s.label}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="story-timer-large">
              <span className="story-timer-value">{Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</span>
            </div>
          </div>
        </div>
      ),
      renderStoryBeats: () => (
        <StoryRenderer
          story={topicRow}
          topicTitle={topicRow?.title}
          timeRemaining={timeRemaining}
          onComplete={handleComplete}
          onClose={() => navigate(`/topic/${topicId}`)}
          hideTopbar={true}
          presentationStyle={storyPresentationStyle}
        />
      ),
      renderStoryQuiz: () => null, // Quiz is rendered within StoryRenderer
    };
  }, [
    tier,
    isCompleted,
    canStart,
    canUseReview,
    user,
    topicRow,
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
    timeRemaining,
    handleComplete,
    storyPresentationStyle,
    canChoosePresentation,
    resolvedStoryPresentationStyle,
    storyStyleBusy,
    presentationStyleOptions,
    presentationStyleOptionById,
  ]);

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

      timerDeadlineMsRef.current = null;
      timerCompletedRef.current = false;
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
    if (!isStarted || isCompleted) {
      timerDeadlineMsRef.current = null;
      timerCompletedRef.current = false;
      return;
    }

    if (!timerDeadlineMsRef.current) {
      timerDeadlineMsRef.current = Date.now() + Math.max(0, totalSeconds) * 1000;
    }

    function tick() {
      const deadline = timerDeadlineMsRef.current;
      if (!deadline) return;

      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining <= 0 && !timerCompletedRef.current) {
        timerCompletedRef.current = true;
        handleTimeUp();
      }
    }

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isStarted, isCompleted, totalSeconds, handleTimeUp]);

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
        <Seo title="Lesson" description="Lesson content." path={`/lesson/${topicId}`} canonicalPath={`/topic/${topicId}`} noindex />
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
        <Seo title="Loading lesson" description="Loading lesson." path={`/lesson/${topicId}`} canonicalPath={`/topic/${topicId}`} noindex />
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
          <Seo title="Lesson" description="Lesson content." path={`/lesson/${topicId}`} canonicalPath={`/topic/${topicId}`} noindex />
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
        <Seo title="Pro-only lesson" description="Upgrade to Pro to start this lesson." path={`/lesson/${topicId}`} canonicalPath={`/topic/${topicId}`} noindex />
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
      <Seo
        title={topicRow?.title ? `Lesson: ${topicRow.title}` : 'Lesson'}
        description={topicRow?.description || 'A timed 60-second lesson.'}
        path={`/lesson/${topicId}`}
        canonicalPath={`/topic/${topicId}`}
        noindex
      />
      {isReviewing ? (
        <StoryReview
          story={topicRow}
          title={topicRow?.title ?? ''}
          onExit={() => setIsReviewing(false)}
          presentationStyle={storyPresentationStyle}
          canChoosePresentationStyle={canChoosePresentation}
          onChangePresentationStyle={onChangeStoryPresentationStyle}
          presentationStyleOptions={presentationStyleOptions}
        />
      ) : isCompleted ? (
        <motion.div 
          className="completion-screen"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className="completion-backdrop" aria-hidden="true" />
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
          
          {/* Confetti Effect (lightweight) */}
          <div className="confetti-container">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="confetti"
                style={{
                  left: `${(i * 8 + 6) % 100}%`,
                  width: `${8 + (i % 4) * 4}px`,
                  height: `${8 + ((i + 2) % 4) * 4}px`,
                  borderRadius: i % 3 === 0 ? '999px' : '6px',
                  backgroundColor: ['#2563EB', '#4ECDC4', '#FFE66D', '#0EA5E9', '#FF9F43'][i % 5],
                  opacity: 0.85,
                }}
                initial={{ y: -20, opacity: 1 }}
                animate={{ 
                  y: '100vh',
                  rotate: 180 + i * 90,
                  opacity: 0
                }}
                transition={{
                  duration: 2.4 + (i % 4) * 0.35,
                  delay: (i % 6) * 0.08,
                  ease: 'easeOut'
                }}
              />
            ))}
          </div>
        </motion.div>
      ) : (
        <div className="lesson-container">
          <JourneyBlocks
            blocks={journey?.lesson?.blocks}
            ctx={journeyCtx}
            allowedTypes={['lessonTopbar', 'storyBeats', 'storyQuiz']}
          />
        </div>
      )}
    </motion.div>
  );
}

export default LessonPage;
