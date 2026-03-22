#!/usr/bin/env node
/**
 * Shorten all beat texts in neuroscience course plans to comply with character limits.
 * - Regular beats (hook, buildup, discovery, twist, climax): max 130 chars
 * - Punchline: max 90 chars
 *
 * Strategy: trim words from the end of sentences or simplify phrasing to fit.
 */
import fs from 'node:fs';
import path from 'node:path';

const BEAT_MAX = 130;
const PUNCHLINE_MAX = 90;
const BEATS = ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline'];

function getMax(beat) {
  return beat === 'punchline' ? PUNCHLINE_MAX : BEAT_MAX;
}

/**
 * Attempt to shorten text to fit within maxLen characters.
 * Uses several strategies:
 * 1. Remove parenthetical asides
 * 2. Replace wordy phrases with shorter ones
 * 3. Split into sentences and drop the least essential one
 * 4. Trim individual sentences
 */
function shortenText(text, maxLen) {
  if (text.length <= maxLen) return text;

  let t = text;

  // Strategy 1: Common wordy replacements
  const replacements = [
    [/that is to say/gi, 'meaning'],
    [/in order to/gi, 'to'],
    [/as a result of/gi, 'from'],
    [/due to the fact that/gi, 'because'],
    [/a large number of/gi, 'many'],
    [/a significant number of/gi, 'many'],
    [/in the process of/gi, 'while'],
    [/it is important to note that/gi, ''],
    [/on the other hand/gi, 'but'],
    [/in addition to/gi, 'besides'],
    [/for the purpose of/gi, 'to'],
    [/with regard to/gi, 'about'],
    [/in spite of/gi, 'despite'],
    [/as well as/gi, 'and'],
    [/a wide variety of/gi, 'many'],
    [/, which /g, ' that '],
    [/ that /g, ' '],  // be cautious with this one
    [/approximately /gi, 'about '],
    [/essentially /gi, ''],
    [/fundamentally /gi, ''],
    [/significantly /gi, ''],
    [/dramatically /gi, ''],
    [/extraordinarily /gi, 'extremely '],
    [/extraordinarily/gi, 'extremely'],
    [/simultaneously/gi, 'at once'],
    [/  +/g, ' '],
  ];

  for (const [pattern, replacement] of replacements) {
    if (t.length <= maxLen) break;
    t = t.replace(pattern, replacement).trim();
  }
  if (t.length <= maxLen) return t;

  // Strategy 2: Remove parenthetical content like "(called X)"
  t = t.replace(/\s*\([^)]{5,}\)\s*/g, ' ').replace(/  +/g, ' ').trim();
  if (t.length <= maxLen) return t;

  // Strategy 3: If there are multiple sentences, try removing the longest non-first, non-last sentence
  const sentences = t.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length >= 3) {
    // Find the longest middle sentence and remove it
    let longestIdx = 1;
    let longestLen = 0;
    for (let i = 1; i < sentences.length - 1; i++) {
      if (sentences[i].length > longestLen) {
        longestLen = sentences[i].length;
        longestIdx = i;
      }
    }
    const reduced = sentences.filter((_, i) => i !== longestIdx).join('').trim();
    if (reduced.length <= maxLen) return reduced;
    t = reduced;
  }

  // Strategy 4: If two sentences, keep the more impactful one (usually shorter)
  if (sentences && sentences.length === 2) {
    const s0 = sentences[0].trim();
    const s1 = sentences[1].trim();
    // Try keeping just one sentence
    if (s0.length <= maxLen) {
      // Try s0 first if it's the longer/more informative one
      if (s1.length <= maxLen && s1.length < s0.length) return s1;
      return s0;
    }
    if (s1.length <= maxLen) return s1;
  }

  // Strategy 5: Progressive word removal from the end, keeping valid ending
  const words = t.split(' ');
  while (words.length > 3) {
    words.pop();
    const candidate = words.join(' ').replace(/[,;:\-—]+$/, '').trim();
    const withPeriod = candidate.endsWith('.') || candidate.endsWith('!') || candidate.endsWith('?')
      ? candidate
      : candidate + '.';
    if (withPeriod.length <= maxLen) return withPeriod;
  }

  return t; // give up, return as-is
}

// Process all neuroscience course plans
const dir = 'content/course-plans';
const files = fs.readdirSync(dir).filter(f => f.startsWith('neuroscience--') && f.endsWith('.json'));

let totalFixed = 0;
let totalFailed = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let fileFixed = 0;

  for (const topic of data.topics) {
    for (const beat of BEATS) {
      const max = getMax(beat);
      const original = topic.story[beat].text;
      if (original.length > max) {
        const shortened = shortenText(original, max);
        if (shortened.length <= max) {
          topic.story[beat].text = shortened;
          fileFixed++;
        } else {
          console.error(`STILL TOO LONG (${shortened.length}/${max}): ${file} | ${topic.title} | ${beat}`);
          console.error(`  Original (${original.length}): ${original}`);
          console.error(`  Shortened (${shortened.length}): ${shortened}`);
          totalFailed++;
        }
      }
    }
  }

  if (fileFixed > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    console.log(`${file}: fixed ${fileFixed} violations`);
    totalFixed += fileFixed;
  } else {
    console.log(`${file}: no violations to fix`);
  }
}

console.log(`\nTotal fixed: ${totalFixed}, Failed: ${totalFailed}`);
