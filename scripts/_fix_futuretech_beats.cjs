const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'content', 'course-plans');
const LIMITS = { hook: 120, buildup: 120, discovery: 120, twist: 120, climax: 120, punchline: 80 };
const beats = ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline'];

const CONTRACTIONS = [
  [/\bdo not\b/gi, "don't"], [/\bcan not\b/gi, "can't"], [/\bcannot\b/gi, "can't"],
  [/\bwill not\b/gi, "won't"], [/\bit is\b/gi, "it's"], [/\bthat is\b/gi, "that's"],
  [/\bthey are\b/gi, "they're"], [/\bwe are\b/gi, "we're"], [/\byou are\b/gi, "you're"],
  [/\bis not\b/gi, "isn't"], [/\bare not\b/gi, "aren't"], [/\bwas not\b/gi, "wasn't"],
  [/\bwere not\b/gi, "weren't"], [/\bhas not\b/gi, "hasn't"], [/\bhave not\b/gi, "haven't"],
  [/\bhad not\b/gi, "hadn't"], [/\bwould not\b/gi, "wouldn't"], [/\bcould not\b/gi, "couldn't"],
  [/\bshould not\b/gi, "shouldn't"], [/\bdoes not\b/gi, "doesn't"], [/\bdid not\b/gi, "didn't"],
  [/\blet us\b/gi, "let's"], [/\bthere is\b/gi, "there's"], [/\bwho is\b/gi, "who's"],
  [/\bwhat is\b/gi, "what's"], [/\bhere is\b/gi, "here's"],
  [/\bIt has\b/g, "It's"], [/\bThat has\b/g, "That's"],
];

const PHRASE_SHORTENINGS = [
  [/\bin order to\b/gi, 'to'],
  [/\ba large number of\b/gi, 'many'],
  [/\ba small number of\b/gi, 'a few'],
  [/\bat this point in time\b/gi, 'now'],
  [/\bdue to the fact that\b/gi, 'because'],
  [/\bin spite of the fact that\b/gi, 'although'],
  [/\bfor the purpose of\b/gi, 'to'],
  [/\bin the event that\b/gi, 'if'],
  [/\bon a daily basis\b/gi, 'daily'],
  [/\bat the present time\b/gi, 'now'],
  [/\bin the near future\b/gi, 'soon'],
  [/\bthe vast majority of\b/gi, 'most'],
  [/\bas a matter of fact\b/gi, 'in fact'],
  [/\bas a result of\b/gi, 'from'],
  [/\bin the process of\b/gi, 'currently'],
  [/\bis able to\b/gi, 'can'],
  [/\bare able to\b/gi, 'can'],
  [/\bwas able to\b/gi, 'could'],
  [/\bhowever, /gi, 'But '],
  [/\bHowever, /g, 'But '],
  [/\bIn addition, /gi, 'Also, '],
  [/\bAs well as\b/gi, 'And'],
];

const FILLER_REMOVALS = [
  [/\bvery much\b/gi, ''],
  [/\bquite\b/gi, ''],
  [/\bactually\b/gi, ''],
  [/\bbasically\b/gi, ''],
  [/\bjust\b/gi, ''],
  [/\breally\b/gi, ''],
  [/\bsimply\b/gi, ''],
  [/\bessentially\b/gi, ''],
  [/\bvirtually\b/gi, ''],
  [/\bliterally\b/gi, ''],
  [/\bentirely\b/gi, ''],
  [/  +/g, ' '],
];

function trimAtSentence(text, limit) {
  if (text.length <= limit) return text;
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences || sentences.length <= 1) return text;
  let result = '';
  for (const s of sentences) {
    if ((result + s).trim().length <= limit) {
      result += s;
    } else break;
  }
  return result.trim() || text;
}

function fix(text, limit) {
  let t = text;
  if (t.length <= limit) return t;
  for (const [re, rep] of CONTRACTIONS) { t = t.replace(re, rep); }
  if (t.length <= limit) return t;
  for (const [re, rep] of PHRASE_SHORTENINGS) { t = t.replace(re, rep); }
  if (t.length <= limit) return t;
  for (const [re, rep] of FILLER_REMOVALS) { t = t.replace(re, rep); }
  t = t.replace(/  +/g, ' ').trim();
  if (t.length <= limit) return t;
  t = trimAtSentence(t, limit);
  return t;
}

let fixed = 0, remaining = 0;
const files = fs.readdirSync(dir).filter(f => f.startsWith('future-tech--') && f.endsWith('.json'));
files.forEach(file => {
  const fp = path.join(dir, file);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  let changed = false;
  data.topics.forEach(t => {
    beats.forEach(b => {
      const limit = LIMITS[b];
      const orig = t.story[b].text;
      if (orig.length > limit) {
        const result = fix(orig, limit);
        if (result.length <= limit) {
          t.story[b].text = result;
          changed = true;
          fixed++;
        } else {
          console.log(`REMAINING [${file}] "${t.title}" ${b}: ${result.length}/${limit}`);
          console.log(`  "${result}"`);
          remaining++;
        }
      }
    });
  });
  if (changed) {
    fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n');
  }
});
console.log(`\nAuto-fixed: ${fixed}, Remaining: ${remaining}`);
