const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'content', 'course-plans');
const files = fs.readdirSync(dir).filter(f => f.startsWith('genetics--') && f.endsWith('.json'));
const LIMITS = { hook: 120, buildup: 120, discovery: 120, twist: 120, climax: 120, punchline: 80 };

let totalFixed = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  let fileFixed = 0;

  for (const t of data.topics) {
    for (const [beat, max] of Object.entries(LIMITS)) {
      if (!t.story || !t.story[beat]) continue;
      let text = t.story[beat].text;
      if (text.length <= max) continue;

      // Strategy 1: Try removing last sentence
      const sentences = text.split(/(?<=\.)\s+/);
      if (sentences.length > 1) {
        let trimmed = sentences.slice(0, -1).join(' ');
        if (trimmed.length <= max) {
          t.story[beat].text = trimmed;
          fileFixed++;
          totalFixed++;
          continue;
        }
        // Strategy 2: Try removing last two sentences
        if (sentences.length > 2) {
          trimmed = sentences.slice(0, -2).join(' ');
          if (trimmed.length <= max) {
            t.story[beat].text = trimmed;
            fileFixed++;
            totalFixed++;
            continue;
          }
        }
      }

      // Strategy 3: Truncate at last word boundary within limit, keep as-is ending
      let truncated = text.substring(0, max);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > max * 0.6) {
        truncated = truncated.substring(0, lastSpace);
        // Remove trailing punctuation fragments
        truncated = truncated.replace(/[,;:\s]+$/, '');
        // Add period if not present
        if (!/[.!?]$/.test(truncated)) truncated += '.';
        if (truncated.length <= max) {
          t.story[beat].text = truncated;
          fileFixed++;
          totalFixed++;
          continue;
        }
      }

      // Strategy 4: Hard truncate and add period
      truncated = text.substring(0, max - 1);
      const ls = truncated.lastIndexOf(' ');
      truncated = truncated.substring(0, ls).replace(/[,;:\s]+$/, '') + '.';
      t.story[beat].text = truncated;
      fileFixed++;
      totalFixed++;
    }
  }

  if (fileFixed > 0) {
    fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n');
    console.log(`Fixed ${fileFixed} violations in ${file}`);
  }
}

console.log(`\nTotal fixed: ${totalFixed}`);
