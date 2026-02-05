import { whenMatches } from './when';
import './journeyBlocks.css';

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

function renderCtaButton(item, ctx) {
  const variant = coerceVariant(item?.variant);
  const label = interpolate(String(item?.label ?? ''), ctx?.vars);
  const key = `${variant}:${item?.action?.type ?? 'unknown'}:${label}`;
  const action = item?.action ?? null;

  const disabled = Boolean(ctx?.isActionDisabled?.(action));

  const className =
    (ctx?.buttonClassName ?? 'journey-btn') +
    (variant === 'primary' ? ' primary' : ' secondary');

  return (
    <button
      key={key}
      type="button"
      className={className}
      disabled={disabled}
      onClick={() => ctx?.onAction?.(action)}
    >
      {label}
    </button>
  );
}

export default function JourneyBlocks({ blocks, ctx, allowedTypes = null }) {
  const list = Array.isArray(blocks) ? blocks : [];
  const allowed = Array.isArray(allowedTypes) ? new Set(allowedTypes) : null;

  return (
    <div className={ctx?.containerClassName ?? 'journey-blocks'}>
      {list
        .filter((b) => (allowed ? allowed.has(b?.type) : true))
        .filter((b) => whenMatches(b?.when, ctx))
        .map((b, idx) => {
          const type = b?.type;
          const key = `${type ?? 'block'}:${idx}`;

          if (type === 'hero') {
            return (
              <div key={key} className="journey-hero">
                <h2 className="journey-hero-title">{interpolate(String(b.title), ctx?.vars)}</h2>
                {b.subtitle ? (
                  <p className="journey-hero-subtitle">{interpolate(String(b.subtitle), ctx?.vars)}</p>
                ) : null}
              </div>
            );
          }

          if (type === 'bullets') {
            const items = (Array.isArray(b.items) ? b.items : []).map((t) => interpolate(String(t), ctx?.vars));
            return (
              <div key={key} className="journey-bullets">
                {b.title ? <h3 className="journey-bullets-title">{interpolate(String(b.title), ctx?.vars)}</h3> : null}
                <ul className="journey-bullets-list">
                  {items.map((t, i) => (
                    <li key={`${key}:li:${i}`}>{t}</li>
                  ))}
                </ul>
              </div>
            );
          }

          if (type === 'info') {
            return (
              <div key={key} className="journey-info">
                {interpolate(String(b.text), ctx?.vars)}
              </div>
            );
          }

          if (type === 'divider') {
            return <hr key={key} className="journey-divider" />;
          }

          if (type === 'cta') {
            if (!whenMatches(b?.when, ctx)) return null;
            return <div key={key} className="journey-cta">{renderCtaButton(b, ctx)}</div>;
          }

          if (type === 'ctaRow') {
            const items = (Array.isArray(b.items) ? b.items : []).filter((it) => whenMatches(it?.when, ctx));
            if (items.length === 0) return null;
            return (
              <div key={key} className="journey-cta-row">
                {items.map((it) => renderCtaButton(it, ctx))}
              </div>
            );
          }

          if (type === 'takeaways') {
            const points = (Array.isArray(b.points) ? b.points : []).map((t) => interpolate(String(t), ctx?.vars));
            if (points.length === 0) return null;
            return (
              <div key={key} className={ctx?.takeawaysClassName ?? 'journey-panel'}>
                <p className={ctx?.panelTitleClassName ?? 'journey-panel-title'}>
                  {interpolate(String(b.title ?? 'Key takeaways'), ctx?.vars)}
                </p>
                <ul className={ctx?.takeawaysListClassName ?? 'journey-takeaways'}>
                  {points.slice(0, 5).map((pt, i) => (
                    <li key={`${key}:pt:${i}`}>{pt}</li>
                  ))}
                </ul>
                {ctx?.renderTakeawaysGating ? ctx.renderTakeawaysGating() : null}
              </div>
            );
          }

          if (type === 'ratingPrompt') {
            return ctx?.renderRating ? (
              <div key={key} className={ctx?.ratingClassName ?? 'journey-panel'}>
                {ctx.renderRating({ title: b.title })}
              </div>
            ) : null;
          }

          if (type === 'completionStats') {
            return ctx?.renderCompletionStats ? <div key={key}>{ctx.renderCompletionStats()}</div> : null;
          }

          if (type === 'completionProgress') {
            return ctx?.renderCompletionProgress ? <div key={key}>{ctx.renderCompletionProgress()}</div> : null;
          }

          if (type === 'proPerkPanel') {
            return ctx?.renderProPerkPanel ? <div key={key}>{ctx.renderProPerkPanel()}</div> : null;
          }

          if (type === 'oneMaAwardPanel') {
            return ctx?.renderOneMaAwardPanel ? <div key={key}>{ctx.renderOneMaAwardPanel()}</div> : null;
          }

          if (type === 'reviewLesson') {
            return ctx?.renderReviewLesson ? <div key={key}>{ctx.renderReviewLesson()}</div> : null;
          }

          return null;
        })}
    </div>
  );
}
