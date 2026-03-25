const fs = require('fs');
const path = require('path');

const LIMITS = { hook: 120, buildup: 120, discovery: 120, twist: 120, climax: 120, punchline: 80 };
const DANGLING = /\b(a|an|the|of|in|on|at|to|for|and|but|or|is|it|by|as|no|so|if|its|was|has|had|are|be|do|my|we|he|she|our|can|all|from|with|that|this|than|into|also|not|yet|nor|per|via)\s*$/i;

function trimSentence(text, limit) {
  if (text.length <= limit) return text;

  // Strategy 1: Cut at last sentence boundary
  let cut = text.slice(0, limit);
  let m = cut.match(/^(.*[.!?])\s+\S/);
  if (m && m[1].length >= limit * 0.45 && !DANGLING.test(m[1])) return m[1];

  // Strategy 2: Cut at em-dash
  m = cut.match(/^(.*?)—/);
  if (m && m[1].length >= limit * 0.45) {
    let s = m[1].trimEnd();
    if (!s.endsWith('.')) s += '.';
    if (s.length <= limit && !DANGLING.test(s)) return s;
  }

  // Strategy 3: Cut at semicolon
  m = cut.match(/^(.*?);/);
  if (m && m[1].length >= limit * 0.45) {
    let s = m[1].trimEnd();
    if (!s.endsWith('.')) s += '.';
    if (s.length <= limit && !DANGLING.test(s)) return s;
  }

  // Strategy 4: Cut at last comma boundary
  m = cut.match(/^(.*),\s+\S/);
  if (m && m[1].length >= limit * 0.5) {
    let s = m[1].trimEnd();
    if (!s.endsWith('.')) s += '.';
    if (s.length <= limit && !DANGLING.test(s)) return s;
  }

  return text; // couldn't fix
}

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.startsWith('banking--') && f.endsWith('.json'));
let fixed = 0, remaining = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  const plan = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const topics = plan.topics || (plan.data && plan.data.topics) || [];
  let changed = false;
  for (const t of topics) {
    const story = t.story || {};
    for (const [beat, limit] of Object.entries(LIMITS)) {
      if (!story[beat]) continue;
      const text = story[beat].text || '';
      if (text.length > limit) {
        const result = trimSentence(text, limit);
        if (result.length <= limit && result !== text) {
          story[beat].text = result;
          fixed++;
          changed = true;
        } else {
          remaining++;
          console.log(`REMAINING: ${file} | "${t.title}" | ${beat}: ${text.length}/${limit}`);
        }
      }
    }
  }
  if (changed) {
    fs.writeFileSync(fp, JSON.stringify(plan, null, 2) + '\n');
  }
}
console.log(`\nFixed: ${fixed} | Remaining: ${remaining}`);
