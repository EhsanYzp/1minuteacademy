import fs from 'fs';
const plan = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
let issues = 0;
const BEAT_MAX = 120, PUNCH_MAX = 80;
console.log('Topics:', plan.topics.length);
const chCounts = {};
plan.topics.forEach(t => { chCounts[t.chapter_id] = (chCounts[t.chapter_id]||0)+1; });
Object.entries(chCounts).forEach(([ch,c]) => console.log(ch.split('--').pop(), ':', c));
plan.topics.forEach((t,i) => {
  ['hook','buildup','discovery','twist','climax'].forEach(b => {
    if(t.story[b].text.length > BEAT_MAX) { console.log('OVER', b, t.story[b].text.length, '>', BEAT_MAX, t.title); issues++; }
  });
  if(t.story.punchline.text.length > PUNCH_MAX) { console.log('OVER punchline', t.story.punchline.text.length, '>', PUNCH_MAX, t.title); issues++; }
  if(t.quiz.options.length !== 3) { console.log('QUIZ opts', t.quiz.options.length, t.title); issues++; }
});
const diff = {};
plan.topics.forEach(t => { diff[t.difficulty] = (diff[t.difficulty]||0)+1; });
console.log('Difficulty:', JSON.stringify(diff));
console.log('Issues:', issues);
