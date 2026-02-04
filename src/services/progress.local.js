const STATS_KEY = 'oma_local_user_stats_v1';
const TOPIC_PROGRESS_KEY = 'oma_local_topic_progress_v1';

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

function readTopicProgress() {
  try {
    const raw = localStorage.getItem(TOPIC_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeTopicProgress(map) {
  localStorage.setItem(TOPIC_PROGRESS_KEY, JSON.stringify(map));
}

export async function getLocalUserStats() {
  return readStats();
}

export async function getLocalTopicProgress() {
  const map = readTopicProgress();
  return Object.entries(map).map(([topic_id, v]) => ({
    topic_id,
    best_seconds: v?.best_seconds ?? null,
    completed_count: Number(v?.completed_count ?? 0),
    last_completed_at: v?.last_completed_at ?? null,
    topics: null,
  }));
}

export async function completeLocalTopic({ topicId, xp = 50, seconds = 60 }) {
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

  if (typeof topicId === 'string' && topicId.length > 0) {
    const map = readTopicProgress();
    const prev = map[topicId] ?? {};
    const prevBest = typeof prev.best_seconds === 'number' ? prev.best_seconds : null;
    const s = Number(seconds);
    const best_seconds = Number.isFinite(s)
      ? prevBest == null
        ? s
        : Math.min(prevBest, s)
      : prevBest;

    map[topicId] = {
      completed_count: Number(prev.completed_count ?? 0) + 1,
      best_seconds,
      last_completed_at: new Date().toISOString(),
    };
    writeTopicProgress(map);
  }

  return { xp: next.xp, streak: next.streak };
}
