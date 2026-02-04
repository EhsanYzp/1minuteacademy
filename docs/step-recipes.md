# Step Recipes Catalog (200)

This catalog is a **large pool of step recipes** (200 IDs) that map onto a smaller set of **primitive step components**.

Why this exists:
- You want modules to feel different early.
- Shipping 200 separate React components would be slow to build and hard to maintain.
- Recipes let us pick 4–5 distinct "micro-interactions" per module, while we grow the primitive set over time.

## How recipes work

In lesson JSON you can use:

- `type: "recipe"`
- `recipeId: "..."` (choose from this list)

A recipe expands into a primitive base type (e.g. `eitherOr`, `tapSprint`, `tapReveal`, `buildChain`) plus defaults you can override per step.

## Implemented primitives (today)

- `intro`
- `tapReveal`
- `buildChain`
- `summary`
- `eitherOr` (1 tap, instant)
- `tapSprint` (6–12 taps, fast)
- `recipe` (wrapper that expands a recipe into one of the above)

## Recipe IDs

All recipe IDs are defined in `src/engine/stepRecipes.js`.

To print the full list (all 200) in your terminal:

- `node scripts/listStepRecipes.mjs`

### Either/Or (60)

Pattern:
- `eitherOr_<variant>_<nn>` where variant ∈ `{thisOrThat,mythFact,leftRight}`

Examples:
- `eitherOr_thisOrThat_01`
- `eitherOr_mythFact_02`
- `eitherOr_leftRight_03`

### Tap Sprint (60)

Pattern:
- `tapSprint_<variant>_<nn>` where variant ∈ `{meter,battery,boost}`

Examples:
- `tapSprint_meter_01`
- `tapSprint_battery_02`
- `tapSprint_boost_03`

### Tap Reveal skins (40)

Pattern:
- `tapReveal_<skin>_<nn>` where skin ∈ `{crate,curtain,xray,peel,envelope}`

Examples:
- `tapReveal_crate_01`
- `tapReveal_xray_02`

### Build Chain themes (40)

Pattern:
- `buildChain_<theme>_<nn>` where theme ∈ `{link,stack,pipeline,ladder}`

Examples:
- `buildChain_pipeline_01`
- `buildChain_stack_02`

## Picking a mix per module

Rule of thumb for a 60s module:
- 1 hook (`intro` or a recipe that feels like a hook)
- 2 fast interactions (`eitherOr` / `tapSprint` / `tapReveal` / `buildChain`)
- 1 payoff (`summary`)

If you want, we can add a helper script to randomly suggest 4–5 recipe IDs that are diverse (not all the same base type).
