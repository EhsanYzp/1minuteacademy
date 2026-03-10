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
  console.log(`[stripe:reset-live] dotenv loaded (${envLabel}): ${loaded.length ? loaded.join(', ') : '(none found)'}`);
  console.log(
    `[stripe:reset-live] env check: ` +
      [
        `SUPABASE_URL=${present('SUPABASE_URL')}`,
        `VITE_SUPABASE_URL=${present('VITE_SUPABASE_URL')}`,
        `SUPABASE_SERVICE_ROLE_KEY=${present('SUPABASE_SERVICE_ROLE_KEY')}`,
        `VITE_SUPABASE_SERVICE_ROLE_KEY=${present('VITE_SUPABASE_SERVICE_ROLE_KEY')}`,
      ].join(' ')
  );
}

const argv = process.argv.slice(2);
const requestedEnv = normalizeEnvName(parseEnvNameFromArgv(argv));
const args = parseArgs(argv);

if (args.help) {
  printHelp();
  process.exit(0);
}

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

function parseArgs(argv2) {
  const out = {
    help: false,
    confirm: false,
    dryRun: true,
    limitUsers: null,
    resetPlan: true,
    clearTables: true,
    clearWebhookEvents: true,
  };

  for (let i = 0; i < argv2.length; i++) {
    const a = argv2[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--confirm') out.confirm = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--no-dry-run') out.dryRun = false;
    else if (a === '--limit-users') {
      const v = argv2[i + 1];
      i++;
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid --limit-users (must be a positive integer)');
      out.limitUsers = Math.floor(n);
    } else if (a === '--no-reset-plan') out.resetPlan = false;
    else if (a === '--no-clear-tables') out.clearTables = false;
    else if (a === '--no-clear-webhook-events') out.clearWebhookEvents = false;
  }

  // Safety: default is dry-run. Only apply changes when --confirm is provided.
  if (out.confirm) out.dryRun = false;

  return out;
}

function printHelp() {
  console.log(
    `\nUsage:\n` +
      `  node scripts/resetStripeForLive.mjs [--env production] [--confirm] [--limit-users N]\n\n` +
      `What it does:\n` +
      `  - Clears Stripe-related tables in Supabase (server-only tables)\n` +
      `    - public.stripe_customers\n` +
      `    - public.stripe_checkout_session_cache\n` +
      `    - public.stripe_webhook_events (optional)\n` +
      `  - Clears Stripe-related fields in Supabase Auth user metadata and resets plan to free\n\n` +
      `Safety:\n` +
      `  - Dry-run by default. Nothing is modified unless you pass --confirm.\n\n` +
      `Options:\n` +
      `  --env production|staging   Load .env.<env>.local in addition to .env/.env.local\n` +
      `  --confirm                 Actually apply changes (implies no dry-run)\n` +
      `  --limit-users N           Only process first N users (for testing)\n` +
      `  --no-reset-plan           Do not change user_metadata.plan (still clears Stripe ids)\n` +
      `  --no-clear-tables         Do not delete from Stripe tables (only user metadata)\n` +
      `  --no-clear-webhook-events Keep stripe_webhook_events (default clears it)\n\n` +
      `Env required (service role only; never VITE_):\n` +
      `  SUPABASE_URL (or VITE_SUPABASE_URL)\n` +
      `  SUPABASE_SERVICE_ROLE_KEY\n`
  );
}

async function countTable(supabase, table, idColumn) {
  const { count, error } = await supabase
    .from(table)
    .select(idColumn, { count: 'exact', head: true });
  if (error) throw error;
  return Number(count ?? 0);
}

async function deleteAllRows(supabase, table, idColumn) {
  // Supabase requires a filter on delete.
  const { error } = await supabase
    .from(table)
    .delete()
    .not(idColumn, 'is', null);
  if (error) throw error;
}

function computeNewUserMetadata(existing, { resetPlan }) {
  const meta = existing && typeof existing === 'object' ? existing : {};
  const next = {
    ...meta,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    plan_interval: null,
  };
  if (resetPlan) next.plan = 'free';
  return next;
}

function needsReset(existing, { resetPlan }) {
  const meta = existing && typeof existing === 'object' ? existing : {};
  const hasStripe =
    meta.stripe_customer_id != null ||
    meta.stripe_subscription_id != null ||
    meta.stripe_price_id != null ||
    meta.plan_interval != null;

  const planNeeds = resetPlan && meta.plan === 'pro';
  return Boolean(hasStripe || planNeeds);
}

async function listAllUsers(supabase, { limitUsers }) {
  const users = [];
  let page = 1;
  const perPage = 200;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const batch = data?.users ?? [];
    if (batch.length === 0) break;

    for (const u of batch) {
      users.push(u);
      if (limitUsers && users.length >= limitUsers) return users;
    }

    page += 1;
  }

  return users;
}

async function main() {
  forbidEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');

  const supabaseUrl = requiredEnvAny(['SUPABASE_URL', 'VITE_SUPABASE_URL']);
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tables = [
    { name: 'stripe_customers', idColumn: 'customer_id' },
    { name: 'stripe_checkout_session_cache', idColumn: 'cache_key' },
    ...(args.clearWebhookEvents ? [{ name: 'stripe_webhook_events', idColumn: 'event_id' }] : []),
  ];

  console.log(`\n[stripe:reset-live] mode: ${args.dryRun ? 'DRY-RUN' : 'APPLY'}\n`);

  if (args.clearTables) {
    console.log('[stripe:reset-live] Table counts (before):');
    for (const t of tables) {
      const n = await countTable(supabase, t.name, t.idColumn);
      console.log(`  - public.${t.name}: ${n}`);
    }
  } else {
    console.log('[stripe:reset-live] Skipping table cleanup (--no-clear-tables).');
  }

  const allUsers = await listAllUsers(supabase, { limitUsers: args.limitUsers });
  const candidates = allUsers.filter((u) => needsReset(u?.user_metadata, { resetPlan: args.resetPlan }));

  console.log(`\n[stripe:reset-live] Users: ${allUsers.length} total; ${candidates.length} need reset`);

  if (args.dryRun) {
    console.log('\n[stripe:reset-live] Dry-run: no changes applied.');
    console.log('[stripe:reset-live] Next step: run again with --confirm');
    return;
  }

  if (args.clearTables) {
    console.log('\n[stripe:reset-live] Deleting rows from Stripe tables...');
    for (const t of tables) {
      await deleteAllRows(supabase, t.name, t.idColumn);
      console.log(`  - cleared public.${t.name}`);
    }
  }

  console.log('\n[stripe:reset-live] Resetting user metadata...');
  let updated = 0;
  for (const u of candidates) {
    const nextMeta = computeNewUserMetadata(u.user_metadata, { resetPlan: args.resetPlan });
    const { error } = await supabase.auth.admin.updateUserById(u.id, {
      user_metadata: nextMeta,
    });
    if (error) throw error;
    updated += 1;
  }

  console.log(`\n[stripe:reset-live] Done. Updated ${updated} user(s).`);

  if (args.clearTables) {
    console.log('\n[stripe:reset-live] Table counts (after):');
    for (const t of tables) {
      const n = await countTable(supabase, t.name, t.idColumn);
      console.log(`  - public.${t.name}: ${n}`);
    }
  }
}

main().catch((err) => {
  console.error('\n[stripe:reset-live] ERROR:', err?.message || err);
  process.exitCode = 1;
});
