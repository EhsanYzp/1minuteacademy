import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LessonReview from '../engine/LessonReview';
import { getTopic } from '../services/topics';
import { useAuth } from '../context/AuthContext';
import { canReview, formatTierLabel, getCurrentTier } from '../services/entitlements';
import './ReviewPage.css';

function getLessonDefaults() {
  return { totalSeconds: 60, xp: 50, steps: [] };
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

    if (allowed) load();
    return () => {
      mounted = false;
    };
  }, [topicId, allowed]);

  const lesson = useMemo(() => topicRow?.lesson ?? getLessonDefaults(), [topicRow]);

  if (!allowed) {
    return (
      <div className="review-page">
        <div className="review-error">
          <h2>{tier === 'paused' ? '⏸️ Account paused' : '🔒 Review mode is Pro-only'}</h2>
          <p style={{ opacity: 0.8 }}>
            {tier === 'paused'
              ? 'Resume your account to access review mode.'
              : <>Your plan: <strong>{formatTierLabel(tier)}</strong></>}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {tier === 'paused'
              ? <button type="button" onClick={() => navigate('/me')}>Go to Profile</button>
              : <button type="button" onClick={() => navigate('/upgrade')}>Upgrade</button>}
            <button type="button" onClick={() => navigate(-1)}>← Back</button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="review-page">
        <div className="review-loading">Loading review…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="review-page">
        <div className="review-error">
          <h2>⚠️ Couldn’t load review</h2>
          <p style={{ opacity: 0.8 }}>{error?.message ?? String(error)}</p>
          <button type="button" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div className="review-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <LessonReview
        lesson={lesson}
        title={topicRow?.title ?? ''}
        onExit={() => navigate(-1)}
      />
    </motion.div>
  );
}
