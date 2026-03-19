const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'content', 'course-plans');
const files = fs.readdirSync(dir).filter(f => f.startsWith('animation--') && f.endsWith('.json'));

console.log(`Found ${files.length} animation course plans\n`);

let allGood = true;
files.forEach(f => {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const topicCount = d.topics.length;
  const chapterCount = d.chapters.length;
  
  const chCounts = {};
  d.topics.forEach(t => { chCounts[t.chapter_id] = (chCounts[t.chapter_id] || 0) + 1; });
  const vals = Object.values(chCounts);
  
  const freeCount = d.topics.filter(t => t.is_free).length;
  
  let maxBeat = 0, maxPunch = 0;
  const violations = [];
  d.topics.forEach((t, i) => {
    Object.entries(t.story).forEach(([k, v]) => {
      if (v.text.length > 120) violations.push(`T${i + 1} ${k}: ${v.text.length}`);
      if (k === 'punchline' && v.text.length > 80) violations.push(`T${i + 1} punch: ${v.text.length}`);
      if (v.text.length > maxBeat) maxBeat = v.text.length;
      if (k === 'punchline' && v.text.length > maxPunch) maxPunch = v.text.length;
    });
  });
  
  const ok = topicCount === 30 && chapterCount === 5 && freeCount === 5 && vals.every(v => v === 6) && violations.length === 0;
  if (!ok) allGood = false;
  
  console.log(`${ok ? '✅' : '❌'} ${f}`);
  console.log(`   Topics:${topicCount} Chs:${chapterCount} Free:${freeCount} PerCh:[${vals.join(',')}] MaxBeat:${maxBeat} MaxPunch:${maxPunch}`);
  
  if (topicCount !== 30) {
    d.chapters.forEach(ch => {
      const cnt = d.topics.filter(t => t.chapter_id === ch.id).length;
      if (cnt < 6) console.log(`   SHORT: "${ch.title}" (${ch.id}) = ${cnt} topics`);
    });
  }
  if (violations.length) console.log(`   VIOLATIONS: ${violations.join('; ')}`);
});

console.log(`\n${allGood ? '🎉 ALL PASS' : '⚠️ ISSUES FOUND'}`);
