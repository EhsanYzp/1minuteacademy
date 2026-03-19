const fs = require('fs');
const path = require('path');

const BEAT_LIMIT = 120;
const PUNCHLINE_LIMIT = 80;
const BEAT_TOLERANCE = 130;
const PUNCHLINE_TOLERANCE = 90;

const dir = path.join(__dirname, '..', 'content', 'course-plans');
const files = fs.readdirSync(dir).filter(f => f.startsWith('literature--') && f.endsWith('.json'));

let totalErrors = 0;
let totalWarnings = 0;

files.forEach(file => {
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const topics = data.topics || [];
  const chapters = data.chapters || [];

  console.log(`\n📘 ${file}`);
  console.log(`   Course: ${data.courseTitle} | Emoji: ${data.emoji} | Color: ${data.color}`);
  console.log(`   Chapters: ${chapters.length} | Topics: ${topics.length}`);

  // Check topic count
  if (topics.length !== 30) {
    console.log(`   ❌ ERROR: Expected 30 topics, got ${topics.length}`);
    totalErrors++;
  }

  // Check chapter count
  if (chapters.length !== 5) {
    console.log(`   ❌ ERROR: Expected 5 chapters, got ${chapters.length}`);
    totalErrors++;
  }

  // Check topics per chapter
  const chapterCounts = {};
  chapters.forEach(c => { chapterCounts[c.id] = 0; });
  topics.forEach(t => {
    if (chapterCounts[t.chapter_id] !== undefined) {
      chapterCounts[t.chapter_id]++;
    } else {
      console.log(`   ❌ ERROR: Topic "${t.title}" has unknown chapter_id: ${t.chapter_id}`);
      totalErrors++;
    }
  });
  Object.entries(chapterCounts).forEach(([chId, count]) => {
    if (count !== 6) {
      console.log(`   ❌ ERROR: Chapter ${chId} has ${count} topics (expected 6)`);
      totalErrors++;
    }
  });

  // Check is_free: first topic in each chapter should be free
  const chapterFirstTopic = {};
  topics.forEach(t => {
    if (!chapterFirstTopic[t.chapter_id]) {
      chapterFirstTopic[t.chapter_id] = t;
    }
  });
  Object.entries(chapterFirstTopic).forEach(([chId, t]) => {
    if (!t.is_free) {
      console.log(`   ❌ ERROR: First topic "${t.title}" in chapter is not is_free: true`);
      totalErrors++;
    }
  });

  // Check beat lengths
  const beatKeys = ['hook', 'buildup', 'discovery', 'twist', 'climax'];
  topics.forEach(t => {
    beatKeys.forEach(key => {
      const text = t.story[key]?.text || '';
      if (text.length > BEAT_TOLERANCE) {
        console.log(`   ❌ ERROR: "${t.title}" ${key} = ${text.length} chars (tolerance: ${BEAT_TOLERANCE})`);
        totalErrors++;
      } else if (text.length > BEAT_LIMIT) {
        console.log(`   ⚠️  WARN: "${t.title}" ${key} = ${text.length} chars (limit: ${BEAT_LIMIT})`);
        totalWarnings++;
      }
    });

    const punchline = t.story.punchline?.text || '';
    if (punchline.length > PUNCHLINE_TOLERANCE) {
      console.log(`   ❌ ERROR: "${t.title}" punchline = ${punchline.length} chars (tolerance: ${PUNCHLINE_TOLERANCE})`);
      totalErrors++;
    } else if (punchline.length > PUNCHLINE_LIMIT) {
      console.log(`   ⚠️  WARN: "${t.title}" punchline = ${punchline.length} chars (limit: ${PUNCHLINE_LIMIT})`);
      totalWarnings++;
    }

    // Check quiz
    if (!t.quiz || !t.quiz.question || !t.quiz.options || t.quiz.options.length !== 3) {
      console.log(`   ❌ ERROR: "${t.title}" quiz invalid`);
      totalErrors++;
    }
  });

  // Check requireAuthoredStory
  if (!data.requireAuthoredStory) {
    console.log(`   ❌ ERROR: requireAuthoredStory is not true`);
    totalErrors++;
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log(`Files: ${files.length}`);
console.log(`Errors: ${totalErrors}`);
console.log(`Warnings: ${totalWarnings}`);
if (totalErrors === 0) {
  console.log('✅ All literature courses passed verification!');
} else {
  console.log('❌ Some courses have errors. Fix them before proceeding.');
  process.exit(1);
}
