export const EXPERT_BADGES = [
  { minutes: 1, emoji: '🌱', name: 'Seedling' },
  { minutes: 2, emoji: '🪴', name: 'Sprout' },
  { minutes: 3, emoji: '✨', name: 'Spark' },
  { minutes: 4, emoji: '🧠', name: 'Mind Awake' },
  { minutes: 5, emoji: '🔥', name: 'Warm‑Up' },
  { minutes: 7, emoji: '⚙️', name: 'Momentum' },
  { minutes: 10, emoji: '⚡️', name: 'Charged' },
  { minutes: 12, emoji: '🧭', name: 'Explorer' },
  { minutes: 15, emoji: '🧩', name: 'Pattern Finder' },
  { minutes: 20, emoji: '🚀', name: 'Lift‑Off' },
  { minutes: 25, emoji: '🎯', name: 'On Target' },
  { minutes: 30, emoji: '🏃‍♂️', name: 'Steady Pace' },
  { minutes: 40, emoji: '🛡️', name: 'Reliable' },
  { minutes: 50, emoji: '💎', name: 'Polished' },
  { minutes: 60, emoji: '⏱️', name: 'One‑Hour Expert' },
  { minutes: 75, emoji: '🌊', name: 'Flow State' },
  { minutes: 90, emoji: '🧪', name: 'Experimenter' },
  { minutes: 100, emoji: '🏅', name: 'Centurion' },
  { minutes: 125, emoji: '📚', name: 'Scholar' },
  { minutes: 150, emoji: '🔭', name: 'Deep Focus' },
  { minutes: 200, emoji: '🧱', name: 'Builder' },
  { minutes: 250, emoji: '🗺️', name: 'Trailblazer' },
  { minutes: 300, emoji: '🦾', name: 'Unstoppable' },
  { minutes: 400, emoji: '🌟', name: 'Standout' },
  { minutes: 500, emoji: '🎖️', name: 'Master' },
  { minutes: 600, emoji: '🏛️', name: 'Architect' },
  { minutes: 750, emoji: '🧬', name: 'Specialist' },
  { minutes: 1000, emoji: '👑', name: 'Legend' },
  { minutes: 1500, emoji: '🪐', name: 'Mythic' },
  { minutes: 2000, emoji: '🏆', name: 'Grandmaster' },
];

export function getUnlockedBadges(minutes) {
  const n = Math.max(0, Math.floor(Number(minutes) || 0));
  return EXPERT_BADGES.filter((b) => n >= (Number(b.minutes) || 0));
}

export function getNextBadge(minutes) {
  const n = Math.max(0, Math.floor(Number(minutes) || 0));
  return EXPERT_BADGES.find((b) => (Number(b.minutes) || 0) > n) ?? null;
}

export function getNewlyUnlockedBadges(prevMinutes, nextMinutes) {
  const prev = Math.max(0, Math.floor(Number(prevMinutes) || 0));
  const next = Math.max(0, Math.floor(Number(nextMinutes) || 0));
  if (next <= prev) return [];
  return EXPERT_BADGES.filter((b) => prev < (Number(b.minutes) || 0) && next >= (Number(b.minutes) || 0));
}
