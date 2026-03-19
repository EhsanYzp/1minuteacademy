// Verify all archaeology course plans: topic counts, beat lengths, structure
const fs = require('fs');
const path = require('path');

const BEAT_LIMIT = 120;
const PUNCHLINE_LIMIT = 80;
const TOPICS_PER_CHAPTER = 6;
const CHAPTERS_PER_COURSE = 5;
const TOTAL_TOPICS = 30;

const dir = path.join(__dirname, '..', 'content', 'course-plans');
const files = fs.readdirSync(dir).filter(f => f.startsWith('archaeology--') && f.endsWith('.json'));

console.log(`Found ${files.length} archaeology course plans\n`);

let allPassed = true;

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const errors = [];

  if (data.chapters.length !== CHAPTERS_PER_COURSE) {
    errors.push(`Expected ${CHAPTERS_PER_COURSE} chapters, got ${data.chapters.length}`);
  }

  if (data.topics.length !== TOTAL_TOPICS) {
    errors.push(`Expected ${TOTAL_TOPICS} topics, got ${data.topics.length}`);
  }

  const chapterCounts = {};
  for (const ch of data.chapters) chapterCounts[ch.id] = 0;
  for (const t of data.topics) {
    if (chapterCounts[t.chapter_id] !== undefined) chapterCounts[t.chapter_id]++;
    else errors.push(`Topic "${t.title}" references unknown chapter ${t.chapter_id}`);
  }
  for (const [chId, count] of Object.entries(chapterCounts)) {
    if (count !== TOPICS_PER_CHAPTER) {
      errors.push(`Chapter ${chId} has ${count} topics (expected ${TOPICS_PER_CHAPTER})`);
    }
  }

  for (const ch of data.chapters) {
    const chTopics = data.topics.filter(t => t.chapter_id === ch.id);
    if (chTopics.length > 0 && !chTopics[0].is_free) {
      errors.push(`First topic in "${ch.title}" should be is_free: true`);
    }
    for (let i = 1; i < chTopics.length; i++) {
      if (chTopics[i].is_free) {
        errors.push(`Topic "${chTopics[i].title}" should NOT be is_free (only first per chapter)`);
      }
    }
  }

  const beats = ['hook', 'buildup', 'discovery', 'twist', 'climax'];
  for (const t of data.topics) {
    if (!t.story) { errors.push(`Topic "${t.title}" missing story`); continue; }
    for (const b of beats) {
      if (t.story[b] && t.story[b].text && t.story[b].text.length > BEAT_LIMIT) {
        errors.push(`"${t.title}" → ${b}: ${t.story[b].text.length} chars (limit ${BEAT_LIMIT}): "${t.story[b].text}"`);
      }
    }
    if (t.story.punchline && t.story.punchline.text && t.story.punchline.text.length > PUNCHLINE_LIMIT) {
      errors.push(`"${t.title}" → punchline: ${t.story.punchline.text.length} chars (limit ${PUNCHLINE_LIMIT}): "${t.story.punchline.text}"`);
    }
  }

  if (data.categoryId !== 'archaeology') errors.push(`categoryId should be "archaeology", got "${data.categoryId}"`);
  if (!data.requireAuthoredStory) errors.push('requireAuthoredStory should be true');

  for (const t of data.topics) {
    if (!t.quiz) { errors.push(`Topic "${t.title}" missing quiz`); continue; }
    if (!t.quiz.question) errors.push(`Topic "${t.title}" quiz missing question`);
    if (!t.quiz.options || t.quiz.options.length !== 3) errors.push(`Topic "${t.title}" quiz should have 3 options`);
    if (typeof t.quiz.correct !== 'number') errors.push(`Topic "${t.title}" quiz missing correct index`);
  }

  if (errors.length > 0) {
    allPassed = false;
    console.log(`❌ ${file}`);
    errors.forEach(e => console.log(`   ${e}`));
  } else {
    console.log(`✅ ${file} — ${data.courseTitle} (${data.topics.length} topics)`);
  }
  console.log('');
}

if (allPassed) {
  console.log('\n🎉 All archaeology courses passed verification!');
} else {
  console.log('\n⚠️  Some courses have issues. Fix them above.');
  process.exit(1);
}
