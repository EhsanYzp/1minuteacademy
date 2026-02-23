import fs from 'node:fs/promises';
import path from 'node:path';
import { TOPICS_DIR } from './_contentPaths.mjs';

function slugify(input) {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
}

function fnv1a32(input) {
  const str = String(input ?? '');
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    hash ^= str.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    hash = Math.imul(hash, 0x01000193);
  }
  // eslint-disable-next-line no-bitwise
  return hash >>> 0;
}

function pick(list, seed) {
  if (!Array.isArray(list) || list.length === 0) throw new Error('pick() requires a non-empty list');
  const i = Math.abs(Number(seed)) % list.length;
  return list[i];
}

function formatTemplate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => String(vars?.[key] ?? ''));
}

function requiredString(obj, key) {
  const v = obj?.[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Missing/invalid string: ${key}`);
  return v.trim();
}

function requiredInt(obj, key) {
  const v = obj?.[key];
  if (!Number.isInteger(v)) throw new Error(`Missing/invalid int: ${key}`);
  return v;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

async function writeFileEnsuringDir(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const next = String(content ?? '');
  try {
    const prev = await fs.readFile(filePath, 'utf8');
    if (prev === next) return false;
  } catch {
    // ignore
  }
  await fs.writeFile(filePath, next, 'utf8');
  return true;
}

function parseArgs(argv) {
  const args = {
    plan: null,
    dryRun: false,
    write: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--plan') {
      const v = argv[i + 1];
      if (!v || v.startsWith('--')) throw new Error('Missing value for --plan');
      args.plan = v;
      i += 1;
    } else if (a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '--no-write') {
      args.write = false;
    } else if (a === '--help' || a === '-h') {
      console.log(`\nUsage:\n  node scripts/generateCourseTopicJsons.mjs --plan content/course-plans/<course>.json [--dry-run] [--no-write]\n\nNotes:\n  - Authored-only: every topic must provide a full story (all 6 beats).\n`);
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }

  if (!args.plan) throw new Error('Missing required arg: --plan <path-to-json>');
  if (args.dryRun) args.write = false;
  return args;
}

function normalizeIsFree(v) {
  if (typeof v === 'boolean') return v;
  // Legacy: treat Beginner as free during migration.
  if (typeof v === 'string' && String(v).toLowerCase() === 'beginner') return true;
  return false;
}

import { GENERATION_LIMITS, VALIDATION_TOLERANCE } from './_beatLimits.mjs';

// Generation guidelines (soft) vs validation tolerance (hard).
// - We *aim* for GENERATION_LIMITS for best readability.
// - We *allow* up to VALIDATION_TOLERANCE so generation can proceed;
//   anything above tolerance is a hard error.
const BEAT_TEXT_GUIDE = GENERATION_LIMITS.beat;
const PUNCHLINE_TEXT_GUIDE = GENERATION_LIMITS.punchline;
const BEAT_TEXT_HARD_MAX = VALIDATION_TOLERANCE.beat;
const PUNCHLINE_TEXT_HARD_MAX = VALIDATION_TOLERANCE.punchline;

// Every beat must end with one of these characters.
const VALID_BEAT_ENDINGS = new Set([
  '.', '!', '?', ')', "'", '"', ':', ';',
  '\u2019', // ' right single curly quote
  '\u201D', // " right double curly quote
]);

/**
 * Detect signs that a beat was mechanically truncated rather than
 * properly rewritten. Any match is a hard error.
 */
function detectTruncationArtifacts(text, beat, label) {
  const errors = [];

  // 1. Ellipsis near the end — classic truncation marker.
  //    (Ellipsis inside quoted dialogue mid-text is intentional and allowed.)
  const tail10 = text.slice(-10);
  if (tail10.includes('\u2026') || tail10.includes('...')) {
    errors.push(`story.${beat}.text ends with an ellipsis (truncation marker)${label}`);
  }

  // 2. Space directly before final punctuation → "some text ." — sloppy cut.
  if (text.length >= 2 && text[text.length - 2] === ' ') {
    errors.push(
      `story.${beat}.text has a space before its final punctuation ("${text.slice(-6)}")${label} — ` +
      `looks like a truncation artifact`
    );
  }

  // 3. Unbalanced quotes — opening " or ( without its closing pair.
  const opens  = (text.match(/[\u201C(]/g) || []).length;
  const closes = (text.match(/[\u201D)]/g) || []).length;
  if (opens > closes) {
    errors.push(
      `story.${beat}.text has unbalanced quotes/parens (${opens} open, ${closes} close)${label} — ` +
      `possible truncation`
    );
  }

  // 4. Ends with article/comparative + punctuation → "the.", "a.", "than." — always truncated.
  const articleEnding = /\b(the|a|an|than)\s*[.!?;:\u201D"')]+$/i;
  if (articleEnding.test(text)) {
    const tail = text.slice(-25);
    errors.push(
      `story.${beat}.text ends with an article/comparative ("…${tail}")${label} — ` +
      `sentence is truncated`
    );
  }

  return errors;
}

function validateStoryShape(story, ctxLabel) {
  const label = ctxLabel ? ` (${ctxLabel})` : '';
  if (!story || typeof story !== 'object') throw new Error(`Invalid story object${label}`);
  const beats = ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline'];
  for (const beat of beats) {
    const node = story[beat];
    if (!node || typeof node !== 'object') throw new Error(`Missing story.${beat}${label}`);
    if (typeof node.text !== 'string' || !node.text.trim()) throw new Error(`Missing story.${beat}.text${label}`);
    if (typeof node.visual !== 'string' || !node.visual.trim()) throw new Error(`Missing story.${beat}.visual${label}`);

    const text = node.text.trim();
    const guideLen = beat === 'punchline' ? PUNCHLINE_TEXT_GUIDE : BEAT_TEXT_GUIDE;
    const hardMaxLen = beat === 'punchline' ? PUNCHLINE_TEXT_HARD_MAX : BEAT_TEXT_HARD_MAX;

    // Hard length cap (validation tolerance).
    if (text.length > hardMaxLen) {
      throw new Error(
        `story.${beat}.text is ${text.length} chars (max ${hardMaxLen})${label}. ` +
        `REWRITE the beat to be shorter — never truncate.`
      );
    }

    // Soft guideline (generation target): intentionally does not warn.
    // We keep generation quiet for any text within the validation tolerance.

    // Must end with valid punctuation.
    const lastChar = text[text.length - 1];
    if (!VALID_BEAT_ENDINGS.has(lastChar)) {
      throw new Error(
        `story.${beat}.text does not end with valid punctuation ` +
        `(last char: ${JSON.stringify(lastChar)} U+${lastChar.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})${label}`
      );
    }

    // Truncation-artifact detection.
    const artifacts = detectTruncationArtifacts(text, beat, label);
    if (artifacts.length > 0) {
      throw new Error(artifacts.join('\n'));
    }
  }
}

function quizFromPlan({ title, quiz }) {
  const q = String(quiz?.question ?? quiz?.q ?? '').trim() || `What’s the best next step for: ${title}?`;
  const options = Array.isArray(quiz?.options) ? quiz.options.map((o) => String(o ?? '').trim()).filter(Boolean) : [];
  if (options.length < 2) throw new Error(`Invalid quiz options for ${title}`);
  if (options.length > 4) throw new Error(`Too many quiz options for ${title}`);
  const correct = Number(quiz?.correct);
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
    throw new Error(`Invalid quiz.correct for ${title}`);
  }

  // Note: keep schema-safe fields only.
  return { question: q, options, correct };
}

function buildDescription({ topicId, title }) {
  const base = fnv1a32(`${topicId}:desc`);
  const templates = [
    'A 60-second lesson on {title}.',
    'Learn {title} in one minute.',
    'A quick, practical guide to {title}.',
    'One-minute skill: {title}.',
    'A micro-lesson that makes {title} usable.',
    'A fast breakdown of {title} for builders.',
    'A short lesson to help you apply {title}.',
    'A quick win: understand {title}.',
    'A 1-minute de-risking session on {title}.',
    'A tiny lesson with a big payoff: {title}.',
  ];
  return formatTemplate(pick(templates, base), { title });
}

function computeAccessCounts(topics) {
  let free = 0;
  let pro = 0;
  for (const t of topics) {
    if (t?.is_free) free += 1;
    else pro += 1;
  }
  return { free, pro };
}

function buildTopicId({ courseId, title }) {
  const slug = slugify(title);
  if (!slug) throw new Error('Cannot build topic id from empty title');
  return `${courseId}--t-${slug}`;
}

async function loadPlan(planPath) {
  const raw = await fs.readFile(planPath, 'utf8');
  const parsed = JSON.parse(raw);

  const categoryId = requiredString(parsed, 'categoryId');
  const subject = requiredString(parsed, 'subject');
  const courseId = requiredString(parsed, 'courseId');
  const courseTitle = requiredString(parsed, 'courseTitle');
  const color = requiredString(parsed, 'color');
  const emoji = requiredString(parsed, 'emoji');

  const chapters = Array.isArray(parsed.chapters) ? parsed.chapters : null;
  if (!chapters || chapters.length < 5 || chapters.length > 10) {
    throw new Error(`Invalid chapters count: ${chapters?.length ?? 0} (must be 5..10)`);
  }

  const chapterById = new Map();
  for (const ch of chapters) {
    const id = requiredString(ch, 'id');
    requiredString(ch, 'title');
    requiredInt(ch, 'position');
    if (!id.startsWith(`${courseId}--ch`)) {
      throw new Error(`Chapter id must start with "${courseId}--ch": ${id}`);
    }
    if (chapterById.has(id)) throw new Error(`Duplicate chapter id: ${id}`);
    chapterById.set(id, ch);
  }

  const topics = Array.isArray(parsed.topics) ? parsed.topics : null;
  if (!topics || topics.length < 30 || topics.length > 60) {
    throw new Error(`Invalid topic count: ${topics?.length ?? 0} (must be 30..60)`);
  }

  // Authored-only mode is mandatory.
  if (parsed.requireAuthoredStory === false) {
    throw new Error('Invalid plan: requireAuthoredStory=false is not allowed (authored stories are required).');
  }
  const requireAuthoredStory = true;

  return {
    categoryId,
    subject,
    courseId,
    courseTitle,
    color,
    emoji,
    requireAuthoredStory,
    chapters,
    chapterById,
    topics,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const planPath = path.resolve(process.cwd(), args.plan);
  const plan = await loadPlan(planPath);

  const accessCounts = computeAccessCounts(plan.topics);
  console.log(`[content:gen-topics] plan=${path.relative(process.cwd(), planPath)}`);
  console.log(`[content:gen-topics] chapters=${plan.chapters.length} topics=${plan.topics.length}`);
  console.log(`[content:gen-topics] accessCounts: ${JSON.stringify(accessCounts)}`);

  const ids = new Set();

  const writes = [];
  for (const t of plan.topics) {
    const title = requiredString(t, 'title');
    const chapterId = requiredString(t, 'chapter_id');
    if (!plan.chapterById.has(chapterId)) throw new Error(`Topic references unknown chapter_id: ${chapterId}`);

    const topicId = String(t.id ?? '').trim() || buildTopicId({ courseId: plan.courseId, title });
    if (ids.has(topicId)) throw new Error(`Duplicate topic id: ${topicId}`);
    ids.add(topicId);

    const isFree = normalizeIsFree(t.is_free);

    let story;
    if (t.story) {
      validateStoryShape(t.story, topicId);
      story = t.story;
    } else {
      throw new Error(
        [
          `Missing story for topic: ${topicId}`,
          `Authored stories are required. Add a full "story" object (all 6 beats) to the course plan for this topic.`,
        ].join('\n')
      );
    }
    const quiz = quizFromPlan({ title, quiz: t.quiz });

    const json = {
      id: topicId,
      version: 1,
      subject: plan.subject,
      subcategory: plan.courseTitle,
      course_id: plan.courseId,
      chapter_id: chapterId,
      title,
      emoji: plan.emoji,
      color: plan.color,
      description: String(t.description ?? '').trim() || buildDescription({ topicId, title }),
      is_free: isFree,
      published: true,
      story,
      quiz,
    };

    const outDir = path.join(TOPICS_DIR, plan.categoryId, plan.courseId, chapterId);
    const outPath = path.join(outDir, `${topicId}.topic.json`);
    writes.push({ outPath, json });
  }

  if (!args.write) {
    for (const w of writes.slice(0, 10)) console.log(`(dry-run) ${path.relative(process.cwd(), w.outPath)}`);
    if (writes.length > 10) console.log(`(dry-run) …and ${writes.length - 10} more`);
    return;
  }

  let changed = 0;
  for (const w of writes) {
    const content = `${JSON.stringify(w.json, null, 2)}\n`;
    // eslint-disable-next-line no-await-in-loop
    const didWrite = await writeFileEnsuringDir(w.outPath, content);
    if (didWrite) changed += 1;
  }

  console.log(`✅ Generated ${writes.length} topic JSON file(s). Changed: ${changed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
