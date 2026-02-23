import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { TOPICS_DIR } from './_contentPaths.mjs';
import { compileJourneyFromTopic } from '../src/engine/journey/compileJourney.js';

function parseEnvNameFromArgv(argv) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--env') {
      const v = argv[i + 1];
      if (!v || v.startsWith('--')) return null;
      return String(v).trim();
    }
  }
  return null;
}

function normalizeEnvName(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v) return null;
  if (v === 'prod') return 'production';
  return v;
}

function loadDotenv(envName) {
  const loaded = [];
  const load = (p) => {
    const res = dotenv.config({ path: p });
    if (!res.error) loaded.push(p);
  };

  load('.env');
  load('.env.local');
  if (envName) {
    load(`.env.${envName}`);
    load(`.env.${envName}.local`);
  }

  const envLabel = envName ? `--env ${envName}` : '(no --env)';
  console.log(`[content:scaffold] dotenv loaded (${envLabel}): ${loaded.length ? loaded.join(', ') : '(none found)'}`);
}

function requiredEnvAny(names) {
  for (const name of names) {
    const v = process.env[name];
    if (v) return v;
  }
  const requestedEnv = normalizeEnvName(parseEnvNameFromArgv(process.argv.slice(2))) ?? 'staging';
  const envFileHint = requestedEnv ? `.env.${requestedEnv}.local` : '.env.local';
  throw new Error(`Missing env var: ${names.join(' or ')} (set it in ${envFileHint} or export it in your shell)`);
}

function slugifyCategoryId(title) {
  return String(title ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
}

function parseArgs(argv) {
  const args = {
    id: null,
    title: null,
    description: '',
    is_free: false,
    emoji: '🎯',
    color: null,
    published: true,
    seed: null,
    dryRun: false,
    force: false,

    subject: null,
    subcategory: null,

    categoryId: null,
    categoryTitle: null,
    categoryDescription: null,
    categoryEmoji: null,
    categoryColor: null,

    courseId: null,
    courseTitle: null,
    courseDescription: null,
    courseEmoji: null,
    courseColor: null,

    chapterId: null,
    chapterTitle: null,
    chapterDescription: null,
    chapterPosition: null,

    noCatalogUpdate: false,

    env: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];

    if (a === '--id') args.id = argv[++i];
    else if (a === '--title') args.title = argv[++i];
    else if (a === '--description') args.description = argv[++i] ?? '';
    else if (a === '--is-free') args.is_free = true;
    else if (a === '--emoji') args.emoji = argv[++i];
    else if (a === '--color') args.color = argv[++i];
    else if (a === '--unpublished') args.published = false;
    else if (a === '--seed') args.seed = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;

    else if (a === '--subject') args.subject = argv[++i];
    else if (a === '--subcategory') args.subcategory = argv[++i];

    else if (a === '--categoryId') args.categoryId = argv[++i];
    else if (a === '--categoryTitle') args.categoryTitle = argv[++i];
    else if (a === '--categoryDescription') args.categoryDescription = argv[++i];
    else if (a === '--categoryEmoji') args.categoryEmoji = argv[++i];
    else if (a === '--categoryColor') args.categoryColor = argv[++i];

    else if (a === '--courseId') args.courseId = argv[++i];
    else if (a === '--courseTitle') args.courseTitle = argv[++i];
    else if (a === '--courseDescription') args.courseDescription = argv[++i];
    else if (a === '--courseEmoji') args.courseEmoji = argv[++i];
    else if (a === '--courseColor') args.courseColor = argv[++i];

    else if (a === '--chapterId') args.chapterId = argv[++i];
    else if (a === '--chapterTitle') args.chapterTitle = argv[++i];
    else if (a === '--chapterDescription') args.chapterDescription = argv[++i];
    else if (a === '--chapterPosition') args.chapterPosition = argv[++i];

    else if (a === '--no-catalog-update') args.noCatalogUpdate = true;
    else if (a === '--env') args.env = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log(`\nUsage:\n  npm run content:scaffold -- --id <topicId> --title <Title> [options]\n\nOptions:\n  Topic:\n  --description <text>\n  --is-free\n  --emoji <emoji>\n  --color <#RRGGBB>\n  --unpublished\n  --seed <any>\n  --dry-run\n  --force   (overwrite if file exists)\n\n  Classification (optional):\n  --subject <Subject>\n  --subcategory <text>\n\n  Hierarchy (recommended):\n  --courseId <courseId>\n  --chapterId <chapterId>\n\n  Folder (only used when NOT using --courseId):\n  --categoryId <categoryId>   (defaults to slugified --subject)\n\n  Environment:\n  --env staging|production    (defaults to staging)\n\nNotes:\n- If you pass --courseId and --chapterId, the script resolves category via Supabase and writes:\n  content/topics/<categoryId>/<courseId>/<chapterId>/<topicId>.topic.json\n- Local catalog mode is retired.\n`);
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }

  if (!args.id) throw new Error('Missing --id');
  if (!args.title) throw new Error('Missing --title');
  if (args.courseId && !args.chapterId) {
    throw new Error('Missing --chapterId (required when using --courseId)');
  }

  if (!args.subject && !args.courseId) {
    throw new Error('Missing --subject (or provide --courseId to infer subject from Supabase)');
  }

  return args;
}

function seedToInt(s) {
  const str = String(s ?? '');
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

function pickPaletteColor(subject, rand) {
  const palette = {
    'AI & Agents': ['#FFB703', '#FB8500', '#8ECAE6'],
    'Programming Fundamentals': ['#FF6B6B', '#4D96FF', '#6BCB77'],
    'Blockchain & Web3': ['#4ECDC4', '#00BFA6', '#2EC4B6'],
    'Quantum & Physics': ['#A06CD5', '#5E60CE', '#64DFDF'],
    Cybersecurity: ['#EF476F', '#118AB2', '#06D6A0'],
  };
  const list = palette[subject] ?? ['#4ECDC4', '#FFB703', '#A06CD5', '#FF6B6B'];
  return pickOne(list, rand);
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function assertSafePathSegment(v, label) {
  const s = String(v ?? '').trim();
  if (!s) throw new Error(`Missing ${label}`);
  if (s.includes('/') || s.includes('\\') || s.includes('..')) throw new Error(`Invalid ${label}: '${s}'`);
  return s;
}

function titleFromId(id) {
  const s = String(id ?? '').trim();
  if (!s) return '';
  return s
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function resolveHierarchyFromSupabase({ supabase, courseId, chapterId }) {
  const { data: course, error: courseErr } = await supabase
    .from('courses')
    .select('id, title, category_id')
    .eq('id', courseId)
    .maybeSingle();
  if (courseErr) throw courseErr;
  if (!course) throw new Error(`Course not found in Supabase: ${courseId}`);

  const categoryId = String(course?.category_id ?? '').trim();
  if (!categoryId) throw new Error(`Course is missing category_id: ${courseId}`);

  const { data: category, error: catErr } = await supabase
    .from('categories')
    .select('id, title')
    .eq('id', categoryId)
    .maybeSingle();
  if (catErr) throw catErr;

  if (chapterId) {
    const { data: chapter, error: chErr } = await supabase
      .from('chapters')
      .select('id, course_id, title')
      .eq('id', chapterId)
      .maybeSingle();
    if (chErr) throw chErr;
    if (!chapter) throw new Error(`Chapter not found in Supabase: ${chapterId}`);
    if (String(chapter?.course_id ?? '') !== courseId) {
      throw new Error(`Chapter ${chapterId} does not belong to course ${courseId}`);
    }
  }

  return {
    categoryId,
    categoryTitle: String(category?.title ?? '').trim() || categoryId,
    courseTitle: String(course?.title ?? '').trim() || courseId,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const requestedEnv = normalizeEnvName(args.env ?? parseEnvNameFromArgv(process.argv.slice(2))) ?? 'staging';
  loadDotenv(requestedEnv);

  const topicId = assertSafePathSegment(args.id, '--id');
  const courseId = args.courseId ? assertSafePathSegment(args.courseId, '--courseId') : null;
  const chapterId = args.chapterId ? assertSafePathSegment(args.chapterId, '--chapterId') : null;

  let inferred = null;

  if (courseId) {
    const supabaseUrl = requiredEnvAny(['SUPABASE_URL', 'VITE_SUPABASE_URL']);
    const anonKey = requiredEnvAny(['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY']);
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    inferred = await resolveHierarchyFromSupabase({ supabase, courseId, chapterId });

    if (!args.subject) args.subject = inferred.categoryTitle;
    if (!args.subcategory) args.subcategory = inferred.courseTitle;
  }

  if (!args.subcategory) args.subcategory = 'Core Concepts';

  const seed = seedToInt(args.seed ?? topicId);
  const rand = mulberry32(seed);
  const color = args.color ?? pickPaletteColor(args.subject, rand);

  const topic = {
    id: topicId,
     version: 1,
    subject: args.subject,
    subcategory: args.subcategory,
    ...(courseId ? { courseId } : {}),
    ...(chapterId ? { chapterId } : {}),
    title: args.title,
    emoji: args.emoji,
    color,
    description: args.description || 'Learn this concept in 1 minute.',
    is_free: Boolean(args.is_free),
    published: Boolean(args.published),
    story: {
      hook: {
        text: '🪝 Hook: Start with a surprising fact or question that grabs attention.',
        visual: args.emoji,
      },
      buildup: {
        text: '🔧 Buildup: Add context or tension to the hook.',
        visual: '⚙️',
      },
      discovery: {
        text: '💡 Discovery: Reveal the core concept or "aha" moment.',
        visual: '🔍',
      },
      twist: {
        text: '🔄 Twist: Show a real-world application or surprising detail.',
        visual: '🎯',
      },
      climax: {
        text: '🚀 Climax: Deepen understanding with a key insight or connection.',
        visual: '⚡',
      },
      punchline: {
        text: '🎤 Punchline: End with a memorable takeaway or call to action.',
        visual: '✨',
      },
    },
    quiz: {
      question: 'What did you just learn?',
      options: ['Option A (wrong)', 'Option B (correct)', 'Option C (wrong)'],
      correct: 1,
    },
  };

  topic.journey = compileJourneyFromTopic(topic);

  const categoryDir = courseId
    ? assertSafePathSegment(inferred?.categoryId, 'categoryId (from Supabase)')
    : assertSafePathSegment(args.categoryId ?? slugifyCategoryId(args.subject), '--categoryId or --subject');

  const outDir = courseId
    ? path.join(
        TOPICS_DIR,
        categoryDir,
        courseId,
        chapterId
      )
    : path.join(TOPICS_DIR, categoryDir);

  const outPath = path.join(outDir, `${topicId}.topic.json`);

  if (args.dryRun) {
    console.log(JSON.stringify(topic, null, 2));
    console.error(`\n(dry-run) Would write: ${path.relative(process.cwd(), outPath)}`);
    return;
  }

  await fs.mkdir(outDir, { recursive: true });

  if (!args.force && (await pathExists(outPath))) {
    throw new Error(`Refusing to overwrite existing file: ${path.relative(process.cwd(), outPath)} (use --force)`);
  }

  await fs.writeFile(outPath, JSON.stringify(topic, null, 2) + '\n', 'utf8');
  console.log(`✅ Scaffolded story-based topic: ${path.relative(process.cwd(), outPath)}`);
  console.log(`\nNext steps:`);
  console.log(`1. Edit story.hook, story.buildup, story.discovery, story.twist, story.climax, story.punchline`);
  console.log(`2. Edit quiz question and options`);
  console.log(`3. Test with: npm run dev`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
