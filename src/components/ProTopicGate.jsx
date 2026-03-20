import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatTierLabel } from '../services/entitlements';
import { listFreeRelatedTopics } from '../services/topics';
import { toDisplaySubject } from '../lib/subjectAliases';
import './ProTopicGate.css';
import '../pages/CategoriesFlow.css';

/**
 * Shown when a free / guest user tries to view a Pro-only topic or lesson.
 *
 * Props
 * ─────
 * topic       – normalised topic object  { id, title, emoji, color, description }
 * topicRow    – raw Supabase row (needs .subject / .subcategory for free suggestions)
 * tier        – current entitlement tier ('guest' | 'free' | 'pro' | 'paused')
 * backTo      – optional string path, e.g. "/categories/.../chapters/..."
 * backLabel   – label for the backTo link  (default "Back to chapter")
 * context     – 'topic' | 'lesson'  (tweaks wording)
 */
export default function ProTopicGate({
  topic,
  topicRow,
  tier,
  backTo = null,
  backLabel = 'Back to chapter',
  context = 'topic',
}) {
  const navigate = useNavigate();
  const [freeTopics, setFreeTopics] = useState([]);
  const [loadingFree, setLoadingFree] = useState(true);

  const topicId = topic?.id ?? topicRow?.id;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingFree(true);
        const results = await listFreeRelatedTopics({
          topicId,
          subject: topicRow?.subject ?? null,
          subcategory: topicRow?.subcategory ?? null,
          limit: 3,
        });
        if (!cancelled) setFreeTopics(results);
      } catch {
        // non-blocking — we simply show no suggestions
      } finally {
        if (!cancelled) setLoadingFree(false);
      }
    })();

    return () => { cancelled = true; };
  }, [topicId, topicRow?.subject, topicRow?.subcategory]);

  const heading =
    context === 'lesson' ? 'Pro-only lesson' : 'Pro-only topic';
  const unlockCopy =
    context === 'lesson'
      ? 'Upgrade to Pro to start this lesson.'
      : 'Upgrade to Pro to unlock this topic.';

  return (
    <motion.section
      className="pro-gate"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* ── Main card ─────────────────────────── */}
      <div
        className="pro-gate__card"
        style={{ '--gate-color': topic?.color ?? '#4ECDC4' }}
      >
        <div className="pro-gate__lock">🔒</div>
        <span className="pro-gate__badge">⭐ Pro only</span>

        <h1 className="pro-gate__title">
          {topic?.emoji ? `${topic.emoji} ` : ''}
          {topic?.title ?? heading}
        </h1>

        <p className="pro-gate__desc">
          {topic?.description ?? unlockCopy}
        </p>

        <p className="pro-gate__plan">
          Your current plan: <strong>{formatTierLabel(tier)}</strong>
        </p>

        <div className="pro-gate__actions">
          <button
            type="button"
            className="pro-gate__btn pro-gate__btn--upgrade"
            onClick={() => navigate('/upgrade')}
          >
            ⭐ Upgrade to Pro
          </button>

          {backTo && (
            <Link to={backTo} className="pro-gate__btn">
              ← {backLabel}
            </Link>
          )}

          <Link to="/" className="pro-gate__btn pro-gate__btn--home">
            🏠 Home
          </Link>
        </div>
      </div>

      {/* ── Free alternative suggestions ─────── */}
      {loadingFree && (
        <div className="pro-gate__suggestions">
          <p className="pro-gate__suggestions-loading">
            <span className="pro-gate__suggestions-loading-spinner">⏳</span>
            Looking for free topics you can try…
          </p>
        </div>
      )}

      {!loadingFree && freeTopics.length > 0 && (
        <motion.div
          className="pro-gate__suggestions"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h2 className="pro-gate__suggestions-title">
            🎓 Try these free topics instead
          </h2>

          <div className="catflow-resultList">
            {freeTopics.map((ft) => {
              const subject = String(ft.subject ?? '').trim();
              const subcategory = String(ft.subcategory ?? '').trim();
              const topicPath = `/topic/${encodeURIComponent(String(ft.id))}`;
              const lessonPath = `/lesson/${encodeURIComponent(String(ft.id))}`;

              return (
                <div
                  key={ft.id}
                  className="catflow-result catflow-resultClickable"
                  style={{ '--row-accent': ft.color ?? 'rgba(16, 185, 129, 0.85)' }}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(topicPath)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(topicPath); }
                  }}
                >
                  <div className="catflow-resultMain">
                    <h3 className="catflow-resultTitle">
                      {ft.emoji ?? '🎯'} {ft.title ?? ft.id}
                    </h3>

                    {ft.description ? (
                      <p className="catflow-resultDesc">{ft.description}</p>
                    ) : null}

                    <div className="catflow-metaChips catflow-metaChips--compact">
                      {subject ? (
                        <span className="catflow-metaChip catflow-metaChip--category">
                          <span className="catflow-metaChipLabel">Category</span>
                          <span className="catflow-metaChipValue">{toDisplaySubject(subject)}</span>
                        </span>
                      ) : null}
                      {subcategory ? (
                        <span className="catflow-metaChip catflow-metaChip--course">
                          <span className="catflow-metaChipLabel">Course</span>
                          <span className="catflow-metaChipValue">{subcategory}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="catflow-resultSide">
                    <span className="catflow-pill">Free</span>
                    <Link
                      to={lessonPath}
                      className="catflow-button primary catflow-startBtn"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Start lesson"
                    >
                      Start ▶
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}
