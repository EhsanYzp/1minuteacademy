#!/usr/bin/env node
/**
 * _shortenBeats.mjs
 *
 * Validation-phase helper: tries to rewrite over-length beats down to the
 * validation tolerance (default 130/90), without mechanical truncation.
 *
 * Important:
 * - This script will NOT add ellipses or hard-truncate.
 * - It may be unable to fix some beats; those require manual rewrite.
 *
 * Usage:
 *   node scripts/_shortenBeats.mjs [--write] [--plans-prefix investing--] [--strict]
 *
 * Options:
 *   --write                 Actually modify files (default: dry-run)
 *   --plans-prefix <pref>   Only process course plan filenames that start with <pref>
 *   --strict                Target generation limits (120/80) instead of validation tolerance (130/90)
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { argv } from 'node:process';

const ROOT = resolve(import.meta.dirname, '..');

import { GENERATION_LIMITS, VALIDATION_TOLERANCE } from './_beatLimits.mjs';

function argValue(flag) {
  const i = argv.indexOf(flag);
  if (i === -1) return null;
  const v = argv[i + 1];
  if (!v || v.startsWith('--')) throw new Error(`Missing value for ${flag}`);
  return v;
}

const strict = argv.includes('--strict');
const plansPrefix = argValue('--plans-prefix');

const LIMITS = strict ? GENERATION_LIMITS : VALIDATION_TOLERANCE;
const BEAT_TEXT_MAX = LIMITS.beat;
const PUNCHLINE_TEXT_MAX = LIMITS.punchline;
const BEATS = ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline'];

const write = argv.includes('--write');

/* ── helpers ──────────────────────────────────────────────────────── */

const VALID_ENDINGS = new Set([
  '.', '!', '?', ')', "'", '"', ':', ';',
  '\u2019',
  '\u201D',
]);

function splitEndingPunctuation(s) {
  const t = String(s ?? '').trim();
  if (!t) return { core: '', ending: '.' };
  const last = t[t.length - 1];
  if (VALID_ENDINGS.has(last)) return { core: t.slice(0, -1).trim(), ending: last };
  return { core: t, ending: '.' };
}

function ensureEndingPunctuation(s, preferredEnding = '.') {
  const t = String(s ?? '').trim();
  if (!t) return t;
  const last = t[t.length - 1];
  if (VALID_ENDINGS.has(last)) return t;
  return `${t}${preferredEnding}`;
}

function containsEllipsis(text) {
  const t = String(text ?? '');
  return t.includes('\u2026') || t.includes('...');
}

/** Try to shorten text to maxLen using safe transforms (no truncation/ellipsis). */
function shorten(text, maxLen) {
  if (typeof text !== 'string') return text;
  const original = text.trim();
  if (original.length <= maxLen) return ensureEndingPunctuation(original);
  if (containsEllipsis(original)) return original; // don't touch; likely already "truncated".

  const { core: originalCore, ending } = splitEndingPunctuation(original);
  let core = originalCore;

  // 2. Replace common long phrases with shorter equivalents
  const replacements = [
    [/\bapproximately\b/gi, 'about'],
    [/\bhowever\b/gi, 'but'],
    [/\btherefore\b/gi, 'so'],
    [/\bnevertheless\b/gi, 'yet'],
    [/\bfurthermore\b/gi, 'also'],
    [/\badditionally\b/gi, 'also'],
    [/\bin order to\b/gi, 'to'],
    [/\bdue to the fact that\b/gi, 'because'],
    [/\bat this point in time\b/gi, 'now'],
    [/\bthat being said\b/gi, 'still'],
    [/\bin the event that\b/gi, 'if'],
    [/\bfor the purpose of\b/gi, 'to'],
    [/\bin spite of\b/gi, 'despite'],
    [/\bas a result of\b/gi, 'from'],
    [/\bwith regard to\b/gi, 'about'],
    [/\bin conjunction with\b/gi, 'with'],
    [/\bthe majority of\b/gi, 'most'],
    [/\ba large number of\b/gi, 'many'],
    [/\ba small number of\b/gi, 'few'],
    [/\buntil such time as\b/gi, 'until'],
    [/\bit is important to note that\b/gi, ''],
    [/\bit is worth noting that\b/gi, ''],
    [/\bit turns out that\b/gi, ''],
    [/\bas a matter of fact\b/gi, 'indeed'],
    [/\bon the other hand\b/gi, 'but'],
    [/\bthroughout the\b/gi, 'across the'],
    [/\bthroughout history\b/gi, 'historically'],
    [/\bcompletely\b/gi, 'fully'],
    [/\bimmediately\b/gi, 'at once'],
    [/\bsignificantly\b/gi, 'greatly'],
    [/\bunfortunately\b/gi, 'sadly'],
    [/\bnevertheless\b/gi, 'still'],
    [/\bsubsequently\b/gi, 'then'],
    [/\bultimately\b/gi, 'in the end'],
    [/\bconsiderably\b/gi, 'much'],
    [/\boccasionally\b/gi, 'sometimes'],
    [/\bfrequently\b/gi, 'often'],
    [/\bnumerous\b/gi, 'many'],
    [/\butilize\b/gi, 'use'],
    [/\butilized\b/gi, 'used'],
    [/\butilization\b/gi, 'use'],
    [/\bdemonstrate\b/gi, 'show'],
    [/\bdemonstrated\b/gi, 'showed'],
    [/\bdemonstrates\b/gi, 'shows'],
    [/\bpurchase\b/gi, 'buy'],
    [/\bpurchased\b/gi, 'bought'],
    [/\brequirement\b/gi, 'need'],
    [/\brequirements\b/gi, 'needs'],
    [/\bcommence\b/gi, 'start'],
    [/\bterminate\b/gi, 'end'],
    [/\bascertain\b/gi, 'find'],
    [/\bendeavor\b/gi, 'try'],
    [/\btransformation\b/gi, 'change'],
    [/\btransformed\b/gi, 'changed'],
    [/\bmanufactured\b/gi, 'made'],
    [/\bmanufacturing\b/gi, 'making'],
    [/\bconstruction\b/gi, 'building'],
    [/\s+—\s+/g, '—'],
    [/\s+–\s+/g, '–'],
    [/\bthat is\b/gi, 'i.e.'],
    [/\bfor example\b/gi, 'e.g.'],
    [/\band also\b/gi, 'and'],
    [/\bbut also\b/gi, 'and'],
    [/\bin addition\b/gi, 'also'],
    [/\bin fact\b/gi, ''],
    [/\bvery much\b/gi, 'greatly'],
    [/\bquite a\b/gi, 'a'],
    [/\breally\b/gi, ''],
    [/\bvery\b/gi, ''],
    [/\bjust\b/gi, ''],
    [/\bactually\b/gi, ''],
    [/\bbasically\b/gi, ''],
    [/\bessentially\b/gi, ''],
    [/\bliterally\b/gi, ''],
  ];

  for (const [rx, rep] of replacements) {
    core = core.replace(rx, rep);
    // Collapse any resulting double spaces
    core = core.replace(/  +/g, ' ').trim();
    const candidate = ensureEndingPunctuation(core, ending);
    if (candidate.length <= maxLen) return candidate;
  }

  // 3. Remove parenthetical asides
  core = core.replace(/\s*\([^)]+\)\s*/g, ' ').replace(/  +/g, ' ').trim();
  {
    const candidate = ensureEndingPunctuation(core, ending);
    if (candidate.length <= maxLen) return candidate;
  }

  // 4. Remove leading "And " / "But " / "So " / "Yet "
  core = core.replace(/^(And|But|So|Yet|Now|Then|Still)\s+/i, '');
  {
    const candidate = ensureEndingPunctuation(core, ending);
    if (candidate.length <= maxLen) return candidate;
  }

  // 5. Remove subordinate clause after last comma if that helps
  const lastComma = core.lastIndexOf(', ');
  if (lastComma > 20) {
    const shortenedCore = core.slice(0, lastComma).trim();
    const candidate = ensureEndingPunctuation(shortenedCore, ending);
    if (candidate.length <= maxLen && candidate.length >= maxLen * 0.6) return candidate;
  }

  // 6. If multiple clauses separated by em-dash/colon/semicolon, keep the first clause.
  for (const sep of ['—', ':', ';']) {
    const i = core.indexOf(sep);
    if (i > 20) {
      const shortenedCore = core.slice(0, i).trim();
      const candidate = ensureEndingPunctuation(shortenedCore, ending);
      if (candidate.length <= maxLen && candidate.length >= maxLen * 0.6) return candidate;
    }
  }

  // 7. If the text contains multiple sentences, keep the first full sentence.
  const withEnding = ensureEndingPunctuation(core, ending);
  const sentences = withEnding.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 1) {
    const first = sentences[0].trim();
    if (first.length <= maxLen && first.length >= maxLen * 0.5) return first;
  }

  // Could not safely shorten.
  return ensureEndingPunctuation(original, ending);
}

/* ── main ─────────────────────────────────────────────────────────── */

if (argv.includes('--help') || argv.includes('-h')) {
  console.log(
    `\nUsage:\n  node scripts/_shortenBeats.mjs [--write] [--plans-prefix <prefix>] [--strict]\n\nDefault limits (validation tolerance): ${VALIDATION_TOLERANCE.beat}/${VALIDATION_TOLERANCE.punchline}\nStrict limits (generation): ${GENERATION_LIMITS.beat}/${GENERATION_LIMITS.punchline}\n\nExamples:\n  node scripts/_shortenBeats.mjs --plans-prefix investing--\n  node scripts/_shortenBeats.mjs --plans-prefix investing-- --write\n  node scripts/_shortenBeats.mjs --plans-prefix investing-- --strict --write\n`
  );
  process.exit(0);
}

const dir = resolve(ROOT, 'content/course-plans');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .filter((f) => (plansPrefix ? f.startsWith(plansPrefix) : true))
  .map((f) => resolve(dir, f));

let totalFixed = 0;
let totalViolations = 0;

for (const file of files) {
  const plan = JSON.parse(readFileSync(file, 'utf8'));
  let fileFixed = 0;

  for (const topic of plan.topics) {
    if (!topic.story) continue;
    for (const beat of BEATS) {
      const obj = topic.story[beat];
      if (!obj || !obj.text) continue;
      const maxLen = beat === 'punchline' ? PUNCHLINE_TEXT_MAX : BEAT_TEXT_MAX;
      if (obj.text.length > maxLen) {
        totalViolations++;
        const shortened = shorten(obj.text, maxLen);
        if (shortened.length <= maxLen) {
          obj.text = shortened;
          fileFixed++;
        } else {
          console.warn(
            `⚠ STILL TOO LONG (${shortened.length}/${maxLen}): ` +
            `${basename(file)} → ${topic.id} → ${beat}: "${shortened}"`
          );
        }
      }
    }
  }

  if (fileFixed > 0) {
    totalFixed += fileFixed;
    if (write) {
      writeFileSync(file, JSON.stringify(plan, null, 2) + '\n', 'utf8');
      console.log(`✅ ${basename(file)}: fixed ${fileFixed} beats (written)`);
    } else {
      console.log(`🔍 ${basename(file)}: would fix ${fileFixed} beats (dry-run)`);
    }
  }
}

console.log(`\nTotal violations: ${totalViolations}, Fixed: ${totalFixed}, Remaining: ${totalViolations - totalFixed}`);
if (!write) console.log('Re-run with --write to apply changes.');
