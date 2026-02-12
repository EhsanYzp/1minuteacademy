import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useAnimationControls } from 'framer-motion';
import { FiArrowRight, FiRefreshCw, FiX } from 'react-icons/fi';
import Header from '../components/Header';
import Seo from '../components/Seo';
import { listTopics, listTopicsPage } from '../services/topics';
import { listUserTopicProgress } from '../services/progress';
import { canStartTopic, canTrackProgress, getCurrentTier } from '../services/entitlements';
import { useAuth } from '../context/AuthContext';
import './LearnPage.css';

const RECENT_RANDOM_TOPIC_IDS_KEY = 'oma_recent_random_topics';
const SLOT_ITEM_HEIGHT = 42;

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

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function uniqueNonEmptyStrings(values) {
  const out = [];
  const seen = new Set();
  for (const v of Array.isArray(values) ? values : []) {
    const s = String(v ?? '').trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function pickManyFromPool(pool, count) {
  const items = [];
  const p = Array.isArray(pool) ? pool.filter(Boolean) : [];
  if (p.length === 0) return items;
  for (let i = 0; i < count; i += 1) items.push(p[randomInt(0, p.length - 1)]);
  return items;
}

function buildSpinSequence({ pool, finalValue, spins = 18, tailPads = 2 }) {
  const safeFinal = String(finalValue ?? '').trim();
  const base = pickManyFromPool(pool, Math.max(12, spins));
  const tail = pickManyFromPool(pool, Math.max(0, tailPads));
  const finalItem = safeFinal || base[base.length - 1] || '???';
  return [...base, finalItem, ...tail];
}

function buildReelItemsFromTopics({ topics, selectedTitle }) {
  const titles = (Array.isArray(topics) ? topics : [])
    .map((t) => String(t?.title ?? '').trim())
    .filter(Boolean);

  const pool = titles.filter((t) => t !== selectedTitle);
  const items = [];
  const wanted = 10;
  for (let i = 0; i < wanted; i += 1) {
    if (pool.length === 0) break;
    items.push(pool[randomInt(0, pool.length - 1)]);
  }

  if (selectedTitle) items.splice(6, 0, selectedTitle);

  const filler = [
    'Something unexpectedly useful',
    'A concept you’ll keep forever',
    'A tiny idea with big impact',
    'A mental model you can reuse',
    'A topic with a fun twist',
    'A shortcut to understanding',
  ];
  while (items.length < 10) items.push(filler[randomInt(0, filler.length - 1)]);

  return items;
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

function SlotReel({ label, sequence, finalIndex, durationMs, onDone }) {
  const controls = useAnimationControls();
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    const run = async () => {
      await controls.set({ y: 0 });
      const targetY = -Math.max(0, (finalIndex - 1) * SLOT_ITEM_HEIGHT);
      await controls.start({
        y: targetY,
        transition: {
          duration: Math.max(0.9, durationMs / 1000),
          ease: [0.12, 0.84, 0.14, 0.98],
        },
      });
      if (doneRef.current) return;
      doneRef.current = true;
      onDone?.();
    };
    run();
    return () => {
      doneRef.current = true;
    };
  }, [controls, durationMs, finalIndex, onDone]);

  return (
    <div className="learn-slotCol" aria-label={label}>
      <div className="learn-slotColLabel" aria-hidden="true">
        {label}
      </div>
      <div className="learn-slotWindow" aria-hidden="true">
        <motion.div className="learn-slotTrack" animate={controls}>
          {(Array.isArray(sequence) ? sequence : []).map((item, idx) => (
            <div key={`${label}-${idx}-${item}`} className="learn-slotItem">
              {item}
            </div>
          ))}
        </motion.div>
        <div className="learn-slotHighlight" />
      </div>
    </div>
  );
}

function LearnHubPageClean() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tier = getCurrentTier(user);

  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [overlay, setOverlay] = useState(null);

  const spinDoneCountRef = useRef(0);
  const overlayOpen = Boolean(overlay);

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

  useEffect(() => {
    if (!overlayOpen) return;
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setOverlay(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [overlayOpen]);

  function goToTopic(topicId) {
    if (!topicId) return;
    navigate(`/topic/${topicId}`);
  }

  async function onSurpriseMe() {
    if (busy) return;
    setBusy(true);

    spinDoneCountRef.current = 0;
    const line = loadingLines[randomInt(0, loadingLines.length - 1)];
    setOverlay({ mode: 'loading', line });

    try {
      const [topic, reelPage] = await Promise.all([
        pickRandomTopic({ tier, includeCompleted }),
        (async () => {
          try {
            const totalProbe = await listTopicsPage({ limit: 1, offset: 0 });
            const total = typeof totalProbe?.total === 'number' ? totalProbe.total : null;
            if (typeof total !== 'number' || total <= 0) return null;
            const limit = 25;
            const offset = randomInt(0, Math.max(0, total - limit));
            return await listTopicsPage({ limit, offset });
          } catch {
            return null;
          }
        })(),
      ]);

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

      if (prefersReducedMotion()) {
        setOverlay({ mode: 'reveal', selectedTopic: topic, line });
        return;
      }

      const selectedTitle = String(topic?.title ?? '').trim() || 'Selected topic';
      const reelItems = buildReelItemsFromTopics({ topics: reelPage?.items ?? [], selectedTitle });

      const subjects = uniqueNonEmptyStrings((reelPage?.items ?? []).map((t) => t?.subject)).slice(0, 20);
      const difficulties = uniqueNonEmptyStrings((reelPage?.items ?? []).map((t) => t?.difficulty)).slice(0, 12);
      const titlePool = uniqueNonEmptyStrings(reelItems).slice(0, 30);

      const subjectPool = subjects.length > 0 ? subjects : ['AI & Agents', 'Cybersecurity', 'Programming Fundamentals', 'Quantum & Physics'];
      const difficultyPool = difficulties.length > 0 ? difficulties : ['Easy', 'Medium', 'Hard'];

      const subjectFinal = String(topic?.subject ?? '').trim() || subjectPool[0];
      const difficultyFinal = String(topic?.difficulty ?? '').trim() || difficultyPool[0];

      const tailPads = 2;
      const subjectSeq = buildSpinSequence({ pool: subjectPool, finalValue: subjectFinal, spins: 22, tailPads });
      const difficultySeq = buildSpinSequence({ pool: difficultyPool, finalValue: difficultyFinal, spins: 18, tailPads });
      const titleSeq = buildSpinSequence({ pool: titlePool, finalValue: selectedTitle, spins: 26, tailPads });

      const subjectFinalIndex = Math.max(1, subjectSeq.length - 1 - tailPads);
      const difficultyFinalIndex = Math.max(1, difficultySeq.length - 1 - tailPads);
      const titleFinalIndex = Math.max(1, titleSeq.length - 1 - tailPads);

      setOverlay({
        mode: 'spinning',
        line,
        selectedTopic: topic,
        spin: {
          subject: { label: 'Subject', sequence: subjectSeq, finalIndex: subjectFinalIndex, durationMs: 2200 },
          difficulty: { label: 'Difficulty', sequence: difficultySeq, finalIndex: difficultyFinalIndex, durationMs: 2500 },
          title: { label: 'Topic', sequence: titleSeq, finalIndex: titleFinalIndex, durationMs: 3000 },
        },
      });
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
      <Seo title="Start learning" description="Choose a topic, or let us surprise you with something new to learn in one minute." path="/learn" />
      <Header />

      <main className="learn-main">
        <section className="learn-hero" aria-label="Learning modes">
          <div className="learn-heroTop">
            <h1 className="learn-title">
              How do you want to learn <span className="learn-titleAccent">today</span>?
            </h1>
          </div>

          <div className="learn-grid">
            <Link className="learn-choice learn-choice--pick" to="/topics">
              <div className="learn-choiceTitle">I want to pick topics myself</div>
              <div className="learn-choiceSub">Browse the library and choose what you’re curious about.</div>
              <div className="learn-choiceHint" aria-hidden="true">
                Browse <FiArrowRight />
              </div>
            </Link>

            <button type="button" className="learn-choice learn-choice--surprise" onClick={onSurpriseMe} disabled={busy}>
              <div className="learn-choiceTitle">You surprise me</div>
              <div className="learn-choiceSub">Spin and pick a random topic I can access right now.</div>
              <div className="learn-choiceHint" aria-hidden="true">
                {busy ? 'Spinning…' : 'Spin'} <FiArrowRight />
              </div>
            </button>
          </div>
        </section>

        {overlayOpen && (
          <div className="learn-overlay" role="dialog" aria-modal="true" aria-label="Random topic picker">
            <div className="learn-overlayBackdrop" onClick={() => setOverlay(null)} aria-hidden="true" />
            <div className="learn-overlayCard">
              <button type="button" className="learn-overlayClose" onClick={() => setOverlay(null)} aria-label="Close">
                <FiX aria-hidden="true" />
              </button>

              {overlay?.mode === 'loading' && (
                <>
                  <div className="learn-overlayTitle">Spinning up…</div>
                  <div className="learn-overlayBody">{overlay.line}</div>
                </>
              )}

              {overlay?.mode === 'spinning' && (
                <>
                  <div className="learn-overlayTitle">Pulling the lever…</div>
                  <div className="learn-slotGrid" aria-label="Slot machine reels">
                    <SlotReel
                      label={overlay?.spin?.subject?.label ?? 'Subject'}
                      sequence={overlay?.spin?.subject?.sequence ?? []}
                      finalIndex={overlay?.spin?.subject?.finalIndex ?? 1}
                      durationMs={overlay?.spin?.subject?.durationMs ?? 2400}
                      onDone={() => {
                        spinDoneCountRef.current += 1;
                        if (spinDoneCountRef.current >= 3) {
                          setOverlay((prev) =>
                            prev && prev.mode === 'spinning'
                              ? { mode: 'reveal', selectedTopic: prev.selectedTopic, line: prev.line }
                              : prev
                          );
                        }
                      }}
                    />
                    <SlotReel
                      label={overlay?.spin?.difficulty?.label ?? 'Difficulty'}
                      sequence={overlay?.spin?.difficulty?.sequence ?? []}
                      finalIndex={overlay?.spin?.difficulty?.finalIndex ?? 1}
                      durationMs={overlay?.spin?.difficulty?.durationMs ?? 2600}
                      onDone={() => {
                        spinDoneCountRef.current += 1;
                        if (spinDoneCountRef.current >= 3) {
                          setOverlay((prev) =>
                            prev && prev.mode === 'spinning'
                              ? { mode: 'reveal', selectedTopic: prev.selectedTopic, line: prev.line }
                              : prev
                          );
                        }
                      }}
                    />
                    <SlotReel
                      label={overlay?.spin?.title?.label ?? 'Topic'}
                      sequence={overlay?.spin?.title?.sequence ?? []}
                      finalIndex={overlay?.spin?.title?.finalIndex ?? 1}
                      durationMs={overlay?.spin?.title?.durationMs ?? 3000}
                      onDone={() => {
                        spinDoneCountRef.current += 1;
                        if (spinDoneCountRef.current >= 3) {
                          setOverlay((prev) =>
                            prev && prev.mode === 'spinning'
                              ? { mode: 'reveal', selectedTopic: prev.selectedTopic, line: prev.line }
                              : prev
                          );
                        }
                      }}
                    />
                  </div>
                  <div className="learn-overlayBody">{overlay.line}</div>
                </>
              )}

              {overlay?.mode === 'reveal' && (
                <>
                  <div className="learn-overlayTitle">Jackpot.</div>
                  <div className="learn-picked" role="group" aria-label="Selected topic">
                    <div className="learn-pickedEmoji" aria-hidden="true">
                      {String(overlay?.selectedTopic?.emoji ?? '🎯')}
                    </div>
                    <div className="learn-pickedMeta">
                      <div className="learn-pickedTitle">{String(overlay?.selectedTopic?.title ?? 'Selected topic')}</div>
                      <div className="learn-pickedSub">
                        {String(overlay?.selectedTopic?.subject ?? 'General')}
                        {overlay?.selectedTopic?.difficulty ? ` • ${String(overlay.selectedTopic.difficulty)}` : ''}
                      </div>
                    </div>
                  </div>

                  <label className="learn-overlayToggle">
                    <input type="checkbox" checked={includeCompleted} onChange={(e) => setIncludeCompleted(e.target.checked)} />
                    <span>Include completed topics (for rerolls)</span>
                  </label>

                  <div className="learn-overlayActions">
                    <button type="button" className="learn-overlayButton" onClick={() => setOverlay(null)}>
                      Not now
                    </button>
                    <button
                      type="button"
                      className="learn-overlayButton"
                      onClick={() => onSurpriseMe()}
                      disabled={busy}
                      title="Pick another random topic"
                    >
                      <FiRefreshCw aria-hidden="true" /> Reroll
                    </button>
                    <button
                      type="button"
                      className="learn-overlayButton learn-overlayButtonPrimary"
                      onClick={() => {
                        const id = overlay?.selectedTopic?.id;
                        if (!id) return;
                        pushRecentRandomId(id);
                        setOverlay(null);
                        goToTopic(id);
                      }}
                    >
                      Take me there <FiArrowRight aria-hidden="true" />
                    </button>
                  </div>
                </>
              )}

              {overlay?.mode && overlay.mode !== 'loading' && overlay.mode !== 'spinning' && overlay.mode !== 'reveal' && (
                <>
                  <div className="learn-overlayTitle">{overlay.title}</div>
                  <div className="learn-overlayBody">{overlay.body}</div>
                  <div className="learn-overlayActions">
                    <button type="button" className="learn-overlayButton" onClick={() => setOverlay(null)}>
                      Close
                    </button>
                    <button type="button" className="learn-overlayButton learn-overlayButtonPrimary" onClick={() => onSurpriseMe()}>
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

export default LearnHubPageClean;
