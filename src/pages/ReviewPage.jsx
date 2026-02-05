import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StoryReview } from '../engine/story';
import { getTopic } from '../services/topics';
import { useAuth } from '../context/AuthContext';
import { canReview, formatTierLabel, getCurrentTier } from '../services/entitlements';
import { compileJourneyFromTopic } from '../engine/journey/compileJourney';
import JourneyBlocks from '../engine/journey/JourneyBlocks';
import './ReviewPage.css';

function normalizeTierForJourney(tier) {
  if (tier === 'pro' || tier === 'paused') return tier;
  if (!tier || tier === 'guest') return 'guest';
  if (tier === 'free') return 'free';
  return String(tier);
}

export default function ReviewPage() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tier = getCurrentTier(user);
  const allowed = canReview(tier);

  const [topicRow, setTopicRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const row = await getTopic(topicId);
        if (mounted) setTopicRow(row);
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

  // Story-based content (4 beats + quiz)
  const hasStory = useMemo(() => Boolean(topicRow?.story && topicRow?.quiz), [topicRow]);

  const journey = useMemo(
    () => compileJourneyFromTopic(topicRow),
    [topicRow]
  );

  const journeyCtx = useMemo(() => {
    const normalizedTier = normalizeTierForJourney(tier);
    return {
      canReview: allowed,
      loggedIn: Boolean(user),
      tier: normalizedTier,
      vars: {
        topicTitle: String(topicRow?.title ?? ''),
        tierLabel: formatTierLabel(tier),
      },
      containerClassName: 'review-journey',
      buttonClassName: 'journey-btn',
      onAction: (action) => {
        if (!action || typeof action !== 'object') return;
        if (action.type === 'goToTopic') {
          navigate(`/topic/${topicId}`);
          return;
        }
        if (action.type === 'startLesson') {
          navigate(`/lesson/${topicId}`);
          return;
        }
        if (action.type === 'goToReview') {
          navigate(`/review/${topicId}`);
          return;
        }
        if (action.type === 'goToUpgrade') {
          navigate('/upgrade');
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
        if (action.type === 'goToTopics') {
          navigate('/topics');
          return;
        }
      },
      renderReviewLesson: () => {
        if (!allowed) return null;
        if (loading) {
          return <div className="review-loading">Loading review…</div>;
        }
        if (error) {
          return (
            <div className="review-error">
              <h2>⚠️ Couldn’t load review</h2>
              <p style={{ opacity: 0.8 }}>{error?.message ?? String(error)}</p>
            </div>
          );
        }
        // Use StoryReview for story-based content
        if (!hasStory) {
          return (
            <div className="review-error">
              <h2>⚠️ No story content</h2>
              <p style={{ opacity: 0.8 }}>This topic doesn't have story-based content to review.</p>
            </div>
          );
        }
        return (
          <StoryReview
            story={topicRow}
            title={topicRow?.title ?? ''}
            onExit={() => navigate(`/topic/${topicId}`)}
          />
        );
      },
    };
  }, [allowed, user, tier, topicRow, hasStory, loading, error, navigate, topicId]);

  return (
    <motion.div className="review-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <JourneyBlocks
        blocks={journey?.review?.blocks}
        ctx={journeyCtx}
        allowedTypes={['hero', 'info', 'divider', 'cta', 'ctaRow', 'reviewLesson']}
      />
    </motion.div>
  );
}
