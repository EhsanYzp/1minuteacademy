import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { SCHEMA_DIR, TOPICS_DIR, COURSE_PLANS_DIR } from './_contentPaths.mjs';

/* ── Beat-completeness constants ────────────────────────────────── */

const BEAT_NAMES = ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline'];

// Every beat must end with one of these characters.
// Includes straight quotes, curly/smart quotes, and standard punctuation.
const VALID_ENDINGS = new Set([
  '.', '!', '?', ')', "'", '"', ':', ';',
  '\u2019', // ' right single curly quote
  '\u201D', // " right double curly quote
]);

const BEAT_MAX = { hook: 120, buildup: 120, discovery: 120, twist: 120, climax: 120, punchline: 80 };

/* ── Helpers ─────────────────────────────────────────────────────── */

async function listFiles(dir, predicate) {
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
      out.push(...(await listFiles(full, predicate)));
    } else if (entry.isFile() && predicate(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const listTopicFiles = (dir) => listFiles(dir, (n) => n.endsWith('.topic.json'));
const listCoursePlanFiles = (dir) => listFiles(dir, (n) => n.endsWith('.json'));

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Validate that a story's beats are "complete":
 *  1. Text ends with valid sentence-ending punctuation.
 *  2. Text does not exceed the character limit.
 *
 * @param {object} story - { hook, buildup, discovery, twist, climax, punchline }
 * @param {string} label - human-readable label for error messages
 * @returns {string[]} array of error messages (empty = all good)
 */
function validateBeats(story, label) {
  const errors = [];
  if (!story || typeof story !== 'object') return errors;

  for (const beat of BEAT_NAMES) {
    const node = story[beat];
    if (!node || typeof node.text !== 'string') continue;

    const text = node.text.trim();
    if (text.length === 0) continue;

    // 1. Proper ending
    const lastChar = text[text.length - 1];
    if (!VALID_ENDINGS.has(lastChar)) {
      errors.push(
        `${label} → ${beat}: text does not end with valid punctuation ` +
        `(last char: ${JSON.stringify(lastChar)} U+${lastChar.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})\n` +
        `    "${text.length > 80 ? text.slice(0, 77) + '...' : text}"`
      );
    }

    // 2. Character limit
    const max = BEAT_MAX[beat];
    if (text.length > max) {
      errors.push(
        `${label} → ${beat}: text exceeds ${max}-char limit (${text.length} chars)`
      );
    }
  }
  return errors;
}

/* ── Main ────────────────────────────────────────────────────────── */

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

  let totalFailed = 0;

  /* ─── Phase 1: Course-plan beat validation ─────────────────────── */
  console.log('── Phase 1: Course-plan beat completeness ──');
  const planFiles = await listCoursePlanFiles(COURSE_PLANS_DIR);
  let planTopicsChecked = 0;
  let planBeatErrors = 0;

  for (const file of planFiles) {
    let plan;
    try {
      plan = await readJson(file);
    } catch (e) {
      totalFailed += 1;
      console.error(`\n❌ ${path.relative(process.cwd(), file)}: invalid JSON – ${e.message}`);
      continue;
    }

    const topics = plan.topics ?? [];
    for (const topic of topics) {
      planTopicsChecked += 1;
      const label = `${path.relative(process.cwd(), file)} » "${topic.title ?? '?'}"`;
      const beatErrors = validateBeats(topic.story, label);
      if (beatErrors.length > 0) {
        planBeatErrors += beatErrors.length;
        for (const err of beatErrors) console.error(`  ❌ ${err}`);
      }
    }
  }

  if (planBeatErrors > 0) {
    console.error(`\n❌ ${planBeatErrors} beat issue(s) found across ${planFiles.length} course plan(s).`);
    totalFailed += planBeatErrors;
  } else {
    console.log(`✅ ${planTopicsChecked} course-plan topic(s) — all beats complete.`);
  }

  /* ─── Phase 2: Topic JSON schema + beat validation ─────────────── */
  console.log('\n── Phase 2: Topic JSON schema + beat completeness ──');
  const files = await listTopicFiles(TOPICS_DIR);
  let validated = 0;
  let topicBeatErrors = 0;

  for (const file of files) {
    let data;
    try {
      data = await readJson(file);
    } catch (e) {
      totalFailed += 1;
      console.error(`\n❌ ${path.relative(process.cwd(), file)}: invalid JSON`);
      console.error(e);
      continue;
    }

    // Schema validation
    const ok = validateTopic(data);
    if (!ok) {
      totalFailed += 1;
      console.error(`\n❌ ${path.relative(process.cwd(), file)}: schema validation failed`);
      for (const err of validateTopic.errors ?? []) {
        console.error(`  - ${err.instancePath || '(root)'} ${err.message}`);
      }
      continue;
    }

    // Beat completeness validation
    const label = path.relative(process.cwd(), file);
    const beatErrors = validateBeats(data.story, label);
    if (beatErrors.length > 0) {
      topicBeatErrors += beatErrors.length;
      for (const err of beatErrors) console.error(`  ❌ ${err}`);
    }

    validated += 1;
  }

  if (topicBeatErrors > 0) {
    console.error(`\n❌ ${topicBeatErrors} beat issue(s) found across topic JSON files.`);
    totalFailed += topicBeatErrors;
  }

  if (files.length === 0 && validated === 0) {
    console.log('No topic content found under content/topics/.');
    process.exit(0);
  }

  if (totalFailed > 0) {
    console.error(`\n❌ Validation failed with ${totalFailed} issue(s).`);
    process.exit(1);
  }

  console.log(`✅ Validated ${validated} topic JSON(s) + ${planTopicsChecked} course-plan topic(s) — all clear.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
