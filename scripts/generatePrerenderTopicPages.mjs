import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTopicOgPngPath } from '../src/lib/topicOg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const TEMPLATE_PATH = path.join(DIST_DIR, 'index.html');
const TOPICS_PATH = path.join(ROOT, 'public', 'topics.json');
const DEFAULT_SITE_URL = 'https://www.1minute.academy';
const WRITE_BATCH_SIZE = 200;

function normalizeSiteUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return DEFAULT_SITE_URL;
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function absoluteUrl(siteUrl, pathname) {
  const pathValue = String(pathname ?? '').trim();
  if (!pathValue) return siteUrl;
  if (pathValue.startsWith('http://') || pathValue.startsWith('https://')) return pathValue;
  return `${siteUrl}${pathValue.startsWith('/') ? pathValue : `/${pathValue}`}`;
}

function upsertMeta(html, attr, key, content) {
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(content)}" />`;
  const regex = new RegExp(`<meta[^>]*${attr}=["']${escapeRegex(key)}["'][^>]*>`, 'i');
  if (regex.test(html)) return html.replace(regex, tag);
  return html.replace('</head>', `  ${tag}\n  </head>`);
}

function upsertLink(html, rel, href) {
  const tag = `<link rel="${rel}" href="${escapeHtml(href)}" />`;
  const regex = new RegExp(`<link[^>]*rel=["']${escapeRegex(rel)}["'][^>]*>`, 'i');
  if (regex.test(html)) return html.replace(regex, tag);
  return html.replace('</head>', `  ${tag}\n  </head>`);
}

function upsertTitle(html, title) {
  const tag = `<title>${escapeHtml(title)}</title>`;
  if (/<title>.*?<\/title>/is.test(html)) return html.replace(/<title>.*?<\/title>/is, tag);
  return html.replace('</head>', `  ${tag}\n  </head>`);
}

function upsertJsonLd(html, json) {
  const tag = `<script type="application/ld+json" data-prerendered-topic="true">${JSON.stringify(json)}</script>`;
  const regex = /<script type="application\/ld\+json" data-prerendered-topic="true">.*?<\/script>/is;
  if (regex.test(html)) return html.replace(regex, tag);
  return html.replace('</head>', `  ${tag}\n  </head>`);
}

function deriveCategoryId(topic) {
  const courseId = String(topic?.course_id ?? '').trim();
  if (courseId.includes('--')) return courseId.split('--')[0];
  const id = String(topic?.id ?? '').trim();
  if (id.includes('--')) return id.split('--')[0];
  return '';
}

function buildNestedTopicPath(topic) {
  const categoryId = deriveCategoryId(topic);
  const courseId = String(topic?.course_id ?? '').trim();
  const chapterId = String(topic?.chapter_id ?? '').trim();
  const topicId = String(topic?.id ?? '').trim();
  if (!categoryId || !courseId || !chapterId || !topicId) return null;

  return `/categories/${encodeURIComponent(categoryId)}/courses/${encodeURIComponent(courseId)}/chapters/${encodeURIComponent(chapterId)}/topic/${encodeURIComponent(topicId)}`;
}

function renderTopicHtml(template, topic, routePath, siteUrl) {
  const topicId = String(topic.id ?? '').trim();
  const rawTitle = topic.title ?? topicId ?? 'Topic';
  const title = String(rawTitle).trim() || 'Topic';
  const description = String(topic.description ?? 'Learn this topic in 60 seconds.').trim() || 'Learn this topic in 60 seconds.';
  const fullTitle = `${title} | 1 Minute Academy`;
  const ogImagePath = buildTopicOgPngPath(topicId);
  const ogImage = absoluteUrl(siteUrl, ogImagePath);
  const routeUrl = absoluteUrl(siteUrl, routePath);
  const canonicalUrl = absoluteUrl(siteUrl, `/topic/${encodeURIComponent(topicId)}`);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: title,
    description,
    url: canonicalUrl,
    inLanguage: 'en',
    timeRequired: 'PT1M',
    isAccessibleForFree: Boolean(topic.is_free),
    provider: {
      '@type': 'Organization',
      name: '1 Minute Academy',
      url: absoluteUrl(siteUrl, '/'),
    },
  };

  let html = template;
  html = upsertTitle(html, fullTitle);
  html = upsertMeta(html, 'name', 'description', description);
  html = upsertMeta(html, 'property', 'og:site_name', '1 Minute Academy');
  html = upsertMeta(html, 'property', 'og:type', 'article');
  html = upsertMeta(html, 'property', 'og:url', routeUrl);
  html = upsertMeta(html, 'property', 'og:title', fullTitle);
  html = upsertMeta(html, 'property', 'og:description', description);
  html = upsertMeta(html, 'property', 'og:image', ogImage);
  html = upsertMeta(html, 'property', 'og:image:secure_url', ogImage);
  html = upsertMeta(html, 'property', 'og:image:type', 'image/png');
  html = upsertMeta(html, 'property', 'og:image:width', '1200');
  html = upsertMeta(html, 'property', 'og:image:height', '630');
  html = upsertMeta(html, 'name', 'twitter:card', 'summary_large_image');
  html = upsertMeta(html, 'name', 'twitter:title', fullTitle);
  html = upsertMeta(html, 'name', 'twitter:description', description);
  html = upsertMeta(html, 'name', 'twitter:image', ogImage);
  html = upsertMeta(html, 'name', 'robots', 'index,follow');
  html = upsertLink(html, 'canonical', canonicalUrl);
  html = upsertJsonLd(html, jsonLd);
  return html;
}

async function main() {
  const [template, topicsRaw] = await Promise.all([
    fs.readFile(TEMPLATE_PATH, 'utf8'),
    fs.readFile(TOPICS_PATH, 'utf8'),
  ]);

  const siteUrl = normalizeSiteUrl(process.env.SITE_URL || process.env.VITE_SITE_URL);
  const parsed = JSON.parse(topicsRaw);
  const topics = Array.isArray(parsed?.topics) ? parsed.topics : [];

  const writeJobs = [];
  let generatedCount = 0;

  for (const topic of topics) {
    const topicId = String(topic?.id ?? '').trim();
    const simplePath = String(topic?.path ?? '').trim() || `/topic/${encodeURIComponent(topicId)}`;
    const nestedPath = buildNestedTopicPath(topic);
    const targets = [...new Set([simplePath, nestedPath].filter(Boolean))];

    for (const routePath of targets) {
      const filePath = path.join(DIST_DIR, routePath.replace(/^\//, ''), 'index.html');
      const html = renderTopicHtml(template, topic, routePath, siteUrl);
      writeJobs.push(async () => {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, html, 'utf8');
      });
      generatedCount += 1;
    }
  }

  for (let index = 0; index < writeJobs.length; index += WRITE_BATCH_SIZE) {
    const batch = writeJobs.slice(index, index + WRITE_BATCH_SIZE).map((job) => job());
    await Promise.all(batch);
  }

  console.log(`✅ Prerendered topic share pages: ${generatedCount} HTML files`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
