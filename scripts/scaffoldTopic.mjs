import fs from 'node:fs/promises';
import path from 'node:path';
import { TOPICS_DIR } from './_contentPaths.mjs';
import { compileJourneyFromTopic } from '../src/engine/journey/compileJourney.js';

function parseArgs(argv) {
  const args = {
    id: null,
    subject: null,
    title: null,
    description: '',
    difficulty: 'Beginner',
    emoji: '🎯',
    color: null,
    published: true,
    seed: null,
    dryRun: false,
      subcategory: 'Core Concepts',
    force: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];

    if (a === '--id') args.id = argv[++i];
    else if (a === '--subject') args.subject = argv[++i];
    else if (a === '--title') args.title = argv[++i];
    else if (a === '--description') args.description = argv[++i] ?? '';
    else if (a === '--difficulty') args.difficulty = argv[++i];
    else if (a === '--emoji') args.emoji = argv[++i];
    else if (a === '--color') args.color = argv[++i];
    else if (a === '--unpublished') args.published = false;
    else if (a === '--seed') args.seed = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
      else if (a === '--subcategory') args.subcategory = argv[++i];
    else if (a === '--force') args.force = true;
    else if (a === '--help' || a === '-h') {
      console.log(`\nUsage:\n  npm run content:scaffold -- --id <topicId> --subject <Subject> --title <Title> [options]\n\nOptions:\n  --subcategory <text>\n  --description <text>\n  --difficulty Beginner|Intermediate|Advanced\n  --emoji <emoji>\n  --color <#RRGGBB>\n  --unpublished\n  --seed <any>\n  --dry-run\n  --force   (overwrite if file exists)\n\nThis scaffolds a story-based topic JSON with 6 narrative beats + quiz.\n`);
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }

  if (!args.id) throw new Error('Missing --id');
  if (!args.subject) throw new Error('Missing --subject');
  if (!args.subcategory) throw new Error('Missing --subcategory');
  if (!args.title) throw new Error('Missing --title');
  if (!['Beginner', 'Intermediate', 'Advanced'].includes(args.difficulty)) {
    throw new Error('Invalid --difficulty (Beginner|Intermediate|Advanced)');
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
    a = (a + 0x6D2B79F5) | 0;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const seed = seedToInt(args.seed ?? args.id);
  const rand = mulberry32(seed);

  const color = args.color ?? pickPaletteColor(args.subject, rand);

  // Create story-based topic structure
  const topic = {
    id: args.id,
    subject: args.subject,
    subcategory: args.subcategory,
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

  // Add auto-generated journey spec
  topic.journey = compileJourneyFromTopic(topic);

  const outDir = path.join(TOPICS_DIR, args.subject);
  const outPath = path.join(outDir, `${args.id}.topic.json`);

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
