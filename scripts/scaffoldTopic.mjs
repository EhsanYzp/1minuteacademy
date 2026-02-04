import fs from 'node:fs/promises';
import path from 'node:path';
import { TOPICS_DIR } from './_contentPaths.mjs';
import { STEP_RECIPES } from '../src/engine/stepRecipes.js';

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
    steps: 4,
    seed: null,
    dryRun: false,
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
    else if (a === '--steps') args.steps = Number(argv[++i]);
    else if (a === '--seed') args.seed = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--help' || a === '-h') {
      console.log(`\nUsage:\n  npm run content:scaffold -- --id <topicId> --subject <Subject> --title <Title> [options]\n\nOptions:\n  --description <text>\n  --difficulty Beginner|Intermediate|Advanced\n  --emoji <emoji>\n  --color <#RRGGBB>\n  --unpublished\n  --steps 4|5\n  --seed <any>\n  --dry-run\n  --force   (overwrite if file exists)\n\nThis scaffolds a topic JSON that uses the step recipe pool (200 IDs) to produce a unique-feeling module with fast interactions.\n`);
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }

  if (!args.id) throw new Error('Missing --id');
  if (!args.subject) throw new Error('Missing --subject');
  if (!args.title) throw new Error('Missing --title');
  if (![4, 5].includes(args.steps)) throw new Error('Invalid --steps (must be 4 or 5)');
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

function uniq(arr) {
  return Array.from(new Set(arr));
}

function tokenize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function pickPaletteColor(subject, rand) {
  const palette = {
    'AI & Agents': ['#FFB703', '#FB8500', '#8ECAE6'],
    'Programming Fundamentals': ['#FF6B6B', '#4D96FF', '#6BCB77'],
    'Blockchain & Web3': ['#4ECDC4', '#00BFA6', '#2EC4B6'],
    'Quantum & Physics': ['#A06CD5', '#5E60CE', '#64DFDF'],
  };
  const list = palette[subject] ?? ['#4ECDC4', '#FFB703', '#A06CD5', '#FF6B6B'];
  return pickOne(list, rand);
}

function weightedBaseTypePreferences({ subject, title, description }) {
  const tokens = uniq([...tokenize(subject), ...tokenize(title), ...tokenize(description)]);

  // Base weights (keep variety as default)
  const w = {
    eitherOr: 1,
    tapSprint: 1,
    tapReveal: 1,
    buildChain: 1,
  };

  // Lightweight heuristics (fast + safe):
  const has = (t) => tokens.includes(t);
  const hasAny = (list) => list.some((t) => has(t));

  if (hasAny(['myth', 'fact', 'true', 'false', 'misconception', 'vs'])) w.eitherOr += 2;
  if (hasAny(['fast', 'speed', 'race', 'mining', 'mine', 'pump', 'boost'])) w.tapSprint += 2;
  if (hasAny(['inside', 'under', 'layer', 'parts', 'components', 'what', 'is'])) w.tapReveal += 1;
  if (hasAny(['build', 'chain', 'pipeline', 'stack', 'steps', 'flow'])) w.buildChain += 1;

  if (hasAny(['quantum', 'physics'])) w.tapReveal += 1;
  if (hasAny(['blockchain', 'web3'])) w.buildChain += 1;
  if (hasAny(['agents', 'ai'])) w.eitherOr += 1;

  return w;
}

function sampleBaseTypes(count, weights, rand) {
  const types = ['eitherOr', 'tapSprint', 'tapReveal', 'buildChain'];
  const out = [];

  // Prefer unique base types, but fall back if count > available.
  const available = new Set(types);

  while (out.length < count) {
    // Build weighted list from remaining types if possible.
    const pool = Array.from(available.size > 0 ? available : new Set(types));
    const total = pool.reduce((sum, t) => sum + (weights[t] ?? 1), 0);
    let r = rand() * total;
    let chosen = pool[0];
    for (const t of pool) {
      r -= weights[t] ?? 1;
      if (r <= 0) {
        chosen = t;
        break;
      }
    }

    out.push(chosen);
    available.delete(chosen);
  }

  return out;
}

function pickRecipeForBaseType(baseType, rand, preferences) {
  const candidates = STEP_RECIPES.filter((r) => r.baseType === baseType);

  // Slight preference for mythFact when eitherOr is requested and the title/desc suggests it.
  if (baseType === 'eitherOr') {
    const tokens = uniq([...tokenize(preferences.title), ...tokenize(preferences.description)]);
    const preferMythFact = tokens.some((t) => ['myth', 'fact', 'misconception', 'true', 'false'].includes(t));
    if (preferMythFact) {
      const mf = candidates.filter((r) => r.id.includes('eitherOr_mythFact_'));
      if (mf.length > 0) return pickOne(mf, rand);
    }
  }

  return pickOne(candidates, rand);
}

function secondsPlan(stepCount) {
  // Keep interactions short; allocate more time to the middle.
  // 4 steps: intro + 2 interactions + summary
  if (stepCount === 4) return [10, 18, 20, 12];
  // 5 steps: intro + 3 interactions + summary
  return [8, 14, 14, 14, 10];
}

function makePlaceholderItems(n) {
  const items = [];
  for (let i = 1; i <= n; i += 1) {
    items.push({ icon: '✨', text: `Key point ${i}` });
  }
  return items;
}

function makeRecipeStep({ idx, seconds, recipe, moduleTitle, rand }) {
  const base = recipe.baseType;

  const step = {
    id: `s${idx}`,
    type: 'recipe',
    recipeId: recipe.id,
    seconds,
    title: recipe.defaults?.title ?? (base === 'eitherOr' ? 'Quick pick' : base === 'tapSprint' ? 'Charge it' : base === 'buildChain' ? 'Build it' : 'Reveal it'),
  };

  // Add minimal, fast-to-complete content. Authors can refine later.
  if (base === 'eitherOr') {
    step.prompt = recipe.defaults?.prompt ?? 'Pick one.';
    step.options = [
      { id: 'a', icon: '🅰️', text: `${moduleTitle}: option A` },
      { id: 'b', icon: '🅱️', text: `${moduleTitle}: option B`, correct: true },
    ];
    step.successText = '✅ Locked in!';
    step.explain = '1 sentence: why this is the better answer.';
  } else if (base === 'tapSprint') {
    step.prompt = recipe.defaults?.prompt ?? 'Tap to fill it up!';
    step.targetTaps = recipe.defaults?.targetTaps ?? (6 + Math.floor(rand() * 7));
    step.buttonLabel = 'TAP';
    step.successText = '✅ Powered up!';
  } else if (base === 'tapReveal') {
    step.prompt = recipe.defaults?.prompt ?? 'Tap to reveal!';
    step.items = makePlaceholderItems(3);
    step.successText = '✅ Revealed!';
  } else if (base === 'buildChain') {
    step.hint = recipe.defaults?.hint ?? 'Tap to build it.';
    step.target = recipe.defaults?.target ?? 2;
    step.genesisLabel = 'Start';
    step.blockLabel = 'Step';
    step.successText = '✅ Built!';
  }

  return step;
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

  const recipeCount = args.steps - 2;
  const weights = weightedBaseTypePreferences({ subject: args.subject, title: args.title, description: args.description });
  const baseTypes = sampleBaseTypes(recipeCount, weights, rand);

  const recipes = baseTypes.map((bt) => pickRecipeForBaseType(bt, rand, { title: args.title, description: args.description }));

  const secs = secondsPlan(args.steps);

  const steps = [];
  steps.push({
    id: 'intro',
    type: 'intro',
    seconds: secs[0],
    title: args.title,
    emoji: args.emoji,
    text: args.description || '1 sentence: what you’ll learn in 60 seconds.',
  });

  for (let i = 0; i < recipes.length; i += 1) {
    steps.push(
      makeRecipeStep({
        idx: i + 1,
        seconds: secs[i + 1],
        recipe: recipes[i],
        moduleTitle: args.title,
        rand,
      })
    );
  }

  steps.push({
    id: 'summary',
    type: 'summary',
    seconds: secs[secs.length - 1],
    title: 'You did it',
    points: [
      '✅ Key takeaway 1',
      '✅ Key takeaway 2',
      '✅ Key takeaway 3',
    ],
    uses: ['🧠', '⚡️', '🛠️', '🎯'],
    congrats: '🎉 Nice work!'
  });

  const topic = {
    id: args.id,
    subject: args.subject,
    title: args.title,
    emoji: args.emoji,
    color,
    description: args.description,
    difficulty: args.difficulty,
    published: Boolean(args.published),
    lesson: {
      version: 1,
      totalSeconds: 60,
      xp: 60,
      steps,
    },
  };

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
  console.log(`✅ Scaffolded topic: ${path.relative(process.cwd(), outPath)}`);
  console.log(`Picked recipes:`);
  for (const r of recipes) console.log(`- ${r.id} [baseType=${r.baseType}]`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
