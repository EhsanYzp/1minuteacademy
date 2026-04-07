#!/usr/bin/env node
/**
 * _patchDetails.mjs
 *
 * Patches existing .topic.json files with details from _details_*.json files.
 *
 * Usage:
 *   node scripts/_patchDetails.mjs <category>            # dry-run (default)
 *   node scripts/_patchDetails.mjs <category> --write     # apply changes
 *
 * Example:
 *   node scripts/_patchDetails.mjs accounting --write
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TOPICS_DIR = path.join(ROOT, 'content', 'topics');

const args = process.argv.slice(2);
const category = args.find(a => !a.startsWith('--'));
const write = args.includes('--write');

if (!category) {
  console.error('Usage: node scripts/_patchDetails.mjs <category> [--write]');
  process.exit(1);
}

const categoryDir = path.join(TOPICS_DIR, category);
if (!fs.existsSync(categoryDir)) {
  console.error(`Category directory not found: ${categoryDir}`);
  process.exit(1);
}

// 1. Load all _details_*.json files for this category
const detailFiles = fs.readdirSync(categoryDir).filter(f => f.startsWith('_details_') && f.endsWith('.json'));
if (detailFiles.length === 0) {
  console.error(`No _details_*.json files found in ${categoryDir}`);
  process.exit(1);
}

const allDetails = {};
for (const file of detailFiles) {
  const filePath = path.join(categoryDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  for (const [topicId, details] of Object.entries(data)) {
    if (allDetails[topicId]) {
      console.error(`Duplicate topic ID "${topicId}" in ${file} — already defined in another details file.`);
      process.exit(1);
    }
    allDetails[topicId] = details;
  }
}

console.log(`Loaded ${Object.keys(allDetails).length} topic details from ${detailFiles.length} files.\n`);

// 2. Find all .topic.json files in the category tree
function findTopicFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTopicFiles(full));
    } else if (entry.name.endsWith('.topic.json')) {
      results.push(full);
    }
  }
  return results;
}

const topicFiles = findTopicFiles(categoryDir);
console.log(`Found ${topicFiles.length} .topic.json files.\n`);

// 3. Patch each topic file
let patched = 0;
let skipped = 0;
let alreadyHas = 0;
const missing = [];

for (const filePath of topicFiles) {
  const topic = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const topicId = topic.id;

  if (!topicId) {
    console.warn(`  WARN: No id field in ${path.relative(ROOT, filePath)}`);
    skipped++;
    continue;
  }

  const details = allDetails[topicId];
  if (!details) {
    missing.push(topicId);
    skipped++;
    continue;
  }

  if (topic.details && !args.includes('--force')) {
    alreadyHas++;
    continue;
  }

  // Add details as the last key
  topic.details = details;

  if (write) {
    fs.writeFileSync(filePath, JSON.stringify(topic, null, 2) + '\n', 'utf-8');
  }
  patched++;
  if (patched <= 5 || !write) {
    const rel = path.relative(ROOT, filePath);
    console.log(`${write ? '  PATCHED' : '  (dry-run)'} ${rel}`);
  }
}

if (patched > 5 && write) {
  console.log(`  ... and ${patched - 5} more.`);
}

console.log(`\nSummary:`);
console.log(`  Patched:     ${patched}`);
console.log(`  Already had: ${alreadyHas}`);
console.log(`  Skipped:     ${skipped}`);
if (missing.length > 0) {
  console.log(`\n  Missing details for ${missing.length} topics:`);
  for (const id of missing.slice(0, 10)) console.log(`    - ${id}`);
  if (missing.length > 10) console.log(`    ... and ${missing.length - 10} more.`);
}
if (!write) {
  console.log(`\nDry run — no files changed. Use --write to apply.`);
}
