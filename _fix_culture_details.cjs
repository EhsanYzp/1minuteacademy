const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'content/topics/culture');
const files = fs.readdirSync(dir).filter(f => f.startsWith('_details_') && f.endsWith('.json'));

function trimToLimit(text, limit) {
  if (text.length <= limit) return text;
  // Try to cut at the last sentence boundary within limit
  const truncated = text.slice(0, limit);
  const lastPeriod = truncated.lastIndexOf('. ');
  const lastExcl = truncated.lastIndexOf('! ');
  const lastQ = truncated.lastIndexOf('? ');
  const best = Math.max(lastPeriod, lastExcl, lastQ);
  if (best > limit * 0.5) {
    return text.slice(0, best + 1);
  }
  // If no good sentence boundary, cut at last period at end
  if (truncated.endsWith('.') || truncated.endsWith('!') || truncated.endsWith('?')) {
    return truncated;
  }
  // Try ending at last sentence-ender
  for (let i = limit - 1; i > limit * 0.5; i--) {
    if (text[i] === '.' || text[i] === '!' || text[i] === '?') {
      return text.slice(0, i + 1);
    }
  }
  // Last resort: cut at last space and add period
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > limit * 0.5) {
    let cut = text.slice(0, lastSpace);
    // Remove trailing comma/conjunction
    cut = cut.replace(/[,;:\s]+$/, '');
    if (!/[.!?]$/.test(cut)) cut += '.';
    return cut;
  }
  return truncated;
}

// Short question expansions
const questionFixes = {
  "How does Obon work?": "How does the Obon festival work in Japan?",
  "What is Bon Odori?": "What is the Bon Odori dance tradition?",
  "Is all food fusion?": "Is all food essentially fusion food?",
  "What is baksheesh?": "What is baksheesh and how does it work?",
  "What is omertà?": "What is omertà and where does it originate?",
  "What are ley lines?": "What are ley lines exactly?",
  "Who was Kūkai?": "Who was Kūkai and why is he important?"
};

let fixedSummary = 0, fixedQ = 0, fixedA = 0;

for (const f of files) {
  const filePath = path.join(dir, f);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let changed = false;

  for (const [id, d] of Object.entries(data)) {
    // Fix summaries >300
    if (d.summary && d.summary.length > 300) {
      d.summary = trimToLimit(d.summary, 300);
      fixedSummary++;
      changed = true;
    }

    // Fix FAQ
    for (const faq of d.faq || []) {
      // Fix short questions
      if (faq.question && faq.question.length < 20) {
        if (questionFixes[faq.question]) {
          faq.question = questionFixes[faq.question];
          fixedQ++;
          changed = true;
        }
      }
      // Fix long answers
      if (faq.answer && faq.answer.length > 300) {
        faq.answer = trimToLimit(faq.answer, 300);
        fixedA++;
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`Fixed: ${f}`);
  }
}

console.log(`\nSummaries fixed: ${fixedSummary}`);
console.log(`Questions fixed: ${fixedQ}`);
console.log(`Answers fixed: ${fixedA}`);
console.log(`Total fixes: ${fixedSummary + fixedQ + fixedA}`);

// Verify no violations remain
let remaining = 0;
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const [id, d] of Object.entries(data)) {
    if (d.summary && d.summary.length > 300) { remaining++; console.log(`STILL OVER - summary: ${id} (${d.summary.length})`); }
    for (const faq of d.faq || []) {
      if (faq.question && faq.question.length < 20) { remaining++; console.log(`STILL SHORT - question: ${id} (${faq.question.length})`); }
      if (faq.answer && faq.answer.length > 300) { remaining++; console.log(`STILL OVER - answer: ${id} (${faq.answer.length})`); }
    }
  }
}
console.log(`\nRemaining violations: ${remaining}`);
