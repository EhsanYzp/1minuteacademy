import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..');
const topicsRoot = path.join(repoRoot, 'content', 'topics');
const catalogFile = path.join(repoRoot, 'content', 'catalog', 'catalog.json');
const outDir = path.join(repoRoot, 'src', 'generated');
const outFile = path.join(outDir, 'contentStats.json');

async function isDirectory(p) {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

function slugifyCategoryId(title) {
  return String(title ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function listTopicFilesRecursive(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await listTopicFilesRecursive(p)));
    } else if (e.isFile() && e.name.endsWith('.topic.json')) {
      out.push(p);
    }
  }
  return out;
}

async function writeTextIfChanged(filePath, content) {
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

async function main() {
  const catalog = await readJson(catalogFile);
  const publishedCategories = (Array.isArray(catalog?.categories) ? catalog.categories : []).filter((c) => c?.published !== false);
  const catalogCategoryIds = new Set(publishedCategories.map((c) => String(c?.id ?? '').trim()).filter(Boolean));

  let latestInputMtimeMs = 0;
  try {
    const stat = await fs.stat(catalogFile);
    latestInputMtimeMs = Math.max(latestInputMtimeMs, stat.mtimeMs);
  } catch {
    // ignore
  }

  const topicFiles = (await isDirectory(topicsRoot)) ? await listTopicFilesRecursive(topicsRoot) : [];

  let topics = 0;
  const categoriesWithTopics = new Set();
  const subcategoryKeys = new Set();
  for (const filePath of topicFiles) {
    try {
      const stat = await fs.stat(filePath);
      const raw = await fs.readFile(filePath, 'utf8');
      const json = JSON.parse(raw);
      if (json?.published !== true) continue;

      latestInputMtimeMs = Math.max(latestInputMtimeMs, stat.mtimeMs);

      topics += 1;

      const rel = path.relative(topicsRoot, filePath);
      const [topDir] = rel.split(path.sep);
      const categoryId = slugifyCategoryId(topDir);
      if (catalogCategoryIds.has(categoryId)) categoriesWithTopics.add(categoryId);

      const subject = String(json?.subject ?? '').trim();
      const subcategory = String(json?.subcategory ?? '').trim();
      if (subject && subcategory) subcategoryKeys.add(`${subject}::${subcategory}`);
    } catch {
      // Ignore malformed content; validateContent.mjs will catch it.
    }
  }

  const payload = {
    categories: publishedCategories.length,
    categoriesWithTopics: categoriesWithTopics.size,
    subcategories: subcategoryKeys.size,
    topics,
    generatedAt: new Date(Math.max(0, latestInputMtimeMs)).toISOString(),
  };

  await fs.mkdir(outDir, { recursive: true });
  const wrote = await writeTextIfChanged(outFile, `${JSON.stringify(payload, null, 2)}\n`);
  process.stdout.write(`Generated ${path.relative(repoRoot, outFile)} (categories=${payload.categories}, topics=${payload.topics})\n`);
  if (!wrote) process.stdout.write('(no changes)\n');
}

main().catch((err) => {
  console.error('Failed to generate content stats:', err);
  process.exitCode = 1;
});
