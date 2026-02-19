import fs from 'node:fs/promises';
import path from 'node:path';
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
  console.log(`[content:seed-categories] dotenv loaded (${envLabel}): ${loaded.length ? loaded.join(', ') : '(none found)'}`);
  console.log(
    `[content:seed-categories] env check: ` +
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

function parseArgs(argv) {
  const args = {
    dryRun: false,
    forceUpdate: false,
    // Deprecated: catalog.json is retired.
    noLocalCatalog: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force-update') args.forceUpdate = true;
    else if (a === '--no-local-catalog') args.noLocalCatalog = true;
    else if (a === '--env') i += 1; // handled earlier
    else if (a === '--help' || a === '-h') {
      console.log(`\nUsage:\n  node scripts/seedCategoriesToSupabase.mjs [--env staging|production] [--dry-run] [--force-update]\n\nNotes:\n- By default, only inserts missing categories (won't overwrite existing rows).\n- --force-update will upsert and may overwrite title/description/color/emoji for existing ids.\n- Local catalog mirroring is retired; this script only writes to Supabase.\n`);
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }

  return args;
}

const CATEGORY_TITLES = [
  'Personal Finance',
  'Investing',
  'Real Estate',
  'Entrepreneurship',
  'Business',
  'Leadership',
  'Management',
  'Sales',
  'Marketing',
  'Negotiation',

  'Career',
  'Communication',
  'Productivity',
  'Learning',
  'Writing',
  'Public Speaking',
  'Creativity',
  'Critical Thinking',
  'Psychology',
  'Mental Health',

  'Relationships',
  'Parenting',
  'Education',
  'Philosophy',
  'History',
  'Politics',
  'Economics',
  'Law',
  'Ethics',
  'Religion & Spirituality',

  'Physical Fitness',
  'Nutrition',
  'Sleep',
  'Medicine',
  'Sexual Health',
  'Self-Care',
  'Cooking',
  'Home & DIY',
  'Gardening',
  'Travel',

  'Art',
  'Music',
  'Photography',
  'Design',
  'Fashion',
  'Technology',
  'Programming',
  'Data',
  'AI',
  'Cybersecurity',
];

function slugifyCategoryId(title) {
  return String(title ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
}

function hashToInt(str) {
  const s = String(str ?? '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickColor(id) {
  const palette = [
    '#2563EB', // blue
    '#4ECDC4', // teal
    '#7C3AED', // violet
    '#F97316', // orange
    '#10B981', // green
    '#EF4444', // red
    '#0EA5E9', // sky
    '#F59E0B', // amber
    '#22C55E', // emerald
    '#A855F7', // purple
  ];
  const n = hashToInt(id);
  return palette[n % palette.length];
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  forbidEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = requiredEnvAny(['SUPABASE_URL', 'VITE_SUPABASE_URL']);
  const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  const desired = CATEGORY_TITLES.map((title) => {
    const id = slugifyCategoryId(title);
    return {
      id,
      title,
      emoji: null,
      color: pickColor(id),
      description: `Explore 1-minute lessons in ${title}.`,
      published: true,
    };
  });

  const ids = desired.map((c) => c.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Duplicate category ids detected after slugify. Please adjust titles.');
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let existingIds = new Set();
  try {
    const { data, error } = await supabase.from('categories').select('id').in('id', ids);
    if (error) throw error;
    existingIds = new Set((Array.isArray(data) ? data : []).map((r) => String(r?.id ?? '')));
  } catch {
    // If select fails for any reason, fall back to upsert mode.
    existingIds = new Set();
  }

  const toWrite = args.forceUpdate ? desired : desired.filter((c) => !existingIds.has(c.id));

  console.log(
    `[content:seed-categories] desired=${desired.length} existing=${existingIds.size} willWrite=${toWrite.length} mode=${args.forceUpdate ? 'upsert' : 'insert-missing'}`
  );

  if (args.dryRun) {
    for (const c of toWrite) {
      console.log(`(dry-run) ${c.id} -> ${c.title}`);
    }
  } else if (toWrite.length > 0) {
    if (args.forceUpdate) {
      const { error } = await supabase.from('categories').upsert(toWrite, { onConflict: 'id' });
      if (error) throw error;
    } else {
      const { error } = await supabase.from('categories').insert(toWrite);
      if (error) throw error;
    }
    console.log(`✅ Wrote ${toWrite.length} category row(s) to Supabase.`);
  } else {
    console.log('✅ No Supabase writes needed (all categories already exist).');
  }

  console.log('\nNext: refresh /categories (cache TTL ~5m) or hard refresh to see new categories.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
