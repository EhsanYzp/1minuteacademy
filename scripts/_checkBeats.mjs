import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'content/course-plans';
const files = readdirSync(dir).filter(f => f.startsWith('neuroscience--') && f.endsWith('.json'));
const articleEnding = /\b(the|a|an|than)\s*[.!?;:\u201D"')]+$/i;
const BEAT_HARD_MAX = 130;
const PUNCH_HARD_MAX = 90;

let issues = 0;
for (const f of files) {
  const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  for (const t of data.topics) {
    for (const [k, v] of Object.entries(t.story)) {
      const maxLen = k === 'punchline' ? PUNCH_HARD_MAX : BEAT_HARD_MAX;
      if (v.text.length > maxLen) {
        console.log(`OVER LIMIT: ${f}::${t.title}::${k} → ${v.text.length}/${maxLen}`);
        issues++;
      }
      if (articleEnding.test(v.text)) {
        console.log(`TRUNCATED: ${f}::${t.title}::${k} → "${v.text.slice(-30)}"`);
        issues++;
      }
    }
  }
}
console.log(issues === 0 ? '\nALL CLEAR!' : `\n${issues} issues remain`);
