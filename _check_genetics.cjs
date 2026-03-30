const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'content', 'course-plans');
const files = fs.readdirSync(dir).filter(f => f.startsWith('genetics--') && f.endsWith('.json'));
const LIMITS = { hook: 120, buildup: 120, discovery: 120, twist: 120, climax: 120, punchline: 80 };
let total = 0;
const counts = {};
const details = [];
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  let fc = 0;
  for (const t of data.topics) {
    for (const [beat, max] of Object.entries(LIMITS)) {
      const len = (t.story && t.story[beat] && t.story[beat].text || '').length;
      if (len > max) { fc++; total++; details.push(`${file} | ${t.title} | ${beat} | ${len}/${max}`); }
    }
  }
  if (fc > 0) counts[file] = fc;
}
console.log('Total violations:', total);
for (const [f, c] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(' ', c, f);
console.log('---DETAIL---');
details.forEach(d => console.log(d));
