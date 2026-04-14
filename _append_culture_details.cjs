const fs = require('fs');
const path = require('path');

const cultureDir = path.join(__dirname, 'content/topics/culture');

// Find all _details_*.json files
const detailsFiles = fs.readdirSync(cultureDir).filter(f => f.startsWith('_details_') && f.endsWith('.json'));
console.log(`Found ${detailsFiles.length} details files`);

let updated = 0;
let notFound = 0;
let alreadyHas = 0;
const errors = [];

for (const df of detailsFiles) {
  const detailsMap = JSON.parse(fs.readFileSync(path.join(cultureDir, df), 'utf8'));
  const topicIds = Object.keys(detailsMap);
  console.log(`\n${df}: ${topicIds.length} topics`);

  for (const topicId of topicIds) {
    // Find the .topic.json file
    const parts = topicId.split('--');
    // Pattern: culture--<course>--t-<slug>
    // File: content/topics/culture/<courseId>/<chapterId>/<topicId>.topic.json
    // We need to find it by searching
    const courseSlug = `culture--${parts[1]}`;
    const courseDir = path.join(cultureDir, courseSlug);
    
    if (!fs.existsSync(courseDir)) {
      errors.push(`Course dir not found: ${courseDir}`);
      notFound++;
      continue;
    }

    // Search recursively for the topic file
    let found = false;
    const searchDir = (dir) => {
      if (found) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (found) return;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          searchDir(fullPath);
        } else if (entry.name === `${topicId}.topic.json`) {
          // Read, merge, write
          const topic = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          if (topic.details) {
            alreadyHas++;
            found = true;
            return;
          }
          topic.details = detailsMap[topicId];
          fs.writeFileSync(fullPath, JSON.stringify(topic, null, 2) + '\n', 'utf8');
          updated++;
          found = true;
        }
      }
    };
    searchDir(courseDir);

    if (!found) {
      errors.push(`Topic file not found: ${topicId}`);
      notFound++;
    }
  }
}

console.log(`\n--- Summary ---`);
console.log(`Updated: ${updated}`);
console.log(`Already had details: ${alreadyHas}`);
console.log(`Not found: ${notFound}`);
if (errors.length) {
  console.log(`\nErrors:`);
  errors.forEach(e => console.log(`  - ${e}`));
}
