import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowRight, FiRefreshCw, FiX } from 'react-icons/fi';
import Header from '../components/Header';
import Seo from '../components/Seo';
import HeroClockBackdrop from '../components/HeroClockBackdrop';
import { useAuth } from '../context/AuthContext';
import { getCurrentTier } from '../services/entitlements';
import { pickRandomEligibleTopic, pushRecentRandomId } from '../lib/surpriseTopic';
import { listTopicsPage } from '../services/topics';
import contentStats from '../generated/contentStats.json';
import './Home.css';

const SLOT_ITEM_HEIGHT = 42;

function randomInt(minInclusive, maxInclusive) {
  const min = Math.ceil(minInclusive);
  const max = Math.floor(maxInclusive);
  if (max < min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

function buildSpinSequenceWithFinalIndex({ pool, finalValue, spins = 18, tailPads = 2 }) {
  const safeFinal = String(finalValue ?? '').trim();
  const baseCount = Math.max(12, spins);
  const base = pickManyFromPool(pool, baseCount);
  const tail = pickManyFromPool(pool, Math.max(0, tailPads));
  const finalItem = safeFinal || base[base.length - 1] || '???';
  const sequence = [...base, finalItem, ...tail];
  const finalIndex = base.length + 1; // 1-based
  return { sequence, finalIndex };
}

function SlotReel({ label, sequence, finalIndex, durationMs, onDone }) {
  const controls = useAnimationControls();
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    const run = async () => {
      await controls.set({ y: 0 });
      // The slot window renders 3 rows, and the highlight is on the middle row.
      // Align the chosen (finalIndex) item to that middle row for 100% visual sync.
      const highlightRowIndex = 2; // 1-based row index within the 3-row window
      const targetY = -Math.max(0, (finalIndex - highlightRowIndex) * SLOT_ITEM_HEIGHT);
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
    <div className="home-slotCol" aria-label={label}>
      <div className="home-slotColLabel" aria-hidden="true">
        {label}
      </div>
      <div className="home-slotWindow" aria-hidden="true">
        <motion.div className="home-slotTrack" animate={controls}>
          {(Array.isArray(sequence) ? sequence : []).map((item, idx) => (
            <div key={`${label}-${idx}-${item}`} className="home-slotItem">
              {item}
            </div>
          ))}
        </motion.div>
        <div className="home-slotHighlight" />
      </div>
    </div>
  );
}

function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tier = getCurrentTier(user);
  const prefersReducedMotion = useReducedMotion();
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [spinOverlay, setSpinOverlay] = useState(null);
  const spinDoneCountRef = useRef(0);
  const spinRunIdRef = useRef(0);

  const stats = contentStats && typeof contentStats === 'object' ? contentStats : { categories: 0, topics: 0, minutes: 0 };
  const categoriesCount = Number(stats.categories ?? 0) || 0;
  const subcategoriesCount = Number(stats.subcategories ?? 0) || 0;
  const topicsCount = Number(stats.topics ?? 0) || 0;

  const fmt = new Intl.NumberFormat(undefined);

  const [ticker, setTicker] = useState({ categories: 0, subcategories: 0, topics: 0 });
  const tickerRafRef = useRef(null);

  useEffect(() => {
    const target = {
      categories: categoriesCount,
      subcategories: subcategoriesCount,
      topics: topicsCount,
    };

    if (prefersReducedMotion) {
      setTicker(target);
      return;
    }

    const durationMs = 900;
    const start = performance.now();

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, Math.max(0, elapsed / durationMs));
      const e = easeOutCubic(t);

      setTicker({
        categories: Math.round(target.categories * e),
        subcategories: Math.round(target.subcategories * e),
        topics: Math.round(target.topics * e),
      });

      if (t < 1) {
        tickerRafRef.current = requestAnimationFrame(tick);
      }
    };

    tickerRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (tickerRafRef.current) cancelAnimationFrame(tickerRafRef.current);
    };
  }, [categoriesCount, subcategoriesCount, topicsCount, prefersReducedMotion]);

  useEffect(() => {
    const open = Boolean(spinOverlay);
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      closeSpinOverlay();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [spinOverlay]);

  function closeSpinOverlay() {
    spinRunIdRef.current += 1;
    setSpinOverlay(null);
    setBusy(false);
  }

  function goToTopic(topicId) {
    const id = String(topicId ?? '').trim();
    if (!id) return;
    pushRecentRandomId(id);
    closeSpinOverlay();
    navigate(`/topic/${id}`);
  }

  async function startSurpriseSpin() {
    if (busy) return;
    setBusy(true);
    setError(null);

    const runId = spinRunIdRef.current + 1;
    spinRunIdRef.current = runId;
    spinDoneCountRef.current = 0;
    setSpinOverlay({ mode: 'loading', line: 'Warming up the slot machine…' });

    try {
      const [topic, poolPage] = await Promise.all([
        pickRandomEligibleTopic({ tier, includeCompleted, avoidRecent: true }),
        listTopicsPage({ limit: 80, offset: 0 }).catch(() => null),
      ]);

      if (spinRunIdRef.current !== runId) return;

      if (!topic?.id) {
        setError("Couldn't find an eligible topic right now.");
        setSpinOverlay(null);
        setBusy(false);
        return;
      }

      if (prefersReducedMotion) {
        setSpinOverlay({ mode: 'reveal', selectedTopic: topic, line: 'Here’s what I picked.' });
        setBusy(false);
        return;
      }

      const poolTopics = Array.isArray(poolPage?.items) ? poolPage.items : [];
      const subjects = uniqueNonEmptyStrings(poolTopics.map((t) => t?.subject)).slice(0, 50);
      const subcategories = uniqueNonEmptyStrings(poolTopics.map((t) => t?.subcategory)).slice(0, 50);
      const titles = uniqueNonEmptyStrings(poolTopics.map((t) => t?.title)).slice(0, 80);

      const safeSubject = String(topic?.subject ?? '').trim() || 'General';
      const safeSubcategory = String(topic?.subcategory ?? '').trim() || 'General';
      const safeTitle = String(topic?.title ?? '').trim() || 'Selected topic';

      const subjectSpin = buildSpinSequenceWithFinalIndex({
        pool: subjects.length ? subjects : ['General', 'Programming Fundamentals', 'AI & Agents', 'Cybersecurity'],
        finalValue: safeSubject,
        spins: 18,
        tailPads: 2,
      });
      const subcategorySpin = buildSpinSequenceWithFinalIndex({
        pool: subcategories.length ? subcategories : ['Basics', 'Core ideas', 'Practical'],
        finalValue: safeSubcategory,
        spins: 20,
        tailPads: 2,
      });
      const titleSpin = buildSpinSequenceWithFinalIndex({
        pool: titles.length ? titles : ['Something unexpectedly useful', 'A tiny idea with big impact', 'A mental model you can reuse'],
        finalValue: safeTitle,
        spins: 22,
        tailPads: 2,
      });

      setSpinOverlay({
        mode: 'spinning',
        line: 'Pulling the lever…',
        selectedTopic: topic,
        spin: {
          subject: { label: 'Category', ...subjectSpin, durationMs: 1700 },
          subcategory: { label: 'Course', ...subcategorySpin, durationMs: 2100 },
          title: { label: 'Topic', ...titleSpin, durationMs: 2600 },
        },
      });
    } catch {
      setError('Something went wrong. Please try again.');
      setSpinOverlay(null);
      setBusy(false);
    }
  }

  async function onSurprise() {
    setSpinOverlay((prev) => prev ?? { mode: 'loading', line: 'Warming up the slot machine…' });
    await startSurpriseSpin();
  }

  return (
    <motion.div
      className="home"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Seo
        title="Learn anything in one minute"
        description="Strict 60-second lessons: pick a topic or get surprised."
        path="/"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: '1 Minute Academy',
            url: typeof window !== 'undefined' ? window.location.origin : undefined,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: '1 Minute Academy',
            url: typeof window !== 'undefined' ? window.location.origin : undefined,
          },
        ]}
      />
      <Header />

      <AnimatePresence>
        {spinOverlay && !prefersReducedMotion && (
          <motion.div
            className="home-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Picking a random topic"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="home-overlayCard"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              {(spinOverlay.mode === 'loading' || spinOverlay.mode === 'spinning') && (
                <button
                  type="button"
                  className="home-overlayClose"
                  onClick={() => {
                    closeSpinOverlay();
                  }}
                  aria-label="Close"
                >
                  <FiX aria-hidden="true" />
                </button>
              )}

              {spinOverlay.mode === 'loading' && (
                <>
                  <div className="home-overlayTitle">Warming up the slot machine…</div>
                  <div className="home-overlayBody">{spinOverlay.line}</div>
                </>
              )}

              {spinOverlay.mode === 'spinning' && (
                <>
                  <div className="home-overlayTitle">Pulling the lever…</div>
                  <div className="home-slot" role="group" aria-label="Random selection slot machine">
                    <SlotReel
                      label={spinOverlay?.spin?.subject?.label ?? 'Subject'}
                      sequence={spinOverlay?.spin?.subject?.sequence ?? []}
                      finalIndex={spinOverlay?.spin?.subject?.finalIndex ?? 1}
                      durationMs={spinOverlay?.spin?.subject?.durationMs ?? 1700}
                      onDone={() => {
                        spinDoneCountRef.current += 1;
                        if (spinDoneCountRef.current >= 3) {
                          setSpinOverlay((prev) => (prev && prev.mode === 'spinning' ? { mode: 'reveal', selectedTopic: prev.selectedTopic, line: 'Jackpot.' } : prev));
                          setBusy(false);
                        }
                      }}
                    />
                    <SlotReel
                      label={spinOverlay?.spin?.subcategory?.label ?? 'Course'}
                      sequence={spinOverlay?.spin?.subcategory?.sequence ?? []}
                      finalIndex={spinOverlay?.spin?.subcategory?.finalIndex ?? 1}
                      durationMs={spinOverlay?.spin?.subcategory?.durationMs ?? 2100}
                      onDone={() => {
                        spinDoneCountRef.current += 1;
                        if (spinDoneCountRef.current >= 3) {
                          setSpinOverlay((prev) => (prev && prev.mode === 'spinning' ? { mode: 'reveal', selectedTopic: prev.selectedTopic, line: 'Jackpot.' } : prev));
                          setBusy(false);
                        }
                      }}
                    />
                    <SlotReel
                      label={spinOverlay?.spin?.title?.label ?? 'Topic'}
                      sequence={spinOverlay?.spin?.title?.sequence ?? []}
                      finalIndex={spinOverlay?.spin?.title?.finalIndex ?? 1}
                      durationMs={spinOverlay?.spin?.title?.durationMs ?? 2600}
                      onDone={() => {
                        spinDoneCountRef.current += 1;
                        if (spinDoneCountRef.current >= 3) {
                          setSpinOverlay((prev) => (prev && prev.mode === 'spinning' ? { mode: 'reveal', selectedTopic: prev.selectedTopic, line: 'Jackpot.' } : prev));
                          setBusy(false);
                        }
                      }}
                    />
                  </div>
                  <div className="home-overlayBody">{spinOverlay.line}</div>
                </>
              )}

              {spinOverlay.mode === 'reveal' && (
                <>
                  <div className="home-overlayTitle">Jackpot.</div>

                  <label className="home-overlayToggle">
                    <input
                      type="checkbox"
                      checked={includeCompleted}
                      onChange={(e) => setIncludeCompleted(e.target.checked)}
                    />
                    <span>Include completed modules</span>
                  </label>

                  <div className="home-picked" role="group" aria-label="Selected topic">
                    <div className="home-pickedEmoji" aria-hidden="true">
                      {String(spinOverlay?.selectedTopic?.emoji ?? '🎯')}
                    </div>
                    <div className="home-pickedMeta">
                      <div className="home-pickedTitle">{String(spinOverlay?.selectedTopic?.title ?? 'Selected topic')}</div>
                      <div className="home-pickedSub">
                        {String(spinOverlay?.selectedTopic?.subject ?? 'General')}
                        {spinOverlay?.selectedTopic?.subcategory ? ` • ${String(spinOverlay.selectedTopic.subcategory)}` : ''}
                        {spinOverlay?.selectedTopic?.difficulty ? ` • ${String(spinOverlay.selectedTopic.difficulty)}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="home-overlayActions">
                    <button type="button" className="home-overlayButton" onClick={() => closeSpinOverlay()}>
                      Not now
                    </button>
                    <button
                      type="button"
                      className="home-overlayButton"
                      onClick={() => startSurpriseSpin()}
                      disabled={busy}
                      title="Pick another random topic"
                    >
                      <FiRefreshCw aria-hidden="true" /> Reroll
                    </button>
                    <button
                      type="button"
                      className="home-overlayButton home-overlayButtonPrimary"
                      onClick={() => goToTopic(spinOverlay?.selectedTopic?.id)}
                    >
                      Take me there <FiArrowRight aria-hidden="true" />
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <main className="home-main">
        <motion.div 
          className="hero"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, type: 'spring' }}
        >
          <HeroClockBackdrop />
          <motion.div 
            className="hero-badge"
            animate={prefersReducedMotion ? undefined : { scale: [1, 1.05, 1] }}
            transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity }}
          >
            <span className="hero-badgeIcon" aria-hidden="true">⏱️</span>
            <span className="hero-badgeText">
              Strictly <span className="hero-badgeStrong">60 seconds</span> <span className="hero-badgeMuted">(no pause)</span>
            </span>
          </motion.div>
          <h1 className="hero-title">
            Learn <span className="accent">Anything</span> in <span className="one-minute accent">One Minute</span>
          </h1>

          <div className="home-direct" aria-label="Start learning">
            <div className="home-directLead">
              Your next minute is ready. Choose your weapon ↓
            </div>

            <div className="home-choices">
              <Link className="home-choice" to="/topics">
                <div className="home-choiceTitle">I’ll pick</div>
                <div className="home-choiceSub">Browse topics and choose what you’re curious about.</div>
                <div className="home-choiceHint" aria-hidden="true">
                  Browse →
                </div>
              </Link>

              <button type="button" className="home-choice home-choice--primary" onClick={onSurprise} disabled={busy}>
                <div className="home-choiceTitle">Surprise me</div>
                <div className="home-choiceSub">Spin a random topic you can access right now.</div>
                <div className="home-choiceHint" aria-hidden="true">
                  {busy ? 'Spinning…' : 'Spin →'}
                </div>
              </button>
            </div>

            <div className="home-reviewsHint" aria-label="Reviews">
              {user ? (
                <Link className="home-reviewsHintLink" to="/reviews?new=1">
                  Leave a review
                </Link>
              ) : (
                <Link className="home-reviewsHintLink" to="/reviews">
                  Read reviews
                </Link>
              )}
            </div>

            {error && <div className="home-error" role="status">{error}</div>}

            <section className="home-stats" aria-label="Learning stats">
              <div className="home-ticker" role="status" aria-live="polite">
                <span className="home-tickerMetric">
                  <span className="home-tickerNum">{fmt.format(ticker.categories)}</span>{' '}
                  <span className="home-tickerLabel">categories</span>
                </span>
                <span className="home-tickerDot" aria-hidden="true">·</span>
                <span className="home-tickerMetric">
                  <span className="home-tickerNum">{fmt.format(ticker.subcategories)}</span>{' '}
                  <span className="home-tickerLabel">subcategories</span>
                </span>
                <span className="home-tickerDot" aria-hidden="true">·</span>
                <span className="home-tickerMetric">
                  <span className="home-tickerNum">{fmt.format(ticker.topics)}</span>{' '}
                  <span className="home-tickerLabel">1-minute lessons</span>
                </span>
              </div>
            </section>
          </div>
        </motion.div>
      </main>
    </motion.div>
  );
}

export default Home;
