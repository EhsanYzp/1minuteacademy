import fs from 'node:fs/promises';
import path from 'node:path';
import { TOPICS_DIR } from './_contentPaths.mjs';
import { compileJourneyFromTopic } from '../src/engine/journey/compileJourney.js';

function parseArgs(argv) {
  const args = {
    topicIds: null,
    publishedOnly: true,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--all') args.publishedOnly = false;
    else if (a === '--topic') {
      const v = argv[i + 1];
      if (!v || v.startsWith('--')) throw new Error('Missing value for --topic <id[,id2,...]>.');
      i += 1;
      args.topicIds = v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (args.topicIds.length === 0) throw new Error('Empty --topic list.');
    } else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/regenerateJourneys.mjs [options]\n\nOptions:\n  --topic <id[,id2,...]>   Only regenerate for these topic ids\n  --all                    Include unpublished topics (default: published only)\n  --dry-run                 Print what would change without writing\n`);
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }

  return args;
}

async function listTopicFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listTopicFiles(full)));
    else if (e.isFile() && e.name.endsWith('.topic.json')) out.push(full);
  }
  return out;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}

function computeJourney(topic) {
  // Force compilation of the deterministic default, even if a topic already has authored journey.
  const cloned = { ...topic };
  delete cloned.journey;
  return compileJourneyFromTopic(cloned);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const files = await listTopicFiles(TOPICS_DIR);
  if (files.length === 0) {
    console.log('No .topic.json files found under content/topics/.');
    process.exit(0);
  }

  const targets = [];
  for (const file of files) {
    const topic = await readJson(file);

    if (args.publishedOnly && !topic?.published) continue;
    if (args.topicIds && !args.topicIds.includes(String(topic?.id))) continue;

    targets.push({ file, topic });
  }

  if (targets.length === 0) {
    console.log('No topics matched.');
    process.exit(0);
  }

  console.log(`Regenerating journey for ${targets.length} topic(s)...`);

  let changed = 0;

  for (const { file, topic } of targets) {
    const rel = path.relative(process.cwd(), file);

    const nextJourney = computeJourney(topic);
    const next = { ...topic, journey: nextJourney };

    const before = stableStringify(topic);
    const after = stableStringify(next);

    if (before === after) {
      console.log(`- ${topic.id}: no change (${rel})`);
      continue;
    }

    changed += 1;

    if (args.dryRun) {
      console.log(`- ${topic.id}: would update (${rel})`);
      continue;
    }

    await fs.writeFile(file, after, 'utf8');
    console.log(`- ${topic.id}: updated (${rel})`);
  }

  if (args.dryRun) {
    console.log(`\nDry run complete. ${changed} topic(s) would change.`);
  } else {
    console.log(`\nDone. Updated ${changed} topic(s).`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
