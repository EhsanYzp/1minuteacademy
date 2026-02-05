const STATS_KEY = 'oma_local_user_stats_v1';
const TOPIC_PROGRESS_KEY = 'oma_local_topic_progress_v1';
const DEV_TIER_KEY = 'oma_dev_tier';

function getDevTier() {
  try {
    const raw = localStorage.getItem(DEV_TIER_KEY);
    const v = String(raw ?? '').toLowerCase();
    if (v === 'guest' || v === 'free' || v === 'pro') return v;
  } catch {
    // ignore
  }
  return 'guest';
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function readStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { one_ma_balance: 0, streak: 0, last_completed_date: null };
    const parsed = JSON.parse(raw);
    return {
      one_ma_balance: Number(parsed.one_ma_balance ?? parsed.xp ?? 0),
      streak: Number(parsed.streak ?? 0),
      last_completed_date: parsed.last_completed_date ?? null,
    };
  } catch {
    return { one_ma_balance: 0, streak: 0, last_completed_date: null };
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

export async function completeLocalTopic({ topicId, seconds = 60 }) {
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

  const tier = getDevTier();
  const awarded_one_ma = tier === 'pro' ? 1 : 0;

  const next = {
    one_ma_balance: (stats.one_ma_balance ?? 0) + awarded_one_ma,
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

  return { one_ma_balance: next.one_ma_balance, streak: next.streak, awarded_one_ma };
}
