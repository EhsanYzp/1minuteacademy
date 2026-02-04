// Step Recipes: a large catalog of "micro-interactions" (recipes)
// implemented by a smaller set of primitives (baseType).
//
// Why recipes?
// - You can have 200+ distinct step IDs (vibes/skins/rules) without shipping 200 React components.
// - Each module can pick 4–5 recipes so the experience feels different.
// - Over time we expand the primitive set; recipes can migrate to new baseTypes.

function makeRecipe(id, name, baseType, defaults) {
  return { id, name, baseType, defaults: defaults ?? {} };
}

const RECIPES = [];

// 1) Either/Or (ultra-fast: 1 tap) — 60 recipes
const eitherOrVariants = [
  { key: 'thisOrThat', label: 'This-or-That' },
  { key: 'mythFact', label: 'Myth-vs-Fact' },
  { key: 'leftRight', label: 'Left-vs-Right' },
];
for (let i = 1; i <= 60; i += 1) {
  const v = eitherOrVariants[(i - 1) % eitherOrVariants.length];
  RECIPES.push(
    makeRecipe(
      `eitherOr_${v.key}_${String(i).padStart(2, '0')}`,
      `${v.label} Pick (${i})`,
      'eitherOr',
      {
        variant: v.key,
        prompt: v.key === 'mythFact' ? 'Pick: myth or fact.' : 'Pick one.'
      }
    )
  );
}

// 2) Tap Sprint (ultra-fast: 6–12 taps) — 60 recipes
const sprintVariants = [
  { key: 'meter', label: 'Charge Meter' },
  { key: 'battery', label: 'Fill Battery' },
  { key: 'boost', label: 'Boost Bar' },
];
for (let i = 1; i <= 60; i += 1) {
  const v = sprintVariants[(i - 1) % sprintVariants.length];
  const target = 6 + ((i - 1) % 7); // 6..12
  RECIPES.push(
    makeRecipe(
      `tapSprint_${v.key}_${String(i).padStart(2, '0')}`,
      `${v.label} (${i})`,
      'tapSprint',
      {
        variant: v.key,
        targetTaps: target,
        prompt: 'Tap to fill it up!'
      }
    )
  );
}

// 3) Tap Reveal (fast: 1 tap) — 40 recipes (skins/vibes)
const revealSkins = [
  { key: 'crate', title: 'Open the Crate', prompt: 'Tap to open!' },
  { key: 'curtain', title: 'Pull the Curtain', prompt: 'Tap to reveal!' },
  { key: 'xray', title: 'X-ray Vision', prompt: 'Tap to scan!' },
  { key: 'peel', title: 'Peel the Layer', prompt: 'Tap to peel!' },
  { key: 'envelope', title: 'Open the Envelope', prompt: 'Tap to open!' },
];
// Generate 8 variants per skin so IDs are stable and intuitive:
// tapReveal_<skin>_01..08  => 5 skins * 8 = 40
for (const s of revealSkins) {
  for (let i = 1; i <= 8; i += 1) {
    RECIPES.push(
      makeRecipe(
        `tapReveal_${s.key}_${String(i).padStart(2, '0')}`,
        `Reveal Skin: ${s.key} (${i})`,
        'tapReveal',
        {
          title: s.title,
          prompt: s.prompt,
          successText: '✅ Revealed!',
        }
      )
    );
  }
}

// 4) Build Chain (fast: 2–4 taps) — 40 recipes
const chainThemes = [
  { key: 'link', title: 'Connect the Links', hint: 'Tap to connect them.' },
  { key: 'stack', title: 'Stack the Pieces', hint: 'Tap to stack them.' },
  { key: 'pipeline', title: 'Build the Pipeline', hint: 'Tap to add stages.' },
  { key: 'ladder', title: 'Climb the Ladder', hint: 'Tap to add rungs.' },
];
for (let i = 1; i <= 40; i += 1) {
  const t = chainThemes[(i - 1) % chainThemes.length];
  const target = 2 + ((i - 1) % 3); // 2..4
  RECIPES.push(
    makeRecipe(
      `buildChain_${t.key}_${String(i).padStart(2, '0')}`,
      `Chain Theme: ${t.key} (${i})`,
      'buildChain',
      {
        title: t.title,
        hint: t.hint,
        target,
        successText: '✅ Built!'
      }
    )
  );
}

export const STEP_RECIPES = Object.freeze(RECIPES);

const byId = new Map(STEP_RECIPES.map((r) => [r.id, r]));

export function getStepRecipe(id) {
  return byId.get(id) ?? null;
}
