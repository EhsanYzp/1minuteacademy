import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { SCHEMA_DIR, TOPICS_DIR } from './_contentPaths.mjs';
import { compileJourneyFromTopic } from '../src/engine/journey/compileJourney.js';

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function listTopicFiles(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listTopicFiles(full)));
    else if (entry.isFile() && entry.name.endsWith('.topic.json')) out.push(full);
  }
  return out;
}

function flattenActions(blocks) {
  const out = [];
  for (const b of Array.isArray(blocks) ? blocks : []) {
    if (b?.type === 'cta') out.push(b.action);
    if (b?.type === 'ctaRow') {
      for (const it of Array.isArray(b.items) ? b.items : []) out.push(it?.action);
    }
  }
  return out.filter(Boolean);
}

async function main() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const blockSchema = await readJson(path.join(SCHEMA_DIR, 'block.schema.json'));
  const journeySchema = await readJson(path.join(SCHEMA_DIR, 'journey.schema.json'));
  ajv.addSchema(blockSchema, 'block.schema.json');
  const validateJourney = ajv.compile(journeySchema);

  const files = await listTopicFiles(TOPICS_DIR);
  if (files.length === 0) {
    console.log('No .topic.json files found under content/topics/.');
    process.exit(0);
  }

  let failed = 0;

  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    const topic = await readJson(file);
    if (!topic?.published) continue;

    const journey = compileJourneyFromTopic(topic);
    const ok = validateJourney(journey);
    if (!ok) {
      failed += 1;
      console.error(`\n❌ ${rel}: journey schema validation failed`);
      for (const err of validateJourney.errors ?? []) {
        console.error(`  - ${err.instancePath || '(root)'} ${err.message}`);
      }
      continue;
    }

    const topicStartActions = flattenActions(journey?.topicStart?.blocks);
    const hasStart = topicStartActions.some((a) => a?.type === 'startLesson');
    if (!hasStart) {
      failed += 1;
      console.error(`\n❌ ${rel}: journey.topicStart missing a startLesson CTA`);
    }

    const completionActions = flattenActions(journey?.completion?.blocks);
    const hasTryAgain = completionActions.some((a) => a?.type === 'tryAgain');
    if (!hasTryAgain) {
      failed += 1;
      console.error(`\n❌ ${rel}: journey.completion missing a tryAgain CTA`);
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} file(s) failed journey parity checks.`);
    process.exit(1);
  }

  console.log(`✅ Journey parity OK for published topics.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
