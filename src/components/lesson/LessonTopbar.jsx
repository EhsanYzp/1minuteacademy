import React from 'react';

export default function LessonTopbar({
  topicEmoji,
  topicTitle,
  onClose,
  canChoosePresentation,
  storyPresentationStyle,
  onChangeStoryPresentationStyle,
  storyStyleBusy,
  presentationStyleOptions,
  timeRemaining,
}) {
  return (
    <div className="story-topbar">
      <button className="story-close-btn" onClick={onClose} aria-label="Close">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div className="story-topic-title">
        <span className="story-topic-emoji">{topicEmoji || '📚'}</span>
        <span className="story-topic-name">{topicTitle || 'Learning...'}</span>
      </div>
      <div className="story-topbar-right">
        {canChoosePresentation ? (
          <label className="story-style">
            <span className="story-style-label">Style</span>
            <select
              className="story-style-select"
              value={storyPresentationStyle}
              onChange={(e) => onChangeStoryPresentationStyle?.(e.target.value)}
              disabled={storyStyleBusy}
              aria-label="Lesson presentation style"
            >
              {(Array.isArray(presentationStyleOptions) ? presentationStyleOptions : []).map((s) => (
                <option key={s.id} value={s.id} disabled={Boolean(s.disabled)}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="story-timer-large">
          <span className="story-timer-value">
            {Math.floor((Number(timeRemaining) || 0) / 60)}:
            {((Number(timeRemaining) || 0) % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </div>
    </div>
  );
}
