const fs = require('fs');
const path = require('path');

const LIMITS = { hook: 120, buildup: 120, discovery: 120, twist: 120, climax: 120, punchline: 80 };
const dir = path.join(__dirname, '..', 'content', 'course-plans');
const files = fs.readdirSync(dir).filter(f => f.startsWith('startups--') && f.endsWith('.json')).map(f => path.join(dir, f));

const CONTRACTIONS = [
  [/\bdo not\b/gi, "don't"],
  [/\bdoes not\b/gi, "doesn't"],
  [/\bdid not\b/gi, "didn't"],
  [/\bcannot\b/gi, "can't"],
  [/\bcan not\b/gi, "can't"],
  [/\bwill not\b/gi, "won't"],
  [/\bwould not\b/gi, "wouldn't"],
  [/\bcould not\b/gi, "couldn't"],
  [/\bshould not\b/gi, "shouldn't"],
  [/\bis not\b/gi, "isn't"],
  [/\bare not\b/gi, "aren't"],
  [/\bwas not\b/gi, "wasn't"],
  [/\bwere not\b/gi, "weren't"],
  [/\bhas not\b/gi, "hasn't"],
  [/\bhave not\b/gi, "haven't"],
  [/\bhad not\b/gi, "hadn't"],
  [/\bit is\b/gi, "it's"],
  [/\bthat is\b/gi, "that's"],
  [/\bwhat is\b/gi, "what's"],
  [/\bthere is\b/gi, "there's"],
  [/\bthey are\b/gi, "they're"],
  [/\bwe are\b/gi, "we're"],
  [/\byou are\b/gi, "you're"],
  [/\bI am\b/g, "I'm"],
  [/\bI have\b/g, "I've"],
  [/\bthey have\b/gi, "they've"],
  [/\bwe have\b/gi, "we've"],
  [/\byou have\b/gi, "you've"],
  [/\bI will\b/g, "I'll"],
  [/\bthey will\b/gi, "they'll"],
  [/\bwho is\b/gi, "who's"],
  [/\blet us\b/gi, "let's"],
  [/\bhe is\b/gi, "he's"],
  [/\bshe is\b/gi, "she's"],
  [/\bhe has\b/gi, "he's"],
  [/\bshe has\b/gi, "she's"],
  [/\bit has\b/gi, "it's"],
];

const PHRASE_SHORTENINGS = [
  [/\bin order to\b/gi, 'to'],
  [/\ba large number of\b/gi, 'many'],
  [/\ba lot of\b/gi, 'many'],
  [/\bdue to the fact that\b/gi, 'because'],
  [/\bin spite of\b/gi, 'despite'],
  [/\bat this point in time\b/gi, 'now'],
  [/\bat the present time\b/gi, 'now'],
  [/\bfor the purpose of\b/gi, 'to'],
  [/\bin the event that\b/gi, 'if'],
  [/\bprior to\b/gi, 'before'],
  [/\bsubsequent to\b/gi, 'after'],
  [/\bwith regard to\b/gi, 'about'],
  [/\bin regard to\b/gi, 'about'],
  [/\bas a result of\b/gi, 'from'],
  [/\bthe majority of\b/gi, 'most'],
  [/\bin addition to\b/gi, 'besides'],
  [/\bon a daily basis\b/gi, 'daily'],
  [/\beveryone else\b/gi, 'others'],
  [/\bvirtually\b/gi, 'nearly'],
  [/\bactually\b/gi, ''],
  [/\bbasically\b/gi, ''],
  [/\bessentially\b/gi, ''],
  [/\bcompletely\b/gi, 'fully'],
  [/\bsimultaneously\b/gi, 'at once'],
  [/\bapproximately\b/gi, 'about'],
  [/\badditionally\b/gi, 'also'],
  [/\bnevertheless\b/gi, 'still'],
  [/\bfurthermore\b/gi, 'also'],
  [/\bhowever\b/gi, 'but'],
  [/\btherefore\b/gi, 'so'],
  [/\bultimately\b/gi, 'in the end'],
  [/\bthe entire\b/gi, 'all'],
  [/\bof the\b/gi, 'of'],
  [/\band also\b/gi, 'and'],
  [/\bin particular\b/gi, 'especially'],
];

const FILLER_REMOVALS = [
  [/\s+— /g, '—'],
  [/\s*,\s*and\s+/g, ', and '],
  [/\s{2,}/g, ' '],
];

function trimAtSentenceBoundary(text, limit) {
  if (text.length <= limit) return text;
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences || sentences.length <= 1) return text;
  let result = '';
  for (const s of sentences) {
    const candidate = result ? result + ' ' + s.trim() : s.trim();
    if (candidate.length <= limit) {
      result = candidate;
    } else break;
  }
  return result || text;
}

function applyFixes(text, limit) {
  let t = text;
  for (const [pat, rep] of CONTRACTIONS) {
    t = t.replace(pat, rep);
  }
  t = t.replace(/\s{2,}/g, ' ').trim();
  if (t.length <= limit) return t;

  for (const [pat, rep] of PHRASE_SHORTENINGS) {
    t = t.replace(pat, rep);
    t = t.replace(/\s{2,}/g, ' ').trim();
    if (t.length <= limit) return t;
  }

  for (const [pat, rep] of FILLER_REMOVALS) {
    t = t.replace(pat, rep);
    t = t.replace(/\s{2,}/g, ' ').trim();
    if (t.length <= limit) return t;
  }

  t = trimAtSentenceBoundary(t, limit);
  return t;
}

let autoFixed = 0;
let remaining = 0;

for (const f of files) {
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  const base = path.basename(f);
  let changed = false;

  for (const t of data.topics) {
    for (const [beat, limit] of Object.entries(LIMITS)) {
      const text = t.story[beat]?.text;
      if (text && text.length > limit) {
        const fixed = applyFixes(text, limit);
        if (fixed.length <= limit) {
          t.story[beat].text = fixed;
          changed = true;
          autoFixed++;
        } else {
          remaining++;
          console.log(`[${base}] "${t.title}" ${beat}: ${fixed.length}/${limit}`);
          console.log(`  "${fixed}"`);
        }
      }
    }
  }

  if (changed) {
    fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n');
  }
}

console.log(`\nAuto-fixed: ${autoFixed}, Remaining: ${remaining}`);
