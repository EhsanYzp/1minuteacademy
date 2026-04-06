import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { TOPICS_DIR, ROOT } from './_contentPaths.mjs';
import { makeTopicOgSvg } from '../src/lib/topicOg.js';

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
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    if (e?.code === 'ENOENT') return [];
    throw e;
  }
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
  if (!date) return null;
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
  const next = String(content ?? '');
  try {
    const prev = await fs.readFile(filePath, 'utf8');
    if (prev === next) return false;
  } catch {
    // ignore
  }
  await fs.writeFile(filePath, next, 'utf8');
  return true;
}

async function writeBinaryEnsuringDir(filePath, buffer) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const next = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  try {
    const prev = await fs.readFile(filePath);
    if (Buffer.isBuffer(prev) && prev.equals(next)) return false;
  } catch {
    // ignore
  }
  await fs.writeFile(filePath, next);
  return true;
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

function parseLessonVersion(data) {
  const v = data?.lesson?.version ?? data?.version ?? null;
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function deterministicUpdatedAtFromVersion(version) {
  const v = typeof version === 'number' ? version : parseLessonVersion({ lesson: { version } });
  if (!v) return null;

  // Deterministic timestamp derived from lesson.version.
  // We intentionally avoid fs.mtime (which changes on checkout/zip/copy) to prevent churn.
  const BASE_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
  return new Date(BASE_MS + v * 1000);
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
      const version = parseLessonVersion(data);
      topicRows.push({
        id: String(data.id),
        subject: String(data.subject ?? ''),
        subcategory: String(data.subcategory ?? ''),
        course_id: String(data.course_id ?? ''),
        chapter_id: String(data.chapter_id ?? ''),
        title: String(data.title ?? data.id),
        description: String(data.description ?? ''),
        emoji: String(data.emoji ?? ''),
        color: String(data.color ?? ''),
        is_free: Boolean(data.is_free),
        version,
        updatedAt: deterministicUpdatedAtFromVersion(version),
      });
    } catch {
      // Ignore invalid files here; content validation should catch them.
    }
  }

  topicRows.sort((a, b) => a.id.localeCompare(b.id));

  const topicUpdatedAtMs = topicRows
    .map((t) => (t.updatedAt instanceof Date ? t.updatedAt.getTime() : null))
    .filter((n) => typeof n === 'number' && Number.isFinite(n));

  const maxTopicUpdatedAt = topicUpdatedAtMs.length > 0 ? new Date(Math.max(...topicUpdatedAtMs)) : null;
  const generatedAt = (maxTopicUpdatedAt ?? new Date(0)).toISOString();

  const routes = [
    { path: '/', changefreq: 'weekly', priority: 1.0, lastmod: null },
    // /topics changes when topic content changes; tie lastmod to the newest published topic.
    { path: '/topics', changefreq: 'daily', priority: 0.9, lastmod: maxTopicUpdatedAt },
    { path: '/pricing', changefreq: 'monthly', priority: 0.6, lastmod: null },
    { path: '/faq', changefreq: 'monthly', priority: 0.4, lastmod: null },
    { path: '/privacy', changefreq: 'yearly', priority: 0.2, lastmod: null },
    { path: '/terms', changefreq: 'yearly', priority: 0.2, lastmod: null },
    { path: '/cookies', changefreq: 'yearly', priority: 0.2, lastmod: null },
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
      await writeFileEnsuringDir(path.join(outDir, filename), svg);
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

  // Topics catalog: lightweight, crawler/LLM-friendly index of published modules.
  {
    const cleaned = topicRows.map((t) => {
      const title = String(t.title ?? '').replace(/\s+/g, ' ').trim();
      const description = String(t.description ?? '').replace(/\s+/g, ' ').trim();
      const subject = String(t.subject ?? '').replace(/\s+/g, ' ').trim();
      const subcategory = String(t.subcategory ?? '').replace(/\s+/g, ' ').trim();
      const courseId = String(t.course_id ?? '').replace(/\s+/g, ' ').trim();
      const chapterId = String(t.chapter_id ?? '').replace(/\s+/g, ' ').trim();
      const urlPath = `/topic/${encodeURIComponent(String(t.id))}`;
      return {
        id: String(t.id),
        title,
        description,
        subject: subject || null,
        subcategory: subcategory || null,
        course_id: courseId || null,
        chapter_id: chapterId || null,
        is_free: Boolean(t.is_free),
        url: `${base}${urlPath}`,
        path: urlPath,
        updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : null,
      };
    });

    const json = JSON.stringify(
      {
        generatedAt,
        site: base,
        count: cleaned.length,
        topics: cleaned,
      },
      null,
      2,
    );
    await writeFileEnsuringDir(path.join(publicDir, 'topics.json'), `${json}\n`);

    const lines = [];
    lines.push('# 1 Minute Academy topics catalog');
    lines.push(`# Generated: ${generatedAt}`);
    lines.push(`# Site: ${base}`);
    lines.push('# Format: TSV');
    lines.push('id\ttitle\tdescription\turl\tsubject\tsubcategory\tis_free\tupdatedAt\tcourse_id\tchapter_id');
    for (const t of cleaned) {
      const row = [
        t.id,
        t.title || '',
        t.description || '',
        t.url,
        t.subject || '',
        t.subcategory || '',
        t.is_free ? 'free' : 'pro',
        t.updatedAt,
        t.course_id || '',
        t.chapter_id || '',
      ]
        .map((v) => String(v).replace(/\t/g, ' ').replace(/\r?\n/g, ' ').trim())
        .join('\t');
      lines.push(row);
    }
    lines.push('');
    await writeFileEnsuringDir(path.join(publicDir, 'topics.txt'), lines.join('\n'));
  }

  console.log(`✅ SEO assets generated: public/sitemap.xml, public/llms.txt, public/topics.json, public/topics.txt, public/og/* (${topicRows.length} topics)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
