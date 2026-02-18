import { motion } from 'framer-motion';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import Seo from '../components/Seo';
import { TopicHeaderSkeleton } from '../components/SkeletonBlocks';
import { getTopic } from '../services/topics';
import { listUserTopicProgress } from '../services/progress';
import { getContentSource } from '../services/_contentSource';
import { useAuth } from '../context/AuthContext';
import { canReview, canStartTopic, formatTierLabel, getCurrentTier, getTopicGate, isBeginnerTopic } from '../services/entitlements';
import { toAbsoluteUrl } from '../services/seo';
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
    difficulty: 'Beginner',
  },
};

function normalizeTopic(topicRow, topicId) {
  const journey = compileJourneyFromTopic(topicRow);
  const learningPoints = getTopicStartLearningPoints(journey);

  return {
    id: topicRow?.id ?? topicId,
    title: topicRow?.title ?? 'Topic',
    emoji: topicRow?.emoji ?? '🎯',
    color: topicRow?.color ?? '#4ECDC4',
    description: topicRow?.description ?? 'No description yet.',
    duration: '60 seconds',
    difficulty: topicRow?.difficulty ?? 'Beginner',
    learningPoints:
      learningPoints.length > 0
        ? learningPoints
        : ['⏱️ Designed to fit in 60 seconds', '🎮 Interactive story + quiz', '🏅 Finish and add +1 expert minute (Pro)'],
    funFact: 'Each lesson here is tuned to fit in one minute!',
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
  const { topicId, categoryId: routeCategoryId, courseId: routeCourseId, chapterId: routeChapterId } = useParams();
  const location = useLocation();
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

  const normalizeDurationLabel = (duration) => {
    const raw = String(duration ?? '').trim();
    const d = raw.toLowerCase();
    if (!raw) return '1 minute';
    if (d.includes('60')) return '1 minute';
    if (d === '1m' || d === '1 min' || d === '1 minute') return '1 minute';
    return raw;
  };

  const ratingSummaryText = (() => {
    const count = Number(ratingSummary?.ratings_count ?? 0);
    const avg = Number(ratingSummary?.avg_rating ?? 0);
    if (count > 0 && Number.isFinite(avg)) return `${avg.toFixed(1)} (${count})`;
    return 'No ratings yet';
  })();

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

  const topicJsonLd = useMemo(() => {
    if (!topic) return null;
    const topicUrl = toAbsoluteUrl(`/topic/${encodeURIComponent(String(topicId))}`);
    const isFree = String(topic?.difficulty ?? '').toLowerCase() === 'beginner';
    return {
      '@context': 'https://schema.org',
      '@type': 'LearningResource',
      name: String(topic.title ?? 'Topic'),
      description: String(topic.description ?? ''),
      url: topicUrl,
      inLanguage: 'en',
      timeRequired: 'PT1M',
      educationalLevel: String(topic.difficulty ?? ''),
      isAccessibleForFree: isFree,
      provider: {
        '@type': 'Organization',
        name: '1 Minute Academy',
        url: toAbsoluteUrl('/'),
      },
    };
  }, [topic, topicId]);


  const isCompleted = Number(completedCount) > 0;
  const beginner = useMemo(() => isBeginnerTopic(topicRow ?? fallbackTopics[topicId]), [topicRow, topicId]);
  const canStart = useMemo(
    () => canStartTopic({ tier, topicRow: topicRow ?? fallbackTopics[topicId] }),
    [tier, topicRow, topicId]
  );
  const canUseReview = canReview(tier);

  const backToChapterTo = useMemo(() => {
    const s = location?.state?.fromChapter;
    const categoryId = String(s?.categoryId ?? routeCategoryId ?? '').trim();
    const courseId = String(s?.courseId ?? routeCourseId ?? '').trim();
    const chapterId = String(s?.chapterId ?? routeChapterId ?? '').trim();
    if (!categoryId || !courseId || !chapterId) return null;
    return `/categories/${encodeURIComponent(categoryId)}/courses/${encodeURIComponent(courseId)}/chapters/${encodeURIComponent(chapterId)}`;
  }, [location?.state, routeCategoryId, routeCourseId, routeChapterId]);

  const lessonTo = useMemo(() => {
    if (!backToChapterTo) return `/lesson/${encodeURIComponent(String(topicId))}`;
    return `${backToChapterTo}/lesson/${encodeURIComponent(String(topicId))}`;
  }, [backToChapterTo, topicId]);

  const topicGate = useMemo(
    () => getTopicGate({ tier, topicRow: topicRow ?? fallbackTopics[topicId] }),
    [tier, topicRow, topicId]
  );

  if (!loading && topic && topicGate?.locked && topicGate?.reason === 'pro') {
    return (
      <motion.div className="topic-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <Seo
          title={topic?.title ? `${topic.title} (Pro)` : 'Pro-only topic'}
          description={topic?.description || 'Upgrade to Pro to unlock this topic.'}
          path={location?.pathname}
          canonicalPath={`/topic/${topicId}`}
          image={`/og/topics/${encodeURIComponent(String(topicId))}.svg`}
          twitterImage="/og/og-image.png"
          jsonLd={topicJsonLd}
          noindex
        />
        <Header />
        <main className="topic-main">
          <div className="topic-header">
            <div className="topic-nav">
              <Link to="/" className="back-button">← Home</Link>
              {backToChapterTo ? (
                <Link to={backToChapterTo} className="back-button">← Back to chapter</Link>
              ) : null}
              <Link to="/categories" className="back-button">← Categories</Link>
            </div>
          </div>

          <div className="topic-content">
            <div className="topic-card" style={{ '--topic-color': topic?.color ?? '#4ECDC4' }}>
              <div className="topic-emoji">🔒</div>
              <h1 className="topic-title">Pro-only topic</h1>
              <p className="topic-description">
                Your plan: <strong>{formatTierLabel(tier)}</strong>. Upgrade to Pro to unlock <strong>{topic?.title}</strong>.
              </p>
              <div className="topic-meta">
                <span className="meta-badge" style={{ background: 'rgba(245, 158, 11, 0.12)', color: 'rgba(120, 53, 15, 0.95)' }}>
                  {topic?.difficulty ?? 'Intermediate'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => navigate('/upgrade')}>Upgrade</button>
                <button type="button" onClick={() => navigate('/categories')}>Browse beginner topics</button>
              </div>
            </div>
          </div>
        </main>
      </motion.div>
    );
  }

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
          navigate(lessonTo, { state: location?.state });
        } else if (action.type === 'goToTopics') {
          navigate('/categories');
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
  }, [tier, isCompleted, canStart, canUseReview, user, topic?.title, navigate, topicId, lessonTo, location?.state]);

  if (!topic && loading) {
    return (
      <div className="topic-page">
        <Seo title="Loading topic" description="Loading topic details." path={location?.pathname} canonicalPath={`/topic/${topicId}`} />
        <Header />
        <div className="topic-not-found">
          <TopicHeaderSkeleton />
        </div>
      </div>
    );
  }

  if (!topic && !loading) {
    return (
      <div className="topic-page">
        <Seo title="Topic not found" description="This topic could not be found." path={location?.pathname} canonicalPath={`/topic/${topicId}`} noindex />
        <Header />
        <div className="topic-not-found">
          <h2>🔍 Topic not found!</h2>
          <div className="topic-nav">
            <Link to="/" className="back-button">← Home</Link>
              {backToChapterTo ? (
                <Link to={backToChapterTo} className="back-button">← Back to chapter</Link>
              ) : null}
              <Link to="/categories" className="back-button">← Categories</Link>
          </div>
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
      <Seo
        title={topic?.title || 'Topic'}
        description={topic?.description || 'Learn this topic in 60 seconds.'}
        path={location?.pathname}
        canonicalPath={`/topic/${topicId}`}
        image={`/og/topics/${encodeURIComponent(String(topicId))}.svg`}
        twitterImage="/og/og-image.png"
        jsonLd={topicJsonLd}
      />
      <Header />
      
      <main className="topic-main">
        <motion.div 
          className="topic-header"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="topic-nav">
            <Link to="/" className="back-button">← Home</Link>
              {backToChapterTo ? (
                <Link to={backToChapterTo} className="back-button">← Back to chapter</Link>
              ) : null}
              <Link to="/categories" className="back-button">← Categories</Link>
          </div>
        </motion.div>

        <div className="topic-content">
          <div className="topic-hero-grid">
            <motion.div 
              className="topic-card topic-card--hero"
              style={{ '--topic-color': topic.color }}
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, type: 'spring' }}
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

            <div className="topic-emoji">{topic.emoji}</div>
            
            <h1 className="topic-title">{topic.title}</h1>
            <p className="topic-description">{topic.description}</p>

            <div className="topic-meta">
              <span className="meta-badge duration">
                ⏱️ {normalizeDurationLabel(topic.duration)}
              </span>
              <span className="meta-badge difficulty">
                📊 {topic.difficulty}
              </span>
              <span className="meta-badge beats">
                🎬 6 beats
              </span>
              <span className="meta-badge quiz">
                ✅ Quick quiz
              </span>
            </div>

            <div className="topic-start-actions">
              <JourneyBlocks
                blocks={journey?.topicStart?.blocks}
                ctx={journeyCtx}
                allowedTypes={['cta', 'ctaRow']}
              />
            </div>

            <p className="start-hint">
              {!canStart
                ? (tier === 'paused'
                  ? 'Your account is paused. Resume it to start lessons.'
                  : `${beginner ? '' : 'This lesson is Pro-only. '}Your plan: ${formatTierLabel(tier)}.`)
                : isCompleted && !canUseReview
                  ? 'Review mode is Pro-only.'
                  : 'Tip: find a quiet 60 seconds, then press Start.'}
            </p>

            <details className="topic-start-panel">
              <summary className="topic-start-panel-title">What you’ll get</summary>
              <ul className="topic-start-points">
                {(Array.isArray(topic.learningPoints) ? topic.learningPoints : []).slice(0, 4).map((p, i) => (
                  <li key={`lp-${i}`}>{p}</li>
                ))}
              </ul>
            </details>

            <details className="topic-rating-details" open={Boolean(ratingError)}>
              <summary className="topic-rating-details__title">
                <span>Ratings</span>
                <span className="topic-rating-details__meta">{ratingSummaryText}</span>
              </summary>

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
            </details>

            </motion.div>
          </div>

        </div>
      </main>
    </motion.div>
  );
}

export default TopicPage;
