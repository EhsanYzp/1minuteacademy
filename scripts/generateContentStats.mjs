import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..');
const topicsRoot = path.join(repoRoot, 'content', 'topics');
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

async function main() {
  const rootEntries = await fs.readdir(topicsRoot, { withFileTypes: true });
  const categoryDirs = rootEntries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !name.startsWith('.'));

  let topics = 0;
  let nonEmptyCategories = 0;
  const subcategoryKeys = new Set();
  for (const category of categoryDirs) {
    const categoryPath = path.join(topicsRoot, category);
    if (!(await isDirectory(categoryPath))) continue;

    const files = await fs.readdir(categoryPath, { withFileTypes: true });
    const topicFiles = files.filter((f) => f.isFile() && f.name.endsWith('.topic.json'));
    const count = topicFiles.length;
    if (count > 0) nonEmptyCategories += 1;
    topics += count;

    for (const entry of topicFiles) {
      try {
        const raw = await fs.readFile(path.join(categoryPath, entry.name), 'utf8');
        const json = JSON.parse(raw);
        const subject = String(json?.subject ?? category ?? '').trim();
        const subcategory = String(json?.subcategory ?? '').trim();
        if (!subcategory) continue;
        subcategoryKeys.add(`${subject}::${subcategory}`);
      } catch {
        // Ignore malformed content; validateContent.mjs will catch it.
      }
    }
  }

  const payload = {
    categories: categoryDirs.length,
    categoriesWithTopics: nonEmptyCategories,
    subcategories: subcategoryKeys.size,
    topics,
    generatedAt: new Date().toISOString(),
  };

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`Generated ${path.relative(repoRoot, outFile)} (categories=${payload.categories}, topics=${payload.topics})\n`);
}

main().catch((err) => {
  console.error('Failed to generate content stats:', err);
  process.exitCode = 1;
});
