#!/usr/bin/env node
/**
 * One-time migration: replace "difficulty" → "is_free" in every course-plan JSON.
 *
 * Rule: first topic in each chapter → is_free: true, rest → is_free: false.
 *
 * Usage:
 *   node scripts/_migrateDifficultyToIsFree.mjs            # dry-run (default)
 *   node scripts/_migrateDifficultyToIsFree.mjs --write     # actually write files
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { COURSE_PLANS_DIR } from './_contentPaths.mjs';

async function listJsonFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listJsonFiles(full)));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

async function main() {
  const write = process.argv.includes('--write');
  const files = await listJsonFiles(COURSE_PLANS_DIR);

  console.log(`Found ${files.length} course plan(s). Mode: ${write ? 'WRITE' : 'DRY-RUN'}`);

  let totalChanged = 0;

  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    const raw = await fs.readFile(file, 'utf8');
    let plan;
    try {
      plan = JSON.parse(raw);
    } catch (e) {
      console.error(`  ❌ ${rel}: invalid JSON – ${e.message}`);
      continue;
    }

    const topics = Array.isArray(plan.topics) ? plan.topics : [];
    if (topics.length === 0) {
      console.log(`  ⏭️  ${rel}: no topics, skipping`);
      continue;
    }

    // Track first-topic-per-chapter
    const seenChapters = new Set();
    let changed = false;

    for (const t of topics) {
      const chapterId = String(t.chapter_id ?? '');

      // Determine is_free: first topic per chapter
      const isFirst = !seenChapters.has(chapterId);
      if (isFirst) seenChapters.add(chapterId);

      const isFree = isFirst;

      // Remove old difficulty field if present
      if ('difficulty' in t) {
        delete t.difficulty;
        changed = true;
      }

      // Set is_free (place it after description for consistent ordering)
      if (t.is_free !== isFree) {
        t.is_free = isFree;
        changed = true;
      }
    }

    if (!changed) {
      console.log(`  ✅ ${rel}: already migrated`);
      continue;
    }

    // Re-order keys in topics for cleanliness: put is_free right after description
    plan.topics = topics.map((t) => {
      const ordered = {};
      for (const [k, v] of Object.entries(t)) {
        ordered[k] = v;
        if (k === 'description') {
          ordered.is_free = t.is_free;
        }
      }
      // Ensure is_free is set even if description wasn't present
      if (!('is_free' in ordered)) ordered.is_free = t.is_free;
      return ordered;
    });

    totalChanged += 1;

    if (write) {
      await fs.writeFile(file, JSON.stringify(plan, null, 2) + '\n', 'utf8');
      console.log(`  ✏️  ${rel}: migrated (${seenChapters.size} free / ${topics.length} total)`);
    } else {
      console.log(`  🔍 ${rel}: would migrate (${seenChapters.size} free / ${topics.length} total)`);
    }
  }

  console.log(`\n${write ? 'Wrote' : 'Would write'} ${totalChanged} file(s).`);
  if (!write && totalChanged > 0) {
    console.log('Re-run with --write to apply changes.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
