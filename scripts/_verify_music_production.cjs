const fs = require('fs');
const path = require('path');

const BEAT_LIMIT = 120;
const PUNCHLINE_LIMIT = 80;
const BEAT_TOLERANCE = 130;
const PUNCHLINE_TOLERANCE = 90;

const planDir = path.join(__dirname, '..', 'content', 'course-plans');
const files = fs.readdirSync(planDir)
  .filter(f => f.startsWith('music-production--') && f.endsWith('.json'))
  .map(f => path.join(planDir, f));

let totalErrors = 0;

files.forEach(f => {
  const plan = JSON.parse(fs.readFileSync(f, 'utf8'));
  const slug = path.basename(f);
  const errors = [];

  // Check topic count
  if (plan.topics.length !== 30) {
    errors.push(`Topic count: ${plan.topics.length} (expected 30)`);
  }

  // Check chapters
  if (plan.chapters.length !== 5) {
    errors.push(`Chapter count: ${plan.chapters.length} (expected 5)`);
  }

  // Check topics per chapter
  const chapterCounts = {};
  plan.chapters.forEach(c => { chapterCounts[c.id] = 0; });
  plan.topics.forEach(t => {
    if (chapterCounts[t.chapter_id] !== undefined) {
      chapterCounts[t.chapter_id]++;
    } else {
      errors.push(`Topic "${t.title}" has unknown chapter_id: ${t.chapter_id}`);
    }
  });
  Object.entries(chapterCounts).forEach(([chId, count]) => {
    if (count !== 6) {
      errors.push(`Chapter "${chId}" has ${count} topics (expected 6)`);
    }
  });

  // Check is_free flags: first topic of each chapter should be free
  plan.chapters.forEach(ch => {
    const chTopics = plan.topics.filter(t => t.chapter_id === ch.id);
    if (chTopics.length > 0) {
      if (!chTopics[0].is_free) {
        errors.push(`First topic of "${ch.title}" is not is_free`);
      }
      chTopics.slice(1).forEach(t => {
        if (t.is_free) {
          errors.push(`Topic "${t.title}" in "${ch.title}" is_free but not first`);
        }
      });
    }
  });

  // Check beat and punchline lengths
  plan.topics.forEach(t => {
    const beats = ['hook', 'buildup', 'discovery', 'twist', 'climax'];
    beats.forEach(b => {
      const len = t.story[b].text.length;
      if (len > BEAT_TOLERANCE) {
        errors.push(`HARD FAIL "${t.title}" ${b}: ${len} chars (tolerance ${BEAT_TOLERANCE})`);
      } else if (len > BEAT_LIMIT) {
        errors.push(`WARN "${t.title}" ${b}: ${len} chars (limit ${BEAT_LIMIT}, tolerance ${BEAT_TOLERANCE})`);
      }
    });
    const pLen = t.story.punchline.text.length;
    if (pLen > PUNCHLINE_TOLERANCE) {
      errors.push(`HARD FAIL "${t.title}" punchline: ${pLen} chars (tolerance ${PUNCHLINE_TOLERANCE})`);
    } else if (pLen > PUNCHLINE_LIMIT) {
      errors.push(`WARN "${t.title}" punchline: ${pLen} chars (limit ${PUNCHLINE_LIMIT}, tolerance ${PUNCHLINE_TOLERANCE})`);
    }
  });

  // Check quiz
  plan.topics.forEach(t => {
    if (!t.quiz || !t.quiz.question || !t.quiz.options || t.quiz.options.length !== 3) {
      errors.push(`Quiz issue in "${t.title}"`);
    }
  });

  // Check requireAuthoredStory
  if (!plan.requireAuthoredStory) {
    errors.push('requireAuthoredStory is not true');
  }

  if (errors.length === 0) {
    console.log(`✅ ${slug}`);
  } else {
    console.log(`❌ ${slug}`);
    errors.forEach(e => console.log(`   ${e}`));
    totalErrors += errors.length;
  }
});

console.log(`\n${files.length} files checked, ${totalErrors} total errors`);
process.exit(totalErrors > 0 ? 1 : 0);
