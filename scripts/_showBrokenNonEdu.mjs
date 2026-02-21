import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const PLANS_DIR = "content/course-plans";
const BEATS = ["hook", "buildup", "discovery", "twist", "climax", "punchline"];
const GOOD = new Set([".", "!", "?", ")", "'", '"', ":", ";"]);

const files = readdirSync(PLANS_DIR).filter(f => f.endsWith(".json")).sort();

for (const file of files) {
  const cat = file.split("--")[0];
  if (cat === "education") continue; // skip education, we'll delete those
  const plan = JSON.parse(readFileSync(join(PLANS_DIR, file), "utf8"));
  for (const topic of plan.topics) {
    for (const beat of BEATS) {
      const text = topic.story?.[beat]?.text?.trim();
      if (!text) continue;
      if (!GOOD.has(text.slice(-1))) {
        console.log("FILE: " + file);
        console.log("TOPIC: " + topic.title);
        console.log("BEAT: " + beat);
        console.log("TEXT (" + text.length + "): " + text);
        console.log("---");
      }
    }
  }
}
