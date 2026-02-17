const DEV_TIER_KEY = 'oma_dev_tier';

// Tiers:
// - guest: not signed in (web), can play Beginner only, no progress, no review
// - free: signed in but not Pro, can play Beginner only, progress enabled, no review
// - pro: signed in and Pro, can play all, progress enabled, review enabled

export function getTierFromUser(user) {
  if (!user) return 'guest';
  const paused = Boolean(user?.user_metadata?.paused);
  if (paused) return 'paused';
  const plan = String(user?.user_metadata?.plan ?? user?.app_metadata?.plan ?? 'free').toLowerCase();
  if (plan === 'pro' || plan === 'premium') return 'pro';
  return 'free';
}

export function getDevTierOverride() {
  if (!import.meta.env.DEV) return null;
  try {
    const raw = window?.localStorage?.getItem(DEV_TIER_KEY);
    const v = String(raw ?? '').toLowerCase();
    if (v === 'guest' || v === 'free' || v === 'pro') return v;
  } catch {
    // ignore
  }

  const env = String(import.meta.env.VITE_BILLING_TIER ?? '').toLowerCase();
  if (env === 'guest' || env === 'free' || env === 'pro') return env;
  return null;
}

export function setDevTierOverride(nextTier) {
  if (!import.meta.env.DEV) return;
  const v = String(nextTier ?? '').toLowerCase();
  if (v !== 'guest' && v !== 'free' && v !== 'pro') return;
  try {
    window?.localStorage?.setItem(DEV_TIER_KEY, v);
  } catch {
    // ignore
  }
}

export function getCurrentTier(user) {
  // Dev override for quickly testing gates.
  const dev = getDevTierOverride();
  if (dev) return dev;

  // Default behavior (both Supabase + Local Preview): tier follows auth.
  // This prevents “still Pro after logout”.
  return getTierFromUser(user);
}

export function isBeginnerTopic(topicRow) {
  const difficulty = String(topicRow?.difficulty ?? 'Beginner');
  return difficulty.toLowerCase() === 'beginner';
}

export function isPremiumTopic(topicRow) {
  const difficulty = String(topicRow?.difficulty ?? 'Beginner');
  return difficulty.toLowerCase() === 'premium';
}

export function isProOnlyTopic(topicRow) {
  // Premium is Pro-only. Intermediate/Advanced are also Pro-only.
  if (isPremiumTopic(topicRow)) return true;
  return !isBeginnerTopic(topicRow);
}

export function getTopicGate({ tier, topicRow, expertMinutes = 0 }) {
  if (tier === 'paused') {
    return { locked: true, reason: 'paused', label: 'Account paused' };
  }

  // expertMinutes is intentionally not used for access. Minute Expert + badges are Pro-only,
  // and Premium topics remain Pro-only.
  void expertMinutes;

  if (tier === 'pro') {
    return { locked: false, reason: null, label: null };
  }

  if (isProOnlyTopic(topicRow)) {
    return { locked: true, reason: 'pro', label: 'Pro only' };
  }

  return { locked: false, reason: null, label: null };
}

export function canStartTopic({ tier, topicRow, expertMinutes = 0 }) {
  return !getTopicGate({ tier, topicRow, expertMinutes })?.locked;
}

export function canTrackProgress(tier) {
  if (tier === 'paused') return false;
  return tier === 'free' || tier === 'pro';
}

export function canReview(tier) {
  if (tier === 'paused') return false;
  return tier === 'pro';
}

export function formatTierLabel(tier) {
  if (tier === 'guest') return 'Free (Guest)';
  if (tier === 'free') return 'Free (Account)';
  if (tier === 'pro') return 'Pro';
  if (tier === 'paused') return 'Paused';
  return String(tier ?? '');
}
