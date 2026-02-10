import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOPICS_DIR, ROOT } from './_contentPaths.mjs';

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

  console.log(`✅ SEO assets generated: public/sitemap.xml, public/llms.txt (${topicRows.length} topics)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
