const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'content', 'course-plans');
const LIMITS = { hook: 120, buildup: 120, discovery: 120, twist: 120, climax: 120, punchline: 80 };
const beats = ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline'];
let total = 0;

const files = fs.readdirSync(dir).filter(f => f.startsWith('future-tech--') && f.endsWith('.json'));
files.forEach(file => {
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  data.topics.forEach(t => {
    beats.forEach(b => {
      const text = t.story[b].text;
      if (text.length > LIMITS[b]) {
        console.log(`[${file}] "${t.title}" ${b}: ${text.length}/${LIMITS[b]} chars`);
        console.log(`  "${text}"`);
        total++;
      }
    });
  });
});
console.log(`\nTotal violations: ${total}`);
