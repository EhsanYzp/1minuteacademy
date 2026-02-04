import { STEP_RECIPES } from '../src/engine/stepRecipes.js';

function parseArgs(argv) {
  const args = { n: 4, seed: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--n') {
      const v = Number(argv[i + 1]);
      if (!Number.isFinite(v) || v < 1 || v > 10) throw new Error('Invalid --n (1..10)');
      args.n = Math.floor(v);
      i += 1;
    } else if (a === '--seed') {
      args.seed = String(argv[i + 1] ?? '');
      i += 1;
    } else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/pickStepMix.mjs [--n 4] [--seed any]');
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }
  return args;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedToInt(s) {
  if (!s) return Math.floor(Math.random() * 2 ** 31);
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickDiverse(recipes, n, rand) {
  const byBase = new Map();
  for (const r of recipes) {
    const arr = byBase.get(r.baseType) ?? [];
    arr.push(r);
    byBase.set(r.baseType, arr);
  }

  const baseTypes = Array.from(byBase.keys());
  const out = [];

  // First pass: try to pick unique base types.
  while (out.length < n && baseTypes.length > 0) {
    const idx = Math.floor(rand() * baseTypes.length);
    const bt = baseTypes.splice(idx, 1)[0];
    const arr = byBase.get(bt) ?? [];
    if (arr.length === 0) continue;
    const r = arr[Math.floor(rand() * arr.length)];
    out.push(r);
  }

  // Fill remaining from entire pool.
  while (out.length < n) {
    out.push(recipes[Math.floor(rand() * recipes.length)]);
  }

  return out;
}

const args = parseArgs(process.argv.slice(2));
const rand = mulberry32(seedToInt(args.seed));

const picked = pickDiverse(STEP_RECIPES, args.n, rand);
console.log(`Picked ${args.n} step recipe(s):`);
for (const r of picked) {
  console.log(`- ${r.id}  [baseType=${r.baseType}]  ${r.name}`);
}
