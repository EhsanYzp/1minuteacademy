function toArray(x) {
  return Array.isArray(x) ? x : x == null ? [] : [x];
}

export function whenMatches(when, ctx) {
  if (!when) return true;
  if (!ctx) return false;

  if (typeof when.completed === 'boolean' && Boolean(ctx.completed) !== when.completed) return false;
  if (typeof when.canStart === 'boolean' && Boolean(ctx.canStart) !== when.canStart) return false;
  if (typeof when.canReview === 'boolean' && Boolean(ctx.canReview) !== when.canReview) return false;
  if (typeof when.loggedIn === 'boolean' && Boolean(ctx.loggedIn) !== when.loggedIn) return false;

  if (when.tier != null) {
    const allowed = new Set(toArray(when.tier).map(String));
    if (!allowed.has(String(ctx.tier))) return false;
  }

  return true;
}
