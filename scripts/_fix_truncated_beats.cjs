#!/usr/bin/env node
/**
 * Fix truncated beats that end with articles/comparatives ("a", "the", "an", "than").
 * The story is an OBJECT with keys: hook, buildup, discovery, twist, climax, punchline.
 */
const fs = require('fs');
const path = require('path');

const PLAN_DIR = path.join(__dirname, '..', 'content', 'course-plans');
const BEAT_LIMIT = 120;
const PUNCHLINE_LIMIT = 80;
const BEATS = ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline'];

// Exact regex from generateCourseTopicJsons.mjs line 157:
const articleEnding = /\b(the|a|an|than)\s*[.!?;:\u201D"')]+$/i;

function fixFile(planFile) {
  const raw = fs.readFileSync(planFile, 'utf8');
  const data = JSON.parse(raw);
  let fixes = 0;

  for (const t of data.topics) {
    for (const beatName of BEATS) {
      const beat = t.story[beatName];
      if (!beat || !beat.text) continue;
      const limit = beatName === 'punchline' ? PUNCHLINE_LIMIT : BEAT_LIMIT;

      if (articleEnding.test(beat.text)) {
        const oldText = beat.text;
        let fixed = beat.text;

        // Iteratively strip dangling articles
        let safety = 0;
        while (articleEnding.test(fixed) && safety++ < 10) {
          // Remove the dangling article word and trailing punctuation
          fixed = fixed.replace(/\s+\b(the|a|an|than)\s*[.!?;:\u201D"')]+$/i, '').trim();
          // Also clean up any trailing punctuation/whitespace
          fixed = fixed.replace(/[,;:\s]+$/, '').trim();
          // Ensure it ends with a period
          if (!/[.!?]$/.test(fixed)) fixed += '.';
        }

        // Ensure within limit
        if (fixed.length > limit) {
          const lastSentence = fixed.lastIndexOf('. ', limit - 1);
          if (lastSentence > 20) {
            fixed = fixed.slice(0, lastSentence + 1).trim();
          } else {
            const lastComma = fixed.lastIndexOf(',', limit - 1);
            if (lastComma > 40) {
              fixed = fixed.slice(0, lastComma).trim() + '.';
            } else {
              const lastSpace = fixed.lastIndexOf(' ', limit - 1);
              if (lastSpace > 40) {
                fixed = fixed.slice(0, lastSpace).trim() + '.';
              }
            }
          }
        }

        // Final check
        if (articleEnding.test(fixed)) {
          console.log('  WARNING STILL DANGLING [' + t.title + '] ' + beatName + ': ' + fixed.slice(-30));
        }

        beat.text = fixed;
        console.log('  FIXED [' + t.title + '] ' + beatName + ':');
        console.log('    OLD (' + oldText.length + '): ' + oldText);
        console.log('    NEW (' + fixed.length + '): ' + fixed);
        fixes++;
      }
    }
  }

  if (fixes > 0) {
    fs.writeFileSync(planFile, JSON.stringify(data, null, 2) + '\n');
    console.log('  >> ' + path.basename(planFile) + ': fixed ' + fixes + ' dangling beat(s)\n');
  }
  return fixes;
}

// Process all archaeology course plans
const plans = fs.readdirSync(PLAN_DIR)
  .filter(function(f) { return f.startsWith('archaeology--') && f.endsWith('.json'); });

let total = 0;
for (const plan of plans) {
  total += fixFile(path.join(PLAN_DIR, plan));
}

console.log('Total dangling beats fixed: ' + total);
