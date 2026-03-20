const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'content', 'course-plans');
const files = fs.readdirSync(dir).filter(f => f.startsWith('materials-science--'));
const BEAT_MAX = 120;
const PUNCH_MAX = 80;
let violations = [];
files.forEach(f => {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  d.topics.forEach((t, i) => {
    const s = t.story;
    ['hook','buildup','discovery','twist','climax'].forEach(k => {
      if (s[k] && s[k].text && s[k].text.length > BEAT_MAX) {
        violations.push(f + ' | topic ' + i + ' (' + t.title + ') | ' + k + ': ' + s[k].text.length + ' chars');
      }
    });
    if (s.punchline && s.punchline.text && s.punchline.text.length > PUNCH_MAX) {
      violations.push(f + ' | topic ' + i + ' (' + t.title + ') | punchline: ' + s.punchline.text.length + ' chars');
    }
  });
});
if (violations.length === 0) {
  console.log('ALL CLEAR — no beat length violations across ' + files.length + ' course plans!');
} else {
  console.log(violations.length + ' violations:');
  violations.forEach(v => console.log(v));
}
