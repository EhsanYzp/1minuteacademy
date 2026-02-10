import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './storyReview.css';

const beatLabels = {
  hook: 'The Hook',
  buildup: 'Buildup',
  discovery: 'Discovery',
  twist: 'The Twist',
  climax: 'Climax',
  punchline: 'Key Insight'
};

function coercePresentationStyle(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'cards' || s === 'split' || s === 'minimal' || s === 'bold' || s === 'dark' || s === 'paper' || s === 'terminal' || s === 'glass') return s;
  return 'focus';
}

export default function StoryReview({
  story,
  title,
  onExit,
  presentationStyle = 'focus',
  canChoosePresentationStyle = false,
  onChangePresentationStyle = null,
  presentationStyleOptions = null,
}) {
  const beats = ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline'];
  const [activeIndex, setActiveIndex] = useState(0);

  const style = coercePresentationStyle(presentationStyle);

  const options = Array.isArray(presentationStyleOptions) && presentationStyleOptions.length
    ? presentationStyleOptions
    : [
        { id: 'focus', label: 'Focus (classic)' },
        { id: 'dark', label: 'Dark (spotlight)' },
        { id: 'cards', label: 'Cards (readable)' },
        { id: 'split', label: 'Split (visual + text)' },
        { id: 'minimal', label: 'Minimal (quiet)' },
        { id: 'bold', label: 'Bold (punchy)' },
        { id: 'paper', label: 'Paper (warm)' },
        { id: 'terminal', label: 'Terminal (code)' },
        { id: 'glass', label: 'Glass (frosted)' },
      ];

  const storyData = story?.story;
  const quiz = story?.quiz;

  if (!storyData) {
    return (
      <div className="story-review">
        <div className="review-topbar">
          <button type="button" className="review-back" onClick={onExit}>
            ← Back
          </button>
          <div className="review-title">Review</div>
          <div className="review-spacer" />
        </div>
        <div className="review-empty">
          <h2>Nothing to review</h2>
          <p>No story content available.</p>
        </div>
      </div>
    );
  }

  const totalItems = beats.length + (quiz ? 1 : 0);
  const isQuiz = activeIndex >= beats.length;
  const beatKey = beats[activeIndex];
  const beatData = storyData[beatKey];

  return (
    <div className={`story-review style-${style}`}>
      {/* Top bar */}
      <div className="review-topbar">
        <button type="button" className="review-back" onClick={onExit}>
          ← Back
        </button>
        <div className="review-title">
          Review{title ? `: ${title}` : ''}
          <div className="review-sub">No timer. Go at your pace.</div>
        </div>
        <div className="review-controls">
          {canChoosePresentationStyle && typeof onChangePresentationStyle === 'function' ? (
            <label className="review-style">
              <span className="review-style-label">Style</span>
              <select
                className="review-style-select"
                value={style}
                onChange={(e) => onChangePresentationStyle(e.target.value)}
                aria-label="Presentation style"
              >
                {options.map((opt) => (
                  <option key={opt.id} value={String(opt.id)} disabled={Boolean(opt.disabled)}>
                    {String(opt.label ?? opt.id)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="review-spacer" />
          )}
        </div>
      </div>

      {/* Content - same layout as StoryRenderer */}
      <AnimatePresence mode="wait">
        {!isQuiz ? (
          <motion.div
            key={beatKey}
            className="story-review-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="story-review-inner">
              <div className="story-review-label">{beatLabels[beatKey]}</div>
              <div className="story-review-visual">{beatData?.visual}</div>
              <p className="story-review-text">{beatData?.text}</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="quiz"
            className="story-review-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="story-review-inner">
              <div className="story-review-label">Quiz Question</div>
              <p className="story-review-question">{quiz.question}</p>
              <div className="story-review-options">
                {quiz.options.map((opt, i) => (
                  <div
                    key={i}
                    className={`story-review-option ${i === quiz.correct ? 'correct' : ''}`}
                  >
                    {i === quiz.correct && <span className="correct-mark">✓</span>}
                    {opt}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div className="story-review-nav">
        <button
          type="button"
          className="review-nav-btn"
          disabled={activeIndex === 0}
          onClick={() => setActiveIndex(i => i - 1)}
        >
          ← Previous
        </button>
        <span className="review-nav-count">{activeIndex + 1} / {totalItems}</span>
        <button
          type="button"
          className="review-nav-btn"
          disabled={activeIndex >= totalItems - 1}
          onClick={() => setActiveIndex(i => i + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
