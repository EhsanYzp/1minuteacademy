#!/usr/bin/env node
/**
 * Patch topic JSON files with `details` objects from a data file.
 *
 * Usage:
 *   node scripts/_patchTopicDetails.mjs --data path/to/details.json [--dry-run]
 *
 * The data file is a JSON object mapping topic IDs to details objects:
 *   { "topic-id": { "summary": "...", "whyItMatters": "...", ... }, ... }
 *
 * The script finds each topic's .topic.json file, adds/replaces the
 * `details` field, and writes it back.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { TOPICS_DIR } from './_contentPaths.mjs';

function parseArgs(argv) {
  const args = { data: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--data') {
      args.data = argv[++i];
    } else if (a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/_patchTopicDetails.mjs --data <details.json> [--dry-run]');
      process.exit(0);
    }
  }
  if (!args.data) throw new Error('Missing --data <path>');
  return args;
}

async function findTopicFiles(dir) {
  const out = [];
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await findTopicFiles(full));
    else if (e.isFile() && e.name.endsWith('.topic.json')) out.push(full);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataPath = path.isAbsolute(args.data) ? args.data : path.join(process.cwd(), args.data);
  const detailsMap = JSON.parse(await fs.readFile(dataPath, 'utf8'));
  const ids = Object.keys(detailsMap);
  console.log(`Loaded ${ids.length} topic detail(s) from ${path.relative(process.cwd(), dataPath)}`);

  const topicFiles = await findTopicFiles(TOPICS_DIR);
  const fileById = new Map();
  for (const f of topicFiles) {
    const data = JSON.parse(await fs.readFile(f, 'utf8'));
    fileById.set(data.id, { path: f, data });
  }

  let patched = 0;
  let skipped = 0;
  const missing = [];

  for (const id of ids) {
    const entry = fileById.get(id);
    if (!entry) { missing.push(id); continue; }

    const details = detailsMap[id];
    entry.data.details = details;

    if (args.dryRun) {
      console.log(`(dry-run) ${id}`);
    } else {
      await fs.writeFile(entry.path, JSON.stringify(entry.data, null, 2) + '\n', 'utf8');
    }
    patched += 1;
  }

  if (missing.length > 0) {
    console.error(`⚠️  ${missing.length} ID(s) not found:`);
    for (const id of missing) console.error(`  - ${id}`);
  }

  console.log(`\n✅ Patched: ${patched}  Skipped: ${skipped}  Missing: ${missing.length}${args.dryRun ? '  (dry-run)' : ''}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
