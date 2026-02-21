#!/usr/bin/env node
/**
 * Extract every broken beat's full text so we can write exact rewrites.
 * Output: JSON array of { file, topicTitle, beat, text, issue }
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { COURSE_PLANS_DIR } from './_contentPaths.mjs';

const BEAT_NAMES = ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline'];
const VALID_ENDINGS = new Set(['.', '!', '?', ')', "'", '"', ':', ';', '\u2019', '\u201D']);
const BEAT_MAX = { hook: 120, buildup: 120, discovery: 120, twist: 120, climax: 120, punchline: 80 };
const ARTICLE_RE = /\b(the|a|an|than)\s*[.!?;:\u201D"')]+$/i;

async function main() {
  const entries = await fs.readdir(COURSE_PLANS_DIR);
  const results = [];

  for (const fname of entries.filter(f => f.endsWith('.json'))) {
    const file = path.join(COURSE_PLANS_DIR, fname);
    const plan = JSON.parse(await fs.readFile(file, 'utf8'));

    for (const topic of plan.topics ?? []) {
      if (!topic.story) continue;
      for (const beat of BEAT_NAMES) {
        const node = topic.story[beat];
        if (!node || typeof node.text !== 'string') continue;
        const text = node.text.trim();
        if (!text) continue;

        const issues = [];
        const lastChar = text[text.length - 1];
        if (!VALID_ENDINGS.has(lastChar)) issues.push('bad-ending');

        const max = BEAT_MAX[beat];
        if (text.length > max) issues.push('over-limit');

        const tail10 = text.slice(-10);
        if (tail10.includes('\u2026') || tail10.includes('...')) issues.push('ellipsis');

        if (text.length >= 2 && text[text.length - 2] === ' ') issues.push('space-before-punct');

        const opens  = (text.match(/[\u201C(]/g) || []).length;
        const closes = (text.match(/[\u201D)]/g) || []).length;
        if (opens > closes) issues.push('unbalanced');

        if (ARTICLE_RE.test(text)) issues.push('article-ending');

        if (issues.length > 0) {
          results.push({
            file: fname,
            topicTitle: topic.title,
            beat,
            text,
            len: text.length,
            max,
            issues: issues.join(','),
          });
        }
      }
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

main();
