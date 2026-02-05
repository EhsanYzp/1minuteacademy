import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { TOPICS_DIR } from './_contentPaths.mjs';
import dotenv from 'dotenv';

// Node scripts do not automatically load Vite env files.
// Load local developer secrets for sync (gitignored).
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

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

async function listTopicFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listTopicFiles(full)));
    else if (entry.isFile() && entry.name.endsWith('.topic.json')) out.push(full);
  }
  return out;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function parseArgs(argv) {
  const args = { topics: null, dryRun: false, force: false, insertOnly: false };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--insert-only') args.insertOnly = true;
    else if (a === '--topic') {
      const v = argv[i + 1];
      if (!v || v.startsWith('--')) throw new Error('Missing value for --topic <topicId[,topicId2,...]>.');
      i++;
      args.topics = v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (args.topics.length === 0) throw new Error('Empty --topic list.');
    } else if (a === '--help' || a === '-h') {
      console.log(`\nUsage: npm run content:sync -- [--topic <id[,id2]>] [--dry-run] [--force] [--insert-only]\n\nDefaults:\n- Inserts new topics\n- Updates existing topics when:\n  - local lesson.version > remote lesson.version, OR\n  - local journey differs from remote journey\n\nFlags:\n- --topic <id[,id2]>   Sync only specific topic IDs\n- --dry-run            Print what would change; write nothing\n- --force              Update even if version isn't higher\n- --insert-only        Only insert new topics; never update existing\n\nTip: Bump lesson.version in your local JSON to intentionally publish changes.\n`);
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }

  if (args.force && args.insertOnly) {
    throw new Error('Invalid flags: --force and --insert-only cannot be used together.');
  }

  return args;
}

function getLessonVersion(lesson) {
  const raw = lesson && typeof lesson === 'object' ? lesson.version : undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function stableStringify(value) {
  const seen = new WeakSet();

  function normalize(v) {
    if (v === null) return null;
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') return v;
    if (t !== 'object') return null;

    if (seen.has(v)) throw new Error('Cannot stableStringify circular structure.');
    seen.add(v);

    if (Array.isArray(v)) return v.map(normalize);

    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = normalize(v[k]);
    return out;
  }

  return JSON.stringify(normalize(value));
}

function journeysEqual(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return stableStringify(a) === stableStringify(b);
}

async function main() {
  // Guardrails: prevent accidentally leaking the service role key to the frontend
  forbidEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');

  const args = parseArgs(process.argv.slice(2));

  const url = requiredEnv('VITE_SUPABASE_URL');

  // IMPORTANT: use service role for bulk upserts in scripts (never expose in the browser)
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const files = await listTopicFiles(TOPICS_DIR);
  if (files.length === 0) {
    console.log('No .topic.json files found under content/topics/.');
    process.exit(0);
  }

  const localById = new Map();
  for (const file of files) {
    const t = await readJson(file);
    // Build the lesson object from story + quiz if lesson is not provided directly
    let lesson = t.lesson;
    if (!lesson && (t.story || t.quiz)) {
      lesson = {
        version: t.version ?? 1,
        story: t.story,
        quiz: t.quiz,
      };
    }
    const row = {
      id: t.id,
      subject: t.subject,
      title: t.title,
      emoji: t.emoji,
      color: t.color,
      description: t.description,
      difficulty: t.difficulty,
      lesson: lesson,
      journey: t.journey ?? null,
      published: Boolean(t.published),
    };
    if (!row.id) throw new Error(`Missing required field 'id' in ${file}`);
    if (!row.lesson) throw new Error(`Missing 'lesson' or 'story'+'quiz' in ${file}`);
    localById.set(row.id, row);
  }

  if (args.topics) {
    const missing = args.topics.filter((id) => !localById.has(id));
    if (missing.length > 0) {
      throw new Error(`--topic not found in content/topics/: ${missing.join(', ')}`);
    }
    for (const id of Array.from(localById.keys())) {
      if (!args.topics.includes(id)) localById.delete(id);
    }
  }

  const ids = Array.from(localById.keys()).sort();
  if (ids.length === 0) {
    console.log('No topics to sync.');
    process.exit(0);
  }

  // Fetch remote versions to prevent accidental overwrites.
  const remoteById = new Map();
  const { data: remoteRows, error: remoteErr } = await supabase
    .from('topics')
    .select('id, lesson, journey')
    .in('id', ids);

  if (remoteErr) throw remoteErr;
  for (const r of remoteRows ?? []) remoteById.set(r.id, r);

  const toInsert = [];
  const toUpdate = [];
  const skipped = [];

  for (const id of ids) {
    const local = localById.get(id);
    const remote = remoteById.get(id);

    if (!remote) {
      toInsert.push(local);
      continue;
    }

    if (args.insertOnly) {
      skipped.push({ id, reason: 'exists (insert-only)' });
      continue;
    }

    const lv = getLessonVersion(local.lesson);
    const rv = getLessonVersion(remote.lesson);

    const journeyChanged = !journeysEqual(local.journey ?? null, remote.journey ?? null);

    if (args.force) {
      toUpdate.push(local);
      continue;
    }

    if (lv > rv) {
      toUpdate.push(local);
    } else if (journeyChanged) {
      toUpdate.push(local);
    } else {
      skipped.push({
        id,
        reason: `no changes (version ${lv} <= ${rv}, journey unchanged)`,
      });
    }
  }

  const summaryLines = [];
  summaryLines.push(`Topics considered: ${ids.length}`);
  summaryLines.push(`Will insert: ${toInsert.length}`);
  summaryLines.push(`Will update: ${toUpdate.length}${args.force ? ' (forced)' : ''}`);
  summaryLines.push(`Will skip: ${skipped.length}`);
  console.log(summaryLines.join('\n'));

  if (skipped.length > 0) {
    const show = skipped.slice(0, 8);
    console.log('\nSkipped:');
    for (const s of show) console.log(`- ${s.id}: ${s.reason}`);
    if (skipped.length > show.length) console.log(`- …and ${skipped.length - show.length} more`);
  }

  if (args.dryRun) {
    console.log('\n🧪 Dry run: no changes written.');
    return;
  }

  if (toInsert.length === 0 && toUpdate.length === 0) {
    console.log('\nNo changes to apply.');
    return;
  }

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from('topics').insert(toInsert);
    if (insErr) throw insErr;
  }

  if (toUpdate.length > 0) {
    const { error: updErr } = await supabase.from('topics').upsert(toUpdate, { onConflict: 'id' });
    if (updErr) throw updErr;
  }

  console.log(`\n✅ Synced ${toInsert.length + toUpdate.length} topic(s) to Supabase.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
