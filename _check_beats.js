import fs from 'fs';
const files = [
  'operations--quality-management.json',
  'operations--inventory-and-warehousing.json',
  'operations--operations-strategy.json',
  'operations--lean-thinking.json',
  'operations--famous-operations-failures.json',
  'operations--global-operations.json',
  'operations--the-future-of-operations.json'
];
let allPass = true;
let totalTopics = 0;
for (const f of files) {
  const plan = JSON.parse(fs.readFileSync('content/course-plans/' + f, 'utf8'));
  for (const t of plan.topics) {
    totalTopics++;
    const beats = ['hook','buildup','discovery','twist','climax'];
    for (const b of beats) {
      if (t.story[b].text.length > 120) {
        console.log('FAIL ' + f + ' | ' + t.title + ' | ' + b + ' = ' + t.story[b].text.length + ' chars: ' + t.story[b].text);
        allPass = false;
      }
    }
    if (t.story.punchline.text.length > 80) {
      console.log('FAIL ' + f + ' | ' + t.title + ' | punchline = ' + t.story.punchline.text.length + ' chars: ' + t.story.punchline.text);
      allPass = false;
    }
  }
}
if (allPass) console.log('All beats pass (' + totalTopics + ' topics across ' + files.length + ' courses)');
else console.log('Total topics checked: ' + totalTopics);
