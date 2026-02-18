import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Header from '../Header';
import ToastStack from '../ToastStack';
import JourneyBlocks from '../../engine/journey/JourneyBlocks';
import { getTopicGate } from '../../services/entitlements';

export default function CompletionScreen({
  journey,
  journeyCtx,
  toasts,
  onDismissToast,
  relatedTopics,
  topicRow,
}) {
  const tier = String(journeyCtx?.tier ?? 'guest');

  return (
    <>
      <Header />
      <ToastStack toasts={toasts} onDismiss={onDismissToast} />
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
              'info',
              'completionStats',
              'proPerkPanel',
              'oneMaAwardPanel',
              'completionProgress',
              'ratingPrompt',
              'cta',
              'ctaRow',
            ]}
          />

          {Array.isArray(relatedTopics) && relatedTopics.length > 0 && (
            <section className="related-topics related-topics--completion" aria-label="Related topics">
              <div className="related-topics__header">
                <div>
                  <div className="related-topics__kicker">Up next</div>
                  <div className="related-topics__title">
                    Related topics{topicRow?.subject ? ` in ${String(topicRow.subject)}` : ''}
                  </div>
                  {topicRow?.subcategory ? (
                    <div className="related-topics__sub">Course: {String(topicRow.subcategory)}</div>
                  ) : null}
                </div>
                <Link className="related-topics__cta" to="/categories">
                  Browse all →
                </Link>
              </div>

              <div className="related-topics__grid">
                {relatedTopics.map((t) => {
                  const gate = getTopicGate({ tier, topicRow: t });
                  const isLocked = Boolean(gate?.locked && gate?.reason === 'pro');

                  const CardTag = isLocked ? 'div' : Link;
                  const cardProps = isLocked
                    ? {
                      role: 'link',
                      'aria-disabled': true,
                      tabIndex: -1,
                    }
                    : { to: `/topic/${t.id}` };

                  return (
                    <CardTag
                      key={t.id}
                      {...cardProps}
                      className={`related-topic-card ${isLocked ? 'related-topic-card--locked' : ''}`}
                      style={{ '--rel-color': t?.color ?? '#4ECDC4' }}
                    >
                      <div className="related-topic-card__top">
                        <div className="related-topic-card__emoji" aria-hidden>
                          {t.emoji ?? '🎯'}
                        </div>
                        <div className="related-topic-card__text">
                          <div className="related-topic-card__title">{t.title}</div>
                          {t?.description ? (
                            <div className="related-topic-card__desc">{t.description}</div>
                          ) : null}
                        </div>
                      </div>

                      <div className="related-topic-card__meta">
                        {isLocked ? (
                          <span className="related-topic-card__badge related-topic-card__badge--lock" title={String(gate?.label ?? 'Pro only')}>
                            🔒 {String(gate?.label ?? 'Pro only')}
                          </span>
                        ) : null}
                        {t?.difficulty ? (
                          <span className="related-topic-card__badge">📊 {t.difficulty}</span>
                        ) : null}
                        {t?.subcategory ? (
                          <span className="related-topic-card__badge related-topic-card__badge--muted">
                            {t.subcategory}
                          </span>
                        ) : null}
                      </div>

                      {isLocked ? (
                        <div className="related-topic-card__locked-hint">
                          Upgrade to unlock.
                        </div>
                      ) : null}
                    </CardTag>
                  );
                })}
              </div>
            </section>
          )}
        </motion.div>

        {/* Confetti Effect (lightweight) */}
        <div className="confetti-container" aria-hidden="true">
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
                opacity: 0,
              }}
              transition={{
                duration: 2.4 + (i % 4) * 0.35,
                delay: (i % 6) * 0.08,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>
      </motion.div>
    </>
  );
}
