import { useMemo, useState } from 'react';
import './StarRating.css';

function clamp(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, n));
}

export default function StarRating({
  value = 0,
  onChange,
  readOnly = false,
  size = 'md',
  label,
  showValue = false,
  countText,
}) {
  const v = clamp(value);
  const [hover, setHover] = useState(null);

  const display = useMemo(() => {
    const d = hover == null ? v : clamp(hover);
    // We render whole stars for now, but keep value for display.
    return { filled: Math.round(d) };
  }, [hover, v]);

  const stars = [1, 2, 3, 4, 5];

  return (
    <div className={`star-rating ${size}`} aria-label={label || 'Rating'}>
      <div className="star-row" role={readOnly ? 'img' : 'radiogroup'} aria-label={label || 'Rating'}>
        {stars.map((s) => {
          const filled = s <= display.filled;
          const canClick = !readOnly && typeof onChange === 'function';
          return (
            <button
              key={s}
              type="button"
              className={filled ? 'star on' : 'star off'}
              disabled={!canClick}
              onMouseEnter={() => canClick && setHover(s)}
              onMouseLeave={() => canClick && setHover(null)}
              onFocus={() => canClick && setHover(s)}
              onBlur={() => canClick && setHover(null)}
              onClick={() => canClick && onChange(s)}
              aria-label={`${s} star${s === 1 ? '' : 's'}`}
              aria-checked={Math.round(v) === s}
              role={readOnly ? undefined : 'radio'}
            >
              {filled ? '★' : '☆'}
            </button>
          );
        })}
      </div>

      {(showValue || countText) && (
        <div className="star-meta">
          {showValue && <span className="star-value">{v.toFixed(1)}</span>}
          {countText && <span className="star-count">{countText}</span>}
        </div>
      )}
    </div>
  );
}
