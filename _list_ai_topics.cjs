const fs = require('fs');
const path = require('path');
const glob = require('path');

function walk(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(walk(full));
    else if (entry.name.endsWith('.topic.json')) results.push(full);
  }
  return results;
}

const topicFiles = walk('content/topics/ai');
const byCourse = {};
for (const fp of topicFiles) {
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const courseId = data.course_id || 'unknown';
  if (!byCourse[courseId]) byCourse[courseId] = [];
  byCourse[courseId].push({ id: data.id, title: data.title });
}
const courseIds = Object.keys(byCourse).sort();
for (const cid of courseIds) {
  const topics = byCourse[cid];
  console.log(cid + ' (' + topics.length + ' topics):');
  topics.forEach(t => console.log('  ' + t.id + ' | ' + t.title));
  console.log('');
}
