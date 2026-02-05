function nonEmptyStrings(items) {
  return (Array.isArray(items) ? items : [])
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean);
}

function findFirstBulletsBlockItems(blocks) {
  for (const b of Array.isArray(blocks) ? blocks : []) {
    if (b?.type === 'bullets') return nonEmptyStrings(b?.items);
  }
  return [];
}

export function compileJourneyFromTopic(topicRow) {
  const authored = topicRow?.journey;
  if (authored && typeof authored === 'object') return authored;

  const title = typeof topicRow?.title === 'string' && topicRow.title.trim() ? topicRow.title.trim() : 'Topic';
  const emoji = typeof topicRow?.emoji === 'string' && topicRow.emoji.trim() ? topicRow.emoji.trim() : '🎯';
  const description =
    typeof topicRow?.description === 'string' && topicRow.description.trim()
      ? topicRow.description.trim()
      : 'No description yet.';

  const learningItems = ['⏱️ Designed to fit in 60 seconds', '🎮 Interactive story + quiz', '🪙 Finish and add +1 minute (1MA, Pro)'];

  return {
    version: 1,
    topicStart: {
      blocks: [
        { type: 'hero', title: `${emoji} {topicTitle}`, subtitle: description },
        { type: 'bullets', title: "What you'll learn", items: learningItems },

        // Start actions (deterministic across modules) with runtime `when` gating.
        {
          type: 'ctaRow',
          items: [
            { label: '📚 Review (no timer)', variant: 'primary', action: { type: 'goToReview' }, when: { completed: true, canReview: true } },
            { label: '🔄 Restart from scratch', variant: 'secondary', action: { type: 'startLesson' }, when: { completed: true, canReview: true, canStart: true } },

            { label: '{startLabel}', variant: 'primary', action: { type: 'startLesson' }, when: { canStart: true, canReview: false } },
            { label: '{startLabel}', variant: 'primary', action: { type: 'startLesson' }, when: { canStart: true, canReview: true, completed: false } },

            { label: '⏸️ Account paused', variant: 'primary', action: { type: 'goToProfile' }, when: { tier: 'paused' } },
            { label: '🔒 Upgrade to start', variant: 'primary', action: { type: 'goToUpgrade' }, when: { canStart: false, tier: ['free', 'guest', 'starter', 'basic'] } },
            { label: '👤 Create free account', variant: 'secondary', action: { type: 'goToLogin' }, when: { loggedIn: false } }
          ]
        }
      ]
    },
    completion: {
      blocks: [
        {
          type: 'hero',
          title: 'Congratulations!',
          subtitle: 'You just learned about {topicTitle} in {totalSeconds} seconds!'
        },
        { type: 'completionStats' },
        { type: 'proPerkPanel', when: { tier: ['guest', 'free', 'starter', 'basic', 'paused'] } },
        { type: 'oneMaAwardPanel', when: { tier: 'pro' } },
        { type: 'completionProgress' },
        { type: 'ratingPrompt', title: 'Rate this module' },
        {
          type: 'ctaRow',
          items: [
            { label: '🔄 Try Again', variant: 'primary', action: { type: 'tryAgain' } },
            { label: '📚 Review what you learned', variant: 'secondary', action: { type: 'openReview' }, when: { canReview: true } },
            { label: '🔒 Unlock review mode', variant: 'secondary', action: { type: 'goToUpgrade' }, when: { canReview: false } },
            { label: '🏠 More Topics', variant: 'secondary', action: { type: 'goToTopics' } },
            { label: '🧑‍🚀 Your learning summary', variant: 'secondary', action: { type: 'goToProfile' } }
          ]
        }
      ]
    },
    review: {
      blocks: [
        { type: 'hero', title: '🧠 Review: {topicTitle}', subtitle: 'No timer. Go at your pace.' },
        { type: 'info', text: 'Reinforce the key ideas in under a minute.' },

        { type: 'reviewLesson', when: { canReview: true } },

        { type: 'info', text: '⏸️ Your account is paused. Resume to access review mode.', when: { canReview: false, tier: 'paused' } },
        { type: 'info', text: '🔒 Review mode is Pro-only. Your plan: {tierLabel}', when: { canReview: false, tier: ['guest', 'free', 'starter', 'basic', 'pro'] } },
        {
          type: 'ctaRow',
          items: [
            { label: 'Upgrade', variant: 'primary', action: { type: 'goToUpgrade' }, when: { canReview: false, tier: ['guest', 'free', 'starter', 'basic'] } },
            { label: 'Go to Profile', variant: 'primary', action: { type: 'goToProfile' }, when: { canReview: false, tier: 'paused' } },
            { label: '← Back to module', variant: 'secondary', action: { type: 'goToTopic' } }
          ]
        }
      ]
    }
  };
}

export function getTopicStartLearningPoints(journey) {
  const items = findFirstBulletsBlockItems(journey?.topicStart?.blocks);
  return items.slice(0, 4);
}
