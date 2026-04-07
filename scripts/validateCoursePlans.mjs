import fs from 'node:fs/promises';
import path from 'node:path';
import { COURSE_PLANS_DIR } from './_contentPaths.mjs';

const BEAT_NAMES = ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline'];

function parseArgs(argv) {
  const args = {
    strictLengths: false,
    prefix: null,
    plans: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--strict-lengths') {
      args.strictLengths = true;
    } else if (a === '--prefix') {
      const v = argv[i + 1];
      if (!v || v.startsWith('--')) throw new Error('Missing value for --prefix');
      args.prefix = v;
      i += 1;
    } else if (a === '--plan') {
      const v = argv[i + 1];
      if (!v || v.startsWith('--')) throw new Error('Missing value for --plan');
      args.plans.push(v);
      i += 1;
    } else if (a === '--help' || a === '-h') {
      console.log(`\nUsage:\n  node scripts/validateCoursePlans.mjs [--strict-lengths] [--prefix <filePrefix>] [--plan <path>]\n\nChecks:\n  - Course plan JSON parses\n  - Chapters count 5\u201310, topics count 30\u201360\n  - requireAuthoredStory === true\n  - Topic chapter_id exists in chapters\n  - is_free is a boolean\n  - Quiz has 3 options and valid correct index\n  - (Optional) Beat text length targets 120/80 when --strict-lengths is set\n\nScoping:\n  --prefix entrepreneurship--   Validate only course plans whose filename starts with a prefix\n  --plan content/course-plans/x.json   Validate only a specific plan (repeatable)\n`);
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }

  return args;
}

async function listJsonFiles(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
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

function beatLimit(beat, strictLengths) {
  if (!strictLengths) return null;
  return beat === 'punchline' ? 80 : 120;
}

function validatePlan(plan, relPath, { strictLengths }) {
  const errors = [];
  const warnings = [];

  if (!plan || typeof plan !== 'object') {
    errors.push(`${relPath}: plan is not an object`);
    return errors;
  }

  if (plan.requireAuthoredStory !== true) {
    errors.push(`${relPath}: requireAuthoredStory must be true`);
  }

  const chapters = Array.isArray(plan.chapters) ? plan.chapters : [];
  const topics = Array.isArray(plan.topics) ? plan.topics : [];

  if (chapters.length < 5 || chapters.length > 10) {
    errors.push(`${relPath}: chapters must be 5–10 (found ${chapters.length})`);
  }

  if (topics.length < 30 || topics.length > 60) {
    errors.push(`${relPath}: topics must be 30–60 (found ${topics.length})`);
  }

  const chapterIds = new Set();
  const chapterPositions = new Set();
  for (const ch of chapters) {
    if (!ch || typeof ch !== 'object') continue;
    if (typeof ch.id === 'string' && ch.id.trim()) {
      if (chapterIds.has(ch.id)) errors.push(`${relPath}: duplicate chapter id: ${ch.id}`);
      chapterIds.add(ch.id);
    } else {
      errors.push(`${relPath}: chapter missing id`);
    }

    if (typeof ch.position === 'number') {
      if (chapterPositions.has(ch.position)) errors.push(`${relPath}: duplicate chapter position: ${ch.position}`);
      chapterPositions.add(ch.position);
    }
  }

  for (let i = 0; i < topics.length; i += 1) {
    const topic = topics[i];
    const label = `${relPath} » topic[${i}]${topic?.title ? ` ("${topic.title}")` : ''}`;

    if (!topic || typeof topic !== 'object') {
      errors.push(`${label}: topic is not an object`);
      continue;
    }

    if (!chapterIds.has(topic.chapter_id)) {
      errors.push(`${label}: chapter_id not found in chapters: ${JSON.stringify(topic.chapter_id)}`);
    }

    if (typeof topic.title !== 'string' || !topic.title.trim()) {
      errors.push(`${label}: missing/empty title`);
    }

    if (typeof topic.is_free !== 'boolean') {
      errors.push(`${label}: is_free must be a boolean (got ${JSON.stringify(topic.is_free)})`);
    }

    const quiz = topic.quiz;
    if (!quiz || typeof quiz !== 'object') {
      errors.push(`${label}: missing quiz`);
    } else {
      if (!Array.isArray(quiz.options) || quiz.options.length !== 3) {
        errors.push(`${label}: quiz.options must be an array of 3 strings`);
      }
      if (![0, 1, 2].includes(quiz.correct)) {
        errors.push(`${label}: quiz.correct must be 0, 1, or 2`);
      }
    }

    if (strictLengths) {
      const story = topic.story;
      if (!story || typeof story !== 'object') {
        errors.push(`${label}: missing story`);
      } else {
        for (const beat of BEAT_NAMES) {
          const text = story?.[beat]?.text;
          if (typeof text !== 'string') continue;
          const limit = beatLimit(beat, strictLengths);
          if (limit != null && text.length > limit) {
            errors.push(`${label}: ${beat} length ${text.length} exceeds ${limit}`);
          }
        }
      }
    }

    // ── details (warned for existing plans, required by generator for new ones) ──
    const details = topic.details;
    if (!details || typeof details !== 'object') {
      warnings.push(`${label}: missing details object`);
    } else {
      if (typeof details.summary !== 'string' || details.summary.length < 100 || details.summary.length > 300) {
        warnings.push(`${label}: details.summary must be a string of 100–300 chars (got ${details.summary?.length ?? 0})`);
      }
      if (typeof details.whyItMatters !== 'string' || details.whyItMatters.length < 80 || details.whyItMatters.length > 250) {
        warnings.push(`${label}: details.whyItMatters must be a string of 80–250 chars (got ${details.whyItMatters?.length ?? 0})`);
      }
      const takeaways = Array.isArray(details.takeaways) ? details.takeaways : [];
      if (takeaways.length !== 3) {
        warnings.push(`${label}: details.takeaways must have exactly 3 items (got ${takeaways.length})`);
      } else {
        for (let k = 0; k < takeaways.length; k += 1) {
          const t = takeaways[k];
          if (typeof t !== 'string' || t.length < 30 || t.length > 120) {
            warnings.push(`${label}: details.takeaways[${k}] must be 30–120 chars (got ${typeof t === 'string' ? t.length : typeof t})`);
          }
        }
      }
      const keywords = Array.isArray(details.keywords) ? details.keywords : [];
      if (keywords.length < 3 || keywords.length > 5) {
        warnings.push(`${label}: details.keywords must have 3–5 items (got ${keywords.length})`);
      } else {
        for (let k = 0; k < keywords.length; k += 1) {
          const kw = keywords[k];
          if (typeof kw !== 'string' || kw.length < 2 || kw.length > 60) {
            warnings.push(`${label}: details.keywords[${k}] must be 2–60 chars (got ${typeof kw === 'string' ? kw.length : typeof kw})`);
          }
        }
      }
      const faq = Array.isArray(details.faq) ? details.faq : [];
      if (faq.length !== 2) {
        warnings.push(`${label}: details.faq must have exactly 2 items (got ${faq.length})`);
      } else {
        for (let k = 0; k < faq.length; k += 1) {
          const f = faq[k];
          if (!f || typeof f !== 'object') {
            warnings.push(`${label}: details.faq[${k}] must be an object`);
          } else {
            if (typeof f.question !== 'string' || f.question.length < 20 || f.question.length > 150) {
              warnings.push(`${label}: details.faq[${k}].question must be 20–150 chars (got ${f.question?.length ?? 0})`);
            }
            if (typeof f.answer !== 'string' || f.answer.length < 50 || f.answer.length > 300) {
              warnings.push(`${label}: details.faq[${k}].answer must be 50–300 chars (got ${f.answer?.length ?? 0})`);
            }
          }
        }
      }
    }
  }

  return { errors, warnings };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let files;
  if (args.plans.length > 0) {
    files = args.plans.map((p) => path.isAbsolute(p) ? p : path.join(process.cwd(), p));
  } else {
    files = await listJsonFiles(COURSE_PLANS_DIR);
    if (args.prefix) {
      files = files.filter((f) => path.basename(f).startsWith(args.prefix));
    }
  }
  let totalErrors = 0;
  let totalWarnings = 0;
  let plansWithWarnings = 0;

  console.log(`── Course plan structural validation ──`);
  console.log(`plans=${files.length} strictLengths=${args.strictLengths} prefix=${args.prefix ?? '(all)'}`);

  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    let plan;
    try {
      plan = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch (e) {
      totalErrors += 1;
      console.error(`\n❌ ${rel}: invalid JSON – ${e.message}`);
      continue;
    }

    const { errors: errs, warnings: warns } = validatePlan(plan, rel, args);
    if (errs.length > 0) {
      totalErrors += errs.length;
      console.error(`\n❌ ${rel}: ${errs.length} issue(s)`);
      for (const err of errs) console.error(`  - ${err}`);
    }
    if (warns.length > 0) {
      totalWarnings += warns.length;
      plansWithWarnings += 1;
    }
  }

  if (totalWarnings > 0) {
    console.log(`\n⚠️  ${totalWarnings} details warning(s) across ${plansWithWarnings} course plan(s) — add "details" to each topic.`);
  }

  if (totalErrors > 0) {
    console.error(`\n❌ Course plan validation failed: ${totalErrors} issue(s).`);
    process.exit(1);
  }

  console.log(`\n✅ Course plan validation passed.`);
}

await main();
