const STATS_KEY = 'oma_local_user_stats_v1';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function readStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { xp: 0, streak: 0, last_completed_date: null };
    const parsed = JSON.parse(raw);
    return {
      xp: Number(parsed.xp ?? 0),
      streak: Number(parsed.streak ?? 0),
      last_completed_date: parsed.last_completed_date ?? null,
    };
  } catch {
    return { xp: 0, streak: 0, last_completed_date: null };
  }
}

function writeStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export async function getLocalUserStats() {
  return readStats();
}

export async function completeLocalTopic({ xp = 50 }) {
  const stats = readStats();
  const today = todayISO();

  let streak = stats.streak ?? 0;
  const last = stats.last_completed_date;

  if (!last) {
    streak = 1;
  } else if (last === today) {
    streak = streak;
  } else {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    streak = last === yesterday ? streak + 1 : 1;
  }

  const next = {
    xp: (stats.xp ?? 0) + Number(xp ?? 0),
    streak,
    last_completed_date: today,
  };

  writeStats(next);
  return { xp: next.xp, streak: next.streak };
}
