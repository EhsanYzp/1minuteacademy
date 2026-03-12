const lines = [
  // 1. Planetary Atmospheres buildup (was 127)
  "Atmospheres come from volcanic outgassing and comet impacts. Gravity and distance from the Sun determine what stays.",
  // 2. Europa's Ocean buildup (was 122)
  "Europa's ice surface is cracked and young. Tidal heating from Jupiter keeps the interior warm enough for liquid.",
  // 3. Titan's Surface climax (was 121)
  "Titan is Earth's strangest twin. Familiar processes run on alien chemistry, creating a landscape both eerie and known.",
  // 4. Io's Volcanoes buildup (was 124)
  "Tidal heating from Jupiter and nearby moons squeezes Io's interior, generating enough heat to drive constant eruptions.",
  // 5. Comets discovery (was 121)
  "Rosetta landed on Comet 67P in 2014. It found organic molecules and confirmed comets carry complex chemistry.",
];
lines.forEach((l, i) => console.log(`${i + 1}. ${l.length} chars`));
