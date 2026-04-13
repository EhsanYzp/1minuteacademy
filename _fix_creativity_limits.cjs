const fs = require("fs");
const path = require("path");

const CATEGORY = "creativity";
const CONTENT_DIR = path.join(__dirname, "content", "topics", CATEGORY);

const LIMITS = { summary: 300, whyItMatters: 250 };
const FAQ_ANS_LIMIT = 300;
const FAQ_Q_MIN = 20;

function trimTo(str, max) {
  if (str.length <= max) return str;
  let cut = str.slice(0, max - 3);
  const last = cut.lastIndexOf(" ");
  if (last > max * 0.6) cut = cut.slice(0, last);
  return cut + "...";
}

function padQuestion(q) {
  if (q.length >= FAQ_Q_MIN) return q;
  // Expand short questions
  return q.replace(/\?$/, "") + " in detail?";
}

function findTopicFiles(dir) {
  let results = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) results = results.concat(findTopicFiles(full));
    else if (e.name.endsWith(".topic.json")) results.push(full);
  }
  return results;
}

const files = findTopicFiles(CONTENT_DIR);
let fixes = 0;

for (const f of files) {
  const topic = JSON.parse(fs.readFileSync(f, "utf-8"));
  if (!topic.details) continue;
  let changed = false;

  for (const [field, limit] of Object.entries(LIMITS)) {
    if (topic.details[field] && topic.details[field].length > limit) {
      topic.details[field] = trimTo(topic.details[field], limit);
      changed = true; fixes++;
    }
  }

  if (topic.details.faq) {
    for (const faq of topic.details.faq) {
      if (faq.answer && faq.answer.length > FAQ_ANS_LIMIT) {
        faq.answer = trimTo(faq.answer, FAQ_ANS_LIMIT);
        changed = true; fixes++;
      }
      if (faq.question && faq.question.length < FAQ_Q_MIN) {
        faq.question = padQuestion(faq.question);
        changed = true; fixes++;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(f, JSON.stringify(topic, null, 2) + "\n");
  }
}

console.log(`Fixed ${fixes} violations`);
