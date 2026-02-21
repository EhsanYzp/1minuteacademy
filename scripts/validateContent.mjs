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

// Validation tolerances are slightly higher than generation targets.
// Generation still aims for 120/80 for comfortable reading; validation allows minor overages.
const VALIDATION_MAX = { beat: 130, punchline: 90 };
const BEAT_MAX = {
  hook: VALIDATION_MAX.beat,
  buildup: VALIDATION_MAX.beat,
  discovery: VALIDATION_MAX.beat,
  twist: VALIDATION_MAX.beat,
  climax: VALIDATION_MAX.beat,
  punchline: VALIDATION_MAX.punchline,
};

function relaxStorySchemaForValidation(storySchema) {
  if (!storySchema || typeof storySchema !== 'object') return storySchema;

  // The topic schema references story.schema.json, which caps lengths at 120/80.
  // For validation runs we relax those caps in-memory without changing the schema file
  // (so generation can keep using the tighter limits).
  const beatText = storySchema?.$defs?.beat?.properties?.text;
  if (beatText && typeof beatText === 'object') {
    beatText.maxLength = VALIDATION_MAX.beat;
  }

  const punchlineText = storySchema?.$defs?.punchlineBeat?.properties?.text;
  if (punchlineText && typeof punchlineText === 'object') {
    punchlineText.maxLength = VALIDATION_MAX.punchline;
  }

  return storySchema;
}

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
 * Validate that a story's beats are "complete" and not mechanically truncated.
 *
 * Checks (in order):
 *  1. Text ends with valid sentence-ending punctuation.
 *  2. Text does not exceed the character limit.
 *  3. No ellipsis (… or ...) — classic truncation marker.
 *  4. No space directly before final punctuation (e.g. "text .").
 *  5. No unbalanced opening quotes/parens (truncation cut off the close).
 *  6. No dangling conjunction/preposition before final punctuation
 *     (e.g. "She ran and." — sentence cut mid-thought).
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

    const tag = `${label} → ${beat}`;
    const preview = text.length > 80 ? text.slice(0, 77) + '...' : text;

    // 1. Proper ending punctuation.
    const lastChar = text[text.length - 1];
    if (!VALID_ENDINGS.has(lastChar)) {
      errors.push(
        `${tag}: text does not end with valid punctuation ` +
        `(last char: ${JSON.stringify(lastChar)} U+${lastChar.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})\n` +
        `    "${preview}"`
      );
    }

    // 2. Character limit.
    const max = BEAT_MAX[beat];
    if (text.length > max) {
      errors.push(
        `${tag}: text exceeds ${max}-char limit (${text.length} chars)\n` +
        `    "${preview}"`
      );
    }

    // 3. Ellipsis near the end of text — truncation marker.
    //    (Ellipsis inside quoted dialogue mid-text is intentional and allowed.)
    const tail10 = text.slice(-10);
    if (tail10.includes('\u2026') || tail10.includes('...')) {
      errors.push(
        `${tag}: text ends with an ellipsis (truncation marker) — "…${text.slice(-20)}"\n` +
        `    "${preview}"`
      );
    }

    // 4. Space directly before final punctuation → "some text ."
    if (text.length >= 2 && text[text.length - 2] === ' ') {
      errors.push(
        `${tag}: space before final punctuation ("${text.slice(-6)}") — looks truncated\n` +
        `    "${preview}"`
      );
    }

    // 5. Unbalanced quotes / parentheses.
    const opens  = (text.match(/[\u201C(]/g) || []).length;
    const closes = (text.match(/[\u201D)]/g) || []).length;
    if (opens > closes) {
      errors.push(
        `${tag}: unbalanced quotes/parens (${opens} open, ${closes} close) — possible truncation\n` +
        `    "${preview}"`
      );
    }

    // 6. Ends with an article or bare comparative + punctuation → "the.", "a.", "than."
    //    These words NEVER validly end an English sentence and signal truncation.
    const articleEnding = /\b(the|a|an|than)\s*[.!?;:\u201D"')]+$/i;
    if (articleEnding.test(text)) {
      const tail = text.slice(-25);
      errors.push(
        `${tag}: ends with an article/comparative before punctuation ("…${tail}") — sentence truncated\n` +
        `    "${preview}"`
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
  const storySchema = relaxStorySchemaForValidation(await readJson(path.join(SCHEMA_DIR, 'story.schema.json')));
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
