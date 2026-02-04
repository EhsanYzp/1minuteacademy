import { STEP_RECIPES } from '../src/engine/stepRecipes.js';

for (const r of STEP_RECIPES) {
  console.log(`${r.id}\t${r.baseType}\t${r.name}`);
}

console.error(`\nTotal: ${STEP_RECIPES.length}`);
