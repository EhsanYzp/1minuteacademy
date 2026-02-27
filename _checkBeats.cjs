const f = process.argv[2] || "./content/course-plans/sexual-health--reproductive-anatomy.json";
const d = require(f);
let issues = 0;
d.topics.forEach((t, i) => {
  ["hook","buildup","discovery","twist","climax","punchline"].forEach(b => {
    const len = t.story[b].text.length;
    const max = b === "punchline" ? 80 : 120;
    if (len > max) {
      issues++;
      console.log("Topic " + (i+1) + " [" + t.title + "] " + b + ": " + len + " chars (max " + max + ")");
    }
  });
});
if (issues === 0) console.log("All beats within limits.");
else console.log(issues + " issues found.");
