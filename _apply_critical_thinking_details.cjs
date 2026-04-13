const fs = require("fs");
const path = require("path");

const CATEGORY = "critical-thinking";
const BASE = path.join(__dirname, "content", "topics", CATEGORY);

// Load all _details_*.json
const detailsFiles = fs.readdirSync(BASE).filter(f => f.startsWith("_details_") && f.endsWith(".json"));
console.log("Found", detailsFiles.length, "details files");

const allDetails = {};
for (const df of detailsFiles) {
  const data = JSON.parse(fs.readFileSync(path.join(BASE, df), "utf-8"));
  Object.assign(allDetails, data);
}
console.log("Loaded", Object.keys(allDetails).length, "topic details");

// Find all topic files recursively
function findTopicFiles(dir) {
  let results = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) results = results.concat(findTopicFiles(full));
    else if (e.name.endsWith(".topic.json")) results.push(full);
  }
  return results;
}

const topicFiles = findTopicFiles(BASE);
console.log("Found", topicFiles.length, "topic files");

let applied = 0, skipped = 0, missing = 0;
for (const tf of topicFiles) {
  const topic = JSON.parse(fs.readFileSync(tf, "utf-8"));
  const id = topic.id;
  if (!id) { skipped++; continue; }
  if (allDetails[id]) {
    topic.details = allDetails[id];
    fs.writeFileSync(tf, JSON.stringify(topic, null, 2) + "\n");
    applied++;
  } else {
    console.log("MISSING:", id);
    missing++;
  }
}
console.log(`Done: applied=${applied}, skipped=${skipped}, missing=${missing}`);
