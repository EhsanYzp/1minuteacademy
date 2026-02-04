import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { TOPICS_DIR } from './_contentPaths.mjs';

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
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

async function main() {
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

  const rows = [];
  for (const file of files) {
    const t = await readJson(file);
    rows.push({
      id: t.id,
      subject: t.subject,
      title: t.title,
      emoji: t.emoji,
      color: t.color,
      description: t.description,
      difficulty: t.difficulty,
      lesson: t.lesson,
      published: Boolean(t.published),
    });
  }

  const { error } = await supabase.from('topics').upsert(rows, { onConflict: 'id' });
  if (error) throw error;

  console.log(`✅ Synced ${rows.length} topic(s) to Supabase.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
