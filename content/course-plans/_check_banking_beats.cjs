const fs = require('fs');
const path = require('path');

const LIMITS = { hook: 120, buildup: 120, discovery: 120, twist: 120, climax: 120, punchline: 80 };
const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.startsWith('banking--') && f.endsWith('.json'));

let total = 0;
for (const file of files) {
  const plan = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const topics = plan.topics || (plan.data && plan.data.topics) || [];
  for (const t of topics) {
    const story = t.story || {};
    for (const [beat, limit] of Object.entries(LIMITS)) {
      const text = (story[beat] && story[beat].text) || '';
      if (text.length > limit) {
        total++;
        console.log(`${file} | "${t.title}" | ${beat}: ${text.length}/${limit} (+${text.length - limit})`);
      }
    }
  }
}
console.log(`\nTotal violations: ${total}`);
