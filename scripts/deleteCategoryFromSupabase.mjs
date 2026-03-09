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
  console.log(`[content:delete-category] dotenv loaded (${envLabel}): ${loaded.length ? loaded.join(', ') : '(none found)'}`);
  console.log(
    `[content:delete-category] env check: ` +
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
    id: 'astronomy-space',
    dryRun: false,
    force: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--id') {
      const v = argv[i + 1];
      i++;
      if (!v || v.startsWith('--')) throw new Error('Missing value for --id');
      args.id = String(v).trim();
    } else if (a === '--env') {
      i += 1; // handled earlier
    } else if (a === '--help' || a === '-h') {
      console.log(
        `\nUsage:\n  node scripts/deleteCategoryFromSupabase.mjs [--env staging|production] [--id <categoryId>] [--dry-run] [--force]\n\nDefaults:\n- --id astronomy-space\n\nSafety:\n- Refuses to delete if courses exist for the category, unless --force is provided.\n\nEnv:\n- Requires SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY\n`
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }

  if (!args.id) throw new Error('Category id missing');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  forbidEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = requiredEnvAny(['SUPABASE_URL', 'VITE_SUPABASE_URL']);
  const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const id = String(args.id).trim();
  console.log(`[content:delete-category] target id: ${id}`);

  const [{ data: catRows, error: catErr }, { count: courseCount, error: courseErr }] = await Promise.all([
    supabase.from('categories').select('id, title').eq('id', id).limit(1),
    supabase.from('courses').select('id', { count: 'exact', head: true }).eq('category_id', id),
  ]);

  if (catErr) throw catErr;
  if (courseErr) throw courseErr;

  const exists = Array.isArray(catRows) && catRows.length > 0;
  if (!exists) {
    console.log('[content:delete-category] category not found; nothing to do.');
    return;
  }

  const title = String(catRows[0]?.title ?? '').trim();
  const nCourses = typeof courseCount === 'number' ? courseCount : 0;
  console.log(`[content:delete-category] found category: ${title || '(no title)'} (courses: ${nCourses})`);

  if (nCourses > 0 && !args.force) {
    throw new Error(`Refusing to delete: category has ${nCourses} course(s). Re-run with --force if you're sure.`);
  }

  if (args.dryRun) {
    console.log('[content:delete-category] dry-run: no changes written.');
    return;
  }

  const { error: delErr } = await supabase.from('categories').delete().eq('id', id);
  if (delErr) throw delErr;

  console.log('[content:delete-category] ✅ deleted');
  console.log('Next: hard refresh /categories (cache TTL ~5m)');
}

main().catch((e) => {
  console.error(`[content:delete-category] ERROR: ${e?.message ?? e}`);
  process.exit(1);
});
