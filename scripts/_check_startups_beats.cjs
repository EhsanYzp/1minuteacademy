const fs = require('fs');
const path = require('path');

const LIMITS = { hook: 120, buildup: 120, discovery: 120, twist: 120, climax: 120, punchline: 80 };
const dir = path.join(__dirname, '..', 'content', 'course-plans');
const files = fs.readdirSync(dir).filter(f => f.startsWith('startups--') && f.endsWith('.json')).map(f => path.join(dir, f));

let total = 0;
const violations = [];

for (const f of files) {
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  const base = path.basename(f);
  for (const t of data.topics) {
    for (const [beat, limit] of Object.entries(LIMITS)) {
      const text = t.story[beat]?.text;
      if (text && text.length > limit) {
        total++;
        violations.push({ file: base, topic: t.title, beat, len: text.length, limit, text });
      }
    }
  }
}

for (const v of violations) {
  console.log(`[${v.file}] "${v.topic}" ${v.beat}: ${v.len}/${v.limit}`);
  console.log(`  "${v.text}"`);
}
console.log(`\nTotal violations: ${total}`);
