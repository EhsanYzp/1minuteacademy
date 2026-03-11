#!/usr/bin/env node
// Pre-scan all ux-research course plans for beat-length violations.
const fs = require('fs');
const path = require('path');

const BEAT_LIMIT = 120;
const PUNCHLINE_LIMIT = 80;
const dir = path.join(__dirname, '..', 'content', 'course-plans');

const files = fs.readdirSync(dir).filter(f => f.startsWith('ux-research--') && f.endsWith('.json'));
let total = 0, violations = 0;

for (const file of files) {
  const plan = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const fileViolations = [];
  for (const topic of plan.topics) {
    for (const [beat, obj] of Object.entries(topic.story)) {
      total++;
      const len = obj.text.length;
      const limit = beat === 'punchline' ? PUNCHLINE_LIMIT : BEAT_LIMIT;
      if (len > limit) {
        violations++;
        fileViolations.push(`  ${topic.title} → ${beat}: ${len} > ${limit}  "${obj.text}"`);
      }
    }
  }
  if (fileViolations.length) {
    console.log(`\n❌ ${file} (${fileViolations.length} violations)`);
    fileViolations.forEach(v => console.log(v));
  }
}

console.log(`\nTotal beats checked: ${total}`);
console.log(`Violations: ${violations}`);
