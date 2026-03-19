const fs = require("fs");

// Fix lost-cities: add 6th topic to ch05
const lcPath = "content/course-plans/archaeology--lost-cities-of-the-ancient-world.json";
const lc = JSON.parse(fs.readFileSync(lcPath, "utf8"));
lc.topics.push({
  title: "El Dorado: Chasing Golden Ghosts",
  chapter_id: "archaeology--lost-cities-of-the-ancient-world--ch05-the-search-continues",
  is_free: false,
  story: {
    hook: { text: "Conquistadors searched decades for a city of gold. It never existed, but the hunt shaped a continent.", visual: "\u{1F30E}" },
    buildup: { text: "The legend began with a Muisca chief who coated himself in gold dust and dove into a lake.", visual: "\u{1F451}" },
    discovery: { text: "Lake Guatavita in Colombia was partially drained. Gold objects were found in the mud.", visual: "\u{1F4B0}" },
    twist: { text: "El Dorado was a ritual, not a place. The Spanish turned a ceremony into a fantasy.", visual: "\u{1F914}" },
    climax: { text: "The search drove the conquest of the Amazon and the destruction of real empires.", visual: "\u2694\uFE0F" },
    punchline: { text: "The city of gold never existed. The search for it destroyed real ones.", visual: "\u{1F494}" }
  },
  quiz: {
    question: "What was El Dorado originally?",
    options: [
      "A vast underground city filled with Aztec gold",
      "A Muisca ritual where a gold-covered chief dove into a lake",
      "A Spanish fort built to store stolen treasure"
    ],
    correct: 1
  }
});
fs.writeFileSync(lcPath, JSON.stringify(lc, null, 2) + "\n");
console.log("Fixed lost-cities:", lc.topics.length, "topics");

// Fix roman-archaeology: add 6th topic to ch05
const raPath = "content/course-plans/archaeology--roman-archaeology.json";
const ra = JSON.parse(fs.readFileSync(raPath, "utf8"));
ra.topics.push({
  title: "Roman Roads: Paths That Shaped Europe",
  chapter_id: "archaeology--roman-archaeology--ch05-romes-legacy-in-stone",
  is_free: false,
  story: {
    hook: { text: "Roman roads were so well built that many are still followed by modern highways today.", visual: "\u{1F6E3}\uFE0F" },
    buildup: { text: "Engineers layered gravel, sand, and stone slabs with drainage ditches on each side.", visual: "\u{1FAA8}" },
    discovery: { text: "Over 250,000 miles of roads connected the empire. The network took centuries to build.", visual: "\u{1F30D}" },
    twist: { text: "Roads were military tools first. Legions needed to march fast. Trade came second.", visual: "\u2694\uFE0F" },
    climax: { text: "LiDAR and aerial photos keep revealing lost Roman roads under modern fields.", visual: "\u{1F6F0}\uFE0F" },
    punchline: { text: "Roman engineers built roads to last forever. They nearly succeeded.", visual: "\u{1F3C6}" }
  },
  quiz: {
    question: "What was the primary purpose of Roman roads?",
    options: [
      "Facilitating trade between wealthy merchants",
      "Military movement so legions could march quickly across the empire",
      "Connecting religious temples and sacred sites across provinces"
    ],
    correct: 1
  }
});
fs.writeFileSync(raPath, JSON.stringify(ra, null, 2) + "\n");
console.log("Fixed roman-archaeology:", ra.topics.length, "topics");
