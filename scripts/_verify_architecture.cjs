#!/usr/bin/env node
/**
 * Verify all architecture course plans meet structural requirements.
 */
const fs = require('fs');
const path = require('path');

const PLAN_DIR = path.join(__dirname, '..', 'content', 'course-plans');
const BEAT_LIMIT = 120;
const PUNCHLINE_LIMIT = 80;
const BEATS = ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline'];

const plans = fs.readdirSync(PLAN_DIR)
  .filter(f => f.startsWith('architecture--') && f.endsWith('.json'))
  .sort();

console.log('Found ' + plans.length + ' architecture course plans\n');

let allPass = true;

for (const file of plans) {
  const data = JSON.parse(fs.readFileSync(path.join(PLAN_DIR, file), 'utf8'));
  const errors = [];

  // Basic structure
  if (data.categoryId !== 'architecture') errors.push('categoryId != architecture');
  if (!data.requireAuthoredStory) errors.push('requireAuthoredStory not true');
  if (!data.chapters || data.chapters.length !== 5) errors.push('chapters != 5 (got ' + (data.chapters ? data.chapters.length : 0) + ')');
  if (!data.topics || data.topics.length !== 30) errors.push('topics != 30 (got ' + (data.topics ? data.topics.length : 0) + ')');

  // Check chapter topic distribution
  if (data.chapters && data.topics) {
    for (const ch of data.chapters) {
      const chTopics = data.topics.filter(t => t.chapter_id === ch.id);
      if (chTopics.length !== 6) {
        errors.push('Chapter "' + ch.title + '" has ' + chTopics.length + ' topics (expected 6)');
      }
      // Check is_free
      const freeCount = chTopics.filter(t => t.is_free === true).length;
      if (freeCount !== 1) {
        errors.push('Chapter "' + ch.title + '" has ' + freeCount + ' free topics (expected 1)');
      }
    }
  }

  // Check beat lengths and structure
  if (data.topics) {
    for (const t of data.topics) {
      if (!t.story) { errors.push('Topic "' + t.title + '" missing story'); continue; }
      for (const beatName of BEATS) {
        const beat = t.story[beatName];
        if (!beat || !beat.text) {
          errors.push('Topic "' + t.title + '" missing ' + beatName);
          continue;
        }
        const limit = beatName === 'punchline' ? PUNCHLINE_LIMIT : BEAT_LIMIT;
        if (beat.text.length > limit) {
          errors.push('Topic "' + t.title + '" ' + beatName + ' = ' + beat.text.length + ' chars (max ' + limit + '): ' + beat.text.slice(0, 50) + '...');
        }
      }
      // Check quiz
      if (!t.quiz || !t.quiz.question || !t.quiz.options || t.quiz.options.length !== 3) {
        errors.push('Topic "' + t.title + '" quiz invalid (need question + 3 options)');
      }
      if (t.quiz && (typeof t.quiz.correct !== 'number' || t.quiz.correct < 0 || t.quiz.correct > 2)) {
        errors.push('Topic "' + t.title + '" quiz.correct invalid');
      }
    }
  }

  if (errors.length > 0) {
    allPass = false;
    console.log('❌ ' + file + ' — ' + data.courseTitle);
    for (const e of errors) console.log('   ' + e);
    console.log();
  } else {
    console.log('✅ ' + file + ' — ' + data.courseTitle + ' (' + data.topics.length + ' topics)');
  }
}

console.log();
if (allPass) {
  console.log('🎉 All architecture courses passed verification!');
} else {
  console.log('💥 Some courses have errors. Fix them and re-run.');
  process.exit(1);
}
