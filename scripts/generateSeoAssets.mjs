import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { TOPICS_DIR, ROOT } from './_contentPaths.mjs';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function normalizeSiteUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function escapeXml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function listTopicFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listTopicFiles(full)));
    else if (entry.isFile() && entry.name.endsWith('.topic.json')) out.push(full);
  }
  return out;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function formatLastmod(date) {
  try {
    return new Date(date).toISOString();
  } catch {
    return null;
  }
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  const parts = [];
  parts.push('<url>');
  parts.push(`  <loc>${escapeXml(loc)}</loc>`);
  if (lastmod) parts.push(`  <lastmod>${escapeXml(lastmod)}</lastmod>`);
  if (changefreq) parts.push(`  <changefreq>${escapeXml(changefreq)}</changefreq>`);
  if (typeof priority === 'number') parts.push(`  <priority>${priority.toFixed(1)}</priority>`);
  parts.push('</url>');
  return parts.join('\n');
}

async function writeFileEnsuringDir(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

async function writeBinaryEnsuringDir(filePath, buffer) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
}

function setPixel(png, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

function fill(png, r, g, b, a = 255) {
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      setPixel(png, x, y, r, g, b, a);
    }
  }
}

function drawRing(png, cx, cy, outerRadius, innerRadius, r, g, b, a = 255) {
  const out2 = outerRadius * outerRadius;
  const in2 = innerRadius * innerRadius;
  const minX = Math.floor(cx - outerRadius);
  const maxX = Math.ceil(cx + outerRadius);
  const minY = Math.floor(cy - outerRadius);
  const maxY = Math.ceil(cy + outerRadius);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= out2 && d2 >= in2) setPixel(png, x, y, r, g, b, a);
    }
  }
}

function drawLine(png, x0, y0, x1, y1, thickness, r, g, b, a = 255) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return;

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = Math.round(x0 + dx * t);
    const y = Math.round(y0 + dy * t);

    for (let oy = -thickness; oy <= thickness; oy += 1) {
      for (let ox = -thickness; ox <= thickness; ox += 1) {
        setPixel(png, x + ox, y + oy, r, g, b, a);
      }
    }
  }
}

async function pngToBuffer(png) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    png
      .pack()
      .on('data', (c) => chunks.push(c))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject);
  });
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
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
  const t = String(title ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return [''];

  const words = t.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= maxLineLen) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = w;
    if (lines.length >= 2) break;
  }
  if (lines.length < 2 && line) lines.push(line);

  // Hard cap to 2 lines; truncate last line if needed.
  const out = lines.slice(0, 2);
  if (out.length > 0) {
    const lastIdx = out.length - 1;
    if (out[lastIdx].length > maxLineLen) {
      out[lastIdx] = `${out[lastIdx].slice(0, Math.max(0, maxLineLen - 1))}…`;
    }
  }
  return out;
}

function makeTopicOgSvg({ title, emoji, color, siteName = '1 Minute Academy' }) {
  const safeTitle = escapeXml(String(title ?? '').trim() || '1-minute lesson');
  const safeEmoji = escapeXml(String(emoji ?? '⏱️').trim() || '⏱️');
  const c = safeHexColor(color, '#22c55e');
  const { r, g, b } = hexToRgb(c);
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
`  <text x="140" y="210" font-size="86" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" fill="#e5e7eb">${safeEmoji}</text>\n` +
`  <text x="140" y="${titleY}" font-size="72" font-weight="800" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" fill="#f9fafb">${lines[0] ?? ''}</text>\n` +
`  ${lines.length > 1 ? `<text x="140" y="${titleY + lineGap}" font-size="72" font-weight="800" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" fill="#f9fafb">${lines[1] ?? ''}</text>` : ''}\n` +
`\n` +
`  <text x="140" y="510" font-size="30" font-weight="700" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" fill="rgba(229,231,235,0.85)">${escapeXml(siteName)} · 60-second lesson</text>\n` +
`</svg>\n`;
}

async function main() {
  const siteUrl = normalizeSiteUrl(process.env.SITE_URL || process.env.VITE_SITE_URL);
  if (!siteUrl) {
    console.warn('⚠️  SEO: SITE_URL/VITE_SITE_URL is not set. Using http://localhost:5173 for generated sitemap/llms.txt.');
  }
  const base = siteUrl || 'http://localhost:5173';

  const topicFiles = await listTopicFiles(TOPICS_DIR);
  const topicRows = [];

  for (const file of topicFiles) {
    try {
      const data = await readJson(file);
      if (!data?.id || data?.published !== true) continue;
      const stat = await fs.stat(file);
      topicRows.push({
        id: String(data.id),
        title: String(data.title ?? data.id),
        description: String(data.description ?? ''),
        emoji: String(data.emoji ?? ''),
        color: String(data.color ?? ''),
        difficulty: String(data.difficulty ?? ''),
        updatedAt: stat.mtime,
      });
    } catch {
      // Ignore invalid files here; content validation should catch them.
    }
  }

  topicRows.sort((a, b) => a.id.localeCompare(b.id));

  const now = new Date();

  const routes = [
    { path: '/', changefreq: 'weekly', priority: 1.0, lastmod: now },
    { path: '/topics', changefreq: 'daily', priority: 0.9, lastmod: now },
    { path: '/pricing', changefreq: 'monthly', priority: 0.6, lastmod: now },
    { path: '/faq', changefreq: 'monthly', priority: 0.4, lastmod: now },
    { path: '/privacy', changefreq: 'yearly', priority: 0.2, lastmod: now },
    { path: '/terms', changefreq: 'yearly', priority: 0.2, lastmod: now },
    { path: '/cookies', changefreq: 'yearly', priority: 0.2, lastmod: now },
  ];

  for (const t of topicRows) {
    routes.push({
      path: `/topic/${encodeURIComponent(t.id)}`,
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: t.updatedAt,
    });
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...routes.map((r) =>
      urlEntry({
        loc: `${base}${r.path}`,
        lastmod: formatLastmod(r.lastmod),
        changefreq: r.changefreq,
        priority: r.priority,
      }),
    ),
    '</urlset>',
    '',
  ].join('\n');

  const publicDir = path.join(ROOT, 'public');
  await writeFileEnsuringDir(path.join(publicDir, 'sitemap.xml'), xml);

  // Default OG image (PNG): keep simple and brand-consistent.
  {
    const png = new PNG({ width: 1200, height: 630 });
    fill(png, 11, 16, 32, 255); // #0b1020

    // Accent ring + hands (simple clock)
    const cx = 210;
    const cy = 315;
    drawRing(png, cx, cy, 150, 120, 34, 197, 94, 255); // green-ish
    drawRing(png, cx, cy, 160, 150, 59, 130, 246, 255); // blue-ish outer
    drawLine(png, cx, cy, cx, cy - 75, 3, 229, 231, 235, 255);
    drawLine(png, cx, cy, cx + 55, cy + 35, 3, 229, 231, 235, 255);

    // Soft gradient stripe
    for (let x = 0; x < png.width; x += 1) {
      const t = x / (png.width - 1);
      const a = Math.round(255 * clamp(0.55 - Math.abs(t - 0.5) * 1.1, 0, 0.55));
      for (let y = 0; y < 8; y += 1) setPixel(png, x, y, 59, 130, 246, a);
      for (let y = png.height - 8; y < png.height; y += 1) setPixel(png, x, y, 34, 197, 94, a);
    }

    const ogDir = path.join(publicDir, 'og');
    await writeBinaryEnsuringDir(path.join(ogDir, 'og-image.png'), await pngToBuffer(png));
  }

  // Topic-specific OG images (SVG): includes title + emoji + accent color.
  {
    const outDir = path.join(publicDir, 'og', 'topics');
    await fs.mkdir(outDir, { recursive: true });
    for (const t of topicRows) {
      const filename = `${encodeURIComponent(t.id)}.svg`;
      const svg = makeTopicOgSvg({
        title: t.title,
        emoji: t.emoji,
        color: t.color,
      });
      await fs.writeFile(path.join(outDir, filename), svg, 'utf8');
    }
  }

  const llmsLines = [];
  llmsLines.push('# 1 Minute Academy');
  llmsLines.push('# This file helps LLM tools discover high-level entry points.');
  llmsLines.push('');
  llmsLines.push(`Site: ${base}`);
  llmsLines.push(`Sitemap: ${base}/sitemap.xml`);
  llmsLines.push('');
  llmsLines.push('Primary pages:');
  llmsLines.push(`- ${base}/`);
  llmsLines.push(`- ${base}/topics`);
  llmsLines.push(`- ${base}/pricing`);
  llmsLines.push(`- ${base}/faq`);
  llmsLines.push('');
  llmsLines.push('Topics (published):');
  const maxTopics = 500;
  for (const t of topicRows.slice(0, maxTopics)) {
    const title = t.title.replace(/\s+/g, ' ').trim();
    const desc = t.description.replace(/\s+/g, ' ').trim();
    const suffix = desc ? ` — ${desc}` : '';
    llmsLines.push(`- ${title}: ${base}/topic/${encodeURIComponent(t.id)}${suffix}`);
  }
  if (topicRows.length > maxTopics) {
    llmsLines.push(`- …and ${topicRows.length - maxTopics} more (see sitemap).`);
  }
  llmsLines.push('');

  await writeFileEnsuringDir(path.join(publicDir, 'llms.txt'), llmsLines.join('\n'));

  console.log(`✅ SEO assets generated: public/sitemap.xml, public/llms.txt, public/og/* (${topicRows.length} topics)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
