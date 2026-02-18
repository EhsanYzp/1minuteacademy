import { motion } from 'framer-motion';
import { Link, useLocation, useParams } from 'react-router-dom';
import Header from '../Header';
import ToastStack from '../ToastStack';
import JourneyBlocks from '../../engine/journey/JourneyBlocks';
import { whenMatches } from '../../engine/journey/when';
import { getTopicGate } from '../../services/entitlements';

function interpolate(text, vars) {
  if (typeof text !== 'string') return '';
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k) => {
    const v = vars && k in vars ? vars[k] : '';
    return v == null ? '' : String(v);
  });
}

function coerceVariant(v) {
  return v === 'secondary' ? 'secondary' : 'primary';
}

export default function CompletionScreen({
  journey,
  journeyCtx,
  toasts,
  onDismissToast,
  relatedTopics,
  topicRow,
}) {
  const tier = String(journeyCtx?.tier ?? 'guest');
  const location = useLocation();
  const { categoryId: routeCategoryId, courseId: routeCourseId, chapterId: routeChapterId } = useParams();

  const from = location?.state?.fromChapter;
  const fromCategoryId = String(from?.categoryId ?? routeCategoryId ?? '').trim();
  const fromCourseId = String(from?.courseId ?? routeCourseId ?? '').trim();
  const fromChapterId = String(from?.chapterId ?? routeChapterId ?? '').trim();
  const backToChapterTo =
    fromCategoryId && fromCourseId && fromChapterId
      ? `/categories/${encodeURIComponent(fromCategoryId)}/courses/${encodeURIComponent(fromCourseId)}/chapters/${encodeURIComponent(fromChapterId)}`
      : null;

  const completionBlocks = Array.isArray(journey?.completion?.blocks) ? journey.completion.blocks : [];

  const ctaItems = completionBlocks
    .filter((b) => b?.type === 'cta' || b?.type === 'ctaRow')
    .flatMap((b) => {
      if (b?.type === 'cta') return [b];
      const items = Array.isArray(b?.items) ? b.items : [];
      return items;
    })
    .filter((it) => whenMatches(it?.when, journeyCtx));

  const primaryCtaIdx = ctaItems.findIndex((it) => coerceVariant(it?.variant) === 'primary');
  const primaryCta = primaryCtaIdx >= 0 ? ctaItems[primaryCtaIdx] : ctaItems[0] ?? null;
  const otherCtas = ctaItems.filter((_, idx) => idx !== (primaryCta ? (primaryCtaIdx >= 0 ? primaryCtaIdx : 0) : -1));

  const summaryCtaDisabledForGuest = ctaItems.some((it) => {
    const action = it?.action;
    if (!action || typeof action !== 'object') return false;
    if (action.type !== 'goToProfile') return false;
    return Boolean(journeyCtx?.isActionDisabled?.(action));
  });

  const buttonBaseClass = journeyCtx?.buttonClassName ?? 'journey-btn';
  const renderCtaButton = (item, { compact = false } = {}) => {
    if (!item) return null;
    const variant = coerceVariant(item?.variant);
    const label = interpolate(String(item?.label ?? ''), journeyCtx?.vars);
    const action = item?.action ?? null;
    const disabled = Boolean(journeyCtx?.isActionDisabled?.(action));

    const disabledTitle =
      disabled && action?.type === 'goToProfile'
        ? 'Sign in to view your learning summary.'
        : undefined;

    const className =
      buttonBaseClass +
      (variant === 'primary' ? ' primary' : ' secondary') +
      (compact ? ' completion-actionBtn--compact' : '');

    return (
      <button
        key={`${variant}:${action?.type ?? 'unknown'}:${label}`}
        type="button"
        className={className}
        disabled={disabled}
        title={disabledTitle}
        onClick={() => journeyCtx?.onAction?.(action)}
      >
        {label}
      </button>
    );
  };

  const nonCtaBlocks = completionBlocks.filter((b) => b?.type !== 'cta' && b?.type !== 'ctaRow');

  const ratingIdx = nonCtaBlocks.findIndex((b) => b?.type === 'ratingPrompt');
  const blocksUpToRating = ratingIdx >= 0 ? nonCtaBlocks.slice(0, ratingIdx + 1) : nonCtaBlocks;
  const blocksAfterRating = ratingIdx >= 0 ? nonCtaBlocks.slice(ratingIdx + 1) : [];

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
          <div className="completion-body" aria-label="Completion content">
            <motion.div
              className="completion-emoji"
              animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: 3 }}
            >
              🎉
            </motion.div>

            <JourneyBlocks
              blocks={blocksUpToRating}
              ctx={journeyCtx}
              allowedTypes={[
                'hero',
                'info',
                'completionStats',
                'proPerkPanel',
                'oneMaAwardPanel',
                'completionProgress',
                'ratingPrompt',
              ]}
            />

            {(backToChapterTo || primaryCta || otherCtas.length > 0) ? (
              <div className="completion-actionDock" aria-label="Next actions">
                <div className="completion-actionDockMain">
                  {primaryCta ? renderCtaButton(primaryCta) : null}
                  {backToChapterTo ? (
                    <Link
                      className={`${buttonBaseClass} secondary`}
                      to={backToChapterTo}
                    >
                      Back to chapter
                    </Link>
                  ) : null}
                </div>
                {otherCtas.length > 0 ? (
                  <details className="completion-actionDockMore" aria-label="Other actions">
                    <summary className="completion-actionDockMoreSummary">
                      Other options
                    </summary>
                    <div className="completion-actionDockMoreGrid">
                      {otherCtas.map((it) => renderCtaButton(it, { compact: true }))}
                    </div>
                    {summaryCtaDisabledForGuest ? (
                      <div className="completion-actionDockHint">
                        Sign in to view your learning summary.
                      </div>
                    ) : null}
                  </details>
                ) : null}
              </div>
            ) : null}

            {blocksAfterRating.length > 0 ? (
              <details className="completion-fold" aria-label="Progress and stats">
                <summary className="completion-foldSummary">Progress and stats</summary>
                <div className="completion-foldBody">
                  <JourneyBlocks
                    blocks={blocksAfterRating}
                    ctx={journeyCtx}
                    allowedTypes={[
                      'hero',
                      'info',
                      'completionStats',
                      'proPerkPanel',
                      'oneMaAwardPanel',
                      'completionProgress',
                      'ratingPrompt',
                    ]}
                  />
                </div>
              </details>
            ) : null}

            {Array.isArray(relatedTopics) && relatedTopics.length > 0 && (
              <details className="completion-fold" aria-label="Up next">
                <summary className="completion-foldSummary">
                  Up next ({relatedTopics.length})
                </summary>
                <div className="completion-foldBody">
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
                </div>
              </details>
            )}
          </div>
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
