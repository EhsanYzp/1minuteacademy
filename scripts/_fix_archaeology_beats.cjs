#!/usr/bin/env node
// Automatically shorten beats that exceed character limits.
// Strategy: trim at last sentence boundary, or remove trailing clauses.
const fs = require('fs');
const path = require('path');

const BEAT_LIMIT = 120;
const PUNCHLINE_LIMIT = 80;
const BEATS = ['hook', 'buildup', 'discovery', 'twist', 'climax'];

const dir = path.join(__dirname, '..', 'content', 'course-plans');
const files = fs.readdirSync(dir).filter(f => f.startsWith('archaeology--') && f.endsWith('.json'));

function shorten(text, limit) {
  if (text.length <= limit) return text;

  // Strategy 1: Replace em-dash phrases with shorter connectors
  let t = text;
  t = t.replace(/ — /g, ' – ');  // shorter dash saves 0 chars but try anyway
  t = t.replace(/ — /g, ': ');
  if (t.length <= limit) return t;

  // Strategy 2: Try to cut at last sentence boundary (period + space) within limit
  t = text;
  const lastPeriod = t.lastIndexOf('. ', limit - 1);
  if (lastPeriod > limit * 0.5) {
    return t.substring(0, lastPeriod + 1);
  }

  // Strategy 3: Cut at last comma within limit
  const lastComma = t.lastIndexOf(', ', limit - 1);
  if (lastComma > limit * 0.6) {
    return t.substring(0, lastComma) + '.';
  }

  // Strategy 4: Cut at last space before limit and add period
  const lastSpace = t.lastIndexOf(' ', limit - 1);
  if (lastSpace > limit * 0.6) {
    let cut = t.substring(0, lastSpace);
    if (!cut.endsWith('.')) cut += '.';
    return cut;
  }

  // Fallback: just truncate
  return t.substring(0, limit - 1) + '.';
}

let totalFixed = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let changed = false;

  for (const t of data.topics) {
    if (!t.story) continue;
    for (const b of BEATS) {
      if (t.story[b] && t.story[b].text && t.story[b].text.length > BEAT_LIMIT) {
        const orig = t.story[b].text;
        t.story[b].text = shorten(orig, BEAT_LIMIT);
        changed = true;
        totalFixed++;
        if (t.story[b].text.length > BEAT_LIMIT) {
          console.log(`STILL OVER: "${t.title}" ${b}: ${t.story[b].text.length} chars`);
          console.log(`  "${t.story[b].text}"`);
        }
      }
    }
    // Punchline
    if (t.story.punchline && t.story.punchline.text && t.story.punchline.text.length > PUNCHLINE_LIMIT) {
      const orig = t.story.punchline.text;
      t.story.punchline.text = shorten(orig, PUNCHLINE_LIMIT);
      changed = true;
      totalFixed++;
      if (t.story.punchline.text.length > PUNCHLINE_LIMIT) {
        console.log(`STILL OVER: "${t.title}" punchline: ${t.story.punchline.text.length} chars`);
        console.log(`  "${t.story.punchline.text}"`);
      }
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    console.log(`Fixed: ${file}`);
  }
}

console.log(`\nTotal beats fixed: ${totalFixed}`);
