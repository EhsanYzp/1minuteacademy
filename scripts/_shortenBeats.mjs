#!/usr/bin/env node
/**
 * _shortenBeats.mjs
 *
 * Automatically shortens beat texts that exceed the character limits
 * enforced by generateCourseTopicJsons.mjs.
 *
 * Limits:
 *   hook / buildup / discovery / twist / climax  ≤ 120 chars
 *   punchline                                     ≤  80 chars
 *
 * Usage:
 *   node scripts/_shortenBeats.mjs [--write]
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { argv } from 'node:process';

const ROOT = resolve(import.meta.dirname, '..');

const BEAT_TEXT_MAX = 120;
const PUNCHLINE_TEXT_MAX = 80;
const BEATS = ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline'];

const write = argv.includes('--write');

/* ── helpers ──────────────────────────────────────────────────────── */

/** Apply a series of shortening transforms until text fits maxLen. */
function shorten(text, maxLen) {
  if (text.length <= maxLen) return text;

  let t = text;

  // 1. Remove trailing period (saves 1 char, acceptable for beats)
  t = t.replace(/\.\s*$/, '');
  if (t.length <= maxLen) return t;

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
    [/ — /g, '—'],
    [/ – /g, '–'],
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
    t = t.replace(rx, rep);
    // Collapse any resulting double spaces
    t = t.replace(/  +/g, ' ').trim();
    if (t.length <= maxLen) return t;
  }

  // 3. Remove parenthetical asides
  t = t.replace(/\s*\([^)]+\)\s*/g, ' ').replace(/  +/g, ' ').trim();
  if (t.length <= maxLen) return t;

  // 4. Remove leading "And " / "But " / "So " / "Yet "
  t = t.replace(/^(And|But|So|Yet|Now|Then|Still)\s+/i, '');
  if (t.length <= maxLen) return t;

  // 5. Remove subordinate clause after last comma if that helps
  const lastComma = t.lastIndexOf(', ');
  if (lastComma > 20) {
    const candidate = t.slice(0, lastComma);
    if (candidate.length <= maxLen && candidate.length >= maxLen * 0.6) {
      return candidate;
    }
  }

  // 6. Truncate at last sentence boundary that fits
  const sentences = t.split(/(?<=[.!?])\s+/);
  if (sentences.length > 1) {
    let acc = '';
    for (const s of sentences) {
      if ((acc + (acc ? ' ' : '') + s).length <= maxLen) {
        acc = acc ? acc + ' ' + s : s;
      } else break;
    }
    if (acc.length >= maxLen * 0.5) return acc;
  }

  // 7. Hard truncate at word boundary + ellipsis
  if (t.length > maxLen) {
    const cut = t.slice(0, maxLen - 1);
    const lastSpace = cut.lastIndexOf(' ');
    if (lastSpace > maxLen * 0.5) {
      t = cut.slice(0, lastSpace) + '…';
    } else {
      t = cut + '…';
    }
  }

  return t;
}

/* ── main ─────────────────────────────────────────────────────────── */

const dir = resolve(ROOT, 'content/course-plans');
const files = readdirSync(dir)
  .filter(f => f.startsWith('home-diy--') && f.endsWith('.json'))
  .map(f => resolve(dir, f));

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
