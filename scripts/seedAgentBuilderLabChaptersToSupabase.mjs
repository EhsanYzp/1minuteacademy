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
  console.log(`[content:seed-abl-chapters] dotenv loaded (${envLabel}): ${loaded.length ? loaded.join(', ') : '(none found)'}`);
  console.log(
    `[content:seed-abl-chapters] env check: ` +
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
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--env') i += 1;
    else if (a === '--help' || a === '-h') {
      console.log(`\nUsage:\n  node scripts/seedAgentBuilderLabChaptersToSupabase.mjs --env staging|production [--dry-run]\n`);
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }
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

  const courseId = 'ai--agent-builder-lab';
  const chapters = [
    { id: `${courseId}--ch01-foundations`, title: 'Foundations', position: 1, description: 'Agent mental models and the thin-slice MVP.' },
    { id: `${courseId}--ch02-prompts-and-tools`, title: 'Prompts & Tools', position: 2, description: 'Constraints, tool contracts, and structured outputs.' },
    { id: `${courseId}--ch03-planning-and-control`, title: 'Planning & Control', position: 3, description: 'Plans, state, retries, stop conditions, and budgets.' },
    { id: `${courseId}--ch04-memory-and-rag`, title: 'Memory & RAG', position: 4, description: 'Context, retrieval, memory writes, and grounding.' },
    { id: `${courseId}--ch05-safety-and-guardrails`, title: 'Safety & Guardrails', position: 5, description: 'Threat modeling, injection, secrets, and response.' },
    { id: `${courseId}--ch06-evaluation`, title: 'Evaluation', position: 6, description: 'Metrics, test sets, rubrics, and drift monitoring.' },
    { id: `${courseId}--ch07-shipping`, title: 'Shipping', position: 7, description: 'Observability, cost/latency, fallbacks, and rollbacks.' },
  ].map((ch) => ({
    ...ch,
    course_id: courseId,
    published: true,
  }));

  console.log(`[content:seed-abl-chapters] course=${courseId} chapters=${chapters.length}`);

  if (args.dryRun) {
    for (const ch of chapters) console.log(`(dry-run) ${ch.id} -> ${ch.title}`);
    return;
  }

  const { error } = await supabase.from('chapters').upsert(chapters, { onConflict: 'id' });
  if (error) throw error;

  console.log('✅ Chapters upserted.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
