import { listTopics, listTopicsPage } from '../services/topics';
import { listUserTopicProgress } from '../services/progress';
import { canStartTopic, canTrackProgress } from '../services/entitlements';

const RECENT_RANDOM_TOPIC_IDS_KEY = 'oma_recent_random_topics';

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function readRecentRandomIds(max = 12) {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(RECENT_RANDOM_TOPIC_IDS_KEY);
  const arr = safeJsonParse(raw, []);
  if (!Array.isArray(arr)) return [];
  return arr.map((v) => String(v)).filter(Boolean).slice(0, max);
}

function writeRecentRandomIds(next) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENT_RANDOM_TOPIC_IDS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function pushRecentRandomId(topicId, max = 12) {
  const id = String(topicId ?? '').trim();
  if (!id) return;
  const prev = readRecentRandomIds(max);
  const next = [id, ...prev.filter((x) => x !== id)].slice(0, max);
  writeRecentRandomIds(next);
}

function randomInt(minInclusive, maxInclusive) {
  const min = Math.ceil(minInclusive);
  const max = Math.floor(maxInclusive);
  if (max < min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function getCompletedTopicIds({ enabled }) {
  if (!enabled) return new Set();
  const rows = await listUserTopicProgress();
  const completed = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    const topicId = row?.topic_id ?? row?.topics?.id;
    const completedCount = Number(row?.completed_count ?? 0) || 0;
    if (!topicId) continue;
    if (completedCount > 0) completed.add(String(topicId));
  }
  return completed;
}

export async function pickRandomEligibleTopic({ tier, includeCompleted = false, avoidRecent = true }) {
  let recentIds = new Set(avoidRecent ? readRecentRandomIds() : []);
  const completedIds = await getCompletedTopicIds({ enabled: !includeCompleted && canTrackProgress(tier) });

  const tryCandidate = (topicRow) => {
    if (!topicRow?.id) return false;
    if (!canStartTopic({ tier, topicRow })) return false;
    const id = String(topicRow.id);
    if (!includeCompleted && completedIds.has(id)) return false;
    if (avoidRecent && recentIds.has(id)) return false;
    return true;
  };

  const tryPick = async () => {
    let total = null;
    try {
      const first = await listTopicsPage({ limit: 1, offset: 0 });
      if (typeof first?.total === 'number') total = first.total;
    } catch {
      // ignore
    }

    if (typeof total === 'number' && total > 0) {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const offset = randomInt(0, total - 1);
        const page = await listTopicsPage({ limit: 1, offset });
        const t = Array.isArray(page?.items) ? page.items[0] : null;
        if (tryCandidate(t)) return t;
      }

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const pageSize = 50;
        const maxOffset = Math.max(0, total - pageSize);
        const offset = randomInt(0, maxOffset);
        const page = await listTopicsPage({ limit: pageSize, offset });
        const items = Array.isArray(page?.items) ? page.items : [];
        const candidates = items.filter(tryCandidate);
        if (candidates.length > 0) return candidates[randomInt(0, candidates.length - 1)];
      }
    }

    const all = await listTopics();
    const candidates = (Array.isArray(all) ? all : []).filter(tryCandidate);
    if (candidates.length === 0) return null;
    return candidates[randomInt(0, candidates.length - 1)];
  };

  const firstPick = await tryPick();
  if (firstPick) return firstPick;

  recentIds = new Set();
  return tryPick();
}
