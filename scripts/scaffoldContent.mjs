import fs from 'node:fs/promises';
import path from 'node:path';
import { CATALOG_DIR, TOPICS_DIR } from './_contentPaths.mjs';
import { compileJourneyFromTopic } from '../src/engine/journey/compileJourney.js';

function parseArgs(argv) {
  const args = {
    id: null,
    title: null,
    description: '',
    difficulty: 'Beginner',
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
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];

    if (a === '--id') args.id = argv[++i];
    else if (a === '--title') args.title = argv[++i];
    else if (a === '--description') args.description = argv[++i] ?? '';
    else if (a === '--difficulty') args.difficulty = argv[++i];
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
    else if (a === '--help' || a === '-h') {
      console.log(`\nUsage:\n  npm run content:scaffold -- --id <topicId> --title <Title> [options]\n\nOptions:\n  Topic:\n  --description <text>\n  --difficulty Beginner|Intermediate|Advanced\n  --emoji <emoji>\n  --color <#RRGGBB>\n  --unpublished\n  --seed <any>\n  --dry-run\n  --force   (overwrite if file exists)\n\n  Classification (optional):\n  --subject <Subject>\n  --subcategory <text>\n\n  Hierarchy (recommended):\n  --courseId <courseId>\n  --chapterId <chapterId>\n\n  Local catalog auto-create (only used when category/course/chapter missing):\n  --categoryId <categoryId>\n  --categoryTitle <text>\n  --categoryDescription <text>\n  --categoryEmoji <emoji>\n  --categoryColor <#RRGGBB>\n\n  --courseTitle <text>\n  --courseDescription <text>\n  --courseEmoji <emoji>\n  --courseColor <#RRGGBB>\n\n  --chapterTitle <text>\n  --chapterDescription <text>\n  --chapterPosition <number>\n\n  --no-catalog-update   (never modify content/catalog/catalog.json)\n\nNotes:\n- If you pass --courseId and --chapterId, the file is written to:\n  content/topics/<categoryId>/<courseId>/<chapterId>/<topicId>.topic.json\n- If the referenced category/course/chapter does not exist in content/catalog/catalog.json and you do NOT pass --no-catalog-update, the script will create them (local mode only).\n`);
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }

  if (!args.id) throw new Error('Missing --id');
  if (!args.title) throw new Error('Missing --title');
  if (!['Beginner', 'Intermediate', 'Advanced'].includes(args.difficulty)) {
    throw new Error('Invalid --difficulty (Beginner|Intermediate|Advanced)');
  }

  if (args.courseId && !args.chapterId) {
    throw new Error('Missing --chapterId (required when using --courseId)');
  }

  if (!args.subject && !args.courseId) {
    throw new Error('Missing --subject (or provide --courseId to infer subject from the local catalog)');
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

async function loadLocalCatalog() {
  const catalogPath = path.join(CATALOG_DIR, 'catalog.json');
  const data = await readJson(catalogPath);
  return { catalogPath, data };
}

function findCatalogCategory(catalog, categoryId) {
  return (Array.isArray(catalog?.categories) ? catalog.categories : []).find((c) => String(c?.id ?? '') === categoryId) ?? null;
}

function findCatalogCourse(catalog, courseId) {
  return (Array.isArray(catalog?.courses) ? catalog.courses : []).find((c) => String(c?.id ?? '') === courseId) ?? null;
}

function resolveHierarchyFromCatalog(catalog, courseId) {
  const course = findCatalogCourse(catalog, courseId);
  if (!course) return null;
  const categoryId = String(course?.categoryId ?? '').trim();
  if (!categoryId) throw new Error(`Course is missing categoryId in local catalog: ${courseId}`);
  const category = findCatalogCategory(catalog, categoryId);
  return {
    categoryId,
    categoryTitle: String(category?.title ?? '').trim() || categoryId,
    courseTitle: String(course?.title ?? '').trim() || courseId,
  };
}

function ensureCategoryInCatalog({ catalog, categoryId, categoryTitle, categoryDescription, categoryEmoji, categoryColor }) {
  const categories = Array.isArray(catalog?.categories) ? catalog.categories : [];
  const existing = categories.find((c) => String(c?.id ?? '') === categoryId);
  if (existing) return { catalog, created: false };

  const next = {
    ...catalog,
    categories: categories
      .concat([
        {
          id: categoryId,
          title: String(categoryTitle ?? '').trim() || titleFromId(categoryId),
          emoji: String(categoryEmoji ?? '').trim() || '📚',
          color: String(categoryColor ?? '').trim() || '#4ECDC4',
          description: String(categoryDescription ?? '').trim() || '',
          published: true,
        },
      ])
      .slice()
      .sort((a, b) => String(a?.title ?? '').localeCompare(String(b?.title ?? ''))),
  };

  return { catalog: next, created: true };
}

function ensureCourseInCatalog({ catalog, courseId, categoryId, courseTitle, courseDescription, courseEmoji, courseColor }) {
  const courses = Array.isArray(catalog?.courses) ? catalog.courses : [];
  const existing = courses.find((c) => String(c?.id ?? '') === courseId);
  if (existing) return { catalog, created: false };

  const next = {
    ...catalog,
    courses: courses
      .concat([
        {
          id: courseId,
          categoryId,
          title: String(courseTitle ?? '').trim() || titleFromId(courseId),
          emoji: String(courseEmoji ?? '').trim() || '📘',
          color: String(courseColor ?? '').trim() || '#4ECDC4',
          description: String(courseDescription ?? '').trim() || '',
          published: true,
        },
      ])
      .slice()
      .sort((a, b) => {
        const ac = String(a?.categoryId ?? '');
        const bc = String(b?.categoryId ?? '');
        if (ac !== bc) return ac.localeCompare(bc);
        return String(a?.title ?? '').localeCompare(String(b?.title ?? ''));
      }),
  };

  return { catalog: next, created: true };
}

function ensureChapterInCatalog({ catalog, courseId, chapterId, chapterTitle, chapterDescription, chapterPosition }) {
  const chapters = Array.isArray(catalog?.chapters) ? catalog.chapters : [];
  const existing = chapters.find((c) => String(c?.id ?? '') === chapterId);
  if (existing) return { catalog, created: false };

  const pos = Number(chapterPosition);
  const courseChapters = chapters.filter((c) => String(c?.courseId ?? '') === courseId);
  const maxPos = courseChapters.reduce((m, c) => Math.max(m, Number(c?.position ?? 0) || 0), 0);
  const nextPos = Number.isFinite(pos) ? pos : (maxPos ? maxPos + 10 : 10);

  const next = {
    ...catalog,
    chapters: chapters
      .concat([
        {
          id: chapterId,
          courseId,
          title: String(chapterTitle ?? '').trim() || titleFromId(chapterId),
          position: nextPos,
          description: String(chapterDescription ?? '').trim() || '',
          published: true,
        },
      ])
      .slice()
      .sort((a, b) => {
        const ac = String(a?.courseId ?? '');
        const bc = String(b?.courseId ?? '');
        if (ac !== bc) return ac.localeCompare(bc);
        const ap = Number(a?.position ?? 0) || 0;
        const bp = Number(b?.position ?? 0) || 0;
        if (ap !== bp) return ap - bp;
        return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
      }),
  };

  return { catalog: next, created: true };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const topicId = assertSafePathSegment(args.id, '--id');
  const courseId = args.courseId ? assertSafePathSegment(args.courseId, '--courseId') : null;
  const chapterId = args.chapterId ? assertSafePathSegment(args.chapterId, '--chapterId') : null;

  let inferred = null;

  if (courseId) {
    const { catalogPath, data } = await loadLocalCatalog();
    let workingCatalog = data;

    if (!findCatalogCourse(workingCatalog, courseId)) {
      if (args.noCatalogUpdate) {
        throw new Error(
          `Course not found in content/catalog/catalog.json: ${courseId}. Remove --no-catalog-update or add it to the local catalog.`
        );
      }
      const categoryIdFromArgs = assertSafePathSegment(args.categoryId, '--categoryId (required for new courses)');

      const { catalog: catNext, created: catCreated } = ensureCategoryInCatalog({
        catalog: workingCatalog,
        categoryId: categoryIdFromArgs,
        categoryTitle: args.categoryTitle,
        categoryDescription: args.categoryDescription,
        categoryEmoji: args.categoryEmoji,
        categoryColor: args.categoryColor,
      });
      workingCatalog = catNext;

      const { catalog: courseNext, created: courseCreated } = ensureCourseInCatalog({
        catalog: workingCatalog,
        courseId,
        categoryId: categoryIdFromArgs,
        courseTitle: args.courseTitle,
        courseDescription: args.courseDescription,
        courseEmoji: args.courseEmoji,
        courseColor: args.courseColor,
      });
      workingCatalog = courseNext;

      if (!args.dryRun && (catCreated || courseCreated)) {
        await writeJson(catalogPath, workingCatalog);
        if (catCreated) console.log(`✅ Added category to local catalog: ${categoryIdFromArgs}`);
        if (courseCreated) console.log(`✅ Added course to local catalog: ${courseId} (categoryId: ${categoryIdFromArgs})`);
      }
    }

    inferred = resolveHierarchyFromCatalog(workingCatalog, courseId);
    if (!inferred) throw new Error(`Unable to resolve category for courseId: ${courseId}`);

    if (!args.subject) args.subject = inferred.categoryTitle;
    if (!args.subcategory) args.subcategory = inferred.courseTitle;

    if (!args.dryRun && chapterId && !args.noCatalogUpdate) {
      const { catalog: nextCatalog, created } = ensureChapterInCatalog({
        catalog: workingCatalog,
        courseId,
        chapterId,
        chapterTitle: args.chapterTitle,
        chapterDescription: args.chapterDescription,
        chapterPosition: args.chapterPosition,
      });
      if (created) {
        await writeJson(catalogPath, nextCatalog);
        console.log(`✅ Added chapter to local catalog: ${chapterId} (courseId: ${courseId})`);
        workingCatalog = nextCatalog;
      }
    }

    inferred = resolveHierarchyFromCatalog(workingCatalog, courseId);
  }

  if (!args.subcategory) args.subcategory = 'Core Concepts';

  const seed = seedToInt(args.seed ?? topicId);
  const rand = mulberry32(seed);
  const color = args.color ?? pickPaletteColor(args.subject, rand);

  const topic = {
    id: topicId,
    subject: args.subject,
    subcategory: args.subcategory,
    ...(courseId ? { courseId } : {}),
    ...(chapterId ? { chapterId } : {}),
    title: args.title,
    emoji: args.emoji,
    color,
    description: args.description || 'Learn this concept in 60 seconds.',
    difficulty: args.difficulty,
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

  const outDir = courseId
    ? path.join(
        TOPICS_DIR,
        assertSafePathSegment(inferred?.categoryId, 'categoryId (from catalog)'),
        courseId,
        chapterId
      )
    : path.join(TOPICS_DIR, assertSafePathSegment(args.subject, '--subject'));

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
  console.log(`3. Test with: npm run dev:local`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
