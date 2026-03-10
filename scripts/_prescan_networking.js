import fs from 'fs';
import path from 'path';

const BEAT_LIMIT = 120;
const PUNCHLINE_LIMIT = 80;

const dir = 'content/course-plans';
const files = fs.readdirSync(dir)
  .filter(f => f.startsWith('computer-networking--') && f.endsWith('.json'))
  .map(f => path.join(dir, f));
let violations = [];
let totalBeats = 0;

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const topic of data.topics) {
    const beats = topic.story;
    for (const [key, val] of Object.entries(beats)) {
      totalBeats++;
      const len = val.text.length;
      const limit = key === 'punchline' ? PUNCHLINE_LIMIT : BEAT_LIMIT;
      if (len > limit) {
        violations.push({
          file: path.basename(file),
          topic: topic.title,
          beat: key,
          len,
          limit,
          over: len - limit,
          text: val.text
        });
      }
    }
  }
}

console.log('Total beats checked:', totalBeats);
console.log('Violations:', violations.length);
for (const v of violations) {
  console.log('\n---');
  console.log('FILE: ' + v.file);
  console.log('TOPIC: ' + v.topic);
  console.log('BEAT: ' + v.beat + ' | LEN: ' + v.len + ' | LIMIT: ' + v.limit + ' | OVER BY: ' + v.over);
  console.log('TEXT: ' + v.text);
}
