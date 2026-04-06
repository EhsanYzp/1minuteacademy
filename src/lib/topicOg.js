function escapeXml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function safeHexColor(input, fallback = '#22c55e') {
  const raw = String(input ?? '').trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) return raw;
  return fallback;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = Number.parseInt(full, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function wrapTitle(title, maxLineLen = 34) {
  const text = String(title ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return [''];

  const words = text.split(' ');
  const lines = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxLineLen) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length >= 2) break;
  }

  if (lines.length < 2 && line) lines.push(line);

  const output = lines.slice(0, 2);
  if (output.length > 0) {
    const lastIndex = output.length - 1;
    if (output[lastIndex].length > maxLineLen) {
      output[lastIndex] = `${output[lastIndex].slice(0, Math.max(0, maxLineLen - 1))}...`;
    }
  }

  return output;
}

export function buildTopicOgPngPath(topicId) {
  const encoded = encodeURIComponent(String(topicId ?? '').trim());
  return `/api/og/topic-image?topicId=${encoded}`;
}

export function makeTopicOgSvg({ title, emoji, color, siteName = '1 Minute Academy' }) {
  const safeTitle = escapeXml(String(title ?? '').trim() || '1-minute lesson');
  const safeEmoji = emoji == null ? '⏱️' : escapeXml(String(emoji).trim());
  const accentColor = safeHexColor(color, '#22c55e');
  const { r, g, b } = hexToRgb(accentColor);
  const accent = `rgb(${r}, ${g}, ${b})`;
  const lines = wrapTitle(title, 34).map(escapeXml);
  const titleY = lines.length > 1 ? 330 : 350;
  const lineGap = 70;

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">\n` +
`  <defs>\n` +
`    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">\n` +
`      <stop offset="0" stop-color="#0b1020"/>\n` +
`      <stop offset="1" stop-color="#090d1a"/>\n` +
`    </linearGradient>\n` +
`    <linearGradient id="stripe" x1="0" y1="0" x2="1" y2="0">\n` +
`      <stop offset="0" stop-color="${accent}" stop-opacity="0.85"/>\n` +
`      <stop offset="1" stop-color="${accent}" stop-opacity="0.15"/>\n` +
`    </linearGradient>\n` +
`    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">\n` +
`      <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#000" flood-opacity="0.35"/>\n` +
`    </filter>\n` +
`  </defs>\n` +
`  <rect width="1200" height="630" fill="url(#bg)"/>\n` +
`  <rect x="0" y="0" width="1200" height="10" fill="url(#stripe)"/>\n` +
`  <rect x="0" y="620" width="1200" height="10" fill="url(#stripe)"/>\n` +
`\n` +
`  <g filter="url(#shadow)">\n` +
`    <rect x="90" y="90" width="1020" height="450" rx="32" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)"/>\n` +
`  </g>\n` +
`\n` +
`  ${safeEmoji ? `<text x="140" y="210" font-size="86" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" fill="#e5e7eb">${safeEmoji}</text>` : ''}\n` +
`  <text x="140" y="${titleY}" font-size="72" font-weight="800" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" fill="#f9fafb">${lines[0] ?? safeTitle}</text>\n` +
`  ${lines.length > 1 ? `<text x="140" y="${titleY + lineGap}" font-size="72" font-weight="800" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" fill="#f9fafb">${lines[1] ?? ''}</text>` : ''}\n` +
`\n` +
`  <text x="140" y="510" font-size="30" font-weight="700" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" fill="rgba(229,231,235,0.85)">${escapeXml(siteName)} · 1-minute lesson</text>\n` +
`</svg>\n`;
}