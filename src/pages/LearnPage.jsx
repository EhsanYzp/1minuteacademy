import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../components/Header';
import Seo from '../components/Seo';
import { listTopics, listTopicsPage } from '../services/topics';
import { listUserTopicProgress } from '../services/progress';
import { canStartTopic, canTrackProgress, getCurrentTier } from '../services/entitlements';
import { useAuth } from '../context/AuthContext';
import './LearnPage.css';

const RECENT_RANDOM_TOPIC_IDS_KEY = 'oma_recent_random_topics';

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function readRecentRandomIds(max = 12) {
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

function pushRecentRandomId(topicId, max = 12) {
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

async function pickRandomTopic({ tier, includeCompleted }) {
  let recentIds = new Set(readRecentRandomIds());
  const completedIds = await getCompletedTopicIds({ enabled: !includeCompleted && canTrackProgress(tier) });

  const tryCandidate = (topicRow) => {
    if (!topicRow?.id) return false;
    if (!canStartTopic({ tier, topicRow })) return false;
    const id = String(topicRow.id);
    if (!includeCompleted && completedIds.has(id)) return false;
    if (recentIds.has(id)) return false;
    return true;
  };

  const tryPick = async () => {
    // Fast path: if we can get a reliable total, sample offsets.
    let total = null;
    try {
      const first = await listTopicsPage({ limit: 1, offset: 0 });
      if (typeof first?.total === 'number') total = first.total;
    } catch {
      // ignore and fall back
    }

    if (typeof total === 'number' && total > 0) {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const offset = randomInt(0, total - 1);
        const page = await listTopicsPage({ limit: 1, offset });
        const t = Array.isArray(page?.items) ? page.items[0] : null;
        if (tryCandidate(t)) return t;
      }

      // Fallback: sample a wider page and choose from it.
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const pageSize = 50;
        const maxOffset = Math.max(0, total - pageSize);
        const offset = randomInt(0, maxOffset);
        const page = await listTopicsPage({ limit: pageSize, offset });
        const items = Array.isArray(page?.items) ? page.items : [];
        const candidates = items.filter(tryCandidate);
        if (candidates.length > 0) {
          return candidates[randomInt(0, candidates.length - 1)];
        }
      }
    }

    // Last resort: pull all topics (works for Local Preview / small catalogs).
    const all = await listTopics();
    const candidates = (Array.isArray(all) ? all : []).filter(tryCandidate);
    if (candidates.length === 0) return null;
    return candidates[randomInt(0, candidates.length - 1)];
  };

  const firstPick = await tryPick();
  if (firstPick) return firstPick;

  // If we couldn't find anything, allow repeats (useful for small catalogs).
  recentIds = new Set();
  return tryPick();
}

function LearnPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tier = getCurrentTier(user);

  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [overlay, setOverlay] = useState(null);

  const loadingLines = useMemo(
    () => [
      'Shuffling the knowledge deck…',
      'Rolling the learning dice…',
      'Spinning the curiosity compass…',
      'Finding your next "aha" moment…',
      'Picking something surprisingly useful…',
    ],
    []
  );

  async function onSurpriseMe() {
    if (busy) return;
    setBusy(true);

    const startedAt = Date.now();
    const line = loadingLines[randomInt(0, loadingLines.length - 1)];
    setOverlay({ mode: 'loading', line });

    try {
      const topic = await pickRandomTopic({ tier, includeCompleted });

      // Keep the loading screen on long enough to feel intentional.
      const minMs = 900;
      const elapsed = Date.now() - startedAt;
      if (elapsed < minMs) await new Promise((r) => setTimeout(r, minMs - elapsed));

      if (!topic?.id) {
        setOverlay({
          mode: 'empty',
          title: includeCompleted ? 'No topics found' : "You're all caught up!",
          body: includeCompleted
            ? 'We could not find an eligible topic right now. Try again in a moment.'
            : 'It looks like you have completed every topic available to you. Toggle “Include completed” to revisit favorites.',
        });
        return;
      }

      pushRecentRandomId(topic.id);
      navigate(`/topic/${topic.id}`);
    } catch {
      setOverlay({
        mode: 'error',
        title: 'Could not pick a topic',
        body: 'Please try again. If the issue persists, refresh the page.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div className="learn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Seo
        title="Start learning"
        description="Choose a topic, or let us surprise you with something new to learn in one minute."
        path="/learn"
      />
      <Header />

      <main className="learn-main">
        <section className="learn-hero" aria-label="Learning modes">
          <div className="learn-heroTop">
            <div className="learn-badge">Pick your vibe</div>
            <h1 className="learn-title">How do you want to learn today?</h1>
            <p className="learn-subtitle">Choose a topic yourself — or let the platform surprise you with something you haven’t completed.</p>
          </div>

          <div className="learn-grid">
            <motion.div className="learn-card" whileHover={{ y: -4 }} whileTap={{ scale: 0.99 }}>
              <div className="learn-cardIcon" aria-hidden="true">🧭</div>
              <h2 className="learn-cardTitle">Learn a new topic myself</h2>
              <p className="learn-cardBody">Browse subjects, filter by difficulty, and pick exactly what you want.</p>
              <Link className="learn-cardCta" to="/topics">
                Browse topics
              </Link>
            </motion.div>

            <motion.div className="learn-card learn-card-surprise" whileHover={{ y: -4 }} whileTap={{ scale: 0.99 }}>
              <div className="learn-cardIcon" aria-hidden="true">🎲</div>
              <h2 className="learn-cardTitle">Surprise me</h2>
              <p className="learn-cardBody">We’ll randomly pick a topic you can access — and (by default) one you haven’t completed yet.</p>

              <label className="learn-toggle">
                <input
                  type="checkbox"
                  checked={includeCompleted}
                  onChange={(e) => setIncludeCompleted(e.target.checked)}
                />
                <span>Include completed topics</span>
              </label>

              <button type="button" className="learn-cardCta learn-cardButton" onClick={onSurpriseMe} disabled={busy}>
                {busy ? 'Picking…' : 'Teach me something random'}
              </button>
            </motion.div>
          </div>
        </section>

        {overlay && (
          <div className="learn-overlay" role="dialog" aria-modal="true" aria-label="Picking a random topic">
            <div className="learn-overlayCard">
              {overlay.mode === 'loading' && (
                <>
                  <div className="learn-spinner" aria-hidden="true" />
                  <div className="learn-overlayTitle">Finding your next topic…</div>
                  <div className="learn-overlayBody">{overlay.line}</div>
                </>
              )}

              {overlay.mode !== 'loading' && (
                <>
                  <div className="learn-overlayTitle">{overlay.title}</div>
                  <div className="learn-overlayBody">{overlay.body}</div>
                  <div className="learn-overlayActions">
                    <button type="button" className="learn-overlayButton" onClick={() => setOverlay(null)}>
                      Close
                    </button>
                    <button
                      type="button"
                      className="learn-overlayButton learn-overlayButtonPrimary"
                      onClick={() => {
                        setOverlay(null);
                        onSurpriseMe();
                      }}
                    >
                      Try again
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </motion.div>
  );
}

export default LearnPage;
