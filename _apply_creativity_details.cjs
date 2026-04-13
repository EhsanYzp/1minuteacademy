const fs = require("fs");
const path = require("path");

const CATEGORY = "creativity";
const CONTENT_DIR = path.join(__dirname, "content", "topics", CATEGORY);

// Load all _details_*.json files
const detailFiles = fs.readdirSync(CONTENT_DIR).filter(f => f.startsWith("_details_") && f.endsWith(".json"));
console.log(`Found ${detailFiles.length} details files`);

let allDetails = {};
for (const file of detailFiles) {
  const data = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, file), "utf-8"));
  Object.assign(allDetails, data);
}
const totalKeys = Object.keys(allDetails).length;
console.log(`Loaded ${totalKeys} topic details`);

// Find all .topic.json files recursively
function findTopicFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findTopicFiles(full));
    } else if (entry.name.endsWith(".topic.json")) {
      results.push(full);
    }
  }
  return results;
}

const topicFiles = findTopicFiles(CONTENT_DIR);
console.log(`Found ${topicFiles.length} topic files`);

let applied = 0, skipped = 0, missing = 0;

for (const tf of topicFiles) {
  const topic = JSON.parse(fs.readFileSync(tf, "utf-8"));
  const id = topic.id;
  if (!id) { skipped++; continue; }
  if (!allDetails[id]) { missing++; console.log(`MISSING: ${id}`); continue; }
  topic.details = allDetails[id];
  fs.writeFileSync(tf, JSON.stringify(topic, null, 2) + "\n");
  applied++;
}

console.log(`\nDone: applied=${applied}, skipped=${skipped}, missing=${missing}`);
