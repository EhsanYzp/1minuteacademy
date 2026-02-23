import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

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

  const present = (name) => (process.env[name] ? 'present' : 'missing');
  const envLabel = envName ? `--env ${envName}` : '(no --env)';
  console.log(`[content:seed-example-course] dotenv loaded (${envLabel}): ${loaded.length ? loaded.join(', ') : '(none found)'}`);
  console.log(
    `[content:seed-example-course] env check: ` +
      [
        `SUPABASE_URL=${present('SUPABASE_URL')}`,
        `VITE_SUPABASE_URL=${present('VITE_SUPABASE_URL')}`,
        `SUPABASE_SERVICE_ROLE_KEY=${present('SUPABASE_SERVICE_ROLE_KEY')}`,
        `VITE_SUPABASE_SERVICE_ROLE_KEY=${present('VITE_SUPABASE_SERVICE_ROLE_KEY')}`,
      ].join(' ')
  );
}

const requestedEnv = normalizeEnvName(parseEnvNameFromArgv(process.argv.slice(2)));
loadDotenv(requestedEnv);

function requiredEnvAny(names) {
  for (const name of names) {
    const v = process.env[name];
    if (v) return v;
  }
  const envFileHint = requestedEnv ? `.env.${requestedEnv}.local` : '.env.local';
  throw new Error(`Missing env var: ${names.join(' or ')} (set it in ${envFileHint} or export it in your shell)`);
}

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function forbidEnv(name) {
  const v = process.env[name];
  if (v) {
    throw new Error(
      `Refusing to run: ${name} is set. Never expose the service role key in any VITE_ variable (it would be bundled into the browser). Use SUPABASE_SERVICE_ROLE_KEY instead.`
    );
  }
}

function slugify(input) {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    categoryId: null,
    courseId: null,
    courseTitle: 'Agent Builder Lab',
    chapters: 7,
    lessons: 56,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--category-id') {
      args.categoryId = String(argv[i + 1] ?? '').trim() || null;
      i += 1;
    } else if (a === '--course-id') {
      args.courseId = String(argv[i + 1] ?? '').trim() || null;
      i += 1;
    } else if (a === '--course-title') {
      args.courseTitle = String(argv[i + 1] ?? '').trim() || args.courseTitle;
      i += 1;
    } else if (a === '--chapters') {
      const n = Number(argv[i + 1]);
      i += 1;
      if (!Number.isFinite(n)) throw new Error('Invalid --chapters');
      args.chapters = clamp(Math.floor(n), 5, 10);
    } else if (a === '--lessons') {
      const n = Number(argv[i + 1]);
      i += 1;
      if (!Number.isFinite(n)) throw new Error('Invalid --lessons');
      args.lessons = clamp(Math.floor(n), 40, 80);
    } else if (a === '--env') {
      i += 1; // handled earlier
    } else if (a === '--help' || a === '-h') {
      console.log(
        `\nUsage:\n  node scripts/seedExampleCourseToSupabase.mjs --env staging [--dry-run] [--category-id ai] [--course-id <id>] [--course-title <title>] [--chapters 5..10] [--lessons 40..80]\n\nDefaults:\n- chapters=7\n- lessons=56\n\nNotes:\n- Creates 1 course + chapters + lessons directly in Supabase topics table (no local content files required).\n- Lessons are completeable in the UI (story beats + quiz).\n`
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }

  // Ensure we always have enough unique lesson titles for the requested size.
  if (args.chapters * 5 > args.lessons) {
    // Not an error; just means fewer lessons per chapter, which is fine.
  }

  return args;
}

function buildChapterPlan(chapterCount) {
  const base = [
    { title: 'Foundations', description: 'What agents are (and aren\'t), and the core mental model.' },
    { title: 'Prompts & Tools', description: 'How to give agents reliable instructions and tool access.' },
    { title: 'Planning & Control', description: 'Plans, constraints, retries, and safe stopping conditions.' },
    { title: 'Memory & RAG', description: 'Context windows, retrieval, and keeping knowledge up to date.' },
    { title: 'Safety & Guardrails', description: 'Policies, red-teaming, and practical safety checks.' },
    { title: 'Evaluation', description: 'Measuring quality and preventing regressions.' },
    { title: 'Shipping', description: 'Deploying, monitoring, and operating agents in production.' },
    { title: 'Advanced Patterns', description: 'Multi-agent systems, orchestration, and hard edge cases.' },
    { title: 'Team Workflows', description: 'Making agents useful inside real teams and processes.' },
    { title: 'Capstone', description: 'Pulling it all together into a repeatable build loop.' },
  ];

  return base.slice(0, clamp(chapterCount, 5, 10));
}

function buildLessonTitlesByChapter(chapters) {
  const per = [
    [
      'Agent vs Automation',
      'The Loop: Observe → Think → Act',
      'Why Agents Fail',
      'Tight Feedback Cycles',
      'Keeping It Simple',
      'Choosing the Right Agent Shape',
      'The “Do One Thing” Rule',
      'When Not to Use an Agent',
    ],
    [
      'Prompt: Role + Goal + Constraints',
      'Tool Use: Inputs and Outputs',
      'Tool Permissions & Safety',
      'Schema: Structured Outputs',
      'Few-Shot for Reliability',
      'Handling Ambiguity',
      'Error Messages as Signals',
      'Tooling Anti-Patterns',
    ],
    [
      'Planning: Steps vs Outcomes',
      'Decomposition',
      'Retries and Backoff',
      'Stop Conditions',
      'Budgeting Tokens/Time',
      'State Machines',
      'Human-in-the-Loop',
      'Logging the Right Things',
    ],
    [
      'Memory Types: Short vs Long',
      'RAG: What It Is',
      'Chunking Basics',
      'Retrieval Quality Checks',
      'Citations and Traceability',
      'Freshness vs Stability',
      'Avoiding Hallucinated Memory',
      'Privacy in Memory',
    ],
    [
      'Threat Modeling an Agent',
      'Prompt Injection Basics',
      'Data Exfiltration Risks',
      'Guardrails: Allowed Actions',
      'Red-Team Checklists',
      'Safe Defaults',
      'Rate Limits and Abuse',
      'Incident Response for Agents',
    ],
    [
      'Defining Success Metrics',
      'Golden Test Sets',
      'Offline vs Online Eval',
      'Human Review Loops',
      'A/B Testing',
      'Regression Prevention',
      'Quality Rubrics',
      'When Metrics Lie',
    ],
    [
      'Launch Checklist',
      'Observability',
      'Cost Monitoring',
      'Latency Budgets',
      'Fallbacks and Degradation',
      'Versioning Prompts',
      'Rollbacks',
      'Roadmap for Iteration',
    ],
    [
      'Multi-Agent Roles',
      'Orchestration Patterns',
      'Tool Routing',
      'Long-Horizon Tasks',
      'Async Work Queues',
      'Caching and Reuse',
      'Adversarial Inputs',
      'Hard Reliability Wins',
    ],
    [
      'Agent for Support Triage',
      'Agent for Research',
      'Agent for Content Ops',
      'Agent for QA',
      'Agent for Sales Ops',
      'Agent for Data Cleanup',
      'Agent for Incident Triage',
      'Agent for Onboarding',
    ],
    [
      'Capstone: Pick a Use Case',
      'Capstone: Define Inputs',
      'Capstone: Define Tools',
      'Capstone: Guardrails',
      'Capstone: Eval Plan',
      'Capstone: Ship MVP',
      'Capstone: Monitor',
      'Capstone: Iterate',
    ],
  ];

  return chapters.map((_, idx) => per[idx] ?? []);
}

function buildStory({ title, emoji }) {
  const e = emoji || '🎯';
  return {
    hook: { visual: e, text: `You can make this reliable in 1 minute: ${title}.` },
    buildup: { visual: '🧩', text: 'Start with a clear goal and tight constraints.' },
    discovery: { visual: '🔍', text: 'Identify the single biggest failure mode to prevent.' },
    twist: { visual: '⚠️', text: 'Assume messy inputs; design for recovery.' },
    climax: { visual: '✅', text: 'Use checks: validate, retry, and stop safely.' },
    punchline: { visual: '🚀', text: 'Small, safe steps beat big, brittle leaps.' },
  };
}

function buildQuiz({ title }) {
  const options = [
    'Make the agent do more steps per run',
    'Add a clear constraint or validation check',
    'Hide errors so users don\'t see them',
    'Use fewer tests to ship faster',
  ];
  return {
    question: `What\'s the best quick reliability upgrade for: “${title}”?`,
    options,
    correct: 1,
    explanation: 'Reliability usually improves fastest by adding explicit constraints and validation checks.' ,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  forbidEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');

  const supabaseUrl = requiredEnvAny(['SUPABASE_URL', 'VITE_SUPABASE_URL']);
  const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: categories, error: catErr } = await supabase
    .from('categories')
    .select('id, title, color, published')
    .eq('published', true)
    .order('title', { ascending: true });
  if (catErr) throw catErr;

  const categoryRows = Array.isArray(categories) ? categories : [];
  if (categoryRows.length === 0) throw new Error('No published categories found.');

  let category = null;
  if (args.categoryId) {
    category = categoryRows.find((c) => String(c?.id ?? '') === args.categoryId) ?? null;
    if (!category) throw new Error(`Category not found: ${args.categoryId}`);
  } else {
    category = categoryRows.find((c) => String(c?.id ?? '') === 'ai') ?? categoryRows[0];
  }

  const categoryId = String(category.id);
  const categoryTitle = String(category.title ?? categoryId);
  const categoryColor = category?.color ? String(category.color) : null;

  const courseTitle = String(args.courseTitle ?? '').trim() || 'Example Course';
  const courseId = args.courseId || `${categoryId}--${slugify(courseTitle) || 'example-course'}`;

  const chaptersPlan = buildChapterPlan(args.chapters);
  const chapterRows = chaptersPlan.map((ch, idx) => {
    const position = idx + 1;
    const chapterId = `${courseId}--ch${String(position).padStart(2, '0')}-${slugify(ch.title)}`;
    return {
      id: chapterId,
      course_id: courseId,
      title: ch.title,
      position,
      description: ch.description,
      published: true,
    };
  });

  const lessonsByChapter = buildLessonTitlesByChapter(chapterRows);

  // Build a deterministic list of lesson titles, chapter by chapter.
  const lessonTitles = [];
  for (let i = 0; i < chapterRows.length; i += 1) {
    for (const t of lessonsByChapter[i] ?? []) lessonTitles.push({ chapterIndex: i, title: t });
  }

  // If requested lesson count differs, extend with generic titles.
  const desiredLessons = clamp(args.lessons, 40, 80);
  while (lessonTitles.length < desiredLessons) {
    const idx = lessonTitles.length;
    const chapterIndex = idx % chapterRows.length;
    lessonTitles.push({ chapterIndex, title: `Lesson ${idx + 1}: ${chapterRows[chapterIndex].title}` });
  }

  const finalLessons = lessonTitles.slice(0, desiredLessons);

  const courseRow = {
    id: courseId,
    category_id: categoryId,
    title: courseTitle,
    emoji: '🤖',
    color: categoryColor,
    description: `A hands-on course with ${chapterRows.length} chapters and ${finalLessons.length} 1-minute lessons (~${finalLessons.length} minutes).`,
    published: true,
  };

  const topics = finalLessons.map((l, idx) => {
    const i = idx + 1;
    const chapter = chapterRows[l.chapterIndex];
    const title = String(l.title);
    const topicId = `${courseId}--t${String(i).padStart(2, '0')}-${slugify(title)}`;
    const emoji = '🎯';

    const story = buildStory({ title, emoji });
    const quiz = buildQuiz({ title });

    return {
      id: topicId,
      subject: categoryTitle,
      subcategory: courseTitle,
      course_id: courseId,
      chapter_id: chapter.id,
      title,
      emoji,
      color: categoryColor || '#4ECDC4',
      description: `A 1-minute lesson: ${title}.`,
      is_free: true,
      published: true,
      // Keep story/quiz in lesson (matches our canonical content shape)
      story: null,
      quiz: null,
      journey: null,
      lesson: {
        version: 1,
        story,
        quiz,
      },
    };
  });

  console.log(
    `[content:seed-example-course] category=${categoryId} (${categoryTitle}) course=${courseId} chapters=${chapterRows.length} lessons=${topics.length} (~${topics.length} minutes)`
  );

  if (args.dryRun) {
    console.log('(dry-run) course:', courseRow.id, '->', courseRow.title);
    console.log('(dry-run) chapters:', chapterRows.slice(0, 3).map((c) => c.id).join(', '), chapterRows.length > 3 ? '…' : '');
    console.log('(dry-run) topics preview:');
    for (const t of topics.slice(0, 10)) console.log(`  ${t.chapter_id} :: ${t.id} -> ${t.title}`);
    if (topics.length > 10) console.log(`  …and ${topics.length - 10} more`);
    return;
  }

  // Upsert so it's safe to re-run.
  {
    const { error } = await supabase.from('courses').upsert([courseRow], { onConflict: 'id' });
    if (error) throw error;
  }

  {
    const { error } = await supabase.from('chapters').upsert(chapterRows, { onConflict: 'id' });
    if (error) throw error;
  }

  const CHUNK = 200;
  for (let i = 0; i < topics.length; i += CHUNK) {
    const slice = topics.slice(i, i + CHUNK);
    // eslint-disable-next-line no-await-in-loop
    const { error } = await supabase.from('topics').upsert(slice, { onConflict: 'id' });
    if (error) throw error;
    console.log(`✅ Upserted ${slice.length} topic row(s) (${i + slice.length}/${topics.length}).`);
  }

  console.log('\n✅ Example course seeded.');
  console.log(`Next: open /categories/${encodeURIComponent(categoryId)} and look for “${courseTitle}”.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
