import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { SCHEMA_DIR, TOPICS_DIR } from './_contentPaths.mjs';

async function listTopicFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
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

async function main() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const blockSchema = await readJson(path.join(SCHEMA_DIR, 'block.schema.json'));
  const journeySchema = await readJson(path.join(SCHEMA_DIR, 'journey.schema.json'));
  const stepSchema = await readJson(path.join(SCHEMA_DIR, 'step.schema.json'));
  const lessonSchema = await readJson(path.join(SCHEMA_DIR, 'lesson.schema.json'));
  const topicSchema = await readJson(path.join(SCHEMA_DIR, 'topic.schema.json'));

  ajv.addSchema(blockSchema, 'block.schema.json');
  ajv.addSchema(journeySchema, 'journey.schema.json');
  ajv.addSchema(stepSchema, 'step.schema.json');
  ajv.addSchema(lessonSchema, 'lesson.schema.json');
  const validateTopic = ajv.compile(topicSchema);

  const files = await listTopicFiles(TOPICS_DIR);
  if (files.length === 0) {
    console.log('No .topic.json files found under content/topics/.');
    process.exit(0);
  }

  let failed = 0;

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
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} file(s) failed validation.`);
    process.exit(1);
  }

  console.log(`✅ Validated ${files.length} topic file(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
