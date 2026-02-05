export default function OneMAIcon({ size = 18, title = '1MA collectible' } = {}) {
  const s = Number(size) || 18;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <defs>
        <linearGradient id="omaCoin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8FF7E7" />
          <stop offset="0.55" stopColor="#4ECDC4" />
          <stop offset="1" stopColor="#2FB9B0" />
        </linearGradient>
        <linearGradient id="omaShine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgba(255,255,255,0.0)" />
          <stop offset="0.5" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.0)" />
        </linearGradient>
      </defs>

      <circle cx="32" cy="32" r="27" fill="url(#omaCoin)" />
      <circle cx="32" cy="32" r="23" fill="rgba(255,255,255,0.10)" />
      <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="2" />

      <path
        d="M18 22 C24 14, 40 14, 46 22"
        fill="none"
        stroke="url(#omaShine)"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.65"
      />

      <g fill="rgba(0,0,0,0.75)">
        <path d="M18 44 h10 v-4 h-3 v-18 h-4 l-3 2 v4 l3-2 v14 h-3z" />
        <path d="M31 44 v-22 h4 l5 8 5-8 h4 v22 h-4 v-14 l-5 7 -5-7 v14z" />
        <path d="M54 44 h-4 l-2-6 h-8 l-2 6 h-4 l8-22 h4zm-8-10-2-7-2 7z" />
      </g>

      <g fill="rgba(255,255,255,0.75)">
        <path d="M12 16 l3 2 -2 3 -3-2z" />
        <path d="M53 14 l3 2 -2 3 -3-2z" />
      </g>
    </svg>
  );
}
