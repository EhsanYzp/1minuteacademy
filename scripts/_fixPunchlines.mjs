import fs from 'fs';

const fixes = [
  // Big Bang
  {
    file: 'content/course-plans/science--the-big-bang-and-the-universe.json',
    replacements: {
      "Space expanded faster than light. The rules of physics allow it because space isn't a thing.": "Space expanded faster than light. Physics allows it — space isn't a thing.",
      "A star is a battle between gravity crushing inward and fusion pushing out. The tie is called a star.": "Gravity crushes in. Fusion pushes out. The tie between them is called a star.",
      "A city-sized ball of neutrons spinning 700 times per second. The universe builds weird things.": "A city-sized neutron ball spinning 700 times per second. Nature is weird.",
      "A big enough black hole would let you cross the point of no return peacefully. Then eat you.": "A big enough black hole lets you pass the point of no return calmly. Then eats you.",
      "We measured a wobble smaller than an atom caused by an event a billion years ago. That's precision.": "A wobble smaller than an atom, from a billion years ago. We measured it.",
      "The universe is suspiciously quiet. Either we're alone or something stops civilizations from reaching us.": "The universe is suspiciously quiet. Either we're alone or being avoided.",
      "The universe will die not with a bang but with a slow fade to nothing. Entropy always wins.": "The universe dies not with a bang but a slow fade to nothing. Entropy wins.",
      "The Big Crunch is probably not our fate. Dark energy is pushing the universe apart forever.": "The Big Crunch is unlikely. Dark energy pushes the universe apart forever.",
    }
  },
  // Famous Experiments
  {
    file: 'content/course-plans/science--famous-experiments.json',
    replacements: {
      "The most important null result in science. Finding nothing proved that light needs no medium.": "Science's most famous null result. Finding nothing proved light needs no medium.",
      "Fire doesn't release a mystery substance. It's oxygen combining with fuel. Lavoisier weighed the proof.": "No mystery substance. Fire is oxygen plus fuel. Lavoisier weighed the proof.",
      "Marie Curie's research literally killed her. Her notebooks are still too radioactive to handle.": "Curie's research killed her. Her notebooks are still too radioactive to touch.",
      "Lightning, water, and simple gases made life's ingredients. Nature's recipe isn't that complicated.": "Lightning, water, and gas made life's ingredients. Nature's recipe is simple.",
      "The secret of life is a twisted ladder. Franklin photographed it. Watson and Crick got the Nobel.": "Life's secret: a twisted ladder. Franklin photographed it. Others got the Nobel.",
      "The first antibiotic was discovered by accident — mold on a dirty dish. Sloppiness saved millions.": "First antibiotic: mold on a dirty dish, found by accident. Sloppiness saved millions.",
      "Different beaks for different seeds. That simple observation led to evolution's greatest theory.": "Different beaks for different seeds. One observation launched evolution theory.",
      "Cavendish weighed the entire Earth using two lead balls and a piece of wire. Genius is subtle.": "Cavendish weighed Earth using two lead balls and a wire. Genius is subtle.",
      "A 'blank' spot in the sky held 3,000 galaxies. Empty space isn't empty — it's full of universes.": "A 'blank' patch of sky held 3,000 galaxies. The void is full of worlds.",
      "An eclipse proved that space itself bends. Einstein was right and became the world's most famous physicist.": "An eclipse proved space bends. Einstein was right — and became world-famous.",
      "Two-thirds of people shocked a stranger to the max. Obedience to authority is disturbingly powerful.": "Two-thirds delivered maximum shock. Authority overrides personal morality.",
      "The marshmallow test isn't just about willpower. It's about trust, strategy, and environment.": "It's not just willpower. It's about trust, strategy, and environment.",
      "Love isn't about food. Baby monkeys proved that comfort and warmth matter more than calories.": "Love isn't about food. Baby monkeys proved comfort matters more than calories.",
      "Half the people couldn't see a gorilla right in front of them. Attention isn't what you think.": "Half the people missed a gorilla in plain sight. Attention isn't what you think.",
      "We can now edit genes like text. A bacterial defense system gave us the power to rewrite life.": "We can edit genes like text. Bacteria gave us the power to rewrite life.",
      "A sheep was copied from one cell. She was named after a singer and changed biology forever.": "A sheep cloned from one cell. Named after a singer. Biology changed forever.",
      "R\u00f6ntgen discovered invisible rays that see through skin. His wife's skeleton was the first X-ray image.": "Invisible rays that see through skin. His wife's skeleton was the first X-ray.",
    }
  },
  // Electricity and Magnetism
  {
    file: 'content/course-plans/science--electricity-and-magnetism.json',
    replacements: {
      "Electric force is far stronger than gravity. A tiny balloon beats Earth's pull on your hair.": "Electric force dwarfs gravity. A tiny balloon beats Earth's pull on your hair.",
      "Lightning is nature discharging static electricity. The same physics as a doorknob shock — just bigger.": "Lightning is a giant static discharge. Same physics as a doorknob shock.",
      "Conductors let charge flow. Insulators block it. Semiconductors switch between both — that's a computer.": "Conductors flow. Insulators block. Semiconductors switch — that's a computer.",
      "Electrons crawl through wire. But the push travels at light speed. That's why lights turn on instantly.": "Electrons crawl through wire. The push moves at light speed. Lights turn on fast.",
      "V equals I times R. Three letters that run the entire electrical world. Ohm was ignored for years.": "V = I times R. Three letters run the electrical world. Ohm was ignored for years.",
      "Series: one path, all share. Parallel: many paths, all independent. Your house uses parallel for good reason.": "Series: one shared path. Parallel: independent paths. Your house picks parallel.",
      "The first battery was a stack of metal discs and wet cloth. It powers every battery concept since.": "First battery: metal discs and wet cloth. Every battery since follows suit.",
      "Magnetism is just electrons spinning in sync. Align enough of them and iron becomes a magnet.": "Magnetism is electrons spinning in sync. Align enough and iron becomes a magnet.",
      "A river of liquid iron protects us from solar radiation. Earth's core is our invisible shield.": "A river of liquid iron shields us from solar radiation. An invisible armor.",
      "The 'north' pole of your compass points to Earth's magnetic south pole. Naming is confusing.": "Your compass's north points to Earth's magnetic south pole. Naming is confusing.",
      "No wheels. No contact. Just magnets pushing against gravity. Trains that fly without leaving the ground.": "No wheels. No contact. Just magnets vs gravity. Trains that fly on the ground.",
      "A twitching compass changed physics forever. Electricity and magnetism are two sides of one force.": "A twitching compass changed physics. Electricity and magnetism are one force.",
      "Move a magnet near wire and electricity flows. Every power plant on Earth uses this one trick.": "Move a magnet near wire and current flows. Every power plant uses this trick.",
      "Four equations explained light, radio, and X-rays. Maxwell unified forces with pure mathematics.": "Four equations explain light, radio, and X-rays. Maxwell unified forces with math.",
      "A motor is a magnet and a wire. Spin it to get electricity. Push current through it to get motion.": "A motor is a magnet and wire. Spin it for electricity. Push current for motion.",
      "You see a tiny fraction of reality. The rest is invisible waves that carry music, heat, and data.": "You see a sliver of reality. The rest is invisible waves carrying music and data.",
      "Coal, nuclear, wind, hydro — they all just spin magnets. The energy source differs; the physics doesn't.": "Coal, nuclear, wind, hydro — all just spin magnets. Sources differ; physics doesn't.",
      "Tesla's AC won the war. Your wall outlets run on it. Edison's DC powers your phone charger.": "Tesla's AC won. Your outlets use it. Edison's DC charges your phone.",
      "Watts measure power. Kilowatt-hours measure energy. Your bill charges for how long you use how much.": "Watts measure power. Kilowatt-hours measure energy. Your bill charges for both.",
      "A battery is a chemical reaction that pushes electrons. Recharge it and the reaction runs backward.": "A battery pushes electrons via chemistry. Recharge it and the reaction reverses.",
      "Zero resistance means perfect conduction. Current flows forever. But you need extreme cold — for now.": "Zero resistance: current flows forever. You just need extreme cold — for now.",
      "Sunlight hits silicon, electrons move, and you get electricity. No burning, no spinning, no noise.": "Sunlight hits silicon and electrons flow. No burning, no spinning, no noise.",
      "The grid balances supply and demand every second. One glitch can black out 55 million people.": "Supply and demand balanced every second. One glitch blacks out 55 million.",
      "Wireless charging is Faraday's 1831 experiment, shrunk into your phone. Same magnet trick, new packaging.": "Faraday's 1831 experiment shrunk into your phone. Same magnet trick, new package.",
    }
  }
];

let totalFixed = 0;
for (const { file, replacements } of fixes) {
  let content = fs.readFileSync(file, 'utf8');
  let count = 0;
  for (const [old, rep] of Object.entries(replacements)) {
    if (content.includes(old)) {
      content = content.replace(old, rep);
      count++;
    } else {
      console.log(`NOT FOUND in ${file}: "${old.substring(0, 60)}..."`);
    }
  }
  fs.writeFileSync(file, content);
  console.log(`Fixed ${count}/${Object.keys(replacements).length} in ${file}`);
  totalFixed += count;
}
console.log(`\nTotal fixed: ${totalFixed}`);
