#!/usr/bin/env node
/**
 * _fixBrokenBeats.mjs
 *
 * Fixes beats flagged as genuinely broken by the audit:
 *   1. dangling-conjunction: list cut off at ", and." / ", or." etc.
 *   2. too-short broken beats: "Satisficing vs." and "Ross et al."
 *
 * Updates BOTH the topic .topic.json files AND the corresponding course-plan JSON.
 *
 * Usage:
 *   node scripts/_fixBrokenBeats.mjs            # dry-run (prints changes)
 *   node scripts/_fixBrokenBeats.mjs --write     # writes changes to disk
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TOPICS_DIR = path.join(ROOT, 'content', 'topics');
const PLANS_DIR = path.join(ROOT, 'content', 'course-plans');
const WRITE = process.argv.includes('--write');

const BEAT_NAMES = ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline'];
const BEAT_MAX = { hook: 130, buildup: 130, discovery: 130, twist: 130, climax: 130, punchline: 90 };

/* ── Helpers ──────────────────────────────────────────────────────── */

async function listFiles(dir, predicate) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFiles(full, predicate)));
    else if (e.isFile() && predicate(e.name)) out.push(full);
  }
  return out;
}

async function readJson(fp) { return JSON.parse(await fs.readFile(fp, 'utf8')); }

async function writeJson(fp, data) {
  await fs.writeFile(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/* ── Manual overrides for too-short / badly broken beats ─────────── */

const MANUAL_OVERRIDES = new Map([
  // "Satisficing vs." → complete the explanation
  [
    't-the-art-of-good-enough-when-to-stop-deciding',
    {
      buildup: "Satisficing vs. maximizing: satisficers pick the first option that meets their criteria. Maximizers exhaust every option.",
    },
  ],
  // "Ross et al." → complete the citation/explanation
  [
    't-belief-perseverance-clinging-to-debunked-ideas',
    {
      discovery: "Ross, Lepper, and Hubbard showed that even full debriefing barely dents the false belief. The brain invents new reasons.",
    },
  ],
]);

/* ── Fix dangling conjunctions ───────────────────────────────────── */

/**
 * Fix text that ends with ", and." / ", or." / ", but." / ", nor." / ", so."
 *
 * Strategy:
 *   1. If appending " more" fits within the limit → ", and more."
 *   2. Otherwise, drop the final ", conjunction." → end at the last real item.
 */
function fixDanglingConjunction(text, beatName) {
  const max = BEAT_MAX[beatName];

  // Match trailing ", conjunction." (with optional smart-quotes / periods)
  const m = text.match(/^(.*),\s*(and|or|nor|but|so)\s*([.!?;:]+)\s*$/i);
  if (!m) return null;

  const [, prefix, conj, punct] = m;

  // Strategy 1: append " more" after the conjunction
  const withMore = `${prefix}, ${conj.toLowerCase()} more${punct}`;
  if (withMore.length <= max) return withMore;

  // Strategy 2: just drop the dangling conjunction — end at the last item
  const trimmed = prefix.trimEnd();
  const lastChar = trimmed[trimmed.length - 1];
  if (/[.!?;:)'"\u2019\u201D]/.test(lastChar)) {
    return trimmed;
  }
  return trimmed + punct[0];
}

/* ── Main ────────────────────────────────────────────────────────── */

async function main() {
  const topicFiles = await listFiles(TOPICS_DIR, n => n.endsWith('.topic.json'));
  topicFiles.sort();

  // Pre-load all course plans indexed by topic slug
  const planFiles = await listFiles(PLANS_DIR, n => n.endsWith('.json'));
  const plansByTopic = new Map();
  const planCache = new Map();

  for (const pf of planFiles) {
    const plan = await readJson(pf);
    planCache.set(pf, plan);
    for (let i = 0; i < (plan.topics ?? []).length; i++) {
      const t = plan.topics[i];
      if (t.slug) plansByTopic.set(t.slug, { planFile: pf, topicIndex: i });
    }
  }

  let fixedCount = 0;
  const dirtyPlans = new Set();
  const changes = [];

  for (const file of topicFiles) {
    let data;
    try { data = await readJson(file); } catch { continue; }
    if (!data.story) continue;

    const slug = data.slug ?? path.basename(file, '.topic.json');
    let fileChanged = false;

    // Check for manual overrides (match on end of slug)
    for (const [overrideSuffix, overrides] of MANUAL_OVERRIDES) {
      if (slug.endsWith(overrideSuffix)) {
        for (const [beat, newText] of Object.entries(overrides)) {
          const oldText = data.story[beat]?.text ?? '';
          if (oldText !== newText) {
            changes.push({ file: path.relative(ROOT, file), beat, oldText, newText });
            data.story[beat].text = newText;
            fileChanged = true;
            fixedCount++;
          }
        }
      }
    }

    // Check for dangling conjunctions in all beats
    for (const beat of BEAT_NAMES) {
      const node = data.story[beat];
      if (!node?.text) continue;
      const text = node.text.trim();

      if (!/,\s*(and|or|nor|but|so)\s*[.!?;:]+\s*$/i.test(text)) continue;

      const fixed = fixDanglingConjunction(text, beat);
      if (fixed && fixed !== text) {
        changes.push({ file: path.relative(ROOT, file), beat, oldText: text, newText: fixed });
        data.story[beat].text = fixed;
        fileChanged = true;
        fixedCount++;
      }
    }

    if (!fileChanged) continue;

    if (WRITE) await writeJson(file, data);

    // Update corresponding course plan
    const planEntry = plansByTopic.get(data.slug ?? slug);
    if (planEntry) {
      const plan = planCache.get(planEntry.planFile);
      const planTopic = plan.topics[planEntry.topicIndex];
      if (planTopic?.story) {
        for (const beat of BEAT_NAMES) {
          if (data.story[beat]?.text) {
            if (planTopic.story[beat]) {
              planTopic.story[beat].text = data.story[beat].text;
            }
          }
        }
        dirtyPlans.add(planEntry.planFile);
      }
    }
  }

  // Write dirty course plans
  if (WRITE) {
    for (const pf of dirtyPlans) {
      await writeJson(pf, planCache.get(pf));
    }
  }

  // Report
  console.log(`\n${ WRITE ? '✅ WRITTEN' : '🔍 DRY-RUN'}: ${fixedCount} beat(s) fixed.`);
  if (dirtyPlans.size > 0) {
    console.log(`   ${WRITE ? 'Updated' : 'Would update'} ${dirtyPlans.size} course-plan file(s).`);
  }
  console.log('');

  for (const c of changes) {
    console.log(`  ${c.file}`);
    console.log(`    ${c.beat}:`);
    console.log(`      OLD (${c.oldText.length}): "${c.oldText}"`);
    console.log(`      NEW (${c.newText.length}): "${c.newText}"`);
    console.log('');
  }

  if (!WRITE && fixedCount > 0) {
    console.log('Run with --write to apply changes.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
