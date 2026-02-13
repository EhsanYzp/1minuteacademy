import { useEffect, useMemo, useRef } from 'react';

function buildTicks(count) {
  const ticks = [];
  const cx = 500;
  const cy = 500;

  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const isMajor = i % 5 === 0;

    const rOuter = 410;
    const rInner = isMajor ? 370 : 388;

    const x1 = cx + Math.cos(angle) * rInner;
    const y1 = cy + Math.sin(angle) * rInner;
    const x2 = cx + Math.cos(angle) * rOuter;
    const y2 = cy + Math.sin(angle) * rOuter;

    ticks.push({ key: i, x1, y1, x2, y2, isMajor });
  }

  return ticks;
}

export default function HeroClockBackdrop() {
  const ticks = useMemo(() => buildTicks(60), []);
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduceMotion) return;

    let rafId = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const onPointerMove = (e) => {
      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);
      const nx = (e.clientX / vw) * 2 - 1;
      const ny = (e.clientY / vh) * 2 - 1;
      targetX = Math.max(-1, Math.min(1, nx));
      targetY = Math.max(-1, Math.min(1, ny));
    };

    const tick = () => {
      const lerp = 0.06;
      currentX += (targetX - currentX) * lerp;
      currentY += (targetY - currentY) * lerp;
      const maxPx = 10;
      root.style.setProperty('--heroClockX', `${(currentX * maxPx).toFixed(2)}px`);
      root.style.setProperty('--heroClockY', `${(currentY * maxPx).toFixed(2)}px`);
      rafId = window.requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={rootRef} className="heroClock" aria-hidden="true">
      <svg className="heroClock-svg" viewBox="0 0 1000 1000" role="presentation" focusable="false">
        <defs>
          <radialGradient id="heroClockGlow" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.30" />
            <stop offset="55%" stopColor="#2563eb" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </radialGradient>

          <filter id="heroClockSoft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.9 0"
              result="soft"
            />
            <feMerge>
              <feMergeNode in="soft" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="heroClockRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#111827" stopOpacity="0.25" />
            <stop offset="40%" stopColor="#2563eb" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#111827" stopOpacity="0.18" />
          </linearGradient>
        </defs>

        <circle cx="500" cy="500" r="465" fill="url(#heroClockGlow)" filter="url(#heroClockSoft)" />

        <g className="heroClock-face">
          <circle cx="500" cy="500" r="420" fill="none" stroke="url(#heroClockRing)" strokeWidth="2" />
          <circle cx="500" cy="500" r="360" fill="none" stroke="#111827" strokeOpacity="0.18" strokeWidth="1" />

          <g className="heroClock-ticks">
            {ticks.map((t) => (
              <line
                key={t.key}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="#111827"
                strokeOpacity={t.isMajor ? 0.26 : 0.14}
                strokeWidth={t.isMajor ? 3 : 2}
                strokeLinecap="round"
              />
            ))}
          </g>

          <g className="heroClock-hands">
            <line
              className="heroClock-minuteHand"
              x1="500"
              y1="500"
              x2="500"
              y2="255"
              stroke="#111827"
              strokeOpacity="0.24"
              strokeWidth="10"
              strokeLinecap="round"
            />

            <line
              className="heroClock-secondHand"
              x1="500"
              y1="540"
              x2="500"
              y2="170"
              stroke="#2563eb"
              strokeOpacity="0.55"
              strokeWidth="4"
              strokeLinecap="round"
            />

            <circle cx="500" cy="500" r="16" fill="#0b1020" fillOpacity="0.20" />
            <circle cx="500" cy="500" r="7" fill="#2563eb" fillOpacity="0.55" />
          </g>
        </g>

        <g className="heroClock-marks">
          <path
            d="M500 98 a402 402 0 0 1 0 804 a402 402 0 0 1 0 -804"
            fill="none"
            stroke="#2563eb"
            strokeOpacity="0.14"
            strokeWidth="26"
            strokeLinecap="round"
            pathLength="60"
            className="heroClock-sweep"
          />
        </g>
      </svg>
    </div>
  );
}
