import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { SCHEMA_DIR, TOPICS_DIR } from './_contentPaths.mjs';

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
    if (entry.isDirectory()) {
      out.push(...(await listTopicFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith('.topic.json')) {
      out.push(full);
    }
  }
  return out;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function listJsonFiles(dir) {
  const out = [];
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listJsonFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

async function main() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const blockSchema = await readJson(path.join(SCHEMA_DIR, 'block.schema.json'));
  const journeySchema = await readJson(path.join(SCHEMA_DIR, 'journey.schema.json'));
  const storySchema = await readJson(path.join(SCHEMA_DIR, 'story.schema.json'));
  const topicSchema = await readJson(path.join(SCHEMA_DIR, 'topic.schema.json'));

  ajv.addSchema(blockSchema, 'block.schema.json');
  ajv.addSchema(journeySchema, 'journey.schema.json');
  ajv.addSchema(storySchema, 'story.schema.json');
  const validateTopic = ajv.compile(topicSchema);

  const files = await listTopicFiles(TOPICS_DIR);

  let failed = 0;
  let validated = 0;

  for (const file of files) {
    let data;
    try {
      data = await readJson(file);
    } catch (e) {
      failed += 1;
      console.error(`\n❌ ${path.relative(process.cwd(), file)}: invalid JSON`);
      console.error(e);
      continue;
    }

    const ok = validateTopic(data);
    if (!ok) {
      failed += 1;
      console.error(`\n❌ ${path.relative(process.cwd(), file)}: schema validation failed`);
      for (const err of validateTopic.errors ?? []) {
        console.error(`  - ${err.instancePath || '(root)'} ${err.message}`);
      }
    } else {
      validated += 1;
    }
  }

  if (files.length === 0 && validated === 0 && failed === 0) {
    console.log('No topic content found under content/topics/.');
    process.exit(0);
  }

  if (failed > 0) {
    console.error(`\n${failed} file(s) failed validation.`);
    process.exit(1);
  }

  console.log(`✅ Validated ${validated} topic item(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
