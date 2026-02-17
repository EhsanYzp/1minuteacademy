export function renderCertificateSvgTemplate({
  width,
  height,
  certificateId,
  subject,
  recipientName,
  dateLabel,
  recipientAvatarHref,
}) {
  const hasAvatar = Boolean(recipientAvatarHref);
  const yShift = hasAvatar ? 0 : -84;

  const w = width;
  const h = height;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f5fbff"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4ECDC4"/>
      <stop offset="55%" stop-color="#3bb1e3"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
    <linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fde68a"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#0b1220" flood-opacity="0.10"/>
    </filter>
    <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.3" fill="#0b1220" opacity="0.06"/>
    </pattern>
    <clipPath id="avatarClip">
      <circle cx="0" cy="0" r="54" />
    </clipPath>
  </defs>

  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#dots)"/>

  <!-- Confetti corners (subtle) -->
  <g opacity="0.22">
    <circle cx="120" cy="130" r="10" fill="#4ECDC4"/>
    <circle cx="155" cy="165" r="6" fill="#2563eb"/>
    <circle cx="195" cy="125" r="7" fill="#f59e0b"/>
    <circle cx="1480" cy="120" r="9" fill="#4ECDC4"/>
    <circle cx="1446" cy="160" r="6" fill="#2563eb"/>
    <circle cx="1492" cy="178" r="7" fill="#f59e0b"/>
  </g>

  <!-- Fun touch: tiny 60s stamp -->
  <g transform="translate(1320 118) rotate(-8)">
    <rect x="0" y="0" width="200" height="70" rx="18" fill="#fff" stroke="#0b1220" stroke-opacity="0.12"/>
    <text x="100" y="46" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="28" font-weight="950" fill="#0b1220" opacity="0.86">60s</text>
  </g>

  <!-- Main certificate card -->
  <g filter="url(#shadow)">
    <rect x="90" y="90" width="1420" height="951" rx="36" fill="#ffffff"/>
    <rect x="90" y="90" width="1420" height="951" rx="36" fill="none" stroke="#0b1220" stroke-opacity="0.10" stroke-width="2"/>

    <!-- Border accent -->
    <rect x="120" y="120" width="1360" height="891" rx="30" fill="none" stroke="url(#accent)" stroke-width="7" opacity="0.58"/>

    <!-- Header bar -->
    <g transform="translate(160 150)">
      <rect x="0" y="0" width="1280" height="86" rx="22" fill="url(#accent)" opacity="0.12"/>
      <text x="640" y="56" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="22" font-weight="900" fill="#0b1220" opacity="0.78">1 Minute Academy</text>
    </g>

    <text x="800" y="310" text-anchor="middle" font-family="ui-serif, Georgia, 'Times New Roman'" font-size="64" font-weight="900" fill="#0b1220" opacity="0.93">Certificate of Completion</text>

    ${hasAvatar ? `<!-- Avatar badge -->
    <g transform="translate(800 392)">
      <circle cx="0" cy="0" r="68" fill="url(#accent)" opacity="0.18"/>
      <circle cx="0" cy="0" r="62" fill="#fff" stroke="#0b1220" stroke-opacity="0.10" stroke-width="2"/>
      <g clip-path="url(#avatarClip)" transform="translate(0 0)">
        <image href="${recipientAvatarHref}" x="-54" y="-54" width="108" height="108" preserveAspectRatio="xMidYMid slice" />
      </g>
      <circle cx="0" cy="0" r="54" fill="none" stroke="url(#accent)" stroke-width="6" opacity="0.60"/>
    </g>` : ''}

    <!-- Recipient -->
    <text x="800" y="${505 + yShift}" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="22" font-weight="850" fill="#0b1220" opacity="0.56">This certifies that</text>
    <text x="800" y="${585 + yShift}" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="60" font-weight="950" fill="#0b1220" opacity="0.95">${recipientName}</text>

    <text x="800" y="${655 + yShift}" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="22" font-weight="850" fill="#0b1220" opacity="0.56">has completed every module in</text>

    <!-- Subject award -->
    <text x="800" y="${745 + yShift}" text-anchor="middle" font-family="ui-serif, Georgia, 'Times New Roman'" font-size="54" font-weight="900" fill="#0b1220" opacity="0.93">${subject}</text>

    <!-- Ribbon title -->
    <g transform="translate(480 ${780 + yShift})">
      <path d="M60 0 H580 a26 26 0 0 1 26 26 v34 a26 26 0 0 1 -26 26 H60 a26 26 0 0 1 -26 -26 V26 A26 26 0 0 1 60 0 Z" fill="url(#ribbon)" opacity="0.95"/>
      <path d="M34 26 L0 43 L34 60" fill="#f59e0b" opacity="0.70"/>
      <path d="M666 26 L700 43 L666 60" fill="#f59e0b" opacity="0.70"/>
      <text x="320" y="58" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="26" font-weight="950" fill="#0b1220" opacity="0.90">${subject} 1 Minute Expert</text>
    </g>

    <!-- Footer -->
    <g transform="translate(180 905)">
      <path d="M0 30 H420" stroke="#0b1220" stroke-opacity="0.12" stroke-width="2"/>
      <text x="0" y="65" font-family="ui-sans-serif, system-ui, -apple-system" font-size="18" font-weight="850" fill="#0b1220" opacity="0.70">Awarded</text>
      <text x="0" y="95" font-family="ui-sans-serif, system-ui, -apple-system" font-size="20" font-weight="950" fill="#0b1220" opacity="0.90">${dateLabel}</text>
    </g>

    <g transform="translate(1000 905)">
      <path d="M0 30 H420" stroke="#0b1220" stroke-opacity="0.12" stroke-width="2"/>
      <text x="0" y="65" font-family="ui-sans-serif, system-ui, -apple-system" font-size="18" font-weight="850" fill="#0b1220" opacity="0.70">Certificate ID</text>
      <text x="0" y="95" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas" font-size="18" font-weight="900" fill="#0b1220" opacity="0.86">${certificateId}</text>
    </g>

    <!-- Friendly wink -->
    <text x="800" y="1000" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="16" font-weight="800" fill="#0b1220" opacity="0.50">Built for people who hate long courses. (Respect.)</text>
  </g>
</svg>`;
}
