import fs from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const args = {
    courseId: null,
    categoryId: null,
    subject: null,
    courseTitle: null,
    emoji: null,
    color: null,
    topicsRoot: null,
    out: null,
    requireAuthoredStory: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = argv[i + 1];

    if (a === '--course-id') {
      args.courseId = next;
      i += 1;
    } else if (a === '--category-id') {
      args.categoryId = next;
      i += 1;
    } else if (a === '--subject') {
      args.subject = next;
      i += 1;
    } else if (a === '--course-title') {
      args.courseTitle = next;
      i += 1;
    } else if (a === '--emoji') {
      args.emoji = next;
      i += 1;
    } else if (a === '--color') {
      args.color = next;
      i += 1;
    } else if (a === '--topics-root') {
      args.topicsRoot = next;
      i += 1;
    } else if (a === '--out') {
      args.out = next;
      i += 1;
    } else if (a === '--no-require-authored-story') {
      args.requireAuthoredStory = false;
    } else if (a === '--help' || a === '-h') {
      console.log(`\nUsage:\n  node scripts/extractCoursePlanFromTopicJsons.mjs \\\n    --course-id <courseId> \\\n    --category-id <categoryId> \\\n    --subject <Subject> \\\n    --course-title <Course Title> \\\n    --emoji <emoji> \\\n    --color <#hex> \\\n    --topics-root content/topics/<categoryId>/<courseId> \\\n    --out content/course-plans/<courseId>.json\n\nExtracts an authored course plan from existing .topic.json files.\n`);
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }

  const required = ['courseId', 'categoryId', 'subject', 'courseTitle', 'emoji', 'color', 'topicsRoot', 'out'];
  for (const k of required) {
    if (!args[k] || String(args[k]).trim() === '') throw new Error(`Missing required arg: --${k.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
    args[k] = String(args[k]).trim();
  }

  return args;
}

async function listTopicFiles(dir) {
  const out = [];
  async function walk(p) {
    const entries = await fs.readdir(p, { withFileTypes: true });
    for (const e of entries) {
      const fp = path.join(p, e.name);
      if (e.isDirectory()) {
        // eslint-disable-next-line no-await-in-loop
        await walk(fp);
      } else if (e.isFile() && e.name.endsWith('.topic.json')) {
        out.push(fp);
      }
    }
  }
  await walk(dir);
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function parseTopicIndex(id) {
  // Expected: <courseId>--tNN-...
  const m = /--t(\d{2})-/.exec(String(id));
  if (!m) return Number.POSITIVE_INFINITY;
  return Number(m[1]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const topicsRootAbs = path.resolve(process.cwd(), args.topicsRoot);
  const files = await listTopicFiles(topicsRootAbs);
  if (files.length === 0) throw new Error(`No .topic.json files found under: ${args.topicsRoot}`);

  const topicItems = [];
  const chaptersSeen = new Set();

  for (const fp of files) {
    // eslint-disable-next-line no-await-in-loop
    const raw = await fs.readFile(fp, 'utf8');
    const json = JSON.parse(raw);

    if (String(json.course_id ?? '') !== args.courseId) {
      throw new Error(`Mismatched course_id in ${fp}`);
    }

    const item = {
      id: json.id,
      chapter_id: json.chapter_id,
      title: json.title,
      description: json.description,
      difficulty: json.difficulty,
      story: json.story,
      quiz: json.quiz,
    };

    chaptersSeen.add(String(json.chapter_id));
    topicItems.push(item);
  }

  // Sort topics by their numeric index if present, then by id.
  topicItems.sort((a, b) => {
    const ai = parseTopicIndex(a.id);
    const bi = parseTopicIndex(b.id);
    if (ai !== bi) return ai - bi;
    return String(a.id).localeCompare(String(b.id));
  });

  // Chapters: extracted from chapter ids present in topic files, but titles/positions must be supplied.
  // For now, provide stable placeholders that you can edit.
  const chapterIds = Array.from(chaptersSeen).sort((a, b) => a.localeCompare(b));
  const chapters = chapterIds.map((id, idx) => ({
    id,
    title: id,
    position: idx + 1,
  }));

  const plan = {
    categoryId: args.categoryId,
    subject: args.subject,
    courseId: args.courseId,
    courseTitle: args.courseTitle,
    emoji: args.emoji,
    color: args.color,
    requireAuthoredStory: args.requireAuthoredStory,
    chapters,
    topics: topicItems,
  };

  const outAbs = path.resolve(process.cwd(), args.out);
  await fs.mkdir(path.dirname(outAbs), { recursive: true });
  await fs.writeFile(outAbs, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');

  console.log(`✅ Wrote course plan: ${args.out}`);
  console.log(`   chapters=${chapters.length} topics=${topicItems.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
