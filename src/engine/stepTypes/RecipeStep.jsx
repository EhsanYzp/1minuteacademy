import IntroStep from './IntroStep';
import TapRevealStep from './TapRevealStep';
import BuildChainStep from './BuildChainStep';
import SummaryStep from './SummaryStep';
import EitherOrStep from './EitherOrStep';
import TapSprintStep from './TapSprintStep';
import { getStepRecipe } from '../stepRecipes';

const baseComponents = {
  intro: IntroStep,
  tapReveal: TapRevealStep,
  buildChain: BuildChainStep,
  summary: SummaryStep,
  eitherOr: EitherOrStep,
  tapSprint: TapSprintStep,
};

export default function RecipeStep({ step, onInteract, interacted }) {
  const recipeId = step?.recipeId;
  const recipe = recipeId ? getStepRecipe(recipeId) : null;

  if (!recipe) {
    return (
      <div className="step">
        <h2 className="step-title">🚧 Missing recipe</h2>
        <p className="step-text">
          This step uses type <b>recipe</b> but recipeId <b>{String(recipeId)}</b> was not found.
        </p>
      </div>
    );
  }

  const baseType = recipe.baseType;
  const Base = baseComponents[baseType];

  if (!Base) {
    return (
      <div className="step">
        <h2 className="step-title">🚧 Unsupported base type</h2>
        <p className="step-text">
          Recipe <b>{recipe.id}</b> points to baseType <b>{String(baseType)}</b> which is not implemented.
        </p>
      </div>
    );
  }

  // Merge: recipe defaults first, then step overrides.
  // Force base type so the primitive renderer receives a compatible shape.
  const merged = {
    ...recipe.defaults,
    ...step,
    type: baseType,
  };

  return <Base step={merged} onInteract={onInteract} interacted={interacted} />;
}
